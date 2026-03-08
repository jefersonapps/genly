import * as FileSystem from 'expo-file-system/legacy';
import {
    clip, endPath,
    LineCapStyle,
    LineJoinStyle,
    PDFBool,
    PDFCheckBox,
    PDFDict,
    PDFDocument,
    PDFDropdown,
    PDFName,
    PDFOptionList,
    PDFRadioGroup,
    PDFTextField,
    popGraphicsState,
    pushGraphicsState,
    rectangle,
    rgb,
    rotateDegrees,
    setLineJoin,
    StandardFonts,
    translate,
} from 'pdf-lib';
import type { Annotation, FormField } from './usePdfEditorStore';

// ─── Helpers ──────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.substring(0, 2), 16) / 255,
    g: parseInt(c.substring(2, 4), 16) / 255,
    b: parseInt(c.substring(4, 6), 16) / 255,
  };
}

/**
 * Export an edited PDF by drawing annotations on top of the original.
 *
 * Coordinate mapping:
 * - `react-native-pdf` with fitPolicy=0 scales the PDF to fit the view WIDTH.
 * - Uniform scale factor: `uniformScale = pdfPageWidth / viewWidth`.
 * - PDF Y-axis is inverted (origin at bottom-left), so we flip Y.
 * - Images use "cover" mode with clipping to match the preview's resizeMode="cover".
 */
export async function exportEditedPdf(
  pdfUri: string,
  annotations: Annotation[],
  formFields: FormField[],
  viewDimensions: { width: number; height: number },
): Promise<string | null> {
  try {
    const pdfBase64 = await FileSystem.readAsStringAsync(pdfUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const pdfDoc = await PDFDocument.load(pdfBase64);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    // Apply Form Fields
    const form = pdfDoc.getForm();
    
    // Signal viewers to generate appearances (some viewers need this even after flattening)
    try {
      const catalog = pdfDoc.catalog;
      let acroForm = catalog.get(PDFName.of('AcroForm'));
      
      if (!acroForm) {
        // Create AcroForm if it doesn't exist
        const acroFormDict = pdfDoc.context.obj({
          Fields: [],
          NeedAppearances: true,
        });
        catalog.set(PDFName.of('AcroForm'), acroFormDict);
        console.log('[PDF Export] AcroForm created with NeedAppearances: true');
      } else {
        const acroFormDict = pdfDoc.context.lookup(acroForm);
        if (acroFormDict instanceof PDFDict) {
          acroFormDict.set(PDFName.of('NeedAppearances'), PDFBool.True);
          // CRITICAL: Delete XFA (XML Forms Architecture) if present. 
          // If XFA exists, many viewers will ignore AcroForm updates.
          acroFormDict.delete(PDFName.of('XFA'));
          console.log('[PDF Export] NeedAppearances set to true, XFA deleted');
        }
      }
    } catch (e) {
      console.warn('Failed to set NeedAppearances/Delete XFA:', e);
    }

    console.log(`[PDF Export] Applying values to ${formFields.length} fields`);
    for (const field of formFields) {
      try {
        if (!field.name) continue;
        const pdfField = form.getField(field.name);
        if (!pdfField) continue;

        console.log(`[PDF Export] Field: ${field.name}, Value: ${field.value}`);

        if (field.type === 'text' && typeof field.value === 'string') {
          const textField = pdfField as PDFTextField;
          if (field.isComb && field.maxLength) {
            try { textField.setText(''); } catch {}
          } else {
            textField.setText(field.value);
            if (field.fontSize) {
              try { textField.setFontSize(field.fontSize); } catch {}
            }
          }
          try { textField.updateAppearances(font); } catch {}
          
        } else if (field.type === 'checkbox' && typeof field.value === 'boolean') {
          const checkBox = pdfField as PDFCheckBox;
          if (field.value) checkBox.check();
          else checkBox.uncheck();
          try { checkBox.updateAppearances(); } catch {}
          
        } else if (field.type === 'radio' && typeof field.value === 'string') {
          const radioGroup = pdfField as PDFRadioGroup;
          if (field.value) {
            try { radioGroup.select(field.value); } catch {}
            try { radioGroup.updateAppearances(); } catch {}
          }
        } else if ((field.type === 'dropdown' || field.type === 'listbox') && (typeof field.value === 'string' || Array.isArray(field.value))) {
          if (field.value && (Array.isArray(field.value) ? (field.value as string[]).length > 0 : true)) {
            const selectField = pdfField as PDFDropdown | PDFOptionList;
            try { selectField.select(field.value); } catch {}
            try { (selectField as any).updateAppearances(font); } catch {}
          }
        }
      } catch (e) {
        console.warn(`[PDF Export] Failed to process field ${field.name}:`, e);
      }
    }

    // Update global appearances before flattening
    try {
      form.updateFieldAppearances(font);
    } catch {
      form.updateFieldAppearances();
    }

    // Re-enable flatten now that XFA is gone
    form.flatten();

    // Manually draw comb fields because pdf-lib appearance generator fails to align comb characters
    for (const field of formFields) {
       if (field.type === 'text' && field.isComb && field.maxLength && typeof field.value === 'string') {
          const page = pages[field.page];
          if (!page) continue;
          
          const chars = field.value.split('');
          const boxWidth = field.width / field.maxLength;
          const pdfH = page.getHeight();
          
          // field.x and field.y from store are ALREADY in PDF scale!
          // field.y is from TOP-LEFT. PDF origin is BOTTOM-LEFT.
          const annX = field.x;
          const annY = pdfH - field.y - field.height; // rect.y
          
          const fontSize = Math.min(boxWidth * 0.8, field.height * 0.6);
          const charY = annY + field.height / 2 - (fontSize * 0.35); // Center vertically

          page.pushOperators(pushGraphicsState());
          for (let i = 0; i < Math.min(chars.length, field.maxLength); i++) {
            const char = chars[i];
            if (char && char.trim()) {
              const charX = annX + (i * boxWidth) + boxWidth / 2 - (fontSize * 0.3); // Rough center horiz
              page.drawText(char, {
                x: charX,
                y: charY,
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
              });
            }
          }
          page.pushOperators(popGraphicsState());
       }
    }

    for (const annotation of annotations) {
      const page = pages[annotation.page];
      if (!page) continue;

      const pdfW = page.getWidth();
      const pdfH = page.getHeight();

      // Uniform scale: react-native-pdf fitPolicy=0 scales by width
      const s = pdfW / viewDimensions.width;

      // Annotation bounds in PDF coordinates
      const annW = annotation.width * s;
      const annH = annotation.height * s;
      const annX = annotation.x * s;
      const annY = pdfH - (annotation.y * s) - annH;

      // Rotation setup
      const rotDeg = annotation.rotation || 0;
      const hasRot = Math.abs(rotDeg) > 0.1;

      if (hasRot) {
        // Save state, rotate around annotation center
        const cx = annX + annW / 2;
        const cy = annY + annH / 2;
        page.pushOperators(
          pushGraphicsState(),
          translate(cx, cy),
          rotateDegrees(-rotDeg), // negative because PDF rotation is CCW
          translate(-cx, -cy),
        );
      }

      switch (annotation.type) {
        case 'text': {
          const color = hexToRgb(annotation.fontColor || '#000000');
          const fontSize = annotation.fontSize * s;
          const lines = (annotation.content || '').split('\n');
          
          // React Native Text line height roughly defaults to 1.2x font size
          const lineHeight = fontSize * 1.2;
          const totalTextHeight = lines.length * lineHeight;

          // React Native View has paddingHorizontal: 4
          const textX = annX + (4 * s);

          // React Native View has justifyContent: 'center'
          // Center the text block vertically in the annotation box.
          // In PDF, Y origin is bottom. 
          // Center Y = annY + (annH / 2)
          // Top of the text block = Center Y + (totalTextHeight / 2)
          // Baseline of the first line is roughly 0.85 * fontSize below the top of its line box (Montserrat font metrics)
          const textStartY = annY + (annH / 2) + (totalTextHeight / 2) - (fontSize * 0.85);

          for (let i = 0; i < lines.length; i++) {
            page.drawText(lines[i], {
              x: textX,
              y: textStartY - (i * lineHeight),
              size: fontSize,
              font,
              color: rgb(color.r, color.g, color.b),
            });
          }
          break;
        }

        case 'image': {
          try {
            const imgBase64 = await FileSystem.readAsStringAsync(annotation.content, {
              encoding: FileSystem.EncodingType.Base64,
            });

            const lowerUri = annotation.content.toLowerCase();
            let img;
            if (lowerUri.endsWith('.png')) {
              img = await pdfDoc.embedPng(`data:image/png;base64,${imgBase64}`);
            } else {
              img = await pdfDoc.embedJpg(`data:image/jpeg;base64,${imgBase64}`);
            }

            // "Cover" mode: scale image to FILL annotation bounds, clip overflow
            const imgW = img.width;
            const imgH = img.height;
            const imgAspect = imgW / imgH;
            const annAspect = annW / annH;

            let drawW: number, drawH: number, drawX: number, drawY: number;

            if (imgAspect > annAspect) {
              // Image is wider than annotation — scale by height, overflow width
              drawH = annH;
              drawW = annH * imgAspect;
              drawX = annX - (drawW - annW) / 2; // center horizontally
              drawY = annY;
            } else {
              // Image is taller than annotation — scale by width, overflow height
              drawW = annW;
              drawH = annW / imgAspect;
              drawX = annX;
              drawY = annY - (drawH - annH) / 2; // center vertically
            }

            // Clip to annotation bounds then draw the larger image
            page.pushOperators(
              pushGraphicsState(),
              rectangle(annX, annY, annW, annH),
              clip(),
              endPath(),
            );

            page.drawImage(img, {
              x: drawX,
              y: drawY,
              width: drawW,
              height: drawH,
            });

            page.pushOperators(popGraphicsState());
          } catch (imgErr) {
            console.warn('Failed to embed image annotation:', imgErr);
          }
          break;
        }

        case 'drawing': {
          if (!annotation.pathData) break;
          
          const strokeRgb = hexToRgb(annotation.strokeColor || '#000000');
          // borderWidth is scaled by the `scale` parameter in drawSvgPath,
          // so we don't multiply by 's' here.
          const lineW = annotation.strokeWidth;

          try {
            // Skia path previews use "round" line joins. drawSvgPath doesn't natively expose LineJoinStyle,
            // so we push the graphics state manually to set it before drawing the path.
            page.pushOperators(
              pushGraphicsState(),
              setLineJoin(LineJoinStyle.Round)
            );

            page.drawSvgPath(annotation.pathData, {
              x: 0,
              y: pdfH, // Start from top-left. drawSvgPath flips the Y axis automatically.
              scale: s,
              borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
              borderWidth: lineW,
              borderLineCap: LineCapStyle.Round,
            });

            page.pushOperators(popGraphicsState());
          } catch (pathErr) {
            console.warn('[PDF Export] Failed to draw SVG path:', pathErr);
          }
          break;
        }
      }

      if (hasRot) {
        page.pushOperators(popGraphicsState());
      }
    }

    const resultBase64 = await pdfDoc.saveAsBase64({ dataUri: false });
    return resultBase64;
  } catch (error) {
    console.error('PDF Export Error:', error);
    return null;
  }
}
