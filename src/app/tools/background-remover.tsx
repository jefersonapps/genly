import { ColorPickerModal } from "@/components/ui/ColorPickerModal";
import { Dialog } from "@/components/ui/Dialog";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ToolActions } from "@/components/ui/ToolActions";
import { useTheme } from "@/providers/ThemeProvider";
import { removeBackground } from "@jacobjmc/react-native-background-remover";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  AlertCircle,
  Camera as CameraIcon,
  CheckCircle2,
  ChevronLeft,
  Image as ImageIcon,
  ImagePlus,
  Palette,
  Save,
  Share2,
  Trash2,
  Wand2
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";

const SCREEN_WIDTH = Dimensions.get("window").width;

type UIState = "landing" | "processing" | "result";

export default function BackgroundRemoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";

  const TOOL_COLOR = "#A855F7"; // Purple color for the magic wand theme

  const [uiState, setUiState] = useState<UIState>("landing");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Customization States
  const [bgColor, setBgColor] = useState<string>("transparent");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  
  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    description: string;
    type: "error" | "success" | "info";
  }>({
    visible: false,
    title: "",
    description: "",
    type: "info"
  });
  
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    if (params.sharedUri && typeof params.sharedUri === "string") {
      processImage(params.sharedUri);
    }
  }, [params.sharedUri]);

  const showDialog = (title: string, description: string, type: "error" | "success" | "info" = "info") => {
    setDialogConfig({ visible: true, title, description, type });
  };

  const closeDialog = () => {
    setDialogConfig(prev => ({ ...prev, visible: false }));
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Gallery Error:", error);
    }
  };

  const handleCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Camera Error:", error);
    }
  };

  const processImage = async (uri: string) => {
    setOriginalImage(uri);
    setUiState("processing");
    setIsProcessing(true);
    
    try {
      // Library expects local file URI
      const transparentImageUri = await removeBackground(uri);
      
      setResultImage(transparentImageUri);
      setUiState("result");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error removing background:", error);
      showDialog("Ops!", "Não foi possivel remover o fundo desta imagem.", "error");
      resetState();
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setUiState("landing");
    setOriginalImage(null);
    setResultImage(null);
    setBgColor("transparent");
    setBgImage(null);
    setIsProcessing(false);
  };

  const handlePickBgImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setBgImage(result.assets[0].uri);
        setBgColor("transparent"); // Reset color when image is chosen
      }
    } catch (error) {
      console.error("BG Gallery Error:", error);
    }
  };

  const captureCombinedImage = async () => {
    if (!viewShotRef.current?.capture) return resultImage;
    try {
      setIsProcessing(true);
      const uri = await viewShotRef.current.capture();
      return uri;
    } catch (e) {
      console.error("ViewShot error", e);
      return resultImage;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!resultImage) return;

    try {
      const finalUri = await captureCombinedImage();
      if (!finalUri) return;

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        showDialog(
          "Permissão Necessária",
          "Precisamos da permissão de armazenamento para salvar a imagem.",
          "error"
        );
        return;
      }

      await MediaLibrary.saveToLibraryAsync(finalUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showDialog("Sucesso", "Imagem salva na galeria!", "success");
    } catch (error) {
      console.error("Error saving image:", error);
      showDialog("Ops!", "Não foi possível salvar a imagem.", "error");
    }
  };

  const handleShare = async () => {
    if (!resultImage) return;
    
    try {
      const finalUri = await captureCombinedImage();
      if (!finalUri) return;

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(finalUri, {
          mimeType: "image/png",
          dialogTitle: "Compartilhar Imagem sem Fundo",
        });
      }
    } catch (error) {
      console.error("Error sharing image:", error);
    }
  };

  return (
    <View style={{ flex: 1 }} className="bg-surface">
      {/* ─── LANDING ─────────────────────────────────── */}
      {uiState === "landing" && (
        <View style={{ flex: 1 }}>
          <View
            style={{ paddingTop: insets.top + 10 }}
            className="flex-row items-center justify-between px-4 pb-4"
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.back()}
              className="h-12 w-12 rounded-full items-center justify-center bg-surface-secondary/50"
            >
              <ChevronLeft size={28} color={isDark ? "#FFF" : "#000"} />
            </TouchableOpacity>
            <View className="flex-1 items-center">
              <Text className="font-sans-bold text-on-surface text-lg">
                Remover Fundo
              </Text>
            </View>
            <View style={{ width: 48 }} />
          </View>

          <Animated.View
            entering={FadeInDown.duration(600).springify()}
            className="flex-1 justify-center items-center px-8"
          >
            <View
              style={{
                backgroundColor: isDark ? "rgba(168, 85, 247, 0.15)" : "rgba(168, 85, 247, 0.1)",
              }}
              className="mb-8 h-24 w-24 items-center justify-center rounded-full"
            >
              <Wand2 size={48} color={TOOL_COLOR} />
            </View>
            <Text className="font-sans-bold text-2xl text-on-surface text-center mb-2">
              Borracha Mágica
            </Text>
            <Text className="font-sans text-base text-on-surface-secondary text-center mb-10 leading-6 px-4">
              Remova o fundo de qualquer imagem offline e instantaneamente usando Inteligência Artificial.
            </Text>

            <ToolActions>
              <ToolActions.Button
                onPress={handleCamera}
                icon={<CameraIcon size={24} color={TOOL_COLOR} />}
                color={TOOL_COLOR}
                title="Câmera"
                description="Tirar foto"
              />
              <ToolActions.Button
                onPress={handlePickImage}
                icon={<ImageIcon size={24} color={TOOL_COLOR} />}
                color={TOOL_COLOR}
                title="Galeria"
                description="Escolher foto salva"
              />
            </ToolActions>
          </Animated.View>
        </View>
      )}

      {/* ─── RESULT ──────────────────────────────────── */}
      {uiState === "result" && resultImage && (
        <View style={{ flex: 1 }}>
          <View
            style={{ paddingTop: insets.top + 10 }}
            className="flex-row items-center justify-between px-4 pb-4"
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={resetState}
              className="h-12 w-12 rounded-full items-center justify-center bg-surface-secondary/50"
            >
              <ChevronLeft size={28} color={isDark ? "#FFF" : "#000"} />
            </TouchableOpacity>
            <View className="flex-1 items-center">
              <Text className="font-sans-bold text-on-surface text-lg">
                Resultado
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={resetState}
              className="h-12 w-12 rounded-full items-center justify-center bg-surface-secondary/50"
            >
              <Trash2 size={22} color={isDark ? "#FFF" : "#000"} />
            </TouchableOpacity>
          </View>

          <View className="flex-1 px-4 mb-4 justify-center items-center">
            {/* Compositing Area */}
            <View
              style={{
                borderRadius: 28,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
              }}
            >
              <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }}>
                <View
                  style={{
                    width: SCREEN_WIDTH - 32,
                    height: SCREEN_WIDTH - 32,
                    // If there is no bgImage, apply checkerboard / custom color. 
                    // If bgImage exists, it occupies the background.
                    backgroundColor: !bgImage 
                      ? (bgColor === "transparent" ? (isDark ? "#171717" : "#E5E5E5") : bgColor)
                      : "transparent", 
                  }}
                >
                    {bgImage && (
                        <Image
                           source={{ uri: bgImage }}
                           style={{ position: 'absolute', width: '100%', height: '100%' }}
                           resizeMode="cover"
                        />
                    )}
                    <Image
                        source={{ uri: resultImage }}
                        style={{ flex: 1 }}
                        resizeMode="contain"
                    />
                </View>
              </ViewShot>
            </View>

            {/* Background Customization Controls */}
            <Animated.View
                entering={FadeInDown.duration(400).delay(200).springify()}
                className="mt-6 flex-row w-full justify-center gap-4 px-4"
            >
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setColorPickerVisible(true)}
                    className="flex-1 flex-row items-center justify-center py-3 rounded-2xl border border-border"
                    style={{ backgroundColor: isDark ? "#171717" : "#FFF" }}
                >
                    <Palette size={20} color={isDark ? "#FFF" : "#000"} />
                    <Text className="font-sans-medium text-on-surface ml-2">Cor de Fundo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handlePickBgImage}
                    className="flex-1 flex-row items-center justify-center py-3 rounded-2xl border border-border"
                    style={{ backgroundColor: isDark ? "#171717" : "#FFF" }}
                >
                    <ImagePlus size={20} color={isDark ? "#FFF" : "#000"} />
                    <Text className="font-sans-medium text-on-surface ml-2">Imagem</Text>
                </TouchableOpacity>
            </Animated.View>
          </View>

           <Animated.View
                entering={FadeInDown.duration(300).springify()}
                className="px-6 mb-8 flex-row justify-center gap-4"
            >
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleShare}
                    className="flex-1 rounded-2xl flex-row items-center justify-center py-4 border border-border"
                    style={{ backgroundColor: isDark ? "#171717" : "#FFF" }}
                >
                    <Share2 size={20} color={isDark ? "#FFF" : "#000"} />
                    <Text className="font-sans-bold text-on-surface ml-2">Compartilhar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleSave}
                    className="flex-1 rounded-2xl flex-row items-center justify-center py-4"
                    style={{ backgroundColor: primaryColor }}
                >
                    <Save size={20} color="#FFF" />
                    <Text className="font-sans-bold text-white ml-2">Salvar Galeria</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Color Picker Modal */}
            <ColorPickerModal
                visible={colorPickerVisible}
                title="Cor de Fundo"
                currentColor={bgColor === "transparent" ? "#FFFFFF" : bgColor}
                isDark={isDark}
                onClose={() => setColorPickerVisible(false)}
                onSelect={(color: string) => {
                    setBgColor(color);
                    setBgImage(null); // Remove image if color is selected
                    setColorPickerVisible(false);
                }}
            />
        </View>
      )}

      {/* ─── LOADING INDICATOR ───────────────────────── */}
      <LoadingOverlay visible={isProcessing} title="Magia em andamento..." description="Isolando o objeto principal da imagem" />
      
      {/* ─── DIALOG ──────────────────────────────────── */}
      <Dialog visible={dialogConfig.visible} onClose={closeDialog}>
        <Dialog.Header>
          <Dialog.Title
            icon={
              dialogConfig.type === "success" ? (
                <CheckCircle2 size={24} color="#10B981" />
              ) : dialogConfig.type === "error" ? (
                <AlertCircle size={24} color="#EF4444" />
              ) : undefined
            }
          >
            {dialogConfig.title}
          </Dialog.Title>
          <Dialog.Description>{dialogConfig.description}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Button onPress={closeDialog} variant="default">
            OK
          </Dialog.Button>
        </Dialog.Footer>
      </Dialog>
    </View>
  );
}
