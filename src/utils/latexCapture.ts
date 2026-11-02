import { Directory, File, Paths } from "expo-file-system";
import { equationScriptValue, getEquationEngineScript, normalizeEquation } from "./equationRendering";

/** Default styling for a new LaTeX equation */
export interface LatexStyle {
  textColor: string;
  backgroundColor: string;
  outerColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  fontSize: number;
  borderStyle: "solid" | "dashed" | "dotted";
  theme: "light" | "dark" | "auto";
  containerMode: "full" | "bare" | "transparent";
}

export const DEFAULT_LATEX_STYLE: LatexStyle = {
  textColor: "#000000",
  backgroundColor: "#F5F5F5",
  outerColor: "#FFFFFF",
  borderColor: "#CCCCCC",
  borderWidth: 1,
  borderRadius: 8,
  fontSize: 20,
  borderStyle: "dashed",
  theme: "auto",
  containerMode: "full",
};

/** Build the HTML page that renders a LaTeX equation with the given style,
 *  then captures it as a PNG (base64) string using MathJax v3 SVG engine. */
export function buildCaptureHtml(latex: string, style: LatexStyle, isDark: boolean): string {
  const resolvedTextColor = style.textColor;
  const resolvedBg = style.backgroundColor;
  const resolvedOuter = style.outerColor;
  
  const cleanLatex = normalizeEquation(latex);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <script>${getEquationEngineScript()}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: ${style.containerMode === 'transparent' ? 'transparent' : resolvedOuter};
      padding: 0;
      margin: 0;
      overflow: visible;
    }
    #equation-box {
      background-color: ${style.containerMode === 'full' ? resolvedBg : 'transparent'};
      border: ${style.containerMode === 'full' ? `${style.borderWidth}px ${style.borderStyle} ${style.borderColor}` : 'none'};
      border-radius: ${style.borderRadius}px;
      padding: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: ${resolvedTextColor};
      font-size: ${style.fontSize}px;
      line-height: normal;
      position: absolute;
      top: 0;
      left: 0;
      min-width: 10px;
      min-height: 10px;
    }
    /* Force MathJax to shrink-wrap and not add display-mode margins */
    mjx-container[display="true"] {
      margin: 0 !important;
      display: inline-block !important;
      text-align: center !important;
    }
    canvas { display: none; }
  </style>
</head>
<body>
  <div id="equation-box">
    <div id="math-content" style="width: 600px"></div>
  </div>
  
  <script>
    async function startCapture() {
      try {
        await window.renderEquationSvg(${equationScriptValue(cleanLatex)},
          document.getElementById('math-content'), ${style.fontSize}, ${equationScriptValue(resolvedTextColor)});
        captureResult();
      } catch (err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capture_error', error: err.message }));
      }
    }

    window.addEventListener('load', startCapture);

    function captureResult() {
      try {
        var box = document.getElementById('equation-box');
        var mjxSvg = box.querySelector('svg');
        if (!mjxSvg) {
           window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capture_error', error: 'No SVG generated' }));
           return;
        }

        // Measure the SVG content precisely using getBBox if available, or getBoundingClientRect
        // MathJax SVGs often have internal transforms that make getBoundingClientRect better for screen positioning,
        // but getBBox is better for the actual vector paths.
        var svgRect = mjxSvg.getBoundingClientRect();
        
        var scale = 20; 
        var boxPadding = 16;
        var margin = 10; // Extra breathing room for the outer color area
        
        // Final width/height of the container
        var w = Math.ceil(svgRect.width) + (boxPadding * 2) + (margin * 2);
        var h = Math.ceil(svgRect.height) + (boxPadding * 2) + (margin * 2);
        
        var canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        var mode = '${style.containerMode}';
        if (mode === 'transparent') {
          ctx.clearRect(0, 0, w, h);
        } else {
          ctx.fillStyle = '${resolvedOuter}';
          ctx.fillRect(0, 0, w, h);
        }

        if (mode === 'full') {
          var bw = ${style.borderWidth};
          var br = ${style.borderRadius};
          ctx.fillStyle = '${resolvedBg}';
          ctx.strokeStyle = '${style.borderColor}';
          ctx.lineWidth = bw;
          ${style.borderStyle === "dashed" ? "ctx.setLineDash([8, 4]);" : style.borderStyle === "dotted" ? "ctx.setLineDash([2, 4]);" : "ctx.setLineDash([]);"}
          
          function drawRoundedRect(x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.fill();
            if (bw > 0) ctx.stroke();
          }
          drawRoundedRect(margin, margin, w - (margin * 2), h - (margin * 2), br);
        }

        // Draw the SVG paths to canvas
        var svgStr = new XMLSerializer().serializeToString(mjxSvg);
        var base64Svg = btoa(unescape(encodeURIComponent(svgStr)));
        var img = new Image();
        
        img.onload = function() {
          try {
            // Draw centered: we have 'w' as total width.
            // boxPadding + margin is the target left edge if svg was perfectly at 0.
            // But getBoundingClientRect tells us exactly how big it is.
            ctx.drawImage(img, margin + boxPadding, margin + boxPadding, svgRect.width, svgRect.height); 
            
            var pngBase64 = canvas.toDataURL('image/png').split(',')[1];
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'capture_result', 
              png: pngBase64, 
              width: w * scale, 
              height: h * scale 
            }));
          } catch (err) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capture_error', error: 'Canvas error: ' + err.message }));
          }
        };
        img.onerror = function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capture_error', error: 'SVG raster failure' }));
        };
        img.src = 'data:image/svg+xml;base64,' + base64Svg;
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capture_error', error: e.message }));
      }
    }
  </script>
</body>
</html>`;
}




/** Standalone preview shares the exact SVG and numbering used in the editor and PNG. */
export function buildPreviewHtml(latex: string, style: LatexStyle, isDark: boolean): string {
  return `<!DOCTYPE html>
<html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>${getEquationEngineScript()}</script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; display: flex; justify-content: center;
      background: ${style.containerMode === "transparent" ? "transparent" : style.outerColor}; }
    #equation-box { padding: 16px; max-width: 100%; overflow-x: auto;
      background: ${style.containerMode === "full" ? style.backgroundColor : "transparent"};
      border: ${style.containerMode === "full" ? `${style.borderWidth}px ${style.borderStyle} ${style.borderColor}` : "none"};
      border-radius: ${style.borderRadius}px; color: ${style.textColor}; font-size: ${style.fontSize}px; }
  </style>
</head><body>
  <div id="equation-box"><div id="math-content" style="width:600px"></div></div>
  <script>
    window.addEventListener('load', async function() {
      try {
        await window.renderEquationSvg(${equationScriptValue(normalizeEquation(latex))},
          document.getElementById('math-content'), ${style.fontSize}, ${equationScriptValue(style.textColor)});
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'height',
          height: document.getElementById('equation-box').scrollHeight + 32}));
      } catch (err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'capture_error', error: err.message}));
      }
    });
  </script>
</body></html>`;
}

/** Save a base64 PNG string to the media directory */
export async function saveLatexPng(base64: string): Promise<string> {
  const mediaDir = new Directory(Paths.document, "media");
  if (!mediaDir.exists) {
    mediaDir.create({ intermediates: true });
  }
  
  const filename = `latex_${Date.now()}.png`;
  const file = new File(mediaDir, filename);
  
  // Convert base64 to Uint8Array for binary write
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  await file.write(bytes);
  return file.uri;
}
