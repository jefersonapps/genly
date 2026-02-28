import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { getKatexHtmlHead } from '../../lib/katex/katex-assets';

interface MathJaxRendererProps {
  content: string;
  style?: StyleProp<ViewStyle>;
  color?: string;
  fontSize?: number;
}

export function MathJaxRenderer({ content, style, color = '#000000', fontSize = 16 }: MathJaxRendererProps) {
  const [height, setHeight] = React.useState(fontSize * 2.5);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        ${getKatexHtmlHead()}
        <style>
          body {
            margin: 0;
            padding: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: transparent;
            color: ${color};
            font-size: ${fontSize}px;
            overflow: hidden;
          }
          #math-content {
            width: 100%;
            text-align: center;
            white-space: pre-wrap;
          }
          /* Ensure KaTeX uses our injected fonts */
          .katex { font-family: 'KaTeX_Main', serif !important; }
        </style>
      </head>
      <body>
        <div id="math-content">
          ${content}
        </div>
        <script>
          function sendHeight() {
             var h = document.getElementById('math-content').scrollHeight;
             if (window.ReactNativeWebView) {
               window.ReactNativeWebView.postMessage(h);
             }
          }
          
          window.addEventListener('load', function() {
            if (typeof renderMathInElement === 'function') {
              renderMathInElement(document.getElementById('math-content'), {
                delimiters: [
                  {left: "$$", right: "$$", display: true},
                  {left: "$", right: "$", display: false},
                  {left: "\\\\(", right: "\\\\)", display: false},
                  {left: "\\\\[", right: "\\\\]", display: true}
                ],
                throwOnError: false
              });
            }
            setTimeout(sendHeight, 100);
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={[{ minHeight: height, overflow: 'hidden' }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        onMessage={(event) => {
          const h = Number(event.nativeEvent.data);
          if (h > 0) setHeight(h + 16);
        }}
        backgroundColor="transparent"
        style={{ height, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
