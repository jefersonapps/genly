import { Button } from "@/components/ui/Button";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { useTheme } from "@/providers/ThemeProvider";
import {
    Bold,
    CheckSquare,
    Code,
    FileCode,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    List,
    ListOrdered,
    Quote,
    Strikethrough,
    Underline,
} from "lucide-react-native";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import { useKeyboard } from "@/hooks/useKeyboard";
import type { EnrichedTextInputInstance } from "react-native-enriched";
import { EnrichedTextInput } from "react-native-enriched";

// ─── Helpers ─────────────────────────────────────
function wrapHtml(html: string): string {
  const trimmed = html.trim();
  if (trimmed.startsWith("<html>") && trimmed.endsWith("</html>")) return trimmed;
  return `<html>\n${trimmed}\n</html>`;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastSafeColor(color: string, isDark: boolean): string {
  const bgLum = isDark ? 0.03 : 0.95;
  const colorLum = luminance(color);
  const ratio =
    (Math.max(colorLum, bgLum) + 0.05) /
    (Math.min(colorLum, bgLum) + 0.05);

  if (ratio >= 3) return color;

  const { r, g, b } = hexToRgb(color);
  if (isDark) {
    const t = 0.55;
    const nr = Math.round(r + (255 - r) * t);
    const ng = Math.round(g + (255 - g) * t);
    const nb = Math.round(b + (255 - b) * t);
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
  }
  const t = 0.45;
  const nr = Math.round(r * (1 - t));
  const ng = Math.round(g * (1 - t));
  const nb = Math.round(b * (1 - t));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

// ─── Types ───────────────────────────────────────
interface StyleState {
  isActive: boolean;
  isConflicting: boolean;
  isBlocking: boolean;
}

interface EditorStylesState {
  bold: StyleState;
  italic: StyleState;
  underline: StyleState;
  strikeThrough: StyleState;
  inlineCode: StyleState;
  h1: StyleState;
  h2: StyleState;
  h3: StyleState;
  codeBlock: StyleState;
  blockQuote: StyleState;
  orderedList: StyleState;
  unorderedList: StyleState;
  checkboxList: StyleState;
  link: StyleState;
  image: StyleState;
  mention: StyleState;
}

export interface EditorColors {
  text: string;
  textSecondary: string;
  iconDefault: string;
  surface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  border: string;
  placeholder: string;
}

export interface EditorContextValue {
  title: string;
  setTitle: (t: string) => void;
  htmlContent: string;
  setHtmlContent: (c: string) => void;
  editorRef: React.RefObject<EnrichedTextInputInstance | null>;
  colors: EditorColors;
  safeAccent: string;
  isDark: boolean;
  primaryColor: string;
  isKeyboardVisible: boolean;
  stylesState: EditorStylesState | null;
  setStylesState: (s: EditorStylesState | null) => void;
  dataLoaded: boolean;
  setDataLoaded: (v: boolean) => void;
  initialContent: string | undefined;
  setInitialContent: (c: string | undefined) => void;
}

const EditorCtx = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorCtx);
  if (!ctx) throw new Error("useEditorContext must be used within Editor.Root");
  return ctx;
}

// ─── Toolbar Button ──────────────────────────────
function ToolbarButton({
  icon,
  isActive,
  isBlocking,
  onPress,
  activeBg,
}: {
  icon: React.ReactNode;
  isActive?: boolean;
  isBlocking?: boolean;
  onPress: () => void;
  activeBg: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isBlocking}
      activeOpacity={0.6}
      style={[
        styles.toolbarBtn,
        isActive && { backgroundColor: activeBg },
        isBlocking && { opacity: 0.3 },
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
}

// ─── Sub-components ──────────────────────────────

/** Root provider — wraps entire editor, provides shared state */
function EditorRoot({
  children,
  defaultTitle = "",
  defaultContent = "",
  autoLoadContent = true,
}: {
  children: ReactNode;
  defaultTitle?: string;
  defaultContent?: string;
  autoLoadContent?: boolean;
}) {
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const safeAccent = getContrastSafeColor(primaryColor, isDark);

  const [title, setTitle] = useState(defaultTitle);
  const [htmlContent, setHtmlContent] = useState(defaultContent);
  const [initialContent, setInitialContent] = useState<string | undefined>(
    autoLoadContent ? defaultContent || undefined : undefined
  );
  const [dataLoaded, setDataLoaded] = useState(true);
  const [stylesState, setStylesState] = useState<EditorStylesState | null>(null);
  const { isVisible: isKeyboardVisible } = useKeyboard();

  const editorRef = useRef<EnrichedTextInputInstance>(null);

  const colors: EditorColors = {
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    iconDefault: isDark ? "#D4D4D8" : "#52525B",
    surface: isDark ? "#0A0A0A" : "#FFFFFF",
    surfaceSecondary: isDark ? "#171717" : "#F5F5F5",
    surfaceTertiary: isDark ? "#262626" : "#E4E4E7",
    border: isDark ? "#262626" : "#E5E5E5",
    placeholder: isDark ? "#52525B" : "#A1A1AA",
  };

  useEffect(() => {
    // Keyboard visibility is now handled by our useKeyboard hook
  }, []);

  // Set initial content after mount
  useEffect(() => {
    if (dataLoaded && initialContent && editorRef.current) {
      const timer = setTimeout(() => {
        editorRef.current?.setValue(wrapHtml(initialContent));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dataLoaded, initialContent]);

  return (
    <EditorCtx.Provider
      value={{
        title,
        setTitle,
        htmlContent,
        setHtmlContent,
        editorRef,
        colors,
        safeAccent,
        isDark,
        primaryColor,
        isKeyboardVisible,
        stylesState,
        setStylesState: setStylesState as any,
        dataLoaded,
        setDataLoaded,
        initialContent,
        setInitialContent,
      }}
    >
      {children}
    </EditorCtx.Provider>
  );
}

/** Header bar with back button, title text, and action slot */
function EditorHeader({
  headerTitle,
  onBack,
  rightSlot,
}: {
  headerTitle: string;
  onBack: () => void;
  rightSlot?: ReactNode;
}) {
  const { colors } = useEditorContext();
  const { ArrowLeft } = require("lucide-react-native");

  return (
    <View
      style={[
        styles.header,
        { borderBottomColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.headerLeft}>
        <Button variant="icon" onPress={onBack} className="mr-1">
          <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
        </Button>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {headerTitle}
        </Text>
      </View>
      {rightSlot}
    </View>
  );
}

/** Reusable title input field */
function EditorTitleInput({ placeholder = "Título" }: { placeholder?: string }) {
  const { title, setTitle, colors } = useEditorContext();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        value={title}
        onChangeText={setTitle}
        multiline
        scrollEnabled={false}
        style={[styles.titleInput, { color: colors.text, marginBottom: 8 }]}
      />
    </View>
  );
}

/** Rich-text formatting toolbar with all standard buttons */
function EditorToolbar({ extraLeft, extraRight }: { extraLeft?: ReactNode; extraRight?: ReactNode }) {
  const { editorRef, stylesState, safeAccent, colors } = useEditorContext();

  const getIconColor = useCallback(
    (isActive?: boolean) => (isActive ? safeAccent : colors.iconDefault),
    [safeAccent, colors.iconDefault]
  );

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingVertical: 6,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolbarRow}
        keyboardShouldPersistTaps="always"
      >
        {extraLeft}

        <ToolbarButton
          icon={<Bold size={18} color={getIconColor(stylesState?.bold?.isActive)} />}
          isActive={stylesState?.bold?.isActive}
          isBlocking={stylesState?.bold?.isBlocking}
          onPress={() => editorRef.current?.toggleBold()}
          activeBg={safeAccent + "20"}
        />
        <ToolbarButton
          icon={<Italic size={18} color={getIconColor(stylesState?.italic?.isActive)} />}
          isActive={stylesState?.italic?.isActive}
          isBlocking={stylesState?.italic?.isBlocking}
          onPress={() => editorRef.current?.toggleItalic()}
          activeBg={safeAccent + "20"}
        />
        <ToolbarButton
          icon={<Underline size={18} color={getIconColor(stylesState?.underline?.isActive)} />}
          isActive={stylesState?.underline?.isActive}
          isBlocking={stylesState?.underline?.isBlocking}
          onPress={() => editorRef.current?.toggleUnderline()}
          activeBg={safeAccent + "20"}
        />
        <ToolbarButton
          icon={<Strikethrough size={18} color={getIconColor(stylesState?.strikeThrough?.isActive)} />}
          isActive={stylesState?.strikeThrough?.isActive}
          isBlocking={stylesState?.strikeThrough?.isBlocking}
          onPress={() => editorRef.current?.toggleStrikeThrough()}
          activeBg={safeAccent + "20"}
        />

        <View style={[styles.separator, { backgroundColor: colors.surfaceTertiary }]} />

        <ToolbarButton
          icon={<Heading1 size={18} color={getIconColor(stylesState?.h1?.isActive)} />}
          isActive={stylesState?.h1?.isActive}
          isBlocking={stylesState?.h1?.isBlocking}
          onPress={() => editorRef.current?.toggleH1()}
          activeBg={safeAccent + "20"}
        />
        <ToolbarButton
          icon={<Heading2 size={18} color={getIconColor(stylesState?.h2?.isActive)} />}
          isActive={stylesState?.h2?.isActive}
          isBlocking={stylesState?.h2?.isBlocking}
          onPress={() => editorRef.current?.toggleH2()}
          activeBg={safeAccent + "20"}
        />
        <ToolbarButton
          icon={<Heading3 size={18} color={getIconColor(stylesState?.h3?.isActive)} />}
          isActive={stylesState?.h3?.isActive}
          isBlocking={stylesState?.h3?.isBlocking}
          onPress={() => editorRef.current?.toggleH3()}
          activeBg={safeAccent + "20"}
        />

        <View style={[styles.separator, { backgroundColor: colors.surfaceTertiary }]} />

        <ToolbarButton
          icon={<List size={18} color={getIconColor(stylesState?.unorderedList?.isActive)} />}
          isActive={stylesState?.unorderedList?.isActive}
          isBlocking={stylesState?.unorderedList?.isBlocking}
          onPress={() => editorRef.current?.toggleUnorderedList()}
          activeBg={safeAccent + "20"}
        />
        <ToolbarButton
          icon={<ListOrdered size={18} color={getIconColor(stylesState?.orderedList?.isActive)} />}
          isActive={stylesState?.orderedList?.isActive}
          isBlocking={stylesState?.orderedList?.isBlocking}
          onPress={() => editorRef.current?.toggleOrderedList()}
          activeBg={safeAccent + "20"}
        />
        <ToolbarButton
          icon={<CheckSquare size={18} color={getIconColor(stylesState?.checkboxList?.isActive)} />}
          isActive={stylesState?.checkboxList?.isActive}
          isBlocking={stylesState?.checkboxList?.isBlocking}
          onPress={() => editorRef.current?.toggleCheckboxList(false)}
          activeBg={safeAccent + "20"}
        />

        <View style={[styles.separator, { backgroundColor: colors.surfaceTertiary }]} />

        <ToolbarButton
          icon={<Quote size={18} color={getIconColor(stylesState?.blockQuote?.isActive)} />}
          isActive={stylesState?.blockQuote?.isActive}
          isBlocking={stylesState?.blockQuote?.isBlocking}
          onPress={() => editorRef.current?.toggleBlockQuote()}
          activeBg={safeAccent + "20"}
        />
        <ToolbarButton
          icon={<Code size={18} color={getIconColor(stylesState?.inlineCode?.isActive)} />}
          isActive={stylesState?.inlineCode?.isActive}
          isBlocking={stylesState?.inlineCode?.isBlocking}
          onPress={() => editorRef.current?.toggleInlineCode()}
          activeBg={safeAccent + "20"}
        />
        <ToolbarButton
          icon={<FileCode size={18} color={getIconColor(stylesState?.codeBlock?.isActive)} />}
          isActive={stylesState?.codeBlock?.isActive}
          isBlocking={stylesState?.codeBlock?.isBlocking}
          onPress={() => editorRef.current?.toggleCodeBlock()}
          activeBg={safeAccent + "20"}
        />

        {extraRight}
      </ScrollView>
    </View>
  );
}

/** Rich text content area */
function EditorContent({
  placeholder = "Comece a escrever...",
}: {
  placeholder?: string;
}) {
  const {
    editorRef,
    colors,
    safeAccent,
    setHtmlContent,
    setStylesState,
    dataLoaded,
    isKeyboardVisible,
  } = useEditorContext();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <View style={{ flex: 1 }}>
          {dataLoaded && (
            <EnrichedTextInput
              ref={editorRef}
              placeholder={placeholder}
              placeholderTextColor={colors.placeholder}
              cursorColor={safeAccent}
              selectionColor={safeAccent + "40"}
              onChangeHtml={(e) => setHtmlContent(e.nativeEvent.value)}
              onChangeState={(e) =>
                setStylesState(e.nativeEvent as unknown as EditorStylesState)
              }
              androidExperimentalSynchronousEvents
              htmlStyle={{
                h1: { fontSize: 28, bold: true },
                h2: { fontSize: 24, bold: true },
                h3: { fontSize: 20, bold: true },
                blockquote: {
                  borderColor: safeAccent,
                  borderWidth: 3,
                  gapWidth: 12,
                  color: colors.textSecondary,
                },
                codeblock: {
                  color: colors.text,
                  backgroundColor: colors.surfaceTertiary,
                  borderRadius: 8,
                },
                code: {
                  color: safeAccent,
                  backgroundColor: colors.surfaceTertiary,
                },
                a: { color: safeAccent, textDecorationLine: "underline" },
                ol: {
                  gapWidth: 8,
                  marginLeft: 4,
                  markerColor: colors.textSecondary,
                },
                ul: {
                  bulletColor: safeAccent,
                  bulletSize: 6,
                  marginLeft: 4,
                  gapWidth: 8,
                },
                ulCheckbox: {
                  boxSize: 20,
                  gapWidth: 8,
                  marginLeft: 4,
                  boxColor: safeAccent,
                },
              }}
              style={{
                fontSize: 18,
                color: colors.text,
                flex: 1,
              }}
              scrollEnabled={true}
            />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Compound Export ─────────────────────────────
export const Editor = Object.assign(EditorRoot, {
  Header: EditorHeader,
  TitleInput: EditorTitleInput,
  Toolbar: EditorToolbar,
  Content: EditorContent,
});

// Re-exports
export { wrapHtml };
export type { EditorStylesState };

// ─── Styles ──────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  headerTitle: { fontWeight: "700", fontSize: 20, marginLeft: 4 },
  titleInput: { fontWeight: "800", fontSize: 26, marginBottom: 4 },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 2,
    paddingBottom: 6,
  },
  toolbarBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: {
    width: 1,
    height: 22,
    marginHorizontal: 6,
    alignSelf: "center" as const,
  },
});
