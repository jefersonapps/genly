import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import KatexDom from "@/components/ui/KatexDom";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { CaptureResult, LatexCaptureView } from "@/components/ui/LatexCaptureView";
import LatexEditorDOM from "@/components/ui/LatexEditorDOM";
import { RangeControl } from "@/components/ui/RangeControl";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { latexStateService } from "@/services/latexStateService";
import { getSetting, setSetting } from "@/services/settingsService";
import { addMedia, createTask } from "@/services/taskService";
import { withOpacity } from "@/utils/colors";
import { DEFAULT_LATEX_STYLE, LatexStyle } from "@/utils/latexCapture";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ExpoSharing from "expo-sharing";
import { ArrowLeft, Download, FileText, Palette, Share2 } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { Keyboard, Platform, Text, TouchableOpacity, View } from "react-native";
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
  const [activeColorKey, setActiveColorKey] = useState<keyof LatexStyle>("textColor");
  const [blurSignal, setBlurSignal] = useState(0);
  const [isStyleLoaded, setIsStyleLoaded] = useState(!!params.style);

  const colorSheetRef = useRef<BottomSheetModal>(null);
  const colorSnapPoints = useMemo(() => ["45%"], []);
  
  const exportSheetRef = useRef<BottomSheetModal>(null);
  const exportSnapPoints = useMemo(() => ["45%"], []);

  // renderBackdrop removed, handled by BottomSheet component

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

  const saveLatex = (forceNewTask = false) => {
    if (!latexInput.trim()) {
      dialog.show({
        title: "Campo Vazio",
        description: "Por favor, digite alguma equação LaTeX antes de salvar.",
        variant: "warning"
      });
      return;
    }
    setLatexSaving(true);
    setCaptureRequest({ 
      latex: latexInput, 
      style: latexStyle, 
      isDark, 
      previewOnly: false,
      // Pass a custom flag inside style or use a separate ref if needed, 
      // but easiest is to check a local state or just modify handleCaptureComplete
    });
    // We'll use a temporary ref to detect if we should force new task
    forceNewTaskRef.current = forceNewTask;
  };

  const forceNewTaskRef = useRef(false);

  const handleCaptureComplete = async (result: CaptureResult) => {
    const styleJson = JSON.stringify(latexStyle);
    if (!result.pngUri) {
      setLatexSaving(false);
      forceNewTaskRef.current = false;
      return;
    }

    if (params.mode === 'createTask' || forceNewTaskRef.current) {
      try {
        const newTask = await createTask("Equação LaTeX", "");
        await addMedia(newTask.id, result.pngUri, "latex", latexInput, styleJson);
        
        // Persist as last used style
        setSetting("latex_style", styleJson).catch(console.error);

        router.replace({ pathname: "/task/editor", params: { id: newTask.id.toString() } });
      } catch (err) {
        console.error("Failed to create task from latex tool:", err);
        setLatexSaving(false);
        forceNewTaskRef.current = false;
        dialog.show({ title: "Erro", description: "Falha ao criar nota automática." });
      }
      forceNewTaskRef.current = false;
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
    if (!latexInput.trim()) {
      dialog.show({
        title: "Campo Vazio",
        description: "Por favor, digite alguma equação LaTeX antes de exportar.",
        variant: "warning"
      });
      return;
    }

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
    <View className="flex-1" style={[{ backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        style={[{ paddingTop: insets.top }]}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View className="flex-1">
          {/* Header */}
          <View 
            className="flex-row items-center justify-between px-4 py-3 border-b"
            style={[{ borderBottomColor: colors.border }]}
          >
            <View className="flex-row items-center">
              <Button variant="icon" onPress={() => router.back()} className="mr-1">
                <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
              </Button>
              <Text className="font-sans-bold text-lg ml-2" style={[{ color: colors.text }]}>
                {editingLatexIndex !== null ? "Editar Equação" : "Nova Equação"}
              </Text>
            </View>

            <View className="flex-row gap-2">
              <TouchableOpacity 
                activeOpacity={0.8} 
                onPress={() => {
                  handleDismiss();
                  exportSheetRef.current?.present();
                }}
                className="w-10 h-10 rounded-full items-center justify-center"
                style={[{ backgroundColor: colors.surfaceSecondary }]}
              >
                <Share2 size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {(params.mode !== 'createTask' || editingLatexIndex !== null) && (
                <Button rounded="full" onPress={() => saveLatex()} loading={latexSaving}>
                  <Button.Text>{editingLatexIndex !== null ? "Salvar" : "Adicionar"}</Button.Text>
                </Button>
              )}
            </View>
          </View>

          {!isStyleLoaded ? null : (
            <View style={{ flex: 1 }}>
              {/* Fixed Section: Preview and Code Editor */}
              <View 
                className="border-b"
                style={[{ borderBottomColor: colors.border, backgroundColor: colors.surface }]}
              >
                {/* Preview */}
                <View className="px-5 pt-2 pb-3">
                  <Text className="text-[13px] font-sans-bold mt-1 mb-2 uppercase tracking-widest" style={[{ color: colors.textSecondary }]}>Pré-visualização</Text>
                  <View 
                    className="h-40 rounded-xl border mb-0 overflow-hidden"
                    style={[{ borderColor: colors.border }]}
                  >
                    <KatexDom
                      dom={{ style: { width: "100%", height: 160 } }}
                      expression={latexInput}
                      isDark={isDark}
                      equationStyle={latexStyle}
                    />
                  </View>
                </View>
 
                {/* Ace Editor Wrapper */}
                <View className="px-5 pb-4">
                  <Text className="text-[13px] font-sans-bold mt-0 mb-2 uppercase tracking-widest" style={[{ color: colors.textSecondary }]}>Código LaTeX</Text>
                  <View 
                    className="h-32 w-full rounded-xl border overflow-hidden"
                    style={[{ borderColor: colors.border }]}
                    onStartShouldSetResponderCapture={() => {
                      setParentScrollEnabled(false);
                      return false;
                    }}
                    onResponderRelease={() => setParentScrollEnabled(true)}
                    onResponderTerminate={() => setParentScrollEnabled(true)}
                  >
                    <LatexEditorDOM
                      dom={{ style: { width: "100%", height: 128 } }}
                      initialContent={latexInput}
                      onChange={setLatexInput}
                      isDark={isDark}
                      blurSignal={blurSignal}
                    />
                  </View>
                </View>
              </View>

              <ScrollView 
                className="flex-1 px-5"
                contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 16 }}
                showsVerticalScrollIndicator={false}
                scrollEnabled={parentScrollEnabled}
                keyboardShouldPersistTaps="handled"
              >
                <TouchableOpacity activeOpacity={1} onPress={handleDismiss}>
                  {/* Color Selection Header */}
                  <Text className="text-[13px] font-sans-bold mt-0 mb-3 uppercase tracking-widest" style={[{ color: colors.textSecondary }]}>Cores</Text>
                  
                  {/* Modern Active Target Selectors */}
                  <View className="flex-row justify-between mb-4">
                    {([
                      { key: "textColor" as const, label: "Texto" },
                      { key: "backgroundColor" as const, label: "Fundo" },
                      { key: "outerColor" as const, label: "Externa" },
                      { key: "borderColor" as const, label: "Borda" },
                    ]).map(({ key, label }) => {
                      const isActive = activeColorKey === key;
                      return (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          key={key}
                          onPress={() => {
                            handleDismiss();
                            setActiveColorKey(key);
                            colorSheetRef.current?.present();
                          }}
                          className="items-center gap-1.5"
                        >
                          <View 
                            className="w-12 h-12 rounded-xl border-2 items-center justify-center"
                            style={[
                              { 
                                backgroundColor: latexStyle[key] as string, 
                                borderColor: isActive ? safeAccent : colors.border 
                              }
                            ]} 
                          >
                             {isActive && (
                               <View className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" style={{ backgroundColor: luminance(latexStyle[key] as string) > 0.5 ? '#000' : '#FFF' }} />
                             )}
                          </View>
                          <Text 
                            className="text-[11px] font-sans-semibold" 
                            style={[{ color: isActive ? safeAccent : colors.textSecondary }]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>


                  {/* Sliders */}
                  <View className="gap-3">
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
                  <Text className="text-[13px] font-sans-bold mt-4 mb-2 uppercase tracking-widest" style={[{ color: colors.textSecondary }]}>Modo do Container</Text>
                  <View className="flex-row gap-2 mt-1">
                    {(['full', 'bare', 'transparent'] as const).map((mode) => (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        key={mode}
                        onPress={() => setLatexStyle((s) => ({ ...s, containerMode: mode }))}
                        className="flex-1 h-11 rounded-xl border items-center justify-center"
                        style={[
                          {
                            backgroundColor: latexStyle.containerMode === mode ? safeAccent + "20" : colors.surfaceTertiary,
                            borderColor: latexStyle.containerMode === mode ? safeAccent : "transparent",
                          },
                        ]}
                      >
                        <Text className="text-[13px] font-sans-semibold" style={[{ color: latexStyle.containerMode === mode ? safeAccent : colors.text }]}>
                          {mode === 'full' ? "Padrão" : mode === 'bare' ? "Simples" : "Transparente"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Border Style */}
                  <Text className="text-[13px] font-sans-bold mt-4 mb-2 uppercase tracking-widest" style={[{ color: colors.textSecondary }]}>Estilo linha</Text>
                  <View className="flex-row gap-2 mt-1">
                    {(["solid", "dashed", "dotted"] as const).map((bs) => (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        key={bs}
                        onPress={() => setLatexStyle((s) => ({ ...s, borderStyle: bs }))}
                        className="flex-1 h-11 rounded-xl border items-center justify-center"
                        style={[
                          {
                            backgroundColor: latexStyle.borderStyle === bs ? safeAccent + "20" : colors.surfaceTertiary,
                            borderColor: latexStyle.borderStyle === bs ? safeAccent : "transparent",
                          },
                        ]}
                      >
                        <Text className="text-[13px] font-sans-semibold" style={[{ color: latexStyle.borderStyle === bs ? safeAccent : colors.text }]}>
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

      {/* Color Picker Bottom Sheet */}
      <BottomSheet
        sheetRef={colorSheetRef}
        snapPoints={colorSnapPoints}
      >
        <BottomSheet.View>
          <View className="flex-row items-center gap-3 mb-1">
            <View className="h-10 w-10 rounded-full items-center justify-center" style={{ backgroundColor: `${safeAccent}15` }}>
              <Palette size={20} color={safeAccent} />
            </View>
            <View>
              <Text className="font-sans-bold text-xl" style={{ color: colors.text }}>
                {activeColorKey === "textColor" ? "Cor do Texto" :
                 activeColorKey === "backgroundColor" ? "Cor de Fundo" :
                 activeColorKey === "outerColor" ? "Cor Externa" : "Cor da Borda"}
              </Text>
              <Text className="font-sans text-xs" style={{ color: colors.textSecondary }}>Personalize sua equação com uma cor exclusiva</Text>
            </View>
          </View>

          <ColorPicker
            selectedColor={latexStyle[activeColorKey] as string}
            onSelect={(color) => setLatexStyle(s => ({ ...s, [activeColorKey]: color }))}
            isDark={isDark}
          />
        </BottomSheet.View>
      </BottomSheet>

      {/* Export Options Bottom Sheet */}
      <BottomSheet
        sheetRef={exportSheetRef}
        snapPoints={exportSnapPoints}
      >
        <BottomSheet.View>
          <BottomSheet.Header title="Opções" />
          
          <BottomSheet.ItemGroup>
            <BottomSheet.Item
              icon={<FileText size={20} color={primaryColor} />}
              iconBackgroundColor={withOpacity(primaryColor, 0.08)}
              title="Nova Nota"
              onPress={() => {
                exportSheetRef.current?.dismiss();
                saveLatex(true);
              }}
            />
            <BottomSheet.Separator />
            <BottomSheet.Item
              icon={<Share2 size={20} color={primaryColor} />}
              iconBackgroundColor={withOpacity(primaryColor, 0.08)}
              title="Compartilhar Imagem"
              onPress={() => {
                exportSheetRef.current?.dismiss();
                handleExportLatex("share-png");
              }}
            />
            <BottomSheet.Separator />
            <BottomSheet.Item
              icon={<Download size={20} color={primaryColor} />}
              iconBackgroundColor={withOpacity(primaryColor, 0.08)}
              title="Salvar na Galeria"
              onPress={() => {
                exportSheetRef.current?.dismiss();
                handleExportLatex("save-png");
              }}
            />
          </BottomSheet.ItemGroup>
        </BottomSheet.View>
      </BottomSheet>
    </View>
  );
}
