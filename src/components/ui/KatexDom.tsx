"use dom";

import React, { useEffect, useRef, useState } from "react";
import "../../global.css";
// Import local katex for bundling as a fallback, but we'll try to use global too
import { KatexCSS } from "../../lib/katex/katex-assets";
import { KatexFontFaces } from "../../lib/katex/katex-fonts";
import katex from "../../lib/katex/katex.min.js";

export interface KatexDomProps {
  dom?: { matchContents?: boolean; style?: { width?: string | number; height?: string | number } };
  expression: string;
  isDark: boolean;
  equationStyle: {
    textColor: string;
    backgroundColor: string;
    outerColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    fontSize: number;
    borderStyle: "solid" | "dashed" | "dotted";
    containerMode: "full" | "bare" | "transparent";
  };
}

export default function KatexDom({ expression, isDark, equationStyle }: KatexDomProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = atob(KatexCSS) + `
      ${KatexFontFaces}
      
      html, body { 
        height: 100%; 
        margin: 0; 
        padding: 0; 
        overflow: hidden;
        background-color: transparent;
      }
      #root { 
        height: 100%; 
      }
      .katex { font-family: KaTeX_Main, Times New Roman, serif !important; }
      .katex-display { margin: 0 !important; }
      .katex { margin: 0 !important; }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) document.head.removeChild(style);
    };
  }, []);

  const updateScale = () => {
    if (!innerContentRef.current || !outerRef.current || !containerRef.current) return;
    
    // Measure at scale 1 to get natural dimensions
    containerRef.current.style.transform = 'scale(1)';
    
    const rect = innerContentRef.current.getBoundingClientRect();
    const contentWidth = rect.width;
    const contentHeight = rect.height;
    
      // Measure total available space from outer container with a safe margin
      // 16px padding * 2 = 32px, plus 16px safety margin * 2 = 32px. Total 64px.
      const availableWidth = outerRef.current.offsetWidth - 64; 
      const availableHeight = outerRef.current.offsetHeight - 64;
    
    if (contentWidth > 0 && contentHeight > 0) {
      const scaleW = availableWidth / contentWidth;
      const scaleH = availableHeight / contentHeight;
      const newScale = Math.min(scaleW, scaleH, 1);
      
      // Apply directly to DOM for instant update without React render lag
      containerRef.current.style.transform = `scale(${newScale})`;
      setScale(newScale);
    }
    
    // Content is now correctly scaled, make it visible
    containerRef.current.style.visibility = 'visible';
  };

  // MutationObserver to catch KaTeX rendering updates immediately
  useEffect(() => {
    if (!innerContentRef.current) return;
    
    const observer = new MutationObserver(() => {
       updateScale();
    });
    
    observer.observe(innerContentRef.current, { 
      childList: true, 
      subtree: true, 
      characterData: true,
      attributes: true
    });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!innerContentRef.current || !containerRef.current) return;

    try {
      let math = expression.trim();
      const isEnvironment = math.includes("\\begin{align}") || 
                          math.includes("\\begin{gather}") ||
                          math.includes("\\begin{equation}");

      math = math.replace(/^\$\$([\s\S]*)\$\$$/g, "$1")
                 .replace(/^\$([\s\S]*)\$/g, "$1")
                 .replace(/^\\\[([\s\S]*)\\\]$/g, "$1")
                 .replace(/^\\\(([\s\S]*)\\\)$/g, "$1")
                 .trim();

      // Hide container while rendering and measuring to avoid flickering
      containerRef.current.style.visibility = 'hidden';

      if (!math) {
        innerContentRef.current.innerHTML = '<div style="opacity: 0.3; font-style: italic;">Digite LaTeX...</div>';
        setScale(1);
        containerRef.current.style.transform = 'scale(1)';
        containerRef.current.style.visibility = 'visible';
        setError(null);
        return;
      }

      const renderMath = () => {
        if (!innerContentRef.current) return;
        try {
          katex.render(math, innerContentRef.current, {
            displayMode: true, 
            throwOnError: false,
            trust: true,
            strict: false
          });
          setError(null);
          // Scale update is handled by MutationObserver or can be called here
          updateScale();
        } catch (err) {
          setError((err as Error).message);
          containerRef.current!.style.visibility = 'visible';
        }
      };

      if (document.fonts.status === 'loaded') {
        renderMath();
      } else {
        document.fonts.ready.then(renderMath);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [expression, equationStyle]);

  useEffect(() => {
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  if (!equationStyle) return null;

  return (
    <div
      ref={outerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        backgroundColor: equationStyle.outerColor,
        padding: "16px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        ref={cardRef}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: equationStyle.containerMode === 'full' ? equationStyle.backgroundColor : "transparent",
          borderColor: equationStyle.containerMode === 'full' ? equationStyle.borderColor : "transparent",
          borderWidth: equationStyle.containerMode === 'full' ? `${equationStyle.borderWidth}px` : 0,
          borderStyle: equationStyle.borderStyle,
          borderRadius: `${equationStyle.borderRadius}px`,
          padding: "16px",
          color: equationStyle.textColor,
          fontSize: `${equationStyle.fontSize}px`,
          boxSizing: "border-box",
          width: "auto",
          maxWidth: "100%",
          maxHeight: "100%",
          overflow: "hidden",
        }}
      >
        <div 
          ref={containerRef} 
          style={{ 
            color: "inherit",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }} 
        >
          <span 
            ref={innerContentRef} 
            style={{ display: "inline-block" }}
          />
        </div>
      </div>
      {error && (
        <div style={{ color: "red", fontSize: "10px", marginTop: "4px", position: "absolute", bottom: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}
