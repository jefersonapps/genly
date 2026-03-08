import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ArrowLeft,
    Bell,
    Bold,
    Check,
    CheckSquare,
    Code,
    FileCode,
    FileText,
    Heading1,
    Heading2,
    Heading3,
    Image as ImageIcon,
    Italic,
    List,
    ListOrdered,
    Plus,
    Quote,
    Redo,
    Sigma,
    Sparkles,
    Strikethrough,
    Trash2,
    Underline,
    Undo,
    X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import PdfThumbnail from "react-native-pdf-thumbnail";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ensureFileProtocol = (uri: string) => {
  if (!uri) return uri;
  if (
    !uri.startsWith("file://") &&
    !uri.startsWith("content://") &&
    !uri.startsWith("http") &&
    uri.startsWith("/")
  ) {
    return `file://${uri}`;
  }
  return uri;
};

import {
    EnrichedTextInput,
    type EnrichedTextInputInstance,
} from "react-native-enriched";

import { MediaPreview } from "@/components/task/MediaPreview";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { GroupChipList } from "@/components/ui/GroupChipList";
import type { Group, Media } from "@/db/schema";
import { AIProcessMode, aiService } from "@/services/aiService";
import { latexStateService } from "@/services/latexStateService";
import {
    addMedia,
    createTask,
    deleteMedia,
    getAllGroups,
    getMediaForTask,
    getTaskById,
    updateTask,
} from "@/services/taskService";
import { copyToMediaDir, pickImages } from "@/utils/file";
// ─── Helpers ─────────────────────────────────────
/** Wrap HTML content in <html> tags for react-native-enriched parser */
function wrapHtml(html: string): string {
  const trimmed = html.trim();
  if (trimmed.startsWith("<html>") && trimmed.endsWith("</html>")) return trimmed;
  return `<html>\n${trimmed}\n</html>`;
}
/** Parse hex color to {r,g,b} (0-255) */
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

/** Relative luminance (0 = black, 1 = white) */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Returns a color derived from `color` that is guaranteed to contrast with the
 * current theme surface.  If the original color already contrasts, it is
 * returned as-is.  Otherwise it is lightened (dark theme) or darkened (light
 * theme) until it reaches an acceptable ratio.
 */
function getContrastSafeColor(color: string, isDark: boolean): string {
  const bgLum = isDark ? 0.03 : 0.95; // approx luminance of #0A0A0A / #FFFFFF
  const colorLum = luminance(color);

  // WCAG contrast ratio
  const ratio =
    (Math.max(colorLum, bgLum) + 0.05) /
    (Math.min(colorLum, bgLum) + 0.05);

  if (ratio >= 3) return color; // enough contrast

  // Lighten for dark bg, darken for light bg
  const { r, g, b } = hexToRgb(color);
  if (isDark) {
    // Lighten: blend towards white
    const t = 0.55;
    const nr = Math.round(r + (255 - r) * t);
    const ng = Math.round(g + (255 - g) * t);
    const nb = Math.round(b + (255 - b) * t);
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
  }
  // Darken: blend towards black
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
      activeOpacity={0.8}
      className="w-10 h-10 rounded-full items-center justify-center m-0.5"
      style={[
        isActive && { backgroundColor: activeBg },
        isBlocking && { opacity: 0.3 },
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
}

// ─── Editor ──────────────────────────────────────
export default function TaskEditor() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    sharedText?: string;
    sharedImages?: string;
    groupId?: string;
    reminderDate?: string;
    deliveryDate?: string;
    deliveryTime?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const safeAccent = getContrastSafeColor(primaryColor, isDark);
  const dialog = useDialog();

  const isEditing = !!params.id;
  const taskId = params.id ? parseInt(params.id) : null;
  const { isVisible: isKeyboardVisible } = useKeyboard();

  const [title, setTitle] = useState("");
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");
  const [initialContent, setInitialContent] = useState<string | undefined>(undefined);
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    params.groupId ? parseInt(params.groupId) : null
  );
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);
  const [deliveryTime, setDeliveryTime] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tempMedia, setTempMedia] = useState<{
    uri: string;
    type: 'image' | 'latex' | 'pdf';
    latexSource?: string;
    latexStyle?: string;
    thumbnailUri?: string;
  }[]>([]);
  const [dataLoaded, setDataLoaded] = useState(!isEditing);
  const [aiLoading, setAiLoading] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const lastSavedHtmlRef = useRef<string>("");
  const [flexToggle, setFlexToggle] = useState(true);

  const memoizedDate = React.useMemo(() => {
    return deliveryDate ? new Date(deliveryDate + 'T00:00:00') : new Date();
  }, [deliveryDate]);

  const memoizedTime = React.useMemo(() => {
    return deliveryDate && deliveryTime ? new Date(`${deliveryDate}T${deliveryTime}`) : new Date();
  }, [deliveryDate, deliveryTime]);

  // Rich text editor
  const editorRef = useRef<EnrichedTextInputInstance>(null);
  const [stylesState, setStylesState] = useState<EditorStylesState | null>(null);



  // ─── Load Data ───────────────────────
  useEffect(() => {
    loadInitialData();
  }, [taskId]);

  useEffect(() => {
    if (params.sharedText) {
      setInitialContent(params.sharedText);
      setHtmlContent(params.sharedText);
    }
    if (params.sharedImages) {
      try {
        const uris: string[] = JSON.parse(params.sharedImages);
        setSaving(true);
        Promise.all(
          uris.map(async (uri) => {
            try {
              return await copyToMediaDir(uri);
            } catch {
              return uri;
            }
          })
        ).then((localUris) => {
          setTempMedia((prev) => [
            ...prev,
            ...localUris.map((uri) => ({ uri, type: "image" as const })),
          ]);
          setSaving(false);
        });
      } catch {
        setSaving(false);
      }
    }
    
    // Handle reminder parameters
    if (params.deliveryDate) {
      setDeliveryDate(params.deliveryDate);
    }
    if (params.deliveryTime) {
      setDeliveryTime(params.deliveryTime);
    }
    
    if (params.reminderDate && !params.deliveryDate) {
      try {
        const date = new Date(params.reminderDate);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          setDeliveryDate(`${year}-${month}-${day}`);
          
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          setDeliveryTime(`${hours}:${minutes}`);
        }
      } catch (e) {
        console.error("Failed to parse reminderDate param", e);
      }
    }
  }, [params.sharedText, params.sharedImages, params.reminderDate, params.deliveryDate, params.deliveryTime]);
 
  useEffect(() => {
    setFlexToggle(!isKeyboardVisible);
  }, [isKeyboardVisible]);

  const loadInitialData = async () => {
    const allGroups = await getAllGroups();
    // Filter out restricted groups dedicated to specific tools
    const filteredGroups = allGroups.filter(
      (g) => g.name !== "Mapas Mentais" && g.name !== "Flashcards"
    );
    setGroups(filteredGroups);
    if (taskId) {
      const t = await getTaskById(taskId);
      if (t) {
        setTitle(t.title);
        const content = t.content ?? "";
        setHtmlContent(content);
        setInitialContent(content);
        setSelectedGroupId(t.groupId);
        setDeliveryDate(t.deliveryDate || null);
        setDeliveryTime(t.deliveryTime || null);
        const m = await getMediaForTask(taskId);
        setMediaItems(m);
      }
    }
    setDataLoaded(true);
  };

  // LaTeX state listener
  useEffect(() => {
    const unsubscribe = latexStateService.onResult((result) => {
      if (result.index !== null) {
        setTempMedia((prev) => {
          const arr = [...prev];
          if (arr[result.index!]) {
            arr[result.index!].uri = result.uri;
            arr[result.index!].latexSource = result.latex;
            arr[result.index!].latexStyle = result.style;
          }
          return arr;
        });
      } else {
        setTempMedia((prev) => [...prev, { uri: result.uri, type: "latex", latexSource: result.latex, latexStyle: result.style }]);
      }
    });

    return unsubscribe;
  }, []);

  // ─── Save ───────────────────────────
  const handleSave = async () => {
    if (!title.trim()) {
      dialog.show({ title: "Erro", description: "O título é obrigatório." });
      return;
    }
    setSaving(true);
    try {
      let finalContent = htmlContent;
      try {
        if (editorRef.current) finalContent = await editorRef.current.getHTML();
      } catch {}

      let currentTaskId = taskId;
      if (isEditing && currentTaskId) {
        await updateTask(currentTaskId, {
          title,
          content: finalContent,
          groupId: selectedGroupId,
          deliveryDate,
          deliveryTime,
        });
      } else {
        const newTask = await createTask(title, finalContent, selectedGroupId, deliveryDate, deliveryTime);
        currentTaskId = newTask.id;
      }

      for (const m of tempMedia) {
        let finalUri = m.uri;
        let finalThumbnailUri = m.thumbnailUri;

        // Ensure all media (images, pdfs) are in the persistent media directory
        if (m.uri.includes("/cache/")) {
          try {
            finalUri = await copyToMediaDir(m.uri);
          } catch (e) {
            console.error("Failed to copy main media to persistent storage", e);
          }
        }

        // Ensure thumbnails are also stored persistently
        if (m.thumbnailUri && m.thumbnailUri.includes("/cache/")) {
          try {
            finalThumbnailUri = await copyToMediaDir(m.thumbnailUri);
          } catch (e) {
            console.error("Failed to copy thumbnail to persistent storage", e);
          }
        }

        await addMedia(
          currentTaskId!,
          finalUri,
          m.type as any,
          m.latexSource,
          m.latexStyle,
          finalThumbnailUri
        );
      }
      router.back();
    } catch (e) {
      dialog.show({ title: "Erro", description: "Falha ao salvar a nota." });
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ─── Media Handlers ─────────────────
  const handlePickImage = async () => {
    try {
      const uris = await pickImages();
      if (uris.length > 0)
        setTempMedia((prev) => [...prev, ...uris.map((uri) => ({ uri, type: "image" as const }))]);
    } catch {}
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
      });

       if (!result.canceled && result.assets && result.assets.length > 0) {
         setSaving(true); // Use existing saving state
         try {
           const newMediaItems = await Promise.all(result.assets.map(async (asset: DocumentPicker.DocumentPickerAsset) => {
             try {
               const thumbnail = await PdfThumbnail.generate(asset.uri, 0);
               return {
                 uri: asset.uri,
                 type: 'pdf' as const,
                 thumbnailUri: ensureFileProtocol(thumbnail.uri)
               };
             } catch (e) {
               console.error("Thumbnail generation failed for", asset.uri, e);
               return {
                 uri: asset.uri,
                 type: 'pdf' as const
               };
             }
           }));
           setTempMedia(prev => [...prev, ...newMediaItems]);
         } catch (e) {
           console.error("Failed to process documents", e);
         } finally {
           setSaving(false);
         }
       }
    } catch (e) {
      console.error("Failed to pick document", e);
    }
  };

  const openLatexEditor = (existingLatex?: string, index?: number, existingStyle?: string) => {
    router.push({
      pathname: "/task/latex-editor",
      params: {
        latex: existingLatex || "",
        style: existingStyle || "",
        index: index !== undefined ? index.toString() : "",
      },
    });
  };

  const exportFormatRef = useRef<"share-png" | "save-png" | null>(null);

  const removeMedia = (id: number) => {
    dialog.show({
      title: "Remover",
      description: "Deseja remover este anexo?",
      buttons: [
        { text: "Cancelar", variant: "ghost" },
        {
          text: "Remover",
          variant: "destructive",
          onPress: async () => {
            await deleteMedia(id);
            setMediaItems((prev) => prev.filter((m) => m.id !== id));
          },
        },
      ],
    });
  };

  const removeTempMedia = (index: number) => {
    setTempMedia((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── AI Handler ─────────────────────
  const lastAIModeRef = useRef<AIProcessMode>("format");

  const showAIErrorDialog = (message: string, mode: AIProcessMode) => {
    dialog.show({
      title: "Erro na IA",
      description: message,
      buttons: [
        {
          text: "Configurações",
          variant: "ghost",
          onPress: () => router.push("/settings/ai-config"),
        },
        {
          text: "Tentar Novamente",
          variant: "default",
          onPress: () => handleAIAction(mode),
        },
      ],
    });
  };

  const addToUndo = (content: string) => {
    if (!content) return;
    setUndoStack(prev => {
      // Avoid duplicate consecutive entries
      if (prev.length > 0 && prev[prev.length - 1] === content) return prev;
      return [...prev.slice(-49), content]; // Limit to 50 entries
    });
    setRedoStack([]);
  };

  // Debounced undo capture during typing
  useEffect(() => {
    if (!htmlContent || htmlContent === lastSavedHtmlRef.current) return;

    const timer = setTimeout(() => {
      addToUndo(lastSavedHtmlRef.current);
      lastSavedHtmlRef.current = htmlContent;
    }, 500); // Capture state after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [htmlContent]);

  const runToolbarAction = (action: () => void) => {
    // Capture state immediately before any formatting action
    if (htmlContent !== lastSavedHtmlRef.current) {
        addToUndo(lastSavedHtmlRef.current);
        lastSavedHtmlRef.current = htmlContent;
    } else {
        addToUndo(htmlContent);
    }
    action();
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const currentHTML = htmlContent;
    const previousHTML = undoStack[undoStack.length - 1];
    
    setRedoStack(prev => [...prev, currentHTML]);
    setUndoStack(prev => prev.slice(0, -1));
    
    setHtmlContent(previousHTML);
    editorRef.current?.setValue(wrapHtml(previousHTML));
    lastSavedHtmlRef.current = previousHTML;
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const currentHTML = htmlContent;
    const nextHTML = redoStack[redoStack.length - 1];
    
    setUndoStack(prev => [...prev, currentHTML]);
    setRedoStack(prev => prev.slice(0, -1));
    
    setHtmlContent(nextHTML);
    editorRef.current?.setValue(wrapHtml(nextHTML));
    lastSavedHtmlRef.current = nextHTML;
  };

  const handleAIAction = async (mode: AIProcessMode) => {
    Keyboard.dismiss();
    lastAIModeRef.current = mode;

    if (!htmlContent && !initialContent) {
      dialog.show({ title: "Aviso", description: "Escreva algo para a IA processar." });
      return;
    }
    
    let contentToProcess = htmlContent;
    if (editorRef.current) {
        try {
            contentToProcess = await editorRef.current.getHTML();
        } catch {}
    }

    if (!contentToProcess || contentToProcess.trim() === "") {
        dialog.show({ title: "Aviso", description: "O editor está vazio." });
        return;
    }

    setAiLoading(true);
    const result = await aiService.processText(contentToProcess, mode, title);
    setAiLoading(false);

    if (result.success && result.text) {
        const text = result.text.trim();

        const hasHtmlTags = /<[a-z][a-z0-9]*[\s>]/i.test(text);
        if (!hasHtmlTags) {
          showAIErrorDialog(
            "A IA retornou um formato inválido (sem tags HTML). Isso pode ser um problema de configuração ou do servidor.",
            mode
          );
          return;
        }

        // Apply directly with undo support
        addToUndo(contentToProcess);
        setHtmlContent(text);
        editorRef.current?.setValue(wrapHtml(text));
        lastSavedHtmlRef.current = text;
    } else {
        showAIErrorDialog(
          result.error || "Falha ao processar texto com IA.",
          mode
        );
    }
  };

  // ─── Theme colors ──────────────────
  const colors = {
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    iconDefault: isDark ? "#D4D4D8" : "#52525B",
    surface: isDark ? "#0A0A0A" : "#FFFFFF",
    surfaceSecondary: isDark ? "#171717" : "#F5F5F5",
    surfaceTertiary: isDark ? "#262626" : "#E4E4E7",
    border: isDark ? "#262626" : "#E5E5E5",
    placeholder: isDark ? "#52525B" : "#A1A1AA",
  };

  const getIconColor = useCallback(
    (isActive?: boolean) => (isActive ? safeAccent : colors.iconDefault),
    [safeAccent, colors.iconDefault]
  );

  const formatReminder = () => {
    if (!deliveryDate || !deliveryTime) return "Definir lembrete";
    try {
      const date = new Date(`${deliveryDate}T${deliveryTime}`);
      return date.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return "Definir lembrete";
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (event.type === "set") {
      setShowDatePicker(false);
      if (selectedDate) {
        // Noon Normalization: Add 12 hours to ensure the date stays on the same day 
        // regardless of timezone offsets (-12h to +12h).
        const normalized = new Date(selectedDate.getTime() + 12 * 60 * 60 * 1000);
        const year = normalized.getFullYear();
        const month = (normalized.getMonth() + 1).toString().padStart(2, '0');
        const day = normalized.getDate().toString().padStart(2, '0');
        
        const dateStr = `${year}-${month}-${day}`;
        setDeliveryDate(dateStr);
        // Only open time picker if time isn't set yet
        if (!deliveryTime) {
          setTimeout(() => openTimePicker(), 150);
        }
      }
    } else {
      setShowDatePicker(false);
      // Logic: if we have time but no date (dismissed), set date to today
      if (deliveryTime && !deliveryDate) {
        setDeliveryDate(new Date().toISOString().split("T")[0]);
      }
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (event.type === "set") {
      setShowTimePicker(false);
      if (selectedTime) {
        const timeStr = selectedTime.toTimeString().split(" ")[0].substring(0, 5);
        setDeliveryTime(timeStr);
      }
    } else {
      setShowTimePicker(false);
      // Logic: if we have date but no time (dismissed), set time to now
      if (deliveryDate && !deliveryTime) {
        setDeliveryTime(new Date().toTimeString().split(" ")[0].substring(0, 5));
      }
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === "android") {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - 1); // Extra safety: set to yesterday to ensure today is active
      minDate.setHours(0, 0, 0, 0);

      DateTimePickerAndroid.open({
        value: memoizedDate,
        onChange: handleDateChange,
        mode: "date",
        display: "default",
        design: "material",
        minimumDate: minDate,
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const openTimePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: memoizedTime,
        onChange: handleTimeChange,
        mode: "time",
        display: "default",
        design: "material",
      });
    } else {
      setShowTimePicker(true);
    }
  };

  const removeReminder = () => {
    setDeliveryDate(null);
    setDeliveryTime(null);
  };

  // Set initial content via setValue after mount (defaultValue has a rendering bug with headings)
  useEffect(() => {
    if (dataLoaded && initialContent && editorRef.current) {
      lastSavedHtmlRef.current = initialContent;
      // Small delay to ensure native view is ready
      const timer = setTimeout(() => {
        editorRef.current?.setValue(wrapHtml(initialContent));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dataLoaded, initialContent]);

  // ─── Render ────────────────────────
  return (
    <KeyboardAvoidingView 
      className="flex-1" 
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 20}
      style={[
        { paddingTop: insets.top, backgroundColor: colors.surface },
        flexToggle ? { flexGrow: 1 } : { flex: 1 }
      ]}
    >
      {/* ── Header ── */}
      <View
        className="flex-row items-center justify-between px-4 py-3 border-b"
        style={[
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View className="flex-row items-center">
          <Button variant="icon" onPress={() => router.back()} className="mr-1">
            <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
          </Button>
          <Text className="font-sans-bold text-lg ml-2" style={[{ color: colors.text }]}>
            {isEditing ? "Editar Nota" : "Nova Nota"}
          </Text>
        </View>

        <Button rounded="full" onPress={handleSave} loading={saving}>
          <Button.Icon icon={<Check size={18} color="#FFF" />} />
          <Button.Text className="ml-2">Salvar</Button.Text>
        </Button>
      </View>

      <View className="px-5 pt-2.5">
        {/* Title */}
        {isTitleFocused ? (
          <TextInput
            autoFocus
            placeholder="Título da nota"
            placeholderTextColor={colors.placeholder}
            value={title}
            onChangeText={setTitle}
            multiline={false}
            numberOfLines={1}
            returnKeyType="done"
            blurOnSubmit={true}
            onBlur={() => setIsTitleFocused(false)}
            textAlignVertical="center"
            className="font-extrabold"
            style={[
              { 
                color: colors.text, 
                paddingVertical: 0,
                paddingHorizontal: 0,
                height: 48,
                fontSize: 26,
                includeFontPadding: false,
              }
            ]}
          />
        ) : (
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={() => setIsTitleFocused(true)}
            style={{ height: 48, justifyContent: 'center', paddingHorizontal: 0 }}
          >
            <Text 
              numberOfLines={1} 
              ellipsizeMode="tail"
              className="font-extrabold text-[26px]"
              style={[{ color: title ? colors.text : colors.placeholder, lineHeight: 32, paddingHorizontal: 0 }]}
            >
              {title || "Título da nota"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View 
        className="py-1.5 mb-4 border-b"
        style={[{ backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', gap: 2, paddingBottom: 6, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="always"
        >
          
          <Dropdown>
            <Dropdown.Trigger>
                <TouchableOpacity 
                    activeOpacity={0.8}
                    className="w-9.5 h-9.5 rounded-xl items-center justify-center"
                    style={[{ opacity: aiLoading ? 0.5 : 1 }]} 
                    disabled={aiLoading}
                >
                    {aiLoading ? (
                        <ActivityIndicator size="small" color={safeAccent} animating={true} />
                    ) : (
                        <Sparkles size={18} color={colors.textSecondary} />
                    )}
                </TouchableOpacity>
            </Dropdown.Trigger>
            <Dropdown.Content width={200} direction="bottom">
                <Dropdown.Item 
                    label="Formatar texto" 
                    icon={FileCode} 
                    onPress={() => handleAIAction("format")} 
                />
                <Dropdown.Item 
                    label="Corrigir gramática" 
                    icon={CheckSquare} 
                    onPress={() => handleAIAction("grammar")} 
                />
            </Dropdown.Content>
          </Dropdown>
 
          <View className="w-[1px] h-[22px] mx-1.5 self-center" style={[{ backgroundColor: colors.surfaceTertiary }]} />
 
          <ToolbarButton
            icon={<Undo size={18} color={undoStack.length > 0 ? colors.text : colors.placeholder} />}
            onPress={handleUndo}
            isBlocking={undoStack.length === 0}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<Redo size={18} color={redoStack.length > 0 ? colors.text : colors.placeholder} />}
            onPress={handleRedo}
            isBlocking={redoStack.length === 0}
            activeBg={safeAccent + "20"}
          />
 
          <View className="w-[1px] h-[22px] mx-1.5 self-center" style={[{ backgroundColor: colors.surfaceTertiary }]} />
          
          <ToolbarButton
            icon={<Bold size={18} color={getIconColor(stylesState?.bold?.isActive)} />}
            isActive={stylesState?.bold?.isActive}
            isBlocking={stylesState?.bold?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleBold())}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<Italic size={18} color={getIconColor(stylesState?.italic?.isActive)} />}
            isActive={stylesState?.italic?.isActive}
            isBlocking={stylesState?.italic?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleItalic())}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<Underline size={18} color={getIconColor(stylesState?.underline?.isActive)} />}
            isActive={stylesState?.underline?.isActive}
            isBlocking={stylesState?.underline?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleUnderline())}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<Strikethrough size={18} color={getIconColor(stylesState?.strikeThrough?.isActive)} />}
            isActive={stylesState?.strikeThrough?.isActive}
            isBlocking={stylesState?.strikeThrough?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleStrikeThrough())}
            activeBg={safeAccent + "20"}
          />

          <View className="w-[1px] h-[22px] mx-1.5 self-center" style={[{ backgroundColor: colors.surfaceTertiary }]} />

          <ToolbarButton
            icon={<Heading1 size={18} color={getIconColor(stylesState?.h1?.isActive)} />}
            isActive={stylesState?.h1?.isActive}
            isBlocking={stylesState?.h1?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleH1())}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<Heading2 size={18} color={getIconColor(stylesState?.h2?.isActive)} />}
            isActive={stylesState?.h2?.isActive}
            isBlocking={stylesState?.h2?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleH2())}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<Heading3 size={18} color={getIconColor(stylesState?.h3?.isActive)} />}
            isActive={stylesState?.h3?.isActive}
            isBlocking={stylesState?.h3?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleH3())}
            activeBg={safeAccent + "20"}
          />

          <View className="w-[1px] h-[22px] mx-1.5 self-center" style={[{ backgroundColor: colors.surfaceTertiary }]} />

          <ToolbarButton
            icon={<List size={18} color={getIconColor(stylesState?.unorderedList?.isActive)} />}
            isActive={stylesState?.unorderedList?.isActive}
            isBlocking={stylesState?.unorderedList?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleUnorderedList())}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<ListOrdered size={18} color={getIconColor(stylesState?.orderedList?.isActive)} />}
            isActive={stylesState?.orderedList?.isActive}
            isBlocking={stylesState?.orderedList?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleOrderedList())}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<CheckSquare size={18} color={getIconColor(stylesState?.checkboxList?.isActive)} />}
            isActive={stylesState?.checkboxList?.isActive}
            isBlocking={stylesState?.checkboxList?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleCheckboxList(false))}
            activeBg={safeAccent + "20"}
          />

          <View className="w-[1px] h-[22px] mx-1.5 self-center" style={[{ backgroundColor: colors.surfaceTertiary }]} />

          <ToolbarButton
            icon={<Quote size={18} color={getIconColor(stylesState?.blockQuote?.isActive)} />}
            isActive={stylesState?.blockQuote?.isActive}
            isBlocking={stylesState?.blockQuote?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleBlockQuote())}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<Code size={18} color={getIconColor(stylesState?.inlineCode?.isActive)} />}
            isActive={stylesState?.inlineCode?.isActive}
            isBlocking={stylesState?.inlineCode?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleInlineCode())}
            activeBg={safeAccent + "20"}
          />
          <ToolbarButton
            icon={<FileCode size={18} color={getIconColor(stylesState?.codeBlock?.isActive)} />}
            isActive={stylesState?.codeBlock?.isActive}
            isBlocking={stylesState?.codeBlock?.isBlocking}
            onPress={() => runToolbarAction(() => editorRef.current?.toggleCodeBlock())}
            activeBg={safeAccent + "20"}
          />
        </ScrollView>
      </View>
        <View className="flex-1 px-5">
          {/* Rich text editor container */}
          <View className="flex-1">
          {dataLoaded && (
            <EnrichedTextInput
              key={`${taskId}-${initialContent?.length || 0}`}
              ref={editorRef}
              placeholder="Comece a escrever..."
              placeholderTextColor={colors.placeholder}
              cursorColor={safeAccent}
              selectionColor={safeAccent + "40"}
              onFocus={() => {
                // Focus empty callback or removed state update
              }}
              onBlur={() => {
                // Blur still useful as final check but debouncing is primary
                if (htmlContent !== lastSavedHtmlRef.current) {
                  addToUndo(lastSavedHtmlRef.current);
                  lastSavedHtmlRef.current = htmlContent;
                }
              }}
              onChangeHtml={(e) => {
                setHtmlContent(e.nativeEvent.value);
              }}
              onChangeState={(e) => setStylesState(e.nativeEvent as unknown as EditorStylesState)}
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

        {/* ── Bottom Toolbar ── */}
        {/* Media section */}
        {/* Media section */}
        {(!isKeyboardVisible || showDatePicker || showTimePicker) && (
          <View 
            className="px-5 pt-2.5 bg-surface" 
            style={[{ paddingBottom: insets.bottom + 10, backgroundColor: colors.surface }]}
          >
            {/* Group picker */}
            <View className="mb-3">
              <Text className="font-sans-bold text-[10px] uppercase tracking-widest mb-1" style={[{ color: colors.textSecondary }]}>Grupo</Text>
              <GroupChipList
                groups={groups}
                selectedGroupId={selectedGroupId}
                onSelect={setSelectedGroupId}
                accentColor={safeAccent}
              />
            </View>
 
            {/* Reminder */}
            <View className="mb-3">
              <Text className="font-sans-bold text-[10px] uppercase tracking-widest mb-1" style={[{ color: colors.textSecondary }]}>Lembrete</Text>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={openDatePicker}
                  activeOpacity={0.8}
                  className="flex-row items-center h-10 px-3 rounded-xl border flex-1"
                  style={[
                    {
                      borderColor: deliveryDate ? safeAccent : "transparent",
                      backgroundColor: deliveryDate ? safeAccent + "15" : colors.surfaceSecondary,
                      marginRight: deliveryDate ? 8 : 0,
                    },
                  ]}
                >
                  <Bell size={16} color={deliveryDate ? safeAccent : colors.iconDefault} style={{ marginRight: 8 }} />
                  <Text className="text-[13px] font-sans-medium" style={[{ color: deliveryDate ? colors.text : colors.textSecondary }]}>
                    {formatReminder()}
                  </Text>
                </TouchableOpacity>
 
                {deliveryDate && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={removeReminder}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={[{ backgroundColor: colors.surfaceSecondary }]}
                  >
                    <X size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>



             <View className="h-[1px] mb-3 mt-1" style={[{ backgroundColor: colors.border }]} />
             
             <Text className="font-sans-bold text-[10px] uppercase tracking-widest mb-2" style={[{ color: colors.textSecondary }]}>Anexos</Text>
             <ScrollView
               horizontal
               showsHorizontalScrollIndicator={false}
               keyboardShouldPersistTaps="handled"
               contentContainerStyle={{ gap: 10, paddingRight: 20 }}
             >
               <Dropdown>
                 <Dropdown.Trigger>
                    <TouchableOpacity 
                      activeOpacity={0.8}
                      style={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: 16, 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: colors.border, 
                        backgroundColor: colors.surfaceSecondary 
                      }}
                    >
                      <Plus size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                 </Dropdown.Trigger>
                 <Dropdown.Content width={180} direction="top" align="start">
                   <Dropdown.Item label="Imagem" icon={ImageIcon} onPress={handlePickImage} />
                   <Dropdown.Item label="Equação LaTeX" icon={Sigma} onPress={() => openLatexEditor()} />
                   <Dropdown.Item label="Documento PDF" icon={FileText} onPress={handlePickDocument} />
                 </Dropdown.Content>
               </Dropdown>

                {mediaItems.map((m) => (
                  <View key={m.id} style={{ width: 80, height: 80, position: 'relative' }}>
                    <TouchableOpacity 
                      activeOpacity={0.8}
                      onPress={() => {
                         if (m.type === 'latex') {
                           openLatexEditor(m.latexSource ?? undefined, undefined, m.latexStyle ?? undefined);
                         } else {
                           const allMedia = [
                             ...mediaItems.map(item => ({ uri: item.uri, type: item.type, thumbnailUri: item.thumbnailUri || (item as any).thumbnail_uri })),
                             ...tempMedia.map(item => ({ uri: item.uri, type: item.type, thumbnailUri: item.thumbnailUri || (item as any).thumbnail_uri }))
                           ];
                           const index = mediaItems.indexOf(m);
                           router.push({
                             pathname: "/media-preview",
                             params: {
                               uri: m.uri,
                               type: m.type,
                               thumbnailUri: m.thumbnailUri || (m as any).thumbnail_uri,
                               mediaItems: JSON.stringify(allMedia),
                                index: index >= 0 ? index.toString() : "0"
                             }
                           });
                         }
                       }}
                    >
                      <MediaPreview media={m as any} size={80} gridSize={12} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 999 }}
                      onPress={() => removeMedia(m.id)}
                    >
                      <Trash2 size={12} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {tempMedia.map((m, i) => (
                  <View key={`t-${i}`} style={{ width: 80, height: 80, position: 'relative' }}>
                    <TouchableOpacity 
                       activeOpacity={0.8}
                       onPress={() => {
                         if (m.type === 'latex') {
                           openLatexEditor(m.latexSource, i, m.latexStyle);
                         } else {
                           const allMedia = [
                             ...mediaItems.map(item => ({ uri: item.uri, type: item.type as "image" | "latex" | "pdf", thumbnailUri: item.thumbnailUri || (item as any).thumbnail_uri })),
                             ...tempMedia.map(item => ({ uri: item.uri, type: item.type as "image" | "latex" | "pdf", thumbnailUri: item.thumbnailUri || (item as any).thumbnail_uri }))
                           ];
                           const index = mediaItems.length + i;
                           router.push({
                             pathname: "/media-preview",
                             params: {
                               uri: m.uri,
                               type: m.type,
                               thumbnailUri: m.thumbnailUri || (m as any).thumbnail_uri,
                               mediaItems: JSON.stringify(allMedia),
                                index: index.toString()
                             }
                           });
                         }
                       }}
                    >
                      <MediaPreview media={m as any} size={80} gridSize={12} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 999 }}
                      onPress={() => removeTempMedia(i)}
                    >
                      <X size={12} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
             </ScrollView>
          </View>
        )}


      {Platform.OS === "ios" && showDatePicker && (
        <DateTimePicker
          value={memoizedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {Platform.OS === "ios" && showTimePicker && (
        <DateTimePicker
          value={memoizedTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

    </KeyboardAvoidingView>
  );
}
