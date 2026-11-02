"use dom";

import React, { useEffect, useRef, useState } from "react";
import "../../global.css";
import { getEquationEngineScript, normalizeEquation } from "../../utils/equationRendering";

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

type EquationWindow = Window & {
  renderEquationSvg: (source: string, host: HTMLElement, fontSize: number, color: string) => Promise<SVGSVGElement>;
};

export default function KatexDom({ expression, equationStyle }: KatexDomProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef(Promise.resolve());
  const [error, setError] = useState<string | null>(null);

  const fitEquation = () => {
    const outer = outerRef.current;
    const card = cardRef.current;
    const host = hostRef.current;
    const svg = host?.querySelector("svg");
    if (!outer || !card || !host || !svg) return;
    host.style.transform = "none";
    const bounds = svg.getBoundingClientRect();
    const scale = Math.max(0, Math.min(1,
      (outer.clientWidth - 64) / bounds.width,
      (outer.clientHeight - 64) / bounds.height));
    card.style.width = `${bounds.width * scale + 32}px`;
    card.style.height = `${bounds.height * scale + 32}px`;
    host.style.transform = `translate(-50%, -50%) scale(${scale})`;
  };

  useEffect(() => {
    const pageStyle = document.createElement("style");
    pageStyle.textContent = `html, body, #root { height: 100%; margin: 0; padding: 0; overflow: hidden; background: transparent; }`;
    document.head.appendChild(pageStyle);
    const engineWindow = window as EquationWindow;
    if (!engineWindow.renderEquationSvg) {
      const script = document.createElement("script");
      script.textContent = getEquationEngineScript();
      document.head.appendChild(script);
    }
    const observer = new ResizeObserver(fitEquation);
    if (outerRef.current) observer.observe(outerRef.current);
    return () => { observer.disconnect(); pageStyle.remove(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Keep typing responsive and serialize the engine's shared numbering state.
    const timer = setTimeout(() => {
      queueRef.current = queueRef.current.then(async () => {
        const host = hostRef.current;
        if (cancelled || !host) return;
        const math = normalizeEquation(expression);
        if (!math) {
          host.textContent = "Digite LaTeX…";
          host.style.width = "max-content";
          host.style.transform = "translate(-50%, -50%)";
          if (cardRef.current) {
            cardRef.current.style.width = "180px";
            cardRef.current.style.height = "64px";
          }
          setError(null);
          return;
        }
        host.style.transform = "none";
        host.style.width = "600px";
        try {
          await (window as EquationWindow).renderEquationSvg(
            math, host, equationStyle.fontSize, equationStyle.textColor);
          if (!cancelled) {
            setError(null);
            fitEquation();
          }
        } catch (err) {
          if (!cancelled) setError((err as Error).message);
        }
      });
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [expression, equationStyle]);

  return (
    <div ref={outerRef} style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      width: "100%", height: "100%", padding: 16, boxSizing: "border-box",
      position: "relative", overflow: "hidden",
      backgroundColor: equationStyle.containerMode === "transparent" ? "transparent" : equationStyle.outerColor,
    }}>
      <div ref={cardRef} style={{
        position: "relative", flexShrink: 0, boxSizing: "border-box",
        backgroundColor: equationStyle.containerMode === "full" ? equationStyle.backgroundColor : "transparent",
        border: equationStyle.containerMode === "full"
          ? `${equationStyle.borderWidth}px ${equationStyle.borderStyle} ${equationStyle.borderColor}` : "none",
        borderRadius: equationStyle.borderRadius,
        color: equationStyle.textColor, fontSize: equationStyle.fontSize,
      }}>
        <div ref={hostRef} style={{
          position: "absolute", left: "50%", top: "50%", width: 600,
          transformOrigin: "center center", lineHeight: 1,
        }} />
      </div>
      {error && <div role="alert" style={{
        position: "absolute", bottom: 4, left: 8, right: 8,
        color: "#d32f2f", fontSize: 11, textAlign: "center",
      }}>{error}</div>}
    </div>
  );
}
