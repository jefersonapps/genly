/** Give the current frame priority; cancellation also guards already queued work. */
export function scheduleIdleTask(task: () => void, timeout = 200): () => void {
  let cancelled = false;
  const run = () => { if (!cancelled) task(); };
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout });
    return () => { cancelled = true; cancelIdleCallback(id); };
  }
  const id = setTimeout(run, 0);
  return () => { cancelled = true; clearTimeout(id); };
}
