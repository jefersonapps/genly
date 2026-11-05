export type ShapeTool = 'circle' | 'rectangle' | 'line';
export type ShapeDraft = { kind: ShapeTool; start: { x: number; y: number }; end: { x: number; y: number } };
type ShapeGeometry = { x: number; y: number; width: number; height: number; shapeKind?: ShapeTool; shapeStart?: { x: number; y: number }; shapeEnd?: { x: number; y: number } };
export type EditorTool = 'text' | 'image' | 'brush' | 'eraser' | ShapeTool | null;

export const ANGLE_SNAP_TOLERANCE = 5;

export function snapRightAngle(angle: number) {
  'worklet';
  const nearest = Math.round(angle / 90) * 90;
  return Math.abs(angle - nearest) <= ANGLE_SNAP_TOLERANCE ? (nearest || 0) : angle;
}

export function snapLineEnd(start: { x: number; y: number }, end: { x: number; y: number }) {
  'worklet';
  const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
  const snapped = snapRightAngle(angle);
  if (snapped % 90 !== 0) return end;
  return snapped % 180 === 0 ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
}

/** Diagonal lines snap by their visible direction, not just their box rotation. */
export function snapObjectRotation(rotation: number, object: ShapeGeometry & { type?: string }) {
  'worklet';
  let direction = 0;
  if (object.type === 'shape' && object.shapeKind === 'line') {
    const start = object.shapeStart || { x: 0, y: 0.5 };
    const end = object.shapeEnd || { x: 1, y: 0.5 };
    direction = Math.atan2((end.y - start.y) * object.height, (end.x - start.x) * object.width) * 180 / Math.PI;
  }
  const visibleAngle = rotation + direction;
  const snapped = snapRightAngle(visibleAngle);
  return snapped === visibleAngle ? rotation : snapped - direction;
}

export function isCanvasTool(tool: EditorTool) {
  'worklet';
  return tool === 'brush' || tool === 'eraser' || tool === 'circle' || tool === 'rectangle' || tool === 'line';
}

/** Shapes use the same SVG paths, colors and stroke widths as freehand drawing. */
export function shapePath(tool: ShapeTool, start: { x: number; y: number }, end: { x: number; y: number }) {
  'worklet';
  if (tool === 'line') return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (tool === 'rectangle') return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
  const radius = Math.min(width, height) / 2;
  if (radius === 0) return '';
  // Four cubic segments keep circles compatible with Skia and pdf-lib.
  const cx = start.x + Math.sign(end.x - start.x) * radius;
  const cy = start.y + Math.sign(end.y - start.y) * radius;
  const k = radius * 0.5522847498307936;
  return `M ${cx + radius} ${cy} C ${cx + radius} ${cy + k} ${cx + k} ${cy + radius} ${cx} ${cy + radius} C ${cx - k} ${cy + radius} ${cx - radius} ${cy + k} ${cx - radius} ${cy} C ${cx - radius} ${cy - k} ${cx - k} ${cy - radius} ${cx} ${cy - radius} C ${cx + k} ${cy - radius} ${cx + radius} ${cy - k} ${cx + radius} ${cy} Z`;
}

export function shapeBounds({ kind, start, end: rawEnd }: ShapeDraft) {
  const end = kind === 'line' ? snapLineEnd(start, rawEnd) : rawEnd;
  if (kind === 'circle') {
    const size = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
    return { shapeKind: kind, x: end.x < start.x ? start.x - size : start.x,
      y: end.y < start.y ? start.y - size : start.y, width: size, height: size };
  }
  // A minimum touch target also keeps horizontal/vertical lines easy to select.
  const width = Math.max(kind === 'line' ? 20 : 1, Math.abs(end.x - start.x));
  const height = Math.max(kind === 'line' ? 20 : 1, Math.abs(end.y - start.y));
  const x = Math.min(start.x, end.x) - (width - Math.abs(end.x - start.x)) / 2;
  const y = Math.min(start.y, end.y) - (height - Math.abs(end.y - start.y)) / 2;
  return { shapeKind: kind, x, y, width, height,
    shapeStart: { x: (start.x - x) / width, y: (start.y - y) / height },
    shapeEnd: { x: (end.x - x) / width, y: (end.y - y) / height } };
}

/** Rebuild geometry after moving/resizing; stroke thickness is kept independent. */
export function shapeAnnotationPath(shape: ShapeGeometry, local = false) {
  const { width: w, height: h } = shape;
  const x = local ? 0 : shape.x;
  const y = local ? 0 : shape.y;
  if (shape.shapeKind === 'line') {
    const start = shape.shapeStart || { x: 0, y: 0.5 };
    const end = shape.shapeEnd || { x: 1, y: 0.5 };
    return shapePath('line', { x: x + start.x * w, y: y + start.y * h }, { x: x + end.x * w, y: y + end.y * h });
  }
  if (shape.shapeKind === 'rectangle') return shapePath('rectangle', { x, y }, { x: x + w, y: y + h });
  const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
  const kx = rx * 0.5522847498307936, ky = ry * 0.5522847498307936;
  return `M ${cx + rx} ${cy} C ${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry} C ${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy} C ${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry} C ${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy} Z`;
}

export function shapeRotationMatrix(shape: ShapeGeometry & { rotation?: number }) {
  const angle = (shape.rotation || 0) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2;
  return [c, -s, cx - c * cx + s * cy, s, c, cy - s * cx - c * cy, 0, 0, 1];
}
