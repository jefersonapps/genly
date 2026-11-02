export interface MindMapDocument {
  nodes: { id: string; title: string; imageUri?: string }[];
  rootId: string | null;
  canvasBgColor: string | null;
  bgPattern: string;
}
export type AutosaveState = 'saved' | 'pending' | 'saving' | 'error' | 'empty';

export function hasMindMapContent(document: MindMapDocument): boolean {
  return document.nodes.some(node => Boolean(node.imageUri) ||
    (node.title.trim().length > 0 && !['ideia central', 'novo tópico'].includes(node.title.trim().toLocaleLowerCase('pt-BR'))));
}

/** One writer per map session. New edits arriving during a write are saved next. */
export class MindMapAutosave {
  private latest = '';
  private saved = '';
  private allowCreate = false;
  private timer?: ReturnType<typeof setTimeout>;
  private writing: Promise<void> | null = null;
  id: number | null;

  constructor(id: number | null, private write: (id: number | null, document: MindMapDocument) => Promise<number | null>,
    private status: (state: AutosaveState, id: number | null) => void) { this.id = id; this.allowCreate = id !== null; }

  initialize(document: MindMapDocument) { this.latest = this.saved = JSON.stringify(document); }

  update(document: MindMapDocument, hasUserText: boolean) {
    this.latest = JSON.stringify(document);
    this.allowCreate ||= hasUserText;
    if (!this.shouldPersist()) {
      clearTimeout(this.timer);
      this.status(hasMindMapContent(document) ? 'saved' : 'empty', this.id);
      return;
    }
    this.status('pending', this.id);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 350);
  }

  private shouldPersist() {
    if (!this.latest) return false;
    const document = JSON.parse(this.latest) as MindMapDocument;
    // An existing note must be removed even when it was already empty on load.
    if (!hasMindMapContent(document)) return this.id !== null;
    return this.latest !== this.saved && (this.id !== null || this.allowCreate || document.nodes.some(node => Boolean(node.imageUri)));
  }

  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.writing) { await this.writing; return this.flush(); }
    if (!this.shouldPersist()) return;
    this.writing = (async () => {
      try {
        while (this.shouldPersist()) {
          const snapshot = this.latest;
          this.status('saving', this.id);
          this.id = await this.write(this.id, JSON.parse(snapshot));
          this.allowCreate ||= this.id !== null;
          this.saved = snapshot;
        }
        this.status(hasMindMapContent(JSON.parse(this.latest)) ? 'saved' : 'empty', this.id);
      } catch (error) { this.status('error', this.id); throw error; }
    })();
    try { await this.writing; } finally { this.writing = null; if (this.latest === this.saved) clearTimeout(this.timer); }
  }
}
