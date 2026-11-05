import type { Annotation } from './usePdfEditorStore';
import { TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT, TEXT_PADDING } from './textLayout';

export type NativeTextLine = { text: string; x: number; y: number; width: number; height: number; ascender: number; baseline?: number };
export type NativeTextLayout = {
  content: string; width: number; fontSize: number; fontFamily: string; lineSpacing: number;
  lines: NativeTextLine[];
};
export type NativeTextLayouts = Record<string, NativeTextLayout>;

export function nativeTextLayoutKey(annotation: Annotation) {
  return { content: annotation.content, width: annotation.width, fontSize: annotation.fontSize,
    fontFamily: annotation.fontFamily || TEXT_FONT_FAMILY, lineSpacing: annotation.lineSpacing ?? TEXT_LINE_HEIGHT };
}

export function matchesNativeTextLayout(annotation: Annotation, snapshot?: NativeTextLayout): snapshot is NativeTextLayout {
  if (!snapshot?.lines.length) return false;
  const key = nativeTextLayoutKey(annotation);
  return key.content === snapshot.content && key.width === snapshot.width && key.fontSize === snapshot.fontSize
    && key.fontFamily === snapshot.fontFamily && key.lineSpacing === snapshot.lineSpacing;
}

/** Native line breaks and advances preserve the editable preview in the exported PDF. */
export function measuredAnnotationText(annotation: Annotation, snapshot: NativeTextLayout) {
  const textHeight = Math.max(...snapshot.lines.map(line => line.y + line.height));
  const top = (annotation.height - textHeight) / 2;
  return {
    lineHeight: annotation.fontSize * snapshot.lineSpacing,
    lines: snapshot.lines.map(line => ({
      text: line.text.replace(/[\r\n]+$/u, ''), x: TEXT_PADDING + line.x,
      baseline: top + (line.baseline ?? line.y + line.ascender), width: line.width,
    })),
  };
}
