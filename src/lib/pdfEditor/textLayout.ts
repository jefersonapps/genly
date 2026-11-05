import type { PDFFont } from 'pdf-lib';

export const TEXT_PADDING = 4;
export const TEXT_FONT_FAMILY = 'Montserrat-Medium';
export const TEXT_LINE_HEIGHT = 1.2;

type TextBox = { content: string; width: number; height: number; fontSize: number; lineSpacing?: number };
type TextFont = Pick<PDFFont, 'widthOfTextAtSize' | 'heightAtSize'>;

/** One layout in display coordinates, shared by the preview and PDF export. */
export function layoutAnnotationText(box: TextBox, font: TextFont) {
  const availableWidth = Math.max(1, box.width - TEXT_PADDING * 2);
  const lines: string[] = [];
  for (const paragraph of box.content.replace(/\r\n?/g, '\n').split('\n')) {
    const characters = Array.from(paragraph);
    if (!characters.length) { lines.push(''); continue; }
    let start = 0;
    while (start < characters.length) {
      let low = 1;
      let high = characters.length - start;
      let count = 1;
      // Long tokens, including runs of underscores, wrap at glyph boundaries.
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const width = font.widthOfTextAtSize(characters.slice(start, start + middle).join(''), box.fontSize);
        if (width <= availableWidth) { count = middle; low = middle + 1; }
        else high = middle - 1;
      }
      if (start + count < characters.length) {
        for (let i = count - 1; i > 0; i--) {
          if (/\s/u.test(characters[start + i])) { count = i + 1; break; }
        }
      }
      lines.push(characters.slice(start, start + count).join(''));
      start += count;
    }
  }

  const ascent = font.heightAtSize(box.fontSize, { descender: false });
  const fontHeight = font.heightAtSize(box.fontSize);
  const lineHeight = box.fontSize * (box.lineSpacing ?? TEXT_LINE_HEIGHT);
  const top = (box.height - lines.length * lineHeight) / 2;
  return {
    lineHeight,
    lines: lines.map((text, index) => ({
      text,
      x: TEXT_PADDING,
      baseline: top + index * lineHeight + (lineHeight - fontHeight) / 2 + ascent,
      width: font.widthOfTextAtSize(text, box.fontSize),
    })),
  };
}
