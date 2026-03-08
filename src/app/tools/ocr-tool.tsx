import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ToolActions } from "@/components/ui/ToolActions";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import { withOpacity } from "@/utils/colors";
import { recognizeText } from "@/utils/ocr";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera as CameraIcon,
  ChevronLeft,
  Copy,
  FilePlus2,
  Image as ImageIcon,
  ScanText,
  Share2,
  Trash2
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Keyboard,
  Platform,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UIState = "landing" | "result";

export default function OCRToolScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUri?: string }>();
  const { resolvedTheme, primaryColor } = useTheme();
  const { isVisible: isKeyboardVisible } = useKeyboard();
  const isDark = resolvedTheme === "dark";
  const dialog = useDialog();
  if (!router || !params || !insets) return null;

  const [uiState, setUiState] = useState<UIState>("landing");
  const [extractedText, setExtractedText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  React.useEffect(() => {
    if (params.imageUri) {
      processImage(params.imageUri);
    }
  }, [params.imageUri]);

  const processImage = async (uri: string) => {
    setIsProcessing(true);
    try {
      const ocrData = await recognizeText(uri);
      if (ocrData && ocrData.text) {
        setExtractedText(ocrData.text);
        setUiState("result");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        dialog.show({ title: "Aviso", description: "Nenhum texto encontrado na imagem selecionada." });
      }
    } catch (error) {
      console.error("OCR Extraction Error:", error);
      dialog.show({ title: "Erro", description: "Falha ao extrair texto da imagem." });
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        dialog.show({ title: "Permissão Negada", description: "O acesso à câmera é necessário para tirar fotos." });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // This enables the cropping area ("área de recorte")
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Camera Error:", error);
      dialog.show({ title: "Erro", description: "Não foi possível abrir a câmera." });
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // This enables cropping from gallery too
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Gallery Error:", error);
      dialog.show({ title: "Erro", description: "Falha ao selecionar imagem da galeria." });
    }
  };

  const handleReset = () => {
    setExtractedText("");
    setUiState("landing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(extractedText);
    dialog.show({ title: "Copiado", description: "Texto copiado para a área de transferência." });
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: extractedText });
    } catch (e) {
      console.error("Share error:", e);
    }
  };

  const handleCreateNote = () => {
    router.push({
      pathname: "/task/editor",
      params: { sharedText: extractedText },
    });
  };


  const renderHeader = (title: string, onBack?: () => void) => (
    <View style={{ paddingTop: insets.top + 10 }} className="flex-row items-center justify-between px-4 pb-4">
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onBack || (() => router.back())}
        className="h-12 w-12 rounded-full items-center justify-center bg-surface-secondary/50"
      >
        <ChevronLeft size={28} color={isDark ? "#FFF" : "#000"} />
      </TouchableOpacity>
      <View className="flex-1 items-center">
        <Text className="font-sans-bold text-on-surface text-lg">{title}</Text>
      </View>
      <View style={{ width: 48 }} />
    </View>
  );

  return (
    <View style={{ flex: 1 }} className="bg-surface">
      {uiState === "landing" && (
        <View style={{ flex: 1 }}>
          {renderHeader("Extrair Texto")}
          <Animated.View 
            entering={FadeInDown.duration(600).springify()}
            className="flex-1 justify-center items-center px-8"
          >
            <View 
              style={{ backgroundColor: withOpacity("#8B5CF6", isDark ? 0.15 : 0.1) }}
              className="mb-8 h-24 w-24 items-center justify-center rounded-full"
            >
              <ScanText size={48} color="#8B5CF6" />
            </View>
            <Text className="font-sans-bold text-2xl text-on-surface text-center mb-2">
              Extração de Texto
            </Text>
            <Text className="font-sans text-base text-on-surface-secondary text-center mb-10 leading-6 px-4">
              Use a inteligência artificial para extrair texto de fotos ou imagens da sua galeria instantaneamente.
            </Text>

            <ToolActions>
              <ToolActions.Button
                onPress={startCamera}
                icon={<CameraIcon size={24} color="#8B5CF6" />}
                color="#8B5CF6"
                title="Câmera"
                description="Tirar foto e extrair"
              />

              <ToolActions.Button
                onPress={handlePickImage}
                icon={<ImageIcon size={24} color="#8B5CF6" />}
                color="#8B5CF6"
                title="Galeria"
                description="Abrir imagem salvada"
              />
            </ToolActions>
          </Animated.View>
        </View>
      )}

      {uiState === "result" && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {renderHeader("Texto Extraído", handleReset)}
          
          <View className="flex-1 px-6 pt-2">
            <Animated.View entering={FadeInUp.delay(200).duration(500)} className="flex-1">
              <View 
                className="bg-surface-secondary rounded-[32px] border border-border/10 overflow-hidden flex-1 mb-4"
                style={shadows.md}
              >
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-border/10 bg-surface/30">
                  <View className="flex-row items-center gap-2">
                    <ScanText size={18} color={primaryColor} />
                    <Text className="font-sans-bold text-on-surface-secondary text-xs uppercase tracking-widest">
                      Texto Identificado
                    </Text>
                  </View>
                  <View className="bg-primary/10 px-2 py-1 rounded-lg">
                    <Text className="font-sans-bold text-[10px]" style={{ color: primaryColor }}>
                      {extractedText.length} CARACTERES
                    </Text>
                  </View>
                </View>

                <TextInput
                  multiline
                  className="p-5 font-sans text-on-surface text-base leading-7 flex-1"
                  style={{ textAlignVertical: 'top' }}
                  value={extractedText}
                  onChangeText={setExtractedText}
                  placeholder="Nenhum texto extraído..."
                  placeholderTextColor={isDark ? "#52525B" : "#A1A1AA"}
                />
                
                <View className="flex-row items-center justify-between px-4 py-3 bg-surface/20 border-t border-border/10">
                   <TouchableOpacity 
                    onPress={() => Keyboard.dismiss()}
                    className={`px-3 py-1 rounded-full bg-surface-secondary ${isKeyboardVisible ? 'opacity-100' : 'opacity-0'}`}
                   >
                     <Text className="font-sans-medium text-[10px] text-on-surface-secondary">OK</Text>
                   </TouchableOpacity>
                  <Text className="font-sans text-[11px] text-on-surface-secondary">
                    {extractedText.split(/\s+/).filter(Boolean).length} palavras
                  </Text>
                </View>
              </View>
            </Animated.View>
          </View>

          {!isKeyboardVisible && (
            <Animated.View 
              entering={FadeInUp.delay(400).duration(500)} 
              className="gap-4 px-6 pb-6"
              style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            >
              <View className="flex-row gap-3">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleCopy}
                  className="flex-1 flex-row items-center justify-center p-4 bg-surface-secondary rounded-2xl border border-border/10"
                  style={shadows.sm}
                >
                  <Copy size={20} color={primaryColor} />
                  <Text className="ml-3 font-sans-bold text-on-surface" style={{ color: primaryColor }}>Copiar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleShare}
                  className="flex-1 flex-row items-center justify-center p-4 bg-surface-secondary rounded-2xl border border-border/10"
                  style={shadows.sm}
                >
                  <Share2 size={20} color={primaryColor} />
                  <Text className="ml-3 font-sans-bold text-on-surface" style={{ color: primaryColor }}>Enviar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleReset}
                  className="w-14 h-14 items-center justify-center bg-red-500/10 rounded-2xl border border-red-500/20"
                >
                  <Trash2 size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleCreateNote}
                className="w-full flex-row items-center justify-center p-5 rounded-3xl"
                style={[{ backgroundColor: primaryColor }, shadows.lg]}
              >
                <FilePlus2 size={24} color="#FFF" />
                <Text className="ml-3 font-sans-bold text-white text-lg">Criar Nova Nota</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      )}

      <LoadingOverlay
        visible={isProcessing}
        title="Extraindo Texto..."
      />
    </View>
  );
}
