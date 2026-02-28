
interface EditorColors {
  text: string;
  textSecondary: string;
  surfaceTertiary: string;
  safeAccent: string;
  placeholder: string;
  isDark: boolean;
}

export function getEditorStyles(colors: EditorColors) {
  const { text, textSecondary, surfaceTertiary, safeAccent, isDark } = colors;

  return {
    h1: { fontSize: 28, bold: true },
    h2: { fontSize: 24, bold: true },
    h3: { fontSize: 20, bold: true },
    blockquote: {
      borderColor: safeAccent,
      borderWidth: 3,
      gapWidth: 12,
      color: textSecondary,
    },
    codeblock: {
      color: text,
      backgroundColor: surfaceTertiary,
      borderRadius: 8,
    },
    code: {
      color: safeAccent,
      backgroundColor: surfaceTertiary,
    },
    a: {
      color: safeAccent,
      textDecorationLine: "underline",
    },
    ol: {
      gapWidth: 8,
      marginLeft: 4,
      markerColor: textSecondary,
    },
    ul: {
      bulletColor: safeAccent,
      bulletSize: 6,
      marginLeft: 4,
      gapWidth: 8,
    },
    ulCheckbox: {
      boxSize: 20,
      gapWidth: 8,
      marginLeft: 4,
      boxColor: safeAccent,
    },
  } as const;
}
