import { redirectMindMapIntent } from '../navigation/mindMapIntent';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  // File intents are imported by ShareIntentProvider, not resolved as app routes.
  // On a running app, ignore the URL so it cannot override the import destination.
  if (/^(content|file):\/\//i.test(path)) return initial ? '/' : '';
  return redirectMindMapIntent(path);
}
