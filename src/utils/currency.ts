/**
 * BRL currency formatting utilities.
 * All monetary values are stored as integers in centavos for precision.
 */

/**
 * Format centavos to BRL display string.
 * e.g. 123456 → "R$ 1.234,56"
 */
export function formatBRL(cents: number): string {
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;

  const reaisStr = reais.toLocaleString("pt-BR");
  const centavosStr = centavos.toString().padStart(2, "0");
  const sign = cents < 0 ? "- " : "";

  return `${sign}R$ ${reaisStr},${centavosStr}`;
}

/**
 * Parse a formatted BRL string back to centavos.
 * e.g. "1.234,56" → 123456
 * Handles partial input gracefully.
 */
export function parseBRL(text: string): number {
  // Remove everything except digits and comma
  const cleaned = text.replace(/[^\d,]/g, "");
  if (!cleaned) return 0;

  // Split by comma
  const parts = cleaned.split(",");
  const reaisPart = parts[0].replace(/\./g, "") || "0";
  const centavosPart = (parts[1] || "0").padEnd(2, "0").substring(0, 2);

  return parseInt(reaisPart, 10) * 100 + parseInt(centavosPart, 10);
}

/**
 * Format user input as they type into a BRL currency field.
 * Works by interpreting all digits as centavos and formatting.
 * e.g. "12345" → "123,45" → displayed as "R$ 123,45"
 */
export function formatBRLInput(text: string): string {
  // Keep only digits
  const digits = text.replace(/\D/g, "");
  if (!digits) return "";

  const cents = parseInt(digits, 10);
  if (isNaN(cents)) return "";

  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;

  const reaisStr = reais.toLocaleString("pt-BR");
  const centavosStr = centavos.toString().padStart(2, "0");

  return `R$ ${reaisStr},${centavosStr}`;
}

/**
 * Extract raw centavos from a formatted BRL input string.
 * e.g. "R$ 1.234,56" → 123456
 */
export function extractCentsFromInput(text: string): number {
  const digits = text.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10);
}
