import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────
export type AnnotationType = 'text' | 'image' | 'eraser';

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

  // Actions - PDF
  setPdf: (uri: string, fileName: string, pageCount: number, formFields?: FormField[]) => void;
  setPageCount: (count: number) => void;
  setCurrentPage: (page: number) => void;
  setPagesDimensions: (dims: { width: number; height: number }[]) => void;
  reset: () => void;

  // Actions - Annotations
  addText: (page: number, x: number, y: number) => string;
  addImage: (page: number, x: number, y: number, width: number, height: number, uri: string, origW: number, origH: number) => string;
  addEraser: (page: number, x: number, y: number) => string;
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
const DEFAULT_ERASER_SIZE = 120;
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_FONT_COLOR = '#000000';

let _idCounter = 0;
const generateId = () => `ann_${Date.now()}_${++_idCounter}`;

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

  setPdf: (uri, fileName, pageCount, formFields = []) =>
    set({ pdfUri: uri, pdfFileName: fileName, pageCount, currentPage: 0, annotations: [], formFields, selectedId: null, pagesDimensions: [] }),

  setPageCount: (count) => set({ pageCount: count }),

  setCurrentPage: (page) => set({ currentPage: page, selectedId: null }),

  setPagesDimensions: (dims) => set({ pagesDimensions: dims }),

  reset: () =>
    set({ pdfUri: null, pdfFileName: '', pageCount: 0, currentPage: 0, annotations: [], formFields: [], selectedId: null, pagesDimensions: [] }),

  addText: (page, x, y) => {
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
    };
    set((s) => ({ annotations: [...s.annotations, annotation], selectedId: id }));
    return id;
  },

  addImage: (page, x, y, width, height, uri, origW, origH) => {
    const id = generateId();
    const annotation: Annotation = {
      id, page, type: 'image',
      x, y, width, height,
      rotation: 0,
      content: uri,
      fontSize: 0,
      fontColor: '',
      originalWidth: origW, originalHeight: origH,
      isCropping: false, cropX: 0, cropY: 0, cropScale: 1,
    };
    set((s) => ({ annotations: [...s.annotations, annotation], selectedId: id }));
    return id;
  },

  addEraser: (page, x, y) => {
    const id = generateId();
    const annotation: Annotation = {
      id, page, type: 'eraser',
      x, y,
      width: DEFAULT_ERASER_SIZE,
      height: DEFAULT_ERASER_SIZE / 3,
      rotation: 0,
      content: '',
      fontSize: 0,
      fontColor: '',
      originalWidth: 0, originalHeight: 0,
      isCropping: false, cropX: 0, cropY: 0, cropScale: 1,
    };
    set((s) => ({ annotations: [...s.annotations, annotation], selectedId: id }));
    return id;
  },

  updateAnnotation: (id, updates) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  toggleCropping: (id) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, isCropping: !a.isCropping } : a
      ),
    })),

  deleteAnnotation: (id) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  selectAnnotation: (id) => set({ selectedId: id }),

  setFormFields: (fields) => set({ formFields: fields }),

  updateFormField: (name, value) =>
    set((s) => ({
      formFields: s.formFields.map((f) =>
        f.name === name ? { ...f, value } : f
      ),
    })),

  resetFormFields: () =>
    set((s) => ({
      formFields: s.formFields.map((f) => ({
        ...f,
        value: f.type === 'checkbox' || f.type === 'radio' ? false : (f.type === 'listbox' ? [] : '')
      })),
    })),
}));
