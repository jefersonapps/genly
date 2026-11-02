import { ColorPickerModal } from "@/components/ui/ColorPickerModal";
import { Dialog } from "@/components/ui/Dialog";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ToolActions } from "@/components/ui/ToolActions";
import { useTheme } from "@/providers/ThemeProvider";
import { removeBackground } from "@jacobjmc/react-native-background-remover";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library/legacy";
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
  ScrollView,
  useWindowDimensions,
  Image,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";

const RATIOS = [
  { label: 'Original', value: 0 }, { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 }, { label: '3:4', value: 3 / 4 },
  { label: '2:3', value: 2 / 3 }, { label: '9:16', value: 9 / 16 },
  { label: '5:4', value: 5 / 4 }, { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 }, { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
];

type UIState = "landing" | "processing" | "result";

export default function BackgroundRemoverScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [sourceRatio, setSourceRatio] = useState(1);
  const [ratio, setRatio] = useState(0);
  const aspectRatio = ratio || sourceRatio;
  const canvasWidth = Math.min(windowWidth - 32, Math.max(180, windowHeight * 0.43) * aspectRatio);
  const canvasHeight = canvasWidth / aspectRatio;
  // Store positions relative to the canvas so resizing a popup preserves the composition.
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const zoom = useSharedValue(1);
  const startZoom = useSharedValue(1);
  const rotation = useSharedValue(0);
  const startRotation = useSharedValue(0);
  const resetPosition = () => { offsetX.value = 0; offsetY.value = 0; zoom.value = 1; rotation.value = 0; };
  const pan = Gesture.Pan().maxPointers(1).onStart(() => {
    startX.value = offsetX.value;
    startY.value = offsetY.value;
  }).onUpdate(event => {
    offsetX.value = startX.value + event.translationX / canvasWidth;
    offsetY.value = startY.value + event.translationY / canvasHeight;
  });
  const pinch = Gesture.Pinch().onStart(() => { startZoom.value = zoom.value; }).onUpdate(event => {
    zoom.value = Math.max(0.15, Math.min(6, startZoom.value * event.scale));
  });
  const rotate = Gesture.Rotation().onStart(() => {
    startRotation.value = rotation.value;
  }).onUpdate(event => {
    rotation.value = startRotation.value + event.rotation;
  });
  const cutoutStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value * canvasWidth }, { translateY: offsetY.value * canvasHeight }, { scale: zoom.value }, { rotate: `${rotation.value}rad` }],
  }));
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
  
  const viewShotRef = useRef<React.ComponentRef<typeof ViewShot>>(null);

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
    resetPosition();
    setRatio(0);
    setSourceRatio(1);
    setBgColor('transparent');
    setBgImage(null);
    setUiState("processing");
    setIsProcessing(true);
    
    try {
      const dimensions = await Image.getSize(uri);
      setSourceRatio(dimensions.width / dimensions.height);
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
    if (!viewShotRef.current?.capture) throw new Error("Composition unavailable");
    try {
      setIsProcessing(true);
      const uri = await viewShotRef.current.capture();
      return uri;
    } catch (e) {
      console.error("ViewShot error", e);
      throw e;
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

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <GestureDetector gesture={Gesture.Simultaneous(pan, pinch, rotate)}>
                <View collapsable={false} style={{ width: canvasWidth, height: canvasHeight, backgroundColor: isDark ? '#27272A' : '#E4E4E7', overflow: 'hidden' }}>
                  <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1, width: 1600, height: Math.round(1600 / aspectRatio) }}>
                    <View collapsable={false} style={{ width: canvasWidth, height: canvasHeight, overflow: 'hidden', backgroundColor: bgImage ? 'transparent' : bgColor }}>
                      {bgImage && <Image source={{ uri: bgImage }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />}
                      <Animated.Image source={{ uri: resultImage }} style={[{ width: canvasWidth, height: canvasHeight }, cutoutStyle]} resizeMode="contain" />
                    </View>
                  </ViewShot>
                </View>
              </GestureDetector>
            </View>
            <View className="flex-row items-center justify-between mb-5">
              <Text className="font-sans text-xs text-on-surface-secondary flex-1 mr-2">Arraste para mover · Use dois dedos para ampliar e girar</Text>
              <TouchableOpacity onPress={resetPosition} accessibilityRole="button" className="p-2">
                <Text className="font-sans-semibold text-xs" style={{ color: primaryColor }}>Centralizar</Text>
              </TouchableOpacity>
            </View>
            <Text className="font-sans-semibold text-base text-on-surface mb-3">Proporção</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
              {RATIOS.map(option => (
                <TouchableOpacity key={option.label} onPress={() => setRatio(option.value)} accessibilityRole="button" accessibilityState={{ selected: ratio === option.value }}
                  className="rounded-xl px-4 py-3 border bg-surface-secondary" style={{ borderColor: ratio === option.value ? primaryColor : isDark ? '#303034' : '#E4E4E7' }}>
                  <Text className="font-sans-medium text-xs" style={{ color: ratio === option.value ? primaryColor : isDark ? '#FAFAFA' : '#27272A' }}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text className="font-sans-semibold text-base text-on-surface mt-5 mb-3">Fundo</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setColorPickerVisible(true)} accessibilityRole="button" className="flex-1 flex-row items-center justify-center py-3 rounded-xl border border-border bg-surface-secondary">
                <Palette size={18} color={primaryColor} />
                <Text className="font-sans-medium text-on-surface ml-2">Cor</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickBgImage} accessibilityRole="button" className="flex-1 flex-row items-center justify-center py-3 rounded-xl border border-border bg-surface-secondary">
                <ImagePlus size={18} color={primaryColor} />
                <Text className="font-sans-medium text-on-surface ml-2">Imagem</Text>
              </TouchableOpacity>
            </View>
            {(bgImage || bgColor !== 'transparent') && <TouchableOpacity onPress={() => { setBgImage(null); setBgColor('transparent'); }} className="self-start py-3" accessibilityRole="button">
              <Text className="font-sans-medium text-xs text-on-surface-secondary">Remover fundo personalizado</Text>
            </TouchableOpacity>}
          </ScrollView>

           <Animated.View
                entering={FadeInDown.duration(300).springify()}
                className="px-6 flex-row justify-center gap-4"
                style={{ paddingBottom: Math.max(insets.bottom, 16), paddingTop: 8 }}
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
