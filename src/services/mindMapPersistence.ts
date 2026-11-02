import { hasMindMapContent, type MindMapDocument } from '@/lib/mindmap/autosave';
import { createGroup, createTask, deleteTask, getGroupByName, updateTask } from './taskService';

export async function saveMindMapDocument(id: number | null, document: MindMapDocument): Promise<number | null> {
  if (!hasMindMapContent(document)) {
    if (id !== null) await deleteTask(id);
    return null;
  }
  const group = await getGroupByName('Mapas Mentais') || await createGroup('Mapas Mentais', 'brain', '#8B5CF6');
  const root = document.nodes.find(node => node.id === document.rootId);
  const placeholder = (title: string) => ['Ideia Central', 'Novo tópico'].includes(title.trim());
  const title = (root?.title.trim() && !placeholder(root.title) ? root.title.trim()
    : document.nodes.find(node => node.title.trim() && !placeholder(node.title))?.title.trim()) || root?.title.trim() || 'Mapa mental';
  const content = JSON.stringify(document);
  if (id !== null) { await updateTask(id, { title, content, groupId: group.id }); return id; }
  return (await createTask(title, content, group.id)).id;
}
