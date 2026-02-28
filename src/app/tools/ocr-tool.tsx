import { Button } from "@/components/ui/Button";
import { ToolActions } from "@/components/ui/ToolActions";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
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
    Share2,
    Trash2
} from "lucide-react-native";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Share,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UIState = "landing" | "result";

export default function OCRToolScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUri?: string }>();
  const { resolvedTheme, primaryColor } = useTheme();
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
          <View className="flex-1 justify-center items-center px-8">
            <View className={`mb-8 h-24 w-24 items-center justify-center rounded-full ${isDark ? "bg-primary/20" : "bg-primary/10"}`}>
              <CameraIcon size={48} color={primaryColor} />
            </View>
            <Text className="font-sans-semibold text-xl text-on-surface text-center mb-2">
              Extração de Texto
            </Text>
            <Text className="font-sans text-base text-on-surface-secondary text-center mb-10">
              Tire uma foto ou escolha uma da galeria. Você poderá recortar a área desejada para o scanner.
            </Text>

            <ToolActions>
              <ToolActions.Button
                onPress={startCamera}
                icon={<CameraIcon size={24} color={primaryColor} />}
                title="Câmera"
                description="Tirar foto e recortar"
              />

              <ToolActions.Button
                onPress={handlePickImage}
                icon={<ImageIcon size={24} color={primaryColor} />}
                title="Galeria"
                description="Escolher imagem e recortar"
              />
            </ToolActions>
          </View>
        </View>
      )}

      {uiState === "result" && (
        <View style={{ flex: 1 }}>
          {renderHeader("Resultado", handleReset)}
          <View className="flex-1 p-6">
            <View className="flex-1 bg-surface-secondary rounded-3xl border border-border overflow-hidden">
              <TextInput
                multiline
                className="flex-1 p-5 font-sans text-on-surface text-base leading-6 text-start"
                style={{ textAlignVertical: 'top' }}
                value={extractedText}
                onChangeText={setExtractedText}
              />
            </View>

            <View className="mt-6 gap-3">
              <View className="flex-row gap-3">
                <Button
                  variant="ghost"
                  onPress={handleCopy}
                  className="flex-1 flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
                >
                  <Button.Icon icon={<Copy size={20} color={primaryColor} />} />
                  <Button.Text className="ml-2 font-sans-bold">Copiar</Button.Text>
                </Button>

                <Button
                  variant="ghost"
                  onPress={handleShare}
                  className="flex-1 flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
                >
                  <Button.Icon icon={<Share2 size={20} color={primaryColor} />} />
                  <Button.Text className="ml-2 font-sans-bold">Enviar</Button.Text>
                </Button>

                <Button
                  variant="ghost"
                  onPress={handleReset}
                  className="p-4 bg-surface-secondary rounded-2xl border border-border"
                >
                  <Trash2 size={20} color="#EF4444" />
                </Button>
              </View>

              <Button
                variant="filled"
                onPress={handleCreateNote}
                className="w-full flex-row items-center p-5 rounded-2xl"
                style={{ backgroundColor: primaryColor }}
              >
                <Button.Icon icon={<FilePlus2 size={20} color="#FFF" />} />
                <Button.Text className="ml-2 font-sans-bold text-white text-lg">Criar Nota</Button.Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {isProcessing && (
        <View className="absolute z-[100] inset-0 items-center justify-center bg-black/50">
          <View className="rounded-2xl bg-surface p-6 items-center">
            <ActivityIndicator size="large" color={primaryColor} />
            <Text className="mt-4 font-sans-semibold text-on-surface text-center">
              Extraindo Texto...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
