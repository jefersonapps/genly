/** Keep readable Unicode names while preventing paths and duplicate extensions. */
export function normalizeScannedDocumentName(value: string): string {
  return value.normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/g, '')
    .replace(/(?:\.(?:pdf|jpe?g|png))+$/i, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim();
}
