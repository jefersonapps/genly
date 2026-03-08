import {
    buildCaptureHtml,
    type LatexStyle,
    saveLatexPng,
} from "@/utils/latexCapture";
import React, { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

export interface CaptureResult {
  pngUri?: string;
  pngBase64?: string;
  base64?: string;
  width?: number;
  height?: number;
}

interface LatexCaptureViewProps {
  /** When set, triggers a capture with these params */
  captureRequest: {
    latex: string;
    style: LatexStyle;
    isDark: boolean;
    previewOnly?: boolean;
  } | null;
  /** Called when capture completes */
  onCaptureComplete: (result: CaptureResult) => void;
  /** Called on capture error */
  onCaptureError?: (error: string) => void;
}

/**
 * Hidden off-screen WebView that renders a LaTeX equation via MathJax
 * and captures it as a high-res PNG (base64).
 * 
 * Mount this component in the editor and set `captureRequest` to trigger a capture.
 */
export function LatexCaptureView({ captureRequest, onCaptureComplete, onCaptureError }: LatexCaptureViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);

  // When captureRequest changes, build HTML and render
  React.useEffect(() => {
    if (captureRequest) {
      const h = buildCaptureHtml(captureRequest.latex, captureRequest.style, captureRequest.isDark);
      setHtml(h);
    } else {
      setHtml(null);
    }
  }, [captureRequest]);

  const isMounted = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleMessage = useCallback(async (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("LatexCaptureView: Message received:", data.type);
      
      if (data.type === "capture_result") {
        console.log("LatexCaptureView: Capture success. PNG length:", data.png?.length);
        
        if (captureRequest?.previewOnly) {
             onCaptureComplete({ base64: data.png, width: data.width, height: data.height });
        } else {
            const pngUri = await saveLatexPng(data.png);
            console.log("LatexCaptureView: Files saved:", pngUri);
            if (isMounted.current) {
                onCaptureComplete({ 
                  pngUri, 
                  pngBase64: data.png, 
                  width: data.width,
                  height: data.height
                });
            }
        }
        if (isMounted.current) setHtml(null);
      } else if (data.type === "capture_error") {
        console.error("LatexCaptureView: Capture error:", data.error);
        if (isMounted.current) {
             onCaptureError?.(data.error || "Unknown capture error");
             setHtml(null);
        }
      }
    } catch (e: any) {
      console.error("LatexCaptureView: Critical error:", e);
      if (isMounted.current) {
          onCaptureError?.(e.message || "Failed to parse capture result");
          setHtml(null);
      }
    }
  }, [onCaptureComplete, onCaptureError, captureRequest]);

  if (!html) return null;

  return (
    <View 
      className="absolute -left-[9999px] -top-[9999px] w-[600px] h-[400px] opacity-0" 
      pointerEvents="none"
    >
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        onMessage={handleMessage}
        className="flex-1 bg-transparent"
        scrollEnabled={false}
      />
    </View>
  );
}
