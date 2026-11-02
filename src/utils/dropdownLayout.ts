export interface DropdownRect { x: number; y: number; width: number; height: number }
interface Bounds { width: number; height: number }
interface Insets { top: number; right: number; bottom: number; left: number }
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(value, maximum));

export function anchorInDropdownWindow(trigger: DropdownRect, origin: { x: number; y: number }): DropdownRect {
  return { ...trigger, x: trigger.x - origin.x, y: trigger.y - origin.y };
}

export function dropdownLayout({ anchor, viewport, insets, width, contentHeight, maxHeight = 320, align = 'start', direction = 'bottom' }: {
  anchor: DropdownRect; viewport: Bounds; insets: Insets; width: number;
  contentHeight?: number; maxHeight?: number;
  align?: 'start' | 'end' | 'center'; direction?: 'top' | 'bottom';
}) {
  const margin = 10, gap = 8;
  const leftEdge = Math.min(insets.left + margin, Math.max(0, viewport.width - 1));
  const rightEdge = Math.max(leftEdge + 1, viewport.width - insets.right - margin);
  const topEdge = Math.min(insets.top + margin, Math.max(0, viewport.height - 1));
  const bottomEdge = Math.max(topEdge + 1, viewport.height - insets.bottom - margin);
  const menuWidth = Math.max(1, Math.min(width, rightEdge - leftEdge));
  const desiredHeight = Math.max(1, Math.min(contentHeight ?? maxHeight, maxHeight, bottomEdge - topEdge));
  const below = Math.max(0, bottomEdge - (anchor.y + anchor.height + gap));
  const above = Math.max(0, anchor.y - gap - topEdge);
  const preferred = direction === 'top' ? above : below;
  const opposite = direction === 'top' ? below : above;
  const side = preferred >= desiredHeight || preferred >= opposite ? direction : direction === 'top' ? 'bottom' : 'top';
  const available = side === 'top' ? above : below;
  // In a very short window, overlap the anchor rather than leave no usable row.
  const overlap = available < Math.min(48, desiredHeight);
  const height = Math.min(desiredHeight, overlap ? bottomEdge - topEdge : available);
  const desiredTop = overlap ? anchor.y : side === 'top' ? anchor.y - gap - height : anchor.y + anchor.height + gap;
  const desiredLeft = align === 'end' ? anchor.x + anchor.width - menuWidth : align === 'center' ? anchor.x + (anchor.width - menuWidth) / 2 : anchor.x;
  return {
    left: clamp(desiredLeft, leftEdge, rightEdge - menuWidth),
    top: clamp(desiredTop, topEdge, bottomEdge - height),
    width: menuWidth, height, direction: side,
  };
}
