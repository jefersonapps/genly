import { Directory, File, Paths } from "expo-file-system";
import { getKatexHtmlHead } from "../lib/katex/katex-assets";
import { MathJaxBase64 } from "../lib/mathjax/mathjax-asset";

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
  
  // Robustly strip LaTeX delimiters for MathJax (handles $$, $, and \\[ \\])
  const cleanLatex = latex
    .replace(/^\\\[\s*/g, '')
    .replace(/\s*\\\]$/g, '')
    .replace(/^\$\$|\$\$$/g, '')
    .replace(/^\$|\$$/g, '')
    .trim();

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <script>
  window.MathJax = {
    loader: { load: ['[tex]/ams'] },
    tex: {
      packages: { '[+]': ['ams'] }
    },
    svg: {
      fontCache: 'local'
    },
    startup: {
      typeset: false
    }
  };
  </script>
  <script>${atob(MathJaxBase64)}</script>
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
    <div id="math-content">$$\\Large ${cleanLatex}$$</div>
  </div>
  
  <script>
    function startCapture() {
      if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetPromise([document.getElementById('math-content')]).then(() => {
          setTimeout(captureResult, 300);
        }).catch(err => {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capture_error', error: 'MathJax error: ' + err.message }));
        });
      } else {
        setTimeout(startCapture, 200);
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
        img.src = 'data:image/svg+xml;base64,' + base64Svg;
        
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
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capture_error', error: e.message }));
      }
    }
  </script>
</body>
</html>`;
}




/** Build the HTML for the live preview only (no capture) */
export function buildPreviewHtml(latex: string, style: LatexStyle, isDark: boolean): string {
  const resolvedTextColor = style.textColor;
  const resolvedBg = style.backgroundColor;
  const resolvedOuter = style.outerColor;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  ${getKatexHtmlHead()}
  <script>
    window.addEventListener('load', function() {
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.getElementById('math-content'), {
          delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false},
            {left: "\\\\(", right: "\\\\)", display: false},
            {left: "\\\\\[", right: "\\\\\]", display: true}
          ],
          throwOnError: false
        });
      }
      setTimeout(function() {
        var h = document.getElementById('equation-box').scrollHeight;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: h + 48 }));
        document.body.classList.add('rendered');
      }, 100);
    });
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: ${style.containerMode === 'transparent' ? 'transparent' : (resolvedOuter === '#FFFFFF' || resolvedOuter === '#fff' ? '#f0f0f0' : resolvedOuter)};
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100px;
      padding: 16px;
      font-family: sans-serif;
    }
    .katex { font-family: 'KaTeX_Main', serif !important; }
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
      max-width: 100%;
      min-width: 60px;
      min-height: 40px;
      transition: opacity 0.2s;
    }
    #math-content { display: inline-block; line-height: 1; }
    #loading { position: absolute; font-size: 14px; color: #999; top: 10px; right: 10px; }
    body.rendered #loading { display: none; }
  </style>
</head>
<body>
  <div id="loading">...</div>
  <div id="equation-box">
    <div id="math-content">${latex || '<span style="color: #999">Vazio</span>'}</div>
  </div>
</body>
</html>`;
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
  
  file.write(bytes);
  return file.uri;
}
