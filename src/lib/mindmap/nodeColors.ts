export function hexLuminance(hex: string): number {
  'worklet';
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function getNodeTextColor(depth: number, isDark: boolean, customColor?: string): string {
  'worklet';
  if (customColor) return hexLuminance(customColor) > 0.5 ? '#1F2937' : '#FFFFFF';
  if (depth === 0) return '#FFFFFF';
  return isDark ? '#E5E7EB' : '#1F2937';
}

