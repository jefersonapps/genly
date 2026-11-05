export const PDF_TEXT_FONTS = [
  { id: 'Montserrat-Medium', label: 'Montserrat' },
  { id: 'Montserrat-Regular', label: 'Montserrat Regular' },
  { id: 'Montserrat-Bold', label: 'Montserrat Negrito' },
  { id: 'PdfArimo', label: 'Arimo (compatível com Arial)' },
  { id: 'PdfTinos', label: 'Tinos (compatível com Times New Roman)' },
  { id: 'PdfRoboto', label: 'Roboto' },
  { id: 'PdfLato', label: 'Lato' },
  { id: 'PdfSerif', label: 'Serifada' },
  { id: 'PdfMono', label: 'Monoespaçada' },
] as const;

export type PdfTextFont = typeof PDF_TEXT_FONTS[number]['id'];
export const DEFAULT_TEXT_FONT: PdfTextFont = 'Montserrat-Medium';
