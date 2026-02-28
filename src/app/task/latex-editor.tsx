import { Button } from "@/components/ui/Button";
import { ColorPickerModal } from "@/components/ui/ColorPickerModal";
import { Dropdown } from "@/components/ui/Dropdown";
import KatexDom from "@/components/ui/KatexDom";
import { CaptureResult, LatexCaptureView } from "@/components/ui/LatexCaptureView";
import LatexEditorDOM from "@/components/ui/LatexEditorDOM";
import { RangeControl } from "@/components/ui/RangeControl";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { latexStateService } from "@/services/latexStateService";
import { getSetting, setSetting } from "@/services/settingsService";
import { addMedia, createTask } from "@/services/taskService";
import { DEFAULT_LATEX_STYLE, LatexStyle } from "@/utils/latexCapture";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ExpoSharing from "expo-sharing";
import { ArrowLeft, Download, Share2 } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LatexEditorRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const dialog = useDialog();
  const params = useLocalSearchParams<{
    latex?: string;
    style?: string;
    index?: string;
    mode?: string;
  }>();

  const [latexInput, setLatexInput] = useState(params.latex || "");
  const [editingLatexIndex, setEditingLatexIndex] = useState<number | null>(
    params.index ? parseInt(params.index) : null
  );
  
  const initialStyle = useMemo(() => {
    if (params.style) {
      try {
        return { ...DEFAULT_LATEX_STYLE, ...JSON.parse(params.style) };
      } catch {
        return { ...DEFAULT_LATEX_STYLE };
      }
    }
    return { ...DEFAULT_LATEX_STYLE };
  }, [params.style]);

  const [latexStyle, setLatexStyle] = useState<LatexStyle>(initialStyle);
  const [captureRequest, setCaptureRequest] = useState<{
    latex: string;
    style: LatexStyle;
    isDark: boolean;
    previewOnly?: boolean;
  } | null>(null);
  const [latexSaving, setLatexSaving] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState<keyof LatexStyle | null>(null);
  const [blurSignal, setBlurSignal] = useState(0);
  const [isStyleLoaded, setIsStyleLoaded] = useState(!!params.style);

  const exportFormatRef = useRef<"share-png" | "save-png" | null>(null);

  /** Load last used style if not editing existing */
  React.useEffect(() => {
    if (!params.style) {
      getSetting("latex_style").then((saved: string) => {
        if (saved) {
          try {
            setLatexStyle(prev => ({ ...prev, ...JSON.parse(saved) }));
          } catch (e) {
            console.error("Failed to parse saved latex style", e);
          }
        }
        setIsStyleLoaded(true);
      });
    }
  }, [params.style]);

  /** Colors derived from theme */
  const colors = {
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    surface: isDark ? "#0A0A0A" : "#FFFFFF",
    surfaceSecondary: isDark ? "#171717" : "#F5F5F5",
    surfaceTertiary: isDark ? "#262626" : "#E4E4E7",
    border: isDark ? "#262626" : "#E5E5E5",
  };

  /** luminance calculation for contrast */
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
  function getContrastSafeColor(color: string, isDark: boolean): string {
    const bgLum = isDark ? 0.03 : 0.95;
    const colorLum = luminance(color);
    const ratio = (Math.max(colorLum, bgLum) + 0.05) / (Math.min(colorLum, bgLum) + 0.05);
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
  const safeAccent = getContrastSafeColor(primaryColor, isDark);

  const saveLatex = () => {
    if (!latexInput.trim()) return;
    setLatexSaving(true);
    setCaptureRequest({ latex: latexInput, style: latexStyle, isDark, previewOnly: false });
  };

  const handleCaptureComplete = async (result: CaptureResult) => {
    const styleJson = JSON.stringify(latexStyle);
    if (!result.pngUri) {
      setLatexSaving(false);
      return;
    }

    if (params.mode === 'createTask') {
      try {
        const newTask = await createTask("Equação LaTeX", "");
        await addMedia(newTask.id, result.pngUri, "latex", latexInput, styleJson);
        
        // Persist as last used style
        setSetting("latex_style", styleJson).catch(console.error);

        router.replace({ pathname: "/task/editor", params: { id: newTask.id.toString() } });
      } catch (err) {
        console.error("Failed to create task from latex tool:", err);
        setLatexSaving(false);
        dialog.show({ title: "Erro", description: "Falha ao criar nota automática." });
      }
      return;
    }

    latexStateService.notify({
      latex: latexInput,
      style: styleJson,
      uri: result.pngUri,
      index: editingLatexIndex,
    });

    // Persist as last used style
    setSetting("latex_style", styleJson).catch(console.error);

    router.back();
  };

  const handleCaptureError = (error: string) => {
    if (latexSaving) {
      console.error("LaTeX capture error:", error);
      setLatexSaving(false);
      setCaptureRequest(null);
      exportFormatRef.current = null;
      dialog.show({ title: "Erro", description: "Falha ao capturar a equação." });
    }
  };

  const handleExportLatex = (format: "share-png" | "save-png") => {
    if (!latexInput.trim()) return;

    if (format === "share-png" && latexStyle.containerMode === "transparent") {
      dialog.show({
        title: "Atenção",
        variant: "warning",
        description: "Alguns aplicativos (como WhatsApp) podem converter fundos transparentes para preto ao compartilhar direto.\n\nPara garantir a transparência, recomendamos salvar na galeria e importar como arquivo no outro app.",
        buttons: [
          {
            text: "Salvar na Galeria",
            onPress: () => {
              dialog.hide();
              startExport("save-png");
            }
          },
          {
            text: "Compartilhar",
            variant: "outline",
            onPress: () => {
              dialog.hide();
              startExport("share-png");
            }
          }
        ]
      });
      return;
    }

    startExport(format);
  };

  const startExport = (format: "share-png" | "save-png") => {
    setLatexSaving(true);
    exportFormatRef.current = format;
    setCaptureRequest({ latex: latexInput, style: latexStyle, isDark, previewOnly: false });
  };

  const handleExportCaptureComplete = async (result: CaptureResult) => {
    const format = exportFormatRef.current;
    setTimeout(() => {
      exportFormatRef.current = null;
      setLatexSaving(false);
      setCaptureRequest(null);
    }, 100);

    try {
      const uri = result.pngUri;
      if (!uri) return;

      // Persist as last used style
      setSetting("latex_style", JSON.stringify(latexStyle)).catch(console.error);

      if (format === "share-png") {
        if (await ExpoSharing.isAvailableAsync()) {
          await ExpoSharing.shareAsync(uri, {
            mimeType: "image/png",
            dialogTitle: "Compartilhar Equação",
            UTI: "public.png",
          });
        }
      } else if (format === "save-png") {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          await MediaLibrary.saveToLibraryAsync(uri);
          dialog.show({ title: "Salvo!", description: "Imagem salva na galeria." });
        } else {
          dialog.show({ title: "Erro", description: "Permissão negada." });
        }
      }
    } catch (err) {
      console.error("Export error:", err);
      dialog.show({ title: "Erro", description: "Falha ao exportar." });
    }
  };

  const [parentScrollEnabled, setParentScrollEnabled] = useState(true);

  const handleDismiss = () => {
    Keyboard.dismiss();
    setParentScrollEnabled(true);
    setBlurSignal(s => s + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, paddingTop: insets.top }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <Button variant="icon" onPress={() => router.back()} className="mr-1">
                <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
              </Button>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {editingLatexIndex !== null ? "Editar Equação" : "Nova Equação"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Dropdown>
                <Dropdown.Trigger>
                  <TouchableOpacity style={[styles.toolbarBtn, { backgroundColor: colors.surfaceSecondary }]}>
                    <Share2 size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </Dropdown.Trigger>
                <Dropdown.Content width={180} direction="bottom" align="end">
                  <Dropdown.Item label="Compartilhar..." icon={Share2} onPress={() => handleExportLatex("share-png")} />
                  <Dropdown.Item label="Salvar na Galeria" icon={Download} onPress={() => handleExportLatex("save-png")} />
                </Dropdown.Content>
              </Dropdown>

              <Button rounded="full" onPress={saveLatex} loading={latexSaving}>
                <Button.Text>{editingLatexIndex !== null ? "Salvar" : "Adicionar"}</Button.Text>
              </Button>
            </View>
          </View>

          {!isStyleLoaded ? null : (
            <View style={{ flex: 1 }}>
              {/* Fixed Section: Preview and Code Editor */}
              <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
                {/* Preview */}
                <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
                  <Text style={[styles.controlLabel, { color: colors.textSecondary, marginTop: 4 }]}>Pré-visualização</Text>
                  <View style={[styles.previewContainer, { borderColor: colors.border, height: 160, marginBottom: 0 }]}>
                    <KatexDom
                      expression={latexInput}
                      isDark={isDark}
                      equationStyle={latexStyle}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </View>
                </View>

                {/* Ace Editor Wrapper */}
                <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                  <Text style={[styles.controlLabel, { color: colors.textSecondary, marginTop: 0 }]}>Código LaTeX</Text>
                  <View 
                    style={{ height: 100, width: "100%", borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}
                    onStartShouldSetResponderCapture={() => {
                      setParentScrollEnabled(false);
                      return false;
                    }}
                    onResponderRelease={() => setParentScrollEnabled(true)}
                    onResponderTerminate={() => setParentScrollEnabled(true)}
                  >
                    <LatexEditorDOM
                      initialContent={latexInput}
                      onChange={setLatexInput}
                      isDark={isDark}
                      blurSignal={blurSignal}
                    />
                  </View>
                </View>
              </View>

              <ScrollView 
                style={styles.content} 
                contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 16 }}
                showsVerticalScrollIndicator={false}
                scrollEnabled={parentScrollEnabled}
                keyboardShouldPersistTaps="handled"
              >
                <TouchableOpacity activeOpacity={1} onPress={handleDismiss}>
                  {/* Color Pickers */}
                  <Text style={[styles.controlLabel, { color: colors.textSecondary, marginTop: 0 }]}>Cores</Text>
                  <View style={styles.colorRow}>
                    {([
                      { key: "textColor" as const, label: "Texto" },
                      { key: "backgroundColor" as const, label: "Fundo" },
                      { key: "outerColor" as const, label: "Externa" },
                      { key: "borderColor" as const, label: "Borda" },
                    ]).map(({ key, label }) => (
                      <TouchableOpacity
                        key={key}
                        onPress={() => {
                          handleDismiss();
                          setColorPickerTarget(key);
                        }}
                        style={styles.colorItem}
                      >
                        <View style={[
                          styles.colorSwatch,
                          { backgroundColor: latexStyle[key] as string, borderColor: colors.border }
                        ]} />
                        <Text style={[styles.colorItemLabel, { color: colors.textSecondary }]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Sliders */}
                  <View style={styles.sliderSection}>
                    <RangeControl
                      label="Largura borda"
                      value={latexStyle.borderWidth}
                      min={0}
                      max={5}
                      step={0.5}
                      onChange={(val) => setLatexStyle((s) => ({ ...s, borderWidth: val }))}
                      accentColor={safeAccent}
                    />
                    <RangeControl
                      label="Raio borda"
                      value={latexStyle.borderRadius}
                      min={0}
                      max={30}
                      step={2}
                      onChange={(val) => setLatexStyle((s) => ({ ...s, borderRadius: val }))}
                      accentColor={safeAccent}
                    />
                    <RangeControl
                      label="Tamanho texto"
                      value={latexStyle.fontSize}
                      min={10}
                      max={50}
                      step={2}
                      onChange={(val) => setLatexStyle((s) => ({ ...s, fontSize: val }))}
                      accentColor={safeAccent}
                    />
                  </View>

                  {/* Container Toggle */}
                  <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>Modo do Container</Text>
                  <View style={styles.themeRow}>
                    {(['full', 'bare', 'transparent'] as const).map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => setLatexStyle((s) => ({ ...s, containerMode: mode }))}
                        style={[
                          styles.themeBtn,
                          {
                            backgroundColor: latexStyle.containerMode === mode ? safeAccent + "20" : colors.surfaceTertiary,
                            borderColor: latexStyle.containerMode === mode ? safeAccent : "transparent",
                          },
                        ]}
                      >
                        <Text style={[styles.themeBtnText, { color: latexStyle.containerMode === mode ? safeAccent : colors.text }]}>
                          {mode === 'full' ? "Padrão" : mode === 'bare' ? "Simples" : "Transparente"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Border Style */}
                  <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>Estilo linha</Text>
                  <View style={styles.themeRow}>
                    {(["solid", "dashed", "dotted"] as const).map((bs) => (
                      <TouchableOpacity
                        key={bs}
                        onPress={() => setLatexStyle((s) => ({ ...s, borderStyle: bs }))}
                        style={[
                          styles.themeBtn,
                          {
                            backgroundColor: latexStyle.borderStyle === bs ? safeAccent + "20" : colors.surfaceTertiary,
                            borderColor: latexStyle.borderStyle === bs ? safeAccent : "transparent",
                          },
                        ]}
                      >
                        <Text style={[styles.themeBtnText, { color: latexStyle.borderStyle === bs ? safeAccent : colors.text }]}>
                          {bs === "solid" ? "Sólida" : bs === "dashed" ? "Tracejada" : "Pontilhada"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* LaTeX Capture (hidden) */}
      <LatexCaptureView
        captureRequest={captureRequest}
        onCaptureComplete={(result) => {
          if (exportFormatRef.current) {
            handleExportCaptureComplete(result);
          } else {
            handleCaptureComplete(result);
          }
        }}
        onCaptureError={handleCaptureError}
      />

      {/* Color Picker Modal */}
      <ColorPickerModal
        visible={colorPickerTarget !== null}
        title={
          colorPickerTarget === "textColor" ? "Cor do texto" :
          colorPickerTarget === "backgroundColor" ? "Cor de fundo" :
          colorPickerTarget === "outerColor" ? "Cor externa" : "Cor da borda"
        }
        currentColor={colorPickerTarget ? (latexStyle[colorPickerTarget] as string) : "#000"}
        onSelect={(color) => {
          if (colorPickerTarget) setLatexStyle((s) => ({ ...s, [colorPickerTarget]: color }));
          setColorPickerTarget(null);
        }}
        onClose={() => setColorPickerTarget(null)}
        isDark={isDark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontWeight: "700", fontSize: 18, marginLeft: 8 },
  content: { flex: 1, paddingHorizontal: 20 },
  controlLabel: { fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  previewContainer: { height: 200, borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 8 },
  colorRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  colorItem: { alignItems: "center", gap: 6 },
  colorSwatch: { width: 48, height: 48, borderRadius: 12, borderWidth: 2 },
  colorItemLabel: { fontSize: 11, fontWeight: "600" },
  sliderSection: { gap: 12 },
  themeRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  themeBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  themeBtnText: { fontSize: 13, fontWeight: "600" },
  toolbarBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
