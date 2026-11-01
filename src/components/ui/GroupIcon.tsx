import { resolveGroupIcon } from "@/utils/groupIcons";
import { BookOpen, Brain, Briefcase, FileText, Flame, Folder, Gamepad2, House, Layers, Lightbulb, Palette, Star } from 'lucide-react-native';

export { resolveGroupIcon } from "@/utils/groupIcons";

const icons = { folder: Folder, home: House, work: Briefcase, books: BookOpen, art: Palette, games: Gamepad2, star: Star, flame: Flame, idea: Lightbulb, brain: Brain, cards: Layers, note: FileText };
export const GROUP_ICONS = Object.keys(icons);
export function GroupIcon({ value, size = 24, color = '#a1a1aa' }: { value?: string | null; size?: number; color?: string }) {
  const Icon = icons[resolveGroupIcon(value)];
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}
