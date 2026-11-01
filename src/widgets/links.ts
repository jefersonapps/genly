/** Mark widget entries while preserving the destination's parameters. */
export function createWidgetLink(path: string, params: Record<string, string | number> = {}) {
  const query = Object.entries({ ...params, source: 'widget' })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `genly://${path.replace(/^\//, '')}?${query}`;
}
