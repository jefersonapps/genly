import fontkit from '@pdf-lib/fontkit';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { PDFDocument, type PDFFont } from 'pdf-lib';
import * as Font from 'expo-font';
import { DEFAULT_TEXT_FONT, type PdfTextFont } from './fonts';

const fontData = new Map<PdfTextFont, Promise<string>>();
const previewFonts = new Map<PdfTextFont, Promise<PDFFont>>();
const fontAssets = {
  'Montserrat-Medium': require('../../../assets/fonts/Montserrat-Medium.ttf'),
  'Montserrat-Regular': require('../../../assets/fonts/Montserrat-Regular.ttf'),
  'Montserrat-Bold': require('../../../assets/fonts/Montserrat-Bold.ttf'),
  PdfSerif: require('../../../assets/fonts/DejaVuSerif.ttf'),
  PdfMono: require('../../../assets/fonts/DejaVuSansMono.ttf'),
  PdfArimo: require('../../../assets/fonts/Arimo-Regular.ttf'),
  PdfTinos: require('../../../assets/fonts/Tinos-Regular.ttf'),
  PdfRoboto: require('../../../assets/fonts/Roboto-Regular.ttf'),
  PdfLato: require('../../../assets/fonts/Lato-Regular.ttf'),
};

function loadFontData(family: PdfTextFont) {
  const cached = fontData.get(family);
  if (cached) return cached;
  const loading = (async () => {
    const source = fontAssets[family];
    await Font.loadAsync({ [family]: source });
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('Não foi possível carregar a fonte do PDF.');
    return FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
  })().catch(error => { fontData.delete(family); throw error; });
  fontData.set(family, loading);
  return loading;
}

export async function embedAnnotationFont(document: PDFDocument, family: PdfTextFont = DEFAULT_TEXT_FONT) {
  document.registerFontkit(fontkit);
  return document.embedFont(await loadFontData(family), { subset: true });
}

/** Register the native typeface without constructing PDF font metrics during editing. */
export async function loadAnnotationTypeface(family: PdfTextFont = DEFAULT_TEXT_FONT): Promise<void> {
  await loadFontData(family);
}

/** Cache the same font metrics used when embedding annotation text in the PDF. */
export function loadAnnotationPreviewFont(family: PdfTextFont = DEFAULT_TEXT_FONT) {
  const cached = previewFonts.get(family);
  if (cached) return cached;
  const loading = PDFDocument.create().then(document => embedAnnotationFont(document, family))
    .catch(error => { previewFonts.delete(family); throw error; });
  previewFonts.set(family, loading);
  return loading;
}
