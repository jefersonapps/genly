export const GROUP_ICON_NAMES = ['folder', 'home', 'work', 'books', 'art', 'games', 'star', 'flame', 'idea', 'brain', 'cards', 'note'] as const;
export type GroupIconName = typeof GROUP_ICON_NAMES[number];
// Preserve existing groups without a database migration.
const legacy: Record<string, GroupIconName> = { '📁': 'folder', '🏠': 'home', '💼': 'work', '📚': 'books', '🎨': 'art', '🎮': 'games', '🌟': 'star', '🔥': 'flame', '💡': 'idea', '🧠': 'brain', '🗂️': 'cards', '🃏': 'cards', '📝': 'note' };
export function resolveGroupIcon(value?: string | null) {
  return legacy[value || ''] || (value && GROUP_ICON_NAMES.includes(value as GroupIconName) ? value as GroupIconName : 'folder');
}
