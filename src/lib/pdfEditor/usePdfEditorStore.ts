import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────
export type AnnotationType = 'text' | 'image' | 'drawing';

export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'button' | 'listbox';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | boolean | string[];
  options?: string[]; // For dropdowns/radios
  optionValue?: string; // For radios (this specific button's value)
  fontSize?: number;    // Extracted from PDF or calculated
  autoSize?: boolean;   // If true, font should scale to fit height
  maxLength?: number;   // For text fields (comb fields)
  isComb?: boolean;     // If true, character-by-character display
  multiline?: boolean;  // If true, for multi-line text input
}

export interface Annotation {
  id: string;
  page: number;         // 0-based page index
  type: AnnotationType;
  // Position & size in view-coordinate space (origin = top-left of rendered page)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;     // degrees, clockwise
  // Content
  content: string;      // text content or image URI
  fontSize: number;
  fontColor: string;
  // Image-specific: original dimensions for aspect-ratio locking
  originalWidth: number;
  originalHeight: number;
  // Crop: when isCropping is true, the annotation acts as a crop window
  isCropping: boolean;
  cropX: number;        // image offset X within crop window
  cropY: number;        // image offset Y within crop window
  cropScale: number;    // image scale relative to annotation size (1 = fit)
  // Drawing-specific fields
  pathData: string;     // serialized SVG path string from Skia
  strokeColor: string;  // hex color of the brush stroke
  strokeWidth: number;  // brush thickness in display px
}

export interface EditorSnapshot {
  annotations: Annotation[];
  formFields: FormField[];
}

interface PdfEditorState {
  // PDF state
  pdfUri: string | null;
  pdfFileName: string;
  pageCount: number;
  currentPage: number;
  pagesDimensions: { width: number; height: number }[];

  // Annotations
  annotations: Annotation[];
  formFields: FormField[];
  selectedId: string | null;

  // History Stack
  past: EditorSnapshot[];
  future: EditorSnapshot[];

  // Actions - History
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;

  // Actions - PDF
  setPdf: (uri: string, fileName: string, pageCount: number, formFields?: FormField[]) => void;
  setPageCount: (count: number) => void;
  setCurrentPage: (page: number) => void;
  setPagesDimensions: (dims: { width: number; height: number }[]) => void;
  reset: () => void;

  // Actions - Annotations
  addText: (page: number, x: number, y: number) => string;
  addImage: (page: number, x: number, y: number, width: number, height: number, uri: string, origW: number, origH: number) => string;
  addDrawing: (page: number, pathData: string, strokeColor: string, strokeWidth: number) => string;
  updateAnnotation: (id: string, updates: Partial<Omit<Annotation, 'id' | 'type' | 'page'>>) => void;
  toggleCropping: (id: string) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;

  // Actions - Form Fields
  setFormFields: (fields: FormField[]) => void;
  updateFormField: (name: string, value: string | boolean | string[]) => void;
  resetFormFields: () => void;
}

// ─── Defaults ─────────────────────────────────────────
const DEFAULT_TEXT_WIDTH = 200;
const DEFAULT_TEXT_HEIGHT = 40;
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_FONT_COLOR = '#000000';

let _idCounter = 0;
const generateId = () => `ann_${Date.now()}_${++_idCounter}`;

const MAX_HISTORY = 50;

// ─── Store ────────────────────────────────────────────
export const usePdfEditorStore = create<PdfEditorState>((set, get) => ({
  pdfUri: null,
  pdfFileName: '',
  pageCount: 0,
  currentPage: 0,
  pagesDimensions: [],

  annotations: [],
  formFields: [],
  selectedId: null,

  past: [],
  future: [],

  saveHistory: () => {
    const { annotations, formFields, past } = get();
    // Only save if there's actual content (optional optimization: deep compare last past item)
    const newPast = [...past, { annotations: [...annotations], formFields: [...formFields] }];
    if (newPast.length > MAX_HISTORY) newPast.shift();
    set({ past: newPast, future: [] }); // Any new action invalidates future
  },

  undo: () => {
    const { past, future, annotations, formFields } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    set({
      past: newPast,
      future: [...future, { annotations: [...annotations], formFields: [...formFields] }],
      annotations: previous.annotations,
      formFields: previous.formFields,
      selectedId: null, // Clear selection on undo to avoid ghost handles
    });
  },

  redo: () => {
    const { past, future, annotations, formFields } = get();
    if (future.length === 0) return;

    const next = future[future.length - 1];
    const newFuture = future.slice(0, future.length - 1);

    set({
      past: [...past, { annotations: [...annotations], formFields: [...formFields] }],
      future: newFuture,
      annotations: next.annotations,
      formFields: next.formFields,
      selectedId: null,
    });
  },

  setPdf: (uri, fileName, pageCount, formFields = []) =>
    set({ pdfUri: uri, pdfFileName: fileName, pageCount, currentPage: 0, annotations: [], formFields, selectedId: null, pagesDimensions: [], past: [], future: [] }),

  setPageCount: (count) => set({ pageCount: count }),

  setCurrentPage: (page) => set({ currentPage: page, selectedId: null }),

  setPagesDimensions: (dims) => set({ pagesDimensions: dims }),

  reset: () =>
    set({ pdfUri: null, pdfFileName: '', pageCount: 0, currentPage: 0, annotations: [], formFields: [], selectedId: null, pagesDimensions: [], past: [], future: [] }),

  addText: (page, x, y) => {
    get().saveHistory();
    const id = generateId();
    const annotation: Annotation = {
      id, page, type: 'text',
      x, y,
      width: DEFAULT_TEXT_WIDTH,
      height: DEFAULT_TEXT_HEIGHT,
      rotation: 0,
      content: 'Texto',
      fontSize: DEFAULT_FONT_SIZE,
      fontColor: DEFAULT_FONT_COLOR,
      originalWidth: 0, originalHeight: 0,
      isCropping: false, cropX: 0, cropY: 0, cropScale: 1,
      pathData: '', strokeColor: '', strokeWidth: 0,
    };
    set((s) => ({ annotations: [...s.annotations, annotation], selectedId: id }));
    return id;
  },

  addImage: (page, x, y, width, height, uri, origW, origH) => {
    get().saveHistory();
    const id = generateId();
    const annotation: Annotation = {
      id, page, type: 'image',
      x, y, width, height,
      rotation: 0,
      content: uri,
      fontSize: 0,
      fontColor: '',
      originalWidth: origW, originalHeight: origH,
      isCropping: false, cropX: 0, cropY: 0,
      // Initialize cropScale so that originalWidth * cropScale = width (fits the box)
      cropScale: origW > 0 ? (width / origW) : 1,
      pathData: '', strokeColor: '', strokeWidth: 0,
    };
    set((s) => ({ annotations: [...s.annotations, annotation], selectedId: id }));
    return id;
  },

  addDrawing: (page, pathData, strokeColor, strokeWidth) => {
    get().saveHistory();
    const id = generateId();
    const annotation: Annotation = {
      id, page, type: 'drawing',
      x: 0, y: 0,
      width: 0, height: 0,
      rotation: 0,
      content: '',
      fontSize: 0,
      fontColor: '',
      originalWidth: 0, originalHeight: 0,
      isCropping: false, cropX: 0, cropY: 0, cropScale: 1,
      pathData, strokeColor, strokeWidth,
    };
    set((s) => ({ annotations: [...s.annotations, annotation] }));
    return id;
  },

  updateAnnotation: (id, updates) => {
    get().saveHistory();
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
  },

  toggleCropping: (id) => {
    get().saveHistory();
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, isCropping: !a.isCropping } : a
      ),
    }));
  },

  deleteAnnotation: (id) => {
    get().saveHistory();
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },

  selectAnnotation: (id) => set({ selectedId: id }),

  setFormFields: (fields) => {
    // Only clear history if we are completely resetting form fields on load, not if this is a generic setter
    set({ formFields: fields });
  },

  updateFormField: (name, value) => {
    get().saveHistory();
    set((s) => ({
      formFields: s.formFields.map((f) =>
        f.name === name ? { ...f, value } : f
      ),
    }));
  },

  resetFormFields: () => {
    get().saveHistory();
    set((s) => ({
      formFields: s.formFields.map((f) => ({
        ...f,
        value: f.type === 'checkbox' || f.type === 'radio' ? false : (f.type === 'listbox' ? [] : '')
      })),
    }));
  },
}));
