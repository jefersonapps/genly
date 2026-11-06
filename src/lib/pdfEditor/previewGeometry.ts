export type PreviewRect = { x: number; y: number; width: number; height: number };
export type PreviewPageFrame = PreviewRect & { viewWidth: number; viewHeight: number };
export type PreviewGeometry = {
  pixelRatio: number;
  pages: Record<number, PreviewPageFrame>;
  objects: Record<string, PreviewRect>;
};

/** Android's PDF renderer fits and centers a page using integer physical pixels. */
export function renderedPageFrame(view: { width: number; height: number },
  viewport: { width: number; height: number }, nativePagePixels?: { width: number; height: number }, pixelRatio = 1): PreviewPageFrame {
  const width = nativePagePixels ? nativePagePixels.width / pixelRatio : viewport.width;
  const height = nativePagePixels ? nativePagePixels.height / pixelRatio : viewport.height;
  return { x: (viewport.width - width) / 2, y: (viewport.height - height) / 2,
    width, height, viewWidth: view.width, viewHeight: view.height };
}

/** Ignore stale layout events from objects changed while their page was unmounted. */
export function renderedObjectBounds<T extends PreviewRect>(object: T, measured: PreviewRect | undefined, pixelRatio: number): T {
  if (!measured) return object;
  const tolerance = 1 / pixelRatio + 0.0001;
  if (['x', 'y', 'width', 'height'].some(key => Math.abs(object[key as keyof PreviewRect] - measured[key as keyof PreviewRect]) > tolerance)) return object;
  return { ...object, ...measured };
}

/** Correct the existing PDF-space mapping to match the actual native page rectangle. */
export function previewPageCorrection(pdf: { width: number; height: number }, frame: PreviewPageFrame) {
  const referenceScale = pdf.width / frame.viewWidth;
  const sx = pdf.width / frame.width;
  const sy = pdf.height / frame.height;
  const scaleX = sx / referenceScale;
  const scaleY = sy / referenceScale;
  return { scaleX, scaleY, x: -frame.x * sx, y: pdf.height * (1 - scaleY) + frame.y * sy };
}

export function insertPageGeometry<T>(pages: Record<number, T>, index: number): Record<number, T> {
  return Object.fromEntries(Object.entries(pages).map(([page, value]) => [Number(page) >= index ? Number(page) + 1 : Number(page), value]));
}
