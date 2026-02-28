"use dom";

import React, { useState } from "react";
import AceEditor from "react-ace";

// Import Ace modes and themes
import "ace-builds/src-noconflict/ext-language_tools";
import "ace-builds/src-noconflict/mode-latex";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/theme-monokai";

interface LatexEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  isDark?: boolean;
  blurSignal?: number;
}

export default function LatexEditorDOM({ 
  initialContent = "", 
  onChange,
  isDark = false,
  blurSignal = 0
}: LatexEditorProps) {
  const [content, setContent] = useState(initialContent);
  const editorRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (editorRef.current && blurSignal > 0) {
      editorRef.current.editor.blur();
    }
  }, [blurSignal]);

  const isInitialized = React.useRef(false);

  React.useEffect(() => {
    if (isInitialized.current) return;
    
    // Safety check for Ace configuration
    const initAce = () => {
      try {
        if (typeof window !== "undefined" && (window as any).ace) {
          const ace = (window as any).ace;
          ace.config.set("mobileContextMenu", true);
          isInitialized.current = true;
        }
      } catch (e) {
        console.warn("Ace init warning:", e);
      }
    };

    // Small delay to ensure Ace is loaded in the DOM environment
    const timer = setTimeout(initAce, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleOnChange = (newValue: string) => {
    setContent(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          overscroll-behavior: none;
        }
        /* Native selection support */
        .ace_editor, .ace_editor * {
          user-select: text !important;
          -webkit-user-select: text !important;
          -webkit-touch-callout: default !important;
        }
        .ace_content {
          pointer-events: auto !important;
        }
        /* Ensure mobile menu is reachable and visible */
        .ace_mobile-menu {
          background: #333 !important;
          color: white !important;
        }
      `}</style>
      <div style={{ 
        width: "100%", 
        height: "100%", 
        border: `2px solid ${isDark ? "#3F3F46" : "#D4D4D8"}`, 
        borderRadius: "12px", 
        overflow: "hidden",
        boxSizing: "border-box",
        position: "relative"
      }}>
        <style>{`
          .ace_context-menu,
          .ace_info-marker,
          .ace_error-marker,
          .ace_warning-marker { display: none !important; }
          .ace_editor { font-family: 'monospace' !important; }
        `}</style>
        <AceEditor
          ref={editorRef}
          mode="latex"
          theme={isDark ? "monokai" : "github"}
          onChange={handleOnChange}
          value={content}
          name="latex-ace-editor"
          editorProps={{ $blockScrolling: true }}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
            showLineNumbers: true,
            tabSize: 2,
            fontSize: 14,
            showPrintMargin: false,
            showFoldWidgets: false,
            highlightActiveLine: false,
            useWorker: false,
            vScrollBarAlwaysVisible: true,
            selectionStyle: "text",
            enableMultiselect: false,
            cursorStyle: "ace" 
          }}
          width="100%"
          height="100%"
        />
      </div>
    </>
  );
}
