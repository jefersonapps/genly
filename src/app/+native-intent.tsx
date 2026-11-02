import { redirectMindMapIntent } from '@/navigation/mindMapIntent';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return redirectMindMapIntent(path);
}
