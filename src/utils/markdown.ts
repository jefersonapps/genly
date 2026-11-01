import { decode } from "html-entities";

export function decodeNoteText(text: string): string {
  return decode(text, { level: "html5", scope: "body" }).normalize("NFC");
}

/**
 * Strip markdown syntax from text for preview display.
 * Removes common markdown symbols while preserving the readable text content.
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";

  const plain = text
    // Strip HTML tags
    .replace(/<[^>]*>/g, " ")
    // Strip markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Strip bold/italic markers
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    // Strip strikethrough
    .replace(/~~(.*?)~~/g, "$1")
    // Strip inline code
    .replace(/`([^`]+)`/g, "$1")
    // Strip links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Strip images ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Strip blockquote markers
    .replace(/^>\s?/gm, "")
    // Strip unordered list markers
    .replace(/^[-*+]\s+/gm, "")
    // Strip ordered list markers
    .replace(/^\d+\.\s+/gm, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  return decodeNoteText(plain).replace(/\s+/g, " ").trim();
}

/**
 * Basic HTML to Markdown converter to support the editor's output
 */
export function htmlToMarkdown(html: string): string {
    if (!html) return "";

    let ms = html;
    
    // Headers
    ms = ms.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n");
    ms = ms.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n");
    ms = ms.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n");
    ms = ms.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n");
    ms = ms.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "\n##### $1\n");
    ms = ms.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "\n###### $1\n");

    // Bold
    ms = ms.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
    ms = ms.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");

    // Italic
    ms = ms.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
    ms = ms.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");

    // Strike / Underline (MD4C might use ~~ or __)
    ms = ms.replace(/<s[^>]*>(.*?)<\/s>/gi, "~~$1~~");
    ms = ms.replace(/<u[^>]*>(.*?)<\/u>/gi, "__$1__");

    // Lines & Paragraphs
    ms = ms.replace(/<br\s*\/?>/gi, "\n");
    ms = ms.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n");

    // Lists
    ms = ms.replace(/<ul[^>]*>(.*?)<\/ul>/gi, "$1\n");
    ms = ms.replace(/<ol[^>]*>(.*?)<\/ol>/gi, "$1\n");
    ms = ms.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
    
    // Checkboxes 
    ms = ms.replace(/<input[^>]*type="checkbox"[^>]*checked[^>]*>\s*/gi, "[x] ");
    ms = ms.replace(/<input[^>]*type="checkbox"[^>]*>\s*/gi, "[ ] ");

    // Link
    ms = ms.replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

    // Code
    ms = ms.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
    ms = ms.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```");
    
    // Final cleanup of remaining tags (including <html>, <body>, <span>)
    ms = ms.replace(/<[^>]*>/g, "");
    
    ms = decodeNoteText(ms);

    // Trim excessive newlines
    ms = ms.replace(/\n{3,}/g, "\n\n");

    return ms.trim();
}

/**
 * Truncates text to the given max length, appending "…" if truncated.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  // Avoid splitting a supplementary Unicode character at the preview boundary.
  const end = /[\uD800-\uDBFF]/.test(text[maxLength - 1]) ? maxLength - 1 : maxLength;
  return text.slice(0, end).trim() + "…";
}
