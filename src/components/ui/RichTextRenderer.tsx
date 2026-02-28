import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getKatexHtmlHead } from '../../lib/katex/katex-assets';

interface RichTextRendererProps {
  content: string;
  colors: {
    text: string;
    textSecondary: string;
    surfaceTertiary: string;
    safeAccent: string;
    isDark: boolean;
  };
  scrollEnabled?: boolean;
  onToggleCheckbox?: (index: number, isChecked: boolean) => void;
  updateKey?: number;
}

function stripCheckboxes(html: string) {
    return html.replace(/<li(\s+checked)?>/gi, '<li>');
}

export function RichTextRenderer({ content, colors, scrollEnabled = false, onToggleCheckbox, updateKey }: RichTextRendererProps) {
  const [height, setHeight] = useState(100);
  const prevBaseContentRef = useRef<string>("");
  const prevUpdateKeyRef = useRef<number | undefined>(updateKey);
  const [renderedHtml, setRenderedHtml] = useState<string>("");

  useEffect(() => {
    // We only want to regenerate the HTML if the actual content (excluding checkbox toggles) changes.
    // This prevents the WebView from flashing when a user taps a checkbox, 
    // because the local JS already handled the visual toggle.
    const baseContent = stripCheckboxes(content);
    const keyChanged = updateKey !== prevUpdateKeyRef.current;
    
    if (baseContent !== prevBaseContentRef.current || keyChanged) {
      prevBaseContentRef.current = baseContent;
      prevUpdateKeyRef.current = updateKey;
      
      const strippedContent = content
        .replace(/^\s*<html>\s*/i, '')
        .replace(/\s*<\/html>\s*$/i, '');

      const newHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            ${getKatexHtmlHead()}
            <style>
              body {
                font-family: 'Montserrat-Regular', -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 18px;
                color: ${colors.text};
                background-color: transparent;
                margin: 0;
                padding: 0;
                line-height: 1.5;
              }
              /* Ensure KaTeX uses our injected fonts */
              .katex { font-family: 'KaTeX_Main', serif !important; }
              
              h1 { font-size: 28px; font-weight: bold; margin-bottom: 20px; }
              h2 { font-size: 24px; font-weight: bold; margin-bottom: 16px; }
              h3 { font-size: 20px; font-weight: bold; margin-bottom: 12px; }
              blockquote {
                border-left: 3px solid ${colors.safeAccent};
                padding-left: 12px;
                color: ${colors.textSecondary};
                margin: 16px 0;
              }
              pre, code {
                background-color: ${colors.surfaceTertiary};
                border-radius: 8px;
                font-family: monospace;
              }
              pre { padding: 12px; overflow-x: auto; margin: 16px 0; }
              code { padding: 2px 4px; color: ${colors.safeAccent}; }
              pre code { padding: 0; background-color: transparent; color: inherit; }
              a { color: ${colors.safeAccent}; text-decoration: underline; }
              ul, ol { padding-left: 20px; margin: 16px 0; }
              li { margin-bottom: 8px; }
              ul { list-style-type: disc; }
              ul li::marker { color: ${colors.safeAccent}; }
              ol li::marker { color: ${colors.textSecondary}; }
              
              /* Checkbox list support */
              ul[data-type="checkbox"] { list-style: none; padding-left: 0; margin: 16px 0; }
              ul[data-type="checkbox"] li {
                position: relative;
                padding-left: 32px;
                margin-bottom: 8px;
                list-style-type: none;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent; /* remove highlight */
              }
              ul[data-type="checkbox"] li::before {
                content: "";
                position: absolute;
                left: 0;
                top: 2px;
                width: 20px;
                height: 20px;
                border: 2px solid ${colors.safeAccent};
                border-radius: 4px;
                background-color: transparent;
                box-sizing: border-box;
                transition: all 0.2s ease;
              }
              /* When Checked */
              ul[data-type="checkbox"] li[checked]::before {
                background-color: ${colors.safeAccent};
              }
              ul[data-type="checkbox"] li[checked]::after {
                content: "";
                position: absolute;
                left: 7px;
                top: 5px;
                width: 5px;
                height: 10px;
                border: solid ${colors.surfaceTertiary}; /* inner checkmark color */
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
              }
              ul[data-type="checkbox"] li::marker { content: none; display: none; }
            </style>
          </head>
          <body>
            <div id="content">${strippedContent}</div>
            <script>
              const contentDiv = document.getElementById('content');
              let lastHeight = 0;
              function sendHeight() {
                const bodyHeight = document.body.scrollHeight;
                const contentHeight = document.getElementById('content').scrollHeight;
                const height = Math.max(bodyHeight, contentHeight, 50);
                
                if (height > 0 && Math.abs(height - lastHeight) > 1) {
                  lastHeight = height;
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: height + 10 })); 
                }
              }

              function attachCheckboxListeners() {
                const lists = document.querySelectorAll('ul[data-type="checkbox"]');
                let globalCheckboxIndex = 0;
                
                lists.forEach((list) => {
                  const items = list.querySelectorAll('li');
                  items.forEach((item) => {
                    const currentIndex = globalCheckboxIndex++;
                    // Check if we already attached a listener
                    if (!item.hasAttribute('data-checkbox-index')) {
                      item.setAttribute('data-checkbox-index', currentIndex);
                      item.addEventListener('click', (e) => {
                        const isChecked = item.hasAttribute('checked');
                        if (isChecked) {
                          item.removeAttribute('checked');
                        } else {
                          item.setAttribute('checked', 'true');
                        }
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'checkbox_toggle',
                          index: currentIndex,
                          isChecked: !isChecked
                        }));
                      });
                    }
                  });
                });
              }
              
              window.addEventListener('load', function() {
                if (typeof renderMathInElement === 'function') {
                  renderMathInElement(document.getElementById('content'), {
                    delimiters: [
                      {left: "$$", right: "$$", display: true},
                      {left: "$", right: "$", display: false},
                      {left: "\\\\(", right: "\\\\)", display: false},
                      {left: "\\\\[", right: "\\\\]", display: true}
                    ],
                    throwOnError: false
                  });
                }
                attachCheckboxListeners();
                sendHeight();
              });
              
              window.addEventListener('resize', sendHeight); 
              
              const observer = new MutationObserver(() => {
                attachCheckboxListeners();
                sendHeight();
              });
              observer.observe(document.body, { 
                attributes: true, 
                childList: true, 
                subtree: true 
              });

              setInterval(sendHeight, 500);
            </script>
          </body>
        </html>
      `;
      setRenderedHtml(newHtml);
    }
  }, [content, colors, onToggleCheckbox, updateKey]);

  // If we haven't rendered HTML yet, render empty block to avoid crashes
  if (!renderedHtml) return <View style={scrollEnabled ? { flex: 1 } : { height, minHeight: 40 }} />;

  // Strip <html>...</html> wrapper if present (enriched editor stores content wrapped)
  const strippedContent = content
    .replace(/^\s*<html>\s*/i, '')
    .replace(/\s*<\/html>\s*$/i, '');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        ${getKatexHtmlHead()}
        <style>
          body {
            font-family: 'Montserrat-Regular', -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 18px;
            color: ${colors.text};
            background-color: transparent;
            margin: 0;
            padding: 0;
            line-height: 1.5;
          }
          /* Ensure KaTeX uses our injected fonts */
          .katex { font-family: 'KaTeX_Main', serif !important; }
          
          h1 { font-size: 28px; font-weight: bold; margin-bottom: 20px; }
          h2 { font-size: 24px; font-weight: bold; margin-bottom: 16px; }
          h3 { font-size: 20px; font-weight: bold; margin-bottom: 12px; }
          blockquote {
            border-left: 3px solid ${colors.safeAccent};
            padding-left: 12px;
            color: ${colors.textSecondary};
            margin: 16px 0;
          }
          pre, code {
            background-color: ${colors.surfaceTertiary};
            border-radius: 8px;
            font-family: monospace;
          }
          pre { padding: 12px; overflow-x: auto; margin: 16px 0; }
          code { padding: 2px 4px; color: ${colors.safeAccent}; }
          pre code { padding: 0; background-color: transparent; color: inherit; }
          a { color: ${colors.safeAccent}; text-decoration: underline; }
          ul, ol { padding-left: 20px; margin: 16px 0; }
          li { margin-bottom: 8px; }
          ul { list-style-type: disc; }
          ul li::marker { color: ${colors.safeAccent}; }
          ol li::marker { color: ${colors.textSecondary}; }
          
          /* Checkbox list support */
          ul[data-type="checkbox"] { list-style: none; padding-left: 0; margin: 16px 0; }
          ul[data-type="checkbox"] li {
            position: relative;
            padding-left: 32px;
            margin-bottom: 8px;
            list-style-type: none;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent; /* remove highlight */
          }
          ul[data-type="checkbox"] li::before {
            content: "";
            position: absolute;
            left: 0;
            top: 2px;
            width: 20px;
            height: 20px;
            border: 2px solid ${colors.safeAccent};
            border-radius: 4px;
            background-color: transparent;
            box-sizing: border-box;
            transition: all 0.2s ease;
          }
          /* When Checked */
          ul[data-type="checkbox"] li[checked]::before {
            background-color: ${colors.safeAccent};
          }
          ul[data-type="checkbox"] li[checked]::after {
            content: "";
            position: absolute;
            left: 7px;
            top: 5px;
            width: 5px;
            height: 10px;
            border: solid ${colors.surfaceTertiary}; /* inner checkmark color */
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
          }
          ul[data-type="checkbox"] li::marker { content: none; display: none; }
        </style>
      </head>
      <body>
        <div id="content">${strippedContent}</div>
        <script>
          const contentDiv = document.getElementById('content');
          let lastHeight = 0;
          function sendHeight() {
            const bodyHeight = document.body.scrollHeight;
            const contentHeight = document.getElementById('content').scrollHeight;
            const height = Math.max(bodyHeight, contentHeight, 50);
            
            if (height > 0 && Math.abs(height - lastHeight) > 1) {
              lastHeight = height;
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: height + 10 })); 
            }
          }

          function attachCheckboxListeners() {
            const lists = document.querySelectorAll('ul[data-type="checkbox"]');
            let globalCheckboxIndex = 0;
            
            lists.forEach((list) => {
              const items = list.querySelectorAll('li');
              items.forEach((item) => {
                const currentIndex = globalCheckboxIndex++;
                // Check if we already attached a listener
                if (!item.hasAttribute('data-checkbox-index')) {
                  item.setAttribute('data-checkbox-index', currentIndex);
                  item.addEventListener('click', (e) => {
                    const isChecked = item.hasAttribute('checked');
                    if (isChecked) {
                      item.removeAttribute('checked');
                    } else {
                      item.setAttribute('checked', 'true');
                    }
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'checkbox_toggle',
                      index: currentIndex,
                      isChecked: !isChecked
                    }));
                  });
                }
              });
            });
          }
          
          window.addEventListener('load', function() {
            if (typeof renderMathInElement === 'function') {
              renderMathInElement(document.getElementById('content'), {
                delimiters: [
                  {left: "$$", right: "$$", display: true},
                  {left: "$", right: "$", display: false},
                  {left: "\\\\(", right: "\\\\)", display: false},
                  {left: "\\\\[", right: "\\\\]", display: true}
                ],
                throwOnError: false
              });
            }
            attachCheckboxListeners();
            sendHeight();
          });
          
          window.addEventListener('resize', sendHeight); 
          
          const observer = new MutationObserver(() => {
            attachCheckboxListeners();
            sendHeight();
          });
          observer.observe(document.body, { 
            attributes: true, 
            childList: true, 
            subtree: true 
          });

          setInterval(sendHeight, 500);
        </script>
      </body>
    </html>
  `;

  return (
    <View style={scrollEnabled ? { flex: 1 } : { height, minHeight: 40 }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: renderedHtml }}
        scrollEnabled={scrollEnabled}
        onMessage={(event) => {
           try {
             const data = JSON.parse(event.nativeEvent.data);
             if (data.type === 'height') {
                 const h = parseFloat(data.value);
                 if (!isNaN(h) && h > 0) {
                     setHeight(h);
                 }
             } else if (data.type === 'checkbox_toggle' && onToggleCheckbox) {
                 onToggleCheckbox(data.index, data.isChecked);
             }
           } catch {
             // Fallback for older messages
             const h = parseFloat(event.nativeEvent.data);
             if (!isNaN(h) && h > 0) {
                 setHeight(h);
             }
           }
        }}
        style={scrollEnabled ? { flex: 1, backgroundColor: 'transparent' } : { backgroundColor: 'transparent' }}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        androidLayerType="hardware"
      />
    </View>
  );
}
