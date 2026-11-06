type Box = { x: number; y: number; width: number; height: number; rotation?: number };

/** Prefer a copy alongside the original while keeping it reachable on the page. */
export function duplicatePosition(item: Box, page: { width: number; height: number }, gap: number) {
  const radians = (item.rotation || 0) * Math.PI / 180;
  const visualWidth = Math.abs(item.width * Math.cos(radians)) + Math.abs(item.height * Math.sin(radians));
  const visualHeight = Math.abs(item.width * Math.sin(radians)) + Math.abs(item.height * Math.cos(radians));
  const minX = Math.max(0, (visualWidth - item.width) / 2);
  const minY = Math.max(0, (visualHeight - item.height) / 2);
  const maxX = Math.max(minX, page.width - (item.width + visualWidth) / 2);
  const maxY = Math.max(minY, page.height - (item.height + visualHeight) / 2);
  const y = Math.max(minY, Math.min(item.y, maxY));
  const right = item.x + visualWidth + gap;
  if (right >= minX && right <= maxX) return { x: right, y };
  const left = item.x - visualWidth - gap;
  if (left >= minX && left <= maxX) return { x: left, y };
  return { x: Math.max(minX, Math.min(item.x + gap, maxX)), y: Math.max(minY, Math.min(item.y + gap, maxY)) };
}
