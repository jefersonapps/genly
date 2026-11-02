type PdfPageRange =
  | { valid: true; startIndex: number; endIndex: number; count: number }
  | { valid: false; error: string };

/** User-facing page numbers are inclusive and refer to the current organizer order. */
export function parsePdfPageRange(from: string, to: string, total: number): PdfPageRange {
  if (!/^\d+$/.test(from.trim()) || !/^\d+$/.test(to.trim())) {
    return { valid: false, error: "Informe a página inicial e a final com números inteiros." };
  }
  const start = Number(from);
  const end = Number(to);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1 || start > total || end > total) {
    return { valid: false, error: `Escolha páginas entre 1 e ${total}.` };
  }
  if (start > end) {
    return { valid: false, error: "A página final deve ser igual ou posterior à inicial." };
  }
  return { valid: true, startIndex: start - 1, endIndex: end, count: end - start + 1 };
}
