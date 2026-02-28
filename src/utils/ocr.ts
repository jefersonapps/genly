import TextRecognition, { TextRecognitionResult } from "@react-native-ml-kit/text-recognition";

export interface OCRResult extends TextRecognitionResult {}

/**
 * Extracts text and structural data (blocks, lines, frames) from an image URI.
 */
export async function recognizeText(uri: string): Promise<OCRResult | null> {
  try {
    const result = await TextRecognition.recognize(uri);
    return result;
  } catch (error) {
    console.error("OCR Utility Error:", error);
    return null;
  }
}

/**
 * Extracts only the concatenated text string from an image URI.
 */
export async function extractTextString(uri: string): Promise<string> {
  const result = await recognizeText(uri);
  return result?.text || "";
}

/**
 * Sanitizes a string to be compatible with PDF WinAnsi encoding.
 * Normalizes Unicode characters to NFD and removes non-WinAnsi characters.
 * This prevents crashes like [Error: WinAnsi cannot encode "ế" (0x1ebf)]
 */
export function sanitizeForWinAnsi(text: string): string {
  if (!text) return "";
  
  // 1. Normalize to NFD (decomposes characters like 'ế' into 'e' + accents)
  // 2. Remove combining diacritical marks
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // 3. Filter out any remaining characters outside the WinAnsi range (Latin-1 subset roughly)
  // Technically WinAnsi has some specific codes, but stripping non-ASCII is the safest
  // for a searchable invisible layer.
  return normalized.replace(/[^\x00-\x7F]/g, "");
}

