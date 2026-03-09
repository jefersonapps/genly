import { computeEdges, computeHiddenNodes } from '@/lib/mindmap/layoutEngine';
import type { BackgroundPattern, MindMapNode } from '@/lib/mindmap/useMindMapStore';
import {
  ImageFormat,
  Skia, type SkFont
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

// Shared styling functions matching MindMapCanvas.tsx
function lightenHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  const toHex = (v: number) => {
    const s = v.toString(16);
    return s.length < 2 ? '0' + s : s;
  };
  return '#' + toHex(lr) + toHex(lg) + toHex(lb);
}

/** Darken a hex color by mixing towards black. factor 0 = no change, 1 = black */
function darkenHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  const toHex = (v: number) => {
    const s = v.toString(16);
    return s.length < 2 ? '0' + s : s;
  };
  return '#' + toHex(dr) + toHex(dg) + toHex(db);
}

function hexLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.substring(0, 2), 16),
    g: parseInt(c.substring(2, 4), 16),
    b: parseInt(c.substring(4, 6), 16),
  };
}

function getNodeBgColor(depth: number, isDark: boolean, customColor?: string): string {
  if (customColor) return customColor;
  if (depth === 0) return isDark ? '#2563EB' : '#3B82F6';
  if (depth === 1) return isDark ? '#1E293B' : '#F0F4FF';
  return isDark ? '#1A1A2E' : '#FAFBFF';
}

function getNodeBorderColor(depth: number, isDark: boolean, customColor?: string): string {
  if (customColor) return darkenHex(customColor, 0.25);
  if (depth === 0) return isDark ? '#3B82F6' : '#2563EB';
  return isDark ? '#333344' : '#E2E8F0';
}

function getNodeTextColor(depth: number, isDark: boolean, customColor?: string): string {
  if (customColor) return hexLuminance(customColor) > 0.5 ? '#1F2937' : '#FFFFFF';
  if (depth === 0) return '#FFFFFF';
  return isDark ? '#E5E7EB' : '#1F2937';
}



const FONT_SIZE = 13;
const APPROX_CHAR_W = FONT_SIZE * 0.58;
function wrapText(title: string, maxW: number, font?: SkFont | null): string[] {
  if (maxW <= 0) return [title || ''];
  const measure = (s: string) => font ? font.measureText(s).width : s.length * APPROX_CHAR_W;

  const result: string[] = [];
  const words = (title || 'Sem título').split(' ');

  for (const word of words) {
    if (measure(word) > maxW) {
      let buf = '';
      for (let i = 0; i < word.length; i++) {
        const next = buf + word[i];
        if (measure(next) > maxW && buf.length > 0) {
          result.push(buf);
          buf = word[i];
        } else {
          buf = next;
        }
      }
      if (buf.length > 0) result.push(buf);
      continue;
    }
    if (result.length === 0) { result.push(word); continue; }
    const joined = result[result.length - 1] ? `${result[result.length - 1]} ${word}` : word;
    if (measure(joined) <= maxW) {
      result[result.length - 1] = joined;
    } else {
      result.push(word);
    }
  }
  return result.length ? result : [''];
}

export async function exportToImage(
  nodes: MindMapNode[], 
  isDark: boolean, 
  customFont: SkFont | null,
  canvasBgColor: string | null,
  bgPattern: BackgroundPattern
): Promise<string | null> {
  if (nodes.length === 0) return null;

  try {
    const PADDING = 60;
    const SCALE = 10; // High resolution scale factor
    
    const hiddenNodes = computeHiddenNodes(nodes);
    const visibleNodes = nodes.filter(n => !hiddenNodes.has(n.id));

    // 1. Calculate Bounding Box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const collapsedSet = new Set(nodes.filter(n => n.collapsed).map(n => n.id));
    
    for (const n of visibleNodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    
    const logicalWidth = contentW + PADDING * 2;
    const logicalHeight = contentH + PADDING * 2;

    const surface = Skia.Surface.Make(Math.ceil(logicalWidth * SCALE), Math.ceil(logicalHeight * SCALE));
    if (!surface) throw new Error("Could not create Skia Surface");

    const canvas = surface.getCanvas();
    canvas.scale(SCALE, SCALE);
    
    // Draw Background Color
    const bgColor = canvasBgColor || (isDark ? '#09090B' : '#FAFAFA');
    const bgPaint = Skia.Paint();
    bgPaint.setColor(Skia.Color(bgColor));
    canvas.drawRect(Skia.XYWHRect(0, 0, logicalWidth, logicalHeight), bgPaint);

    // Apply translation to center
    canvas.translate(PADDING - minX, PADDING - minY);

    const isBgDark = hexLuminance(bgColor) < 0.5;

    // Draw Pattern
    if (bgPattern !== 'none') {
      const BASE_SIZE = 40;
      const patternColor = isBgDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
      const patternColorStrong = isBgDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
      
      const startX = minX - PADDING;
      const startY = minY - PADDING;
      const endX = maxX + PADDING;
      const endY = maxY + PADDING;
      
      const firstLineX = Math.floor(startX / BASE_SIZE) * BASE_SIZE;
      const firstLineY = Math.floor(startY / BASE_SIZE) * BASE_SIZE;

      if (bgPattern === 'grid' || bgPattern === 'lines') {
        const linePaint = Skia.Paint();
        linePaint.setColor(Skia.Color(patternColor));
        linePaint.setStrokeWidth(1);
        linePaint.setStyle(1); // Stroke
        
        const path = Skia.Path.Make();
        for (let y = firstLineY; y <= endY; y += BASE_SIZE) {
          path.moveTo(startX, y);
          path.lineTo(endX, y);
        }
        if (bgPattern === 'grid') {
          for (let x = firstLineX; x <= endX; x += BASE_SIZE) {
            path.moveTo(x, startY);
            path.lineTo(x, endY);
          }
        }
        canvas.drawPath(path, linePaint);
      } else if (bgPattern === 'dots') {
        const dotPaint = Skia.Paint();
        dotPaint.setColor(Skia.Color(patternColorStrong));
        dotPaint.setAntiAlias(true);
        const radius = 2;
        
        for (let x = firstLineX; x <= endX; x += BASE_SIZE) {
          for (let y = firstLineY; y <= endY; y += BASE_SIZE) {
             canvas.drawCircle(x, y, radius, dotPaint);
          }
        }
      }
    }

    // Edges
    const edges = computeEdges(visibleNodes, collapsedSet);
    const edgeColor = isBgDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
    const edgePaint = Skia.Paint();
    edgePaint.setStyle(1); // Stroke
    edgePaint.setColor(Skia.Color(edgeColor));
    edgePaint.setStrokeWidth(2);
    edgePaint.setAntiAlias(true);
    // Skia.StrokeCap.Round = 1
    edgePaint.setStrokeCap(1);

    const path = Skia.Path.Make();
    for (const e of edges) {
      path.moveTo(e.fromX, e.fromY);
      if (e.direction === 'top' || e.direction === 'bottom') {
        const cpY = Math.abs(e.toY - e.fromY) * 0.45;
        path.cubicTo(
          e.fromX, e.fromY + (e.direction === 'bottom' ? cpY : -cpY),
          e.toX, e.toY + (e.direction === 'bottom' ? -cpY : cpY),
          e.toX, e.toY
        );
      } else {
        const sign = e.direction === 'right' ? 1 : -1;
        const cpX = Math.abs(e.toX - e.fromX) * 0.45;
        path.cubicTo(
          e.fromX + sign * cpX, e.fromY,
          e.toX - sign * cpX, e.toY,
          e.toX, e.toY
        );
      }
    }
    canvas.drawPath(path, edgePaint);

    // Nodes
    const fillP = Skia.Paint(); fillP.setStyle(0); fillP.setAntiAlias(true);
    const strokeP = Skia.Paint(); strokeP.setStyle(1); strokeP.setAntiAlias(true);

    // Pre-load images
    const nodeImages: Record<string, any> = {};
    for (const n of visibleNodes) {
      if (n.imageUri) {
        try {
          const data = await Skia.Data.fromURI(n.imageUri);
          if (data) {
            const img = Skia.Image.MakeImageFromEncoded(data);
            if (img) nodeImages[n.id] = img;
          }
        } catch (e) {
          console.warn(`Failed to lead image for node ${n.id}:`, e);
        }
      }
    }

    for (const n of visibleNodes) {
        const rrect = Skia.RRectXY(Skia.XYWHRect(n.x, n.y, n.width, n.height), 12, 12);
        
        fillP.setColor(Skia.Color(getNodeBgColor(n.depth, isBgDark, n.color)));
        canvas.drawRRect(rrect, fillP);

        strokeP.setColor(Skia.Color(getNodeBorderColor(n.depth, isBgDark, n.color)));
        strokeP.setStrokeWidth(1);
        canvas.drawRRect(rrect, strokeP);

        const H_PAD = 16;
        const V_PAD = 16;
        const LINE_HEIGHT = FONT_SIZE * 1.5;

        const lines = wrapText(n.title, n.width - H_PAD * 2, customFont);
        const totalTextH = lines.length * LINE_HEIGHT;
        
        let totalContentH = totalTextH;
        let imgH = 0;
        const img = nodeImages[n.id];
        if (img && n.imageAspectRatio) {
          imgH = (n.width - H_PAD * 2) / n.imageAspectRatio;
          totalContentH += imgH + 16;
        }

        const firstLineTop = n.y + (n.height - totalContentH) / 2;

        // Text
        if (customFont) {
            const textPaint = Skia.Paint();
            textPaint.setColor(Skia.Color(getNodeTextColor(n.depth, isBgDark, n.color)));
            textPaint.setAntiAlias(true);
            
            // Standard baseline offset: 
            // center the font box (FONT_SIZE) within the line-height box (LINE_HEIGHT)
            const lineMargin = (LINE_HEIGHT - FONT_SIZE) / 2;
            let currentY = firstLineTop + lineMargin + (FONT_SIZE * 0.8) - 1;

            for (const line of lines) {
                const lineWidth = customFont.measureText(line).width;
                const align = n.textAlign || 'center';
                let x = n.x + H_PAD;
                if (align === 'center') x = n.x + (n.width - lineWidth) / 2;
                else if (align === 'right') x = n.x + n.width - H_PAD - lineWidth;

                canvas.drawText(line, x, currentY, textPaint, customFont);
                currentY += LINE_HEIGHT;
            }
        }

        // Image
        if (img && imgH > 0) {
          const imgX = n.x + H_PAD;
          const imgY = firstLineTop + totalTextH + 16;
          const imgW = n.width - H_PAD * 2;
          
          canvas.save();
          // Clip to match UI's rounded corners
          const imgRRect = Skia.RRectXY(Skia.XYWHRect(imgX, imgY, imgW, imgH), 12, 12);
          // 1 = Intersect, true = Antialias
          canvas.clipRRect(imgRRect, 1, true);
          
          // Draw image with 'cover' logic
          const srcW = img.width();
          const srcH = img.height();
          const srcAR = srcW / srcH;
          const dstAR = imgW / imgH;
          
          let drawSrcW = srcW;
          let drawSrcH = srcH;
          let srcX = 0;
          let srcY = 0;
          
          if (srcAR > dstAR) {
            drawSrcW = srcH * dstAR;
            srcX = (srcW - drawSrcW) / 2;
          } else {
            drawSrcH = srcW / dstAR;
            srcY = (srcH - drawSrcH) / 2;
          }
          
          const imagePaint = Skia.Paint();
          imagePaint.setAntiAlias(true);
          canvas.drawImageRect(
            img,
            Skia.XYWHRect(srcX, srcY, drawSrcW, drawSrcH),
            Skia.XYWHRect(imgX, imgY, imgW, imgH),
            imagePaint
          );
          canvas.restore();
        }
    }

    const image = surface.makeImageSnapshot();
    if (!image) throw new Error("Failed to make snapshot");

    const pngBytes = image.encodeToBase64(ImageFormat.PNG, 100);
    
    const file = new File(Paths.cache, `MindMapExport-${Date.now()}.png`);
    file.write(pngBytes, { encoding: 'base64' });
    
    return file.uri;

  } catch (e) {
    console.error("Export Image Error:", e);
    return null;
  }
}



