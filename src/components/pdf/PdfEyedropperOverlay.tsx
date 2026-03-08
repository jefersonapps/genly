import { shadows } from '@/theme/shadows';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

interface PdfEyedropperOverlayProps {
  pdfUri: string;
  page: number; // 1-indexed form pdf-editor.tsx
  onColorPicked: (color: string) => void;
  onCancel: () => void;
}

const LOUPE_SIZE = 140;
const LOUPE_ZOOM = 3;
const LOUPE_OFFSET_Y = -90;

function rgbaToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function PdfEyedropperOverlay({ pdfUri, page, onColorPicked, onCancel }: PdfEyedropperOverlayProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [loupeVisible, setLoupeVisible] = useState(false);
  const [loupeColor, setLoupeColor] = useState<string | null>(null);
  
  const pixelDataRef = useRef<Uint8Array | null>(null);
  const skImage = useImage(imageUri ?? undefined);

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  
  const loupeX = useSharedValue(0);
  const loupeY = useSharedValue(0);

  // 1. Generate thumbnail
  useEffect(() => {
    let mounted = true;
    const generateThumb = async () => {
      try {
        // pdf-thumbnail uses 0-indexed pages
        const result = await PdfThumbnail.generate(pdfUri, Math.max(0, page - 1), 100);
        if (mounted && result?.uri) {
          setImageUri(result.uri);
          setImageDimensions({ width: result.width, height: result.height });
        } else if (mounted) {
          onCancel();
        }
      } catch (err) {
        console.error("Failed to generate PDF thumbnail for eyedropper", err);
        if (mounted) onCancel();
      }
    };
    generateThumb();
    return () => { mounted = false; };
  }, [pdfUri, page, onCancel]);

  // 2. Load pixels when image is ready
  useEffect(() => {
    if (skImage) {
      const w = skImage.width();
      const h = skImage.height();
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

  // 3. Sampling logic
  const samplePixelAtScreenPos = useCallback(
    (screenX: number, screenY: number): string | null => {
      if (!imageDimensions || !pixelDataRef.current) return null;

      const imgW = imageDimensions.width;
      const imgH = imageDimensions.height;

      // The image is fitted (`contain`) in the SCREEN_WIDTH x SCREEN_HEIGHT space
      const aspectRatio = imgW / imgH;
      const screenAspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT;

      let displayW, displayH;
      if (aspectRatio > screenAspectRatio) {
        displayW = SCREEN_WIDTH;
        displayH = SCREEN_WIDTH / aspectRatio;
      } else {
        displayH = SCREEN_HEIGHT;
        displayW = SCREEN_HEIGHT * aspectRatio;
      }

      const offsetX = (SCREEN_WIDTH - displayW) / 2;
      const offsetY = (SCREEN_HEIGHT - displayH) / 2;

      const ix = screenX - offsetX;
      const iy = screenY - offsetY;

      const px = Math.round((ix / displayW) * imgW);
      const py = Math.round((iy / displayH) * imgH);

      if (px < 0 || px >= imgW || py < 0 || py >= imgH) return null;

      const idx = (py * imgW + px) * 4;
      const r = pixelDataRef.current[idx];
      const g = pixelDataRef.current[idx + 1];
      const b = pixelDataRef.current[idx + 2];

      return rgbaToHex(r, g, b);
    },
    [imageDimensions, SCREEN_WIDTH, SCREEN_HEIGHT],
  );

  const onLoupeUpdate = useCallback((x: number, y: number) => {
    const color = samplePixelAtScreenPos(x, y);
    if (color) {
      setLoupeColor(color);
    }
  }, [samplePixelAtScreenPos]);

  const onLoupeStart = useCallback((x: number, y: number) => {
    setLoupeVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLoupeUpdate(x, y);
  }, [onLoupeUpdate]);

  const onLoupeEnd = useCallback((x: number, y: number) => {
    setLoupeVisible(false);
    const color = samplePixelAtScreenPos(x, y);
    if (color) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onColorPicked(color);
    } else {
      onCancel();
    }
  }, [samplePixelAtScreenPos, onColorPicked, onCancel]);

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onStart((e) => {
      loupeX.value = e.absoluteX;
      loupeY.value = e.absoluteY;
      runOnJS(onLoupeStart)(e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      loupeX.value = e.absoluteX;
      loupeY.value = e.absoluteY;
      runOnJS(onLoupeUpdate)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onLoupeEnd)(e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      runOnJS(setLoupeVisible)(false);
    });

  const tapCancel = Gesture.Tap()
    .onEnd(() => {
      runOnJS(onCancel)();
    });

  const composedGesture = Gesture.Exclusive(gesture, tapCancel);

  const loupeAnimatedStyle = useAnimatedStyle(() => {
    let ly = loupeY.value + LOUPE_OFFSET_Y - LOUPE_SIZE / 2;
    let lx = loupeX.value - LOUPE_SIZE / 2;

    if (lx < 0) lx = 0;
    if (lx + LOUPE_SIZE > SCREEN_WIDTH) lx = SCREEN_WIDTH - LOUPE_SIZE;
    if (ly < 0) ly = loupeY.value + 40; 

    return {
      position: "absolute",
      left: lx,
      top: ly,
      width: LOUPE_SIZE,
      height: LOUPE_SIZE,
    };
  });

  let displayW = SCREEN_WIDTH;
  let displayH = SCREEN_HEIGHT;
  let imageOffsetX = 0;
  let imageOffsetY = 0;

  if (imageDimensions) {
    const aspectRatio = imageDimensions.width / imageDimensions.height;
    const screenAspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT;

    if (aspectRatio > screenAspectRatio) {
      displayW = SCREEN_WIDTH;
      displayH = SCREEN_WIDTH / aspectRatio;
    } else {
      displayH = SCREEN_HEIGHT;
      displayW = SCREEN_HEIGHT * aspectRatio;
    }

    imageOffsetX = (SCREEN_WIDTH - displayW) / 2;
    imageOffsetY = (SCREEN_HEIGHT - displayH) / 2;
  }

  const loupeImageAnimatedStyle = useAnimatedStyle(() => {
    const tx = loupeX.value - imageOffsetX;
    const ty = loupeY.value - imageOffsetY;

    const translateX = LOUPE_SIZE / 2 - (displayW / 2 + (tx - displayW / 2) * LOUPE_ZOOM);
    const translateY = LOUPE_SIZE / 2 - (displayH / 2 + (ty - displayH / 2) * LOUPE_ZOOM);

    return {
      transform: [{ translateX }, { translateY }, { scale: LOUPE_ZOOM }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} className="bg-black/90 z-50">
      {(!skImage || !imageDimensions) ? (
        <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={StyleSheet.absoluteFill}>
            <View style={styles.centerContainer}>
              <Canvas style={{ width: displayW, height: displayH }}>
                <SkiaImage
                  image={skImage}
                  fit="contain"
                  x={0}
                  y={0}
                  width={displayW}
                  height={displayH}
                />
              </Canvas>
            </View>
            
            {loupeVisible && imageUri && (
              <Animated.View
                style={[
                  loupeAnimatedStyle,
                  styles.loupeContainer,
                  { borderColor: loupeColor || "#FFFFFF" },
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
                <View style={styles.crosshair} />
              </Animated.View>
            )}
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loupeContainer: {
    borderRadius: LOUPE_SIZE / 2,
    overflow: "hidden",
    borderWidth: 3,
    backgroundColor: "#171717",
  },
  crosshair: {
    position: "absolute",
    left: LOUPE_SIZE / 2 - 4,
    top: LOUPE_SIZE / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.3)",
    backgroundColor: "transparent",
  },
});
