import fontkit from '@pdf-lib/fontkit';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { PDFDocument, type PDFFont } from 'pdf-lib';

let fontData: Promise<string> | undefined;
let previewFont: Promise<PDFFont> | undefined;

function loadFontData() {
  return fontData ??= (async () => {
    const asset = Asset.fromModule(require('../../../assets/fonts/Montserrat-Medium.ttf'));
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('Não foi possível carregar a fonte do PDF.');
    return FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
  })().catch(error => { fontData = undefined; throw error; });
}

export async function embedAnnotationFont(document: PDFDocument) {
  document.registerFontkit(fontkit);
  return document.embedFont(await loadFontData(), { subset: true });
}

/** Cache the same font metrics used when embedding annotation text in the PDF. */
export function loadAnnotationPreviewFont() {
  return previewFont ??= PDFDocument.create().then(embedAnnotationFont)
    .catch(error => { previewFont = undefined; throw error; });
}
