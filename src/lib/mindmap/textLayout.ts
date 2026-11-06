import type { SkFont } from '@shopify/react-native-skia';

export const NODE_TEXT_FONT = 'Montserrat-SemiBold';
export const NODE_TEXT_SIZE = 13;
export const NODE_TEXT_LINE_HEIGHT = NODE_TEXT_SIZE * 1.5;
export const NODE_TEXT_PADDING = 16;

/** Advance widths include spaces, matching native text layout rather than ink bounds. */
export function measureNodeText(text: string, font: SkFont | null): number {
  'worklet';
  if (!font) return text.length * NODE_TEXT_SIZE * 0.6;
  return font.getGlyphWidths(font.getGlyphIDs(text)).reduce((sum, width) => sum + width, 0);
}

export function wrapNodeText(title: string, maxW: number, font: SkFont | null): string[] {
  'worklet';
  if (maxW <= 0) return [title || ''];
  const measure = (s: string) => measureNodeText(s, font);

  const result: string[] = [];
  const rawLines = (title || 'Sem título').split('\r').join('').split('\n');

  for (const line of rawLines) {
    if (line === '') {
      result.push('');
      continue;
    }
    const words = line.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (measure(word) > maxW) {
        if (currentLine) result.push(currentLine);
        currentLine = '';
        
        let buf = '';
        for (let i = 0; i < word.length; i++) {
          const char = word[i];
          const next = buf + char;
          if (measure(next) > maxW && buf.length > 0) {
            result.push(buf);
            buf = char;
          } else {
            buf = next;
          }
        }
        currentLine = buf;
        continue;
      }

      const joined = currentLine ? `${currentLine} ${word}` : word;
      if (measure(joined) <= maxW) {
        currentLine = joined;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }
    result.push(currentLine);
  }
  
  return result.length ? result : [''];
}

