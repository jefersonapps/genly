import { triggerAllWidgetsUpdate } from '../widgets/widget-task-handler';

/**
 * Refresh all widget types after data changes.
 * Called from taskService after create/update/delete operations.
 * Silently catches errors to not interfere with the main operation.
 */
export async function refreshAllWidgets(): Promise<void> {
  try {
    await triggerAllWidgetsUpdate();
  } catch (e) {
    // Silently fail — widget updates should never break the app
    console.warn('Failed to refresh widgets:', e);
  }
}
