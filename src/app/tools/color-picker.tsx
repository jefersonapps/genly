import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ToolActions } from "@/components/ui/ToolActions";
import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import { withOpacity } from "@/utils/colors";
import {
  Canvas, Image as SkiaImage,
  useImage
} from "@shopify/react-native-skia";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera as CameraIcon,
  ChevronLeft,
  Copy,
  Image as ImageIcon,
  Pipette,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions, ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { createPalette, type PaletteResult } from "react-native-material-palette";
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────
type UIState = "landing" | "picker";

type PaletteSwatch = {
  label: string;
  color: string;
  bodyTextColor: string;
  titleTextColor: string;
  population: number;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const LOUPE_SIZE = 140;
const LOUPE_ZOOM = 3;
const LOUPE_OFFSET_Y = -90; // Offset above the finger

// ─── Helpers ──────────────────────────────────────────
function rgbaToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()
  );
}

function normalizeToHex(color: string): string {
  if (color.startsWith("#")) {
    return color.toUpperCase();
  }
  if (color.startsWith("rgb")) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return rgbaToHex(r, g, b);
    }
  }
  return color;
}

function hexToRgbString(hex: string): string {
  const normalized = normalizeToHex(hex);
  const h = normalized.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// ─── Component ────────────────────────────────────────
export default function ColorPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";

  const TOOL_COLOR = "#E11D48";

  // ─── State ──────────────────────────────────────────
  const [uiState, setUiState] = useState<UIState>("landing");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteSwatch[]>([]);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loupeVisible, setLoupeVisible] = useState(false);
  const [loupeColor, setLoupeColor] = useState<string | null>(null);


  const pixelDataRef = useRef<Uint8Array | null>(null);

  // Skia image hook
  const skImage = useImage(imageUri ?? undefined);

  // ─── Loupe shared values ───────────────────────────
  const loupeX = useSharedValue(0);
  const loupeY = useSharedValue(0);



  // ─── When image loads, read pixels ──────────────────
  useEffect(() => {
    if (params.sharedUri && typeof params.sharedUri === "string") {
      loadImage(params.sharedUri);
    }
  }, [params.sharedUri]);

  useEffect(() => {
    if (skImage) {
      const w = skImage.width();
      const h = skImage.height();
      setImageDimensions({ width: w, height: h });

      // Read all pixels into a buffer for fast lookups
      const pixels = skImage.readPixels(0, 0, {
        width: w,
        height: h,
        colorType: 4, // RGBA_8888
        alphaType: 1, // Premultiplied
      });
      if (pixels) {
        pixelDataRef.current = new Uint8Array(pixels);
      }
    }
  }, [skImage]);

  // ─── Extract palette ────────────────────────────────
  const extractPalette = useCallback(async (uri: string) => {
    try {
      const result: PaletteResult = await createPalette({ uri });
      const swatches: PaletteSwatch[] = [];
      const swatchNames: [keyof PaletteResult, string][] = [
        ["vibrant", "Vibrante"],
        ["lightVibrant", "Vibrante Claro"],
        ["darkVibrant", "Vibrante Escuro"],
        ["muted", "Suave"],
        ["lightMuted", "Suave Claro"],
        ["darkMuted", "Suave Escuro"],
      ];

      for (const [key, label] of swatchNames) {
        const swatch = result[key];
        if (swatch) {
          swatches.push({
            label,
            color: swatch.color,
            bodyTextColor: swatch.bodyTextColor,
            titleTextColor: swatch.titleTextColor,
            population: swatch.population,
          });
        }
      }
      setPalette(swatches);
    } catch (e) {
      console.warn("Palette extraction failed:", e);
    }
  }, []);

  // ─── Image selection ────────────────────────────────
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        loadImage(result.assets[0].uri);
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
        loadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Camera Error:", error);
    }
  };

  const loadImage = async (uri: string) => {
    setIsProcessing(true);
    setImageUri(uri);
    setUiState("picker");
    setSelectedColor(null);
    setLoupeVisible(false);
    setLoupeColor(null);
    setPalette([]);
    pixelDataRef.current = null;

    // Extract palette
    await extractPalette(uri);
    setIsProcessing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ─── Pixel sampling ─────────────────────────────────
  const samplePixelAtScreenPos = useCallback(
    (screenX: number, screenY: number): string | null => {
      if (!imageDimensions || !pixelDataRef.current) return null;

      const viewportWidth = SCREEN_WIDTH - 32;
      const imgW = imageDimensions.width;
      const imgH = imageDimensions.height;

      // Calculate the fitted image dimensions within the viewport
      const aspectRatio = imgW / imgH;
      let displayW: number, displayH: number;
      if (aspectRatio > 1) {
        displayW = viewportWidth;
        displayH = viewportWidth / aspectRatio;
      } else {
        displayH = viewportWidth;
        displayW = viewportWidth * aspectRatio;
      }

      // Center offset within the viewport
      const offsetX = (viewportWidth - displayW) / 2;
      const offsetY = (viewportWidth - displayH) / 2;

      // Map from screen coords within the gesture view to image pixel coords
      const ix = screenX - offsetX;
      const iy = screenY - offsetY;

      // Normalize to image pixel coords
      const px = Math.round((ix / displayW) * imgW);
      const py = Math.round((iy / displayH) * imgH);

      if (px < 0 || px >= imgW || py < 0 || py >= imgH) return null;

      // Read from the pixel buffer (RGBA)
      const idx = (py * imgW + px) * 4;
      const r = pixelDataRef.current[idx];
      const g = pixelDataRef.current[idx + 1];
      const b = pixelDataRef.current[idx + 2];

      return rgbaToHex(r, g, b);
    },
    [imageDimensions],
  );

  const onLoupeUpdate = useCallback(
    (x: number, y: number) => {

      const color = samplePixelAtScreenPos(x, y);
      if (color) {
        setLoupeColor(color);
      }
    },
    [samplePixelAtScreenPos],
  );

  const onLoupeStart = useCallback(
    (x: number, y: number) => {
      setLoupeVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLoupeUpdate(x, y);
    },
    [onLoupeUpdate],
  );

  const onLoupeEnd = useCallback(
    (x: number, y: number) => {
      setLoupeVisible(false);
      const color = samplePixelAtScreenPos(x, y);
      if (color) {
        setSelectedColor(color);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [samplePixelAtScreenPos],
  );

  // ─── Gestures ───────────────────────────────────────
  const longPressGesture = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart((e) => {
      loupeX.value = e.x;
      loupeY.value = e.y;
      runOnJS(onLoupeStart)(e.x, e.y);
    })
    .onUpdate((e) => {
      loupeX.value = e.x;
      loupeY.value = e.y;
      runOnJS(onLoupeUpdate)(e.x, e.y);
    })
    .onEnd((e) => {
      runOnJS(onLoupeEnd)(e.x, e.y);
    })
    .onFinalize(() => {
      runOnJS(setLoupeVisible)(false);
    });



  // ─── Loupe animated position ───────────────────────
  const loupeAnimatedStyle = useAnimatedStyle(() => {
    // Position the loupe above and centered on the touch point
    let ly = loupeY.value + LOUPE_OFFSET_Y - LOUPE_SIZE / 2;
    let lx = loupeX.value - LOUPE_SIZE / 2;

    // Keep loupe within bounds
    const viewportWidth = SCREEN_WIDTH - 32;
    if (lx < 0) lx = 0;
    if (lx + LOUPE_SIZE > viewportWidth) lx = viewportWidth - LOUPE_SIZE;
    if (ly < 0) ly = loupeY.value + 40; // flip below if at top

    return {
      position: "absolute" as const,
      left: lx,
      top: ly,
      width: LOUPE_SIZE,
      height: LOUPE_SIZE,
    };
  });

  // ─── Calculate display dimensions ───────────────────
  const viewportWidth = SCREEN_WIDTH - 32;
  const viewportHeight = viewportWidth;

  let displayW = viewportWidth;
  let displayH = viewportHeight;
  if (imageDimensions) {
    const ar = imageDimensions.width / imageDimensions.height;
    if (ar > 1) {
      displayW = viewportWidth;
      displayH = viewportWidth / ar;
    } else {
      displayH = viewportHeight;
      displayW = viewportHeight * ar;
    }
  }

  const imageOffsetX = (viewportWidth - displayW) / 2;
  const imageOffsetY = (viewportHeight - displayH) / 2;

  const loupeImageAnimatedStyle = useAnimatedStyle(() => {
    const tx = loupeX.value - imageOffsetX;
    const ty = loupeY.value - imageOffsetY;

    const translateX =
      LOUPE_SIZE / 2 - (displayW / 2 + (tx - displayW / 2) * LOUPE_ZOOM);
    const translateY =
      LOUPE_SIZE / 2 - (displayH / 2 + (ty - displayH / 2) * LOUPE_ZOOM);

    return {
      transform: [{ translateX }, { translateY }, { scale: LOUPE_ZOOM }],
    };
  });

  // ─── Copy handler ──────────────────────────────────
  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ─── Select palette swatch ─────────────────────────
  const handleSelectSwatch = (color: string) => {
    setSelectedColor(normalizeToHex(color));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ─── Reset ──────────────────────────────────────────
  const handleReset = () => {
    setUiState("landing");
    setImageUri(null);
    setSelectedColor(null);
    setPalette([]);
    setImageDimensions(null);
    pixelDataRef.current = null;
    setLoupeVisible(false);
    setLoupeColor(null);
  };

  // ─── Render ─────────────────────────────────────────
  return (
    <View style={{ flex: 1 }} className="bg-surface">
      {/* ─── LANDING ─────────────────────────────────── */}
      {uiState === "landing" && (
        <View style={{ flex: 1 }}>
          {/* Header */}
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
                Color Picker
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
                backgroundColor: withOpacity(TOOL_COLOR, isDark ? 0.15 : 0.1),
              }}
              className="mb-8 h-24 w-24 items-center justify-center rounded-full"
            >
              <Pipette size={48} color={TOOL_COLOR} />
            </View>
            <Text className="font-sans-bold text-2xl text-on-surface text-center mb-2">
              Conta-Gotas de Cores
            </Text>
            <Text className="font-sans text-base text-on-surface-secondary text-center mb-10 leading-6 px-4">
              Importe uma imagem e extraia cores com o conta-gotas ou gere uma
              paleta automaticamente.
            </Text>

            <ToolActions>
              <ToolActions.Button
                onPress={handleCamera}
                icon={<CameraIcon size={24} color={TOOL_COLOR} />}
                color={TOOL_COLOR}
                title="Câmera"
                description="Tirar foto e analisar"
              />
              <ToolActions.Button
                onPress={handlePickImage}
                icon={<ImageIcon size={24} color={TOOL_COLOR} />}
                color={TOOL_COLOR}
                title="Galeria"
                description="Escolher imagem salva"
              />
            </ToolActions>
          </Animated.View>
        </View>
      )}

      {/* ─── PICKER ──────────────────────────────────── */}
      {uiState === "picker" && (
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View
            style={{ paddingTop: insets.top + 10 }}
            className="flex-row items-center justify-between px-4 pb-4"
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleReset}
              className="h-12 w-12 rounded-full items-center justify-center bg-surface-secondary/50"
            >
              <ChevronLeft size={28} color={isDark ? "#FFF" : "#000"} />
            </TouchableOpacity>
            <View className="flex-1 items-center">
              <Text className="font-sans-bold text-on-surface text-lg">
                Color Picker
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePickImage}
              className="h-12 w-12 rounded-full items-center justify-center bg-surface-secondary/50"
            >
              <ImageIcon size={22} color={isDark ? "#FFF" : "#000"} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 24,
            }}
          >
            {/* Image Viewport */}
            <View className="px-4 mb-4">
              <View
                style={[
                  {
                    width: viewportWidth,
                    height: viewportHeight,
                    borderRadius: 28,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.08)",
                    backgroundColor: isDark ? "#171717" : "#F5F5F5",
                  },
                  shadows.md,
                ]}
              >
                {skImage ? (
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <GestureDetector gesture={longPressGesture}>
                      <Animated.View
                        style={{
                          width: viewportWidth,
                          height: viewportHeight,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Canvas
                          style={{
                            width: displayW,
                            height: displayH,
                          }}
                        >
                          <SkiaImage
                            image={skImage}
                            fit="contain"
                            x={0}
                            y={0}
                            width={displayW}
                            height={displayH}
                          />
                        </Canvas>
                      </Animated.View>
                    </GestureDetector>

                    {/* Magnifier Loupe */}
                    {loupeVisible && imageUri && (
                      <Animated.View
                        style={[
                          loupeAnimatedStyle,
                          {
                            borderRadius: LOUPE_SIZE / 2,
                            overflow: "hidden",
                            borderWidth: 3,
                            borderColor: loupeColor || "#FFFFFF",
                            backgroundColor: isDark ? "#171717" : "#F5F5F5",
                          },
                          shadows.xl,
                        ]}
                        pointerEvents="none"
                      >
                        <Animated.Image
                          source={{ uri: imageUri }}
                          style={[
                            {
                              width: displayW,
                              height: displayH,
                              position: "absolute",
                              left: 0,
                              top: 0,
                            },
                            loupeImageAnimatedStyle,
                          ]}
                          resizeMode="cover"
                        />
                        {/* Crosshair at center */}
                        <View
                          style={{
                            position: "absolute",
                            left: LOUPE_SIZE / 2 - 4,
                            top: LOUPE_SIZE / 2 - 4,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            borderWidth: 2,
                            borderColor: "rgba(255, 255, 255, 0.9)",
                          }}
                        />
                        <View
                          style={{
                            position: "absolute",
                            left: LOUPE_SIZE / 2 - 4,
                            top: LOUPE_SIZE / 2 - 4,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: "rgba(0, 0, 0, 0.5)",
                          }}
                        />
                      </Animated.View>
                    )}
                  </GestureHandlerRootView>
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={primaryColor} />
                  </View>
                )}

                {/* Hint text */}
                <View
                  className="absolute bottom-3 left-0 right-0 items-center"
                  pointerEvents="none"
                >
                  <View
                    className="flex-row items-center px-3 py-1.5 rounded-full"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(0,0,0,0.7)"
                        : "rgba(255,255,255,0.85)",
                    }}
                  >
                    <Pipette size={12} color={isDark ? "#FFF" : "#000"} />
                    <Text
                      className="font-sans-medium text-[11px] ml-1"
                      style={{ color: isDark ? "#FFF" : "#000" }}
                    >
                      Segure para ativar a lupa e capturar cor
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Selected Color Info */}
            {selectedColor && (
              <Animated.View
                entering={FadeInDown.duration(300).springify()}
                className="px-4 mb-4"
              >
                <View
                  className="rounded-3xl p-4 border"
                  style={[
                    {
                      borderColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.08)",
                      backgroundColor: isDark ? "#171717" : "#F5F5F5",
                    },
                    shadows.sm,
                  ]}
                >
                  <View className="flex-row items-center">
                    {/* Color Preview */}
                    <View
                      style={[
                        {
                          width: 64,
                          height: 64,
                          borderRadius: 20,
                          backgroundColor: selectedColor,
                          borderWidth: 2,
                          borderColor: isDark
                            ? "rgba(255,255,255,0.15)"
                            : "rgba(0,0,0,0.1)",
                        },
                        shadows.md,
                      ]}
                    />

                    <View className="flex-1 ml-4">
                      {/* HEX */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleCopy(selectedColor)}
                        className="flex-row items-center justify-between py-2"
                      >
                        <View>
                          <Text className="font-sans text-[10px] text-on-surface-secondary uppercase tracking-widest">
                            HEX
                          </Text>
                          <Text className="font-sans-bold text-lg text-on-surface">
                            {normalizeToHex(selectedColor)}
                          </Text>
                        </View>
                        <Copy size={16} color={primaryColor} />
                      </TouchableOpacity>

                      <View
                        style={{
                          height: 1,
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.06)",
                        }}
                      />

                      {/* RGB */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() =>
                          handleCopy(`rgb(${hexToRgbString(selectedColor)})`)
                        }
                        className="flex-row items-center justify-between py-2"
                      >
                        <View>
                          <Text className="font-sans text-[10px] text-on-surface-secondary uppercase tracking-widest">
                            RGB
                          </Text>
                          <Text className="font-sans-bold text-base text-on-surface">
                            {hexToRgbString(selectedColor)}
                          </Text>
                        </View>
                        <Copy size={16} color={primaryColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Palette Section */}
            {palette.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(200).duration(400).springify()}
                className="px-4"
              >
                <View className="flex-row items-center mb-3">
                  <View
                    className="h-8 w-8 rounded-full items-center justify-center mr-2"
                    style={{
                      backgroundColor: withOpacity(
                        TOOL_COLOR,
                        isDark ? 0.15 : 0.1,
                      ),
                    }}
                  >
                    <Pipette size={14} color={TOOL_COLOR} />
                  </View>
                  <Text className="font-sans-bold text-base text-on-surface">
                    Paleta Extraída
                  </Text>
                </View>

                <View
                  className="rounded-3xl border overflow-hidden"
                  style={[
                    {
                      borderColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.08)",
                      backgroundColor: isDark ? "#171717" : "#F5F5F5",
                    },
                    shadows.sm,
                  ]}
                >
                  {palette.map((swatch, idx) => (
                    <React.Fragment key={swatch.label}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleSelectSwatch(swatch.color)}
                        className="flex-row items-center p-4"
                      >
                        <View
                          style={[
                            {
                              width: 44,
                              height: 44,
                              borderRadius: 14,
                              backgroundColor: swatch.color,
                              borderWidth:
                                selectedColor?.toLowerCase() ===
                                normalizeToHex(swatch.color).toLowerCase()
                                  ? 2.5
                                  : 1,
                              borderColor:
                                selectedColor?.toLowerCase() ===
                                normalizeToHex(swatch.color).toLowerCase()
                                  ? primaryColor
                                  : isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.08)",
                            },
                            shadows.sm,
                          ]}
                        />
                        <View className="flex-1 ml-3">
                          <Text className="font-sans-semibold text-sm text-on-surface">
                            {swatch.label}
                          </Text>
                          <Text className="font-sans text-xs text-on-surface-secondary mt-0.5">
                            {swatch.color.toUpperCase()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleCopy(swatch.color)}
                          className="h-9 w-9 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: withOpacity(
                              primaryColor,
                              0.1,
                            ),
                          }}
                        >
                          <Copy size={14} color={primaryColor} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                      {idx < palette.length - 1 && (
                        <View
                          style={{
                            height: 1,
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.05)",
                            marginHorizontal: 16,
                          }}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </View>
      )}

      <LoadingOverlay
        visible={isProcessing}
        title="Extraindo Paleta..."
        description="Analisando as cores da imagem"
      />
    </View>
  );
}
