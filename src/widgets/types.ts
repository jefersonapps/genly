import type { Task } from '../db/schema';

// Widgets never render rich text or attachments. Avoid reading large note and
// mind-map bodies just to show ten titles on the launcher.
export type WidgetTask = Pick<Task, 'id' | 'title' | 'deliveryDate' | 'deliveryTime' | 'completed'>;
