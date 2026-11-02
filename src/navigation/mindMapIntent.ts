let session = 0;

/** Repeated taps on a widget's fixed URI must create different editor sessions. */
export function redirectMindMapIntent(path: string): string {
  try {
    const url = new URL(path, 'genly://app');
    const isMap = url.pathname === '/tools/mind-map' || (url.hostname === 'tools' && url.pathname === '/mind-map');
    const create = url.searchParams.get('newMap') === '1' || (url.searchParams.get('source') === 'widget' && !url.searchParams.has('taskId'));
    if (!isMap || !create) return path;
    url.searchParams.delete('taskId');
    url.searchParams.set('mapSession', `${Date.now()}-${++session}`);
    return `/tools/mind-map?${url.searchParams.toString()}`;
  } catch { return path; }
}
