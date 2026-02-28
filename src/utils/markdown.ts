/**
 * Strip markdown syntax from text for preview display.
 * Removes common markdown symbols while preserving the readable text content.
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";

  return text
    // Strip HTML tags
    .replace(/<[^>]*>/g, " ")
    // Decode numeric HTML entities (&#NNN; and &#xHHH;)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    // Decode common named HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
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
}

/**
 * Truncates text to the given max length, appending "…" if truncated.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}
