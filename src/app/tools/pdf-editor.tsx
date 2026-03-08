import BottomSheet from '@/components/ui/BottomSheet';
import { useDialog } from '@/providers/DialogProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { withOpacity } from '@/utils/colors';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight, Crop,
  Download,
  Eraser,
  FilePen,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  Maximize,
  RefreshCw,
  Share2,
  Trash2,
  Type,
  X
} from 'lucide-react-native';
import { PDFButton, PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  Text, TextInput, TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Pdf from 'react-native-pdf';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ToolActions } from "@/components/ui/ToolActions";
import { exportEditedPdf } from '@/lib/pdfEditor/pdfExportUtils';
import { usePdfEditorStore, type Annotation, type FormField } from '@/lib/pdfEditor/usePdfEditorStore';
import { shadows } from '@/theme/shadows';

const SPRING_CONFIG = { damping: 20, stiffness: 200 };

// ─── Draggable Annotation Component ───────────────────
interface DraggableAnnotationProps {
  annotation: Annotation;
  isSelected: boolean;
  canvasScale: SharedValue<number>;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResizeEnd: (id: string, w: number, h: number) => void;
  onRotateEnd: (id: string, rotation: number) => void;
  onDoubleTap: (id: string) => void;
  onToggleCrop: (id: string) => void;
  onLongPress: (id: string) => void;
  isDark: boolean;
  primaryColor: string;
}

function DraggableAnnotation({
  annotation,
  isSelected,
  canvasScale,
  onSelect,
  onDragEnd,
  onResizeEnd,
  onRotateEnd,
  onDoubleTap,
  onToggleCrop,
  onLongPress,
  isDark,
  primaryColor,
}: DraggableAnnotationProps) {
  // ── ALL position in shared values to avoid React/Reanimated mixing ──
  const baseX = useSharedValue(annotation.x);
  const baseY = useSharedValue(annotation.y);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  const resizeW = useSharedValue(annotation.width);
  const resizeH = useSharedValue(annotation.height);
  const liveRotation = useSharedValue(annotation.rotation || 0);

  // Sync shared values when store updates — atomic, no flicker gap
  React.useEffect(() => {
    baseX.value = annotation.x;
    baseY.value = annotation.y;
    offsetX.value = 0;
    offsetY.value = 0;
  }, [annotation.x, annotation.y]);

  React.useEffect(() => {
    resizeW.value = annotation.width;
    resizeH.value = annotation.height;
  }, [annotation.width, annotation.height]);

  React.useEffect(() => {
    liveRotation.value = annotation.rotation || 0;
  }, [annotation.rotation]);

  // ── Drag ──
  const dragGesture = Gesture.Pan()
    .minDistance(5)
    .onStart(() => {
      'worklet';
      runOnJS(onSelect)(annotation.id);
    })
    .onUpdate((e) => {
      'worklet';
      offsetX.value = e.translationX / canvasScale.value;
      offsetY.value = e.translationY / canvasScale.value;
    })
    .onEnd(() => {
      'worklet';
      const newX = baseX.value + offsetX.value;
      const newY = baseY.value + offsetY.value;
      runOnJS(onDragEnd)(annotation.id, newX, newY);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    });

  // ── Tap ──
  const tapGesture = Gesture.Tap()
    .maxDuration(300)
    .onEnd(() => {
      'worklet';
      runOnJS(onSelect)(annotation.id);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    });

  // ── Double tap ──
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd(() => {
      'worklet';
      if (annotation.type === 'image') {
        runOnJS(onToggleCrop)(annotation.id);
      } else {
        runOnJS(onDoubleTap)(annotation.id);
      }
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    });

  // ── Long press ──
  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      'worklet';
      runOnJS(onLongPress)(annotation.id);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    });

  // ── Resize (8 points) ──
  const createResizeGesture = (edgeX: 0 | 0.5 | 1, edgeY: 0 | 0.5 | 1) => {
    return Gesture.Pan()
      .minDistance(2)
      .onUpdate((e) => {
        'worklet';
        const dx = e.translationX / canvasScale.value;
        const dy = e.translationY / canvasScale.value;

        const isFree = annotation.isCropping || annotation.type !== 'image' || annotation.originalWidth <= 0;
        
        let newW = annotation.width;
        let newH = annotation.height;
        let pOffsetX = 0;
        let pOffsetY = 0;

        if (edgeX === 1) { // Right
          newW = Math.max(40, annotation.width + dx);
        } else if (edgeX === 0) { // Left
          newW = Math.max(40, annotation.width - dx);
          pOffsetX = annotation.width - dx >= 40 ? dx : annotation.width - 40;
        }

        if (edgeY === 1) { // Bottom
          newH = Math.max(20, annotation.height + dy);
        } else if (edgeY === 0) { // Top
          newH = Math.max(20, annotation.height - dy);
          pOffsetY = annotation.height - dy >= 20 ? dy : annotation.height - 20;
        }

        if (isFree) {
          resizeW.value = newW;
          resizeH.value = newH;
          offsetX.value = pOffsetX;
          offsetY.value = pOffsetY;
        } else {
          // Lock aspect ratio for normal image mode based on current annotation dimensions
          const aspect = annotation.height / annotation.width;
          const newWLock = Math.max(40, annotation.width + dx);
          resizeW.value = newWLock;
          resizeH.value = newWLock * aspect;
        }
      })
      .onEnd(() => {
        'worklet';
        runOnJS(onResizeEnd)(annotation.id, resizeW.value, resizeH.value);
        if (offsetX.value !== 0 || offsetY.value !== 0) {
          const finalX = baseX.value + offsetX.value;
          const finalY = baseY.value + offsetY.value;
          runOnJS(onDragEnd)(annotation.id, finalX, finalY);
        }
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      });
  };

  const resizeTL = createResizeGesture(0, 0);
  const resizeTC = createResizeGesture(0.5, 0);
  const resizeTR = createResizeGesture(1, 0);
  const resizeML = createResizeGesture(0, 0.5);
  const resizeMR = createResizeGesture(1, 0.5);
  const resizeBL = createResizeGesture(0, 1);
  const resizeBC = createResizeGesture(0.5, 1);
  const resizeGesture = createResizeGesture(1, 1);

  // ── Rotation (top-center handle) ──
  const startRotation = useSharedValue(0);
  const rotateGesture = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      'worklet';
      startRotation.value = liveRotation.value;
    })
    .onUpdate((e) => {
      'worklet';
      liveRotation.value = startRotation.value + e.translationX / 1.5;
    })
    .onEnd(() => {
      'worklet';
      runOnJS(onRotateEnd)(annotation.id, liveRotation.value);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    });

  const combinedGesture = Gesture.Race(
    doubleTapGesture,
    longPressGesture,
    Gesture.Simultaneous(tapGesture, dragGesture),
  );

  // ── Animated style — ALL position via shared values ──
  const animatedStyle = useAnimatedStyle(() => ({
    left: baseX.value + offsetX.value,
    top: baseY.value + offsetY.value,
    width: resizeW.value,
    height: resizeH.value,
    transform: [{ rotate: `${liveRotation.value}deg` }],
  }));

  const getBgColor = () => {
    switch (annotation.type) {
      case 'eraser':
        return '#FFFFFF';
      case 'text':
        return 'transparent';
      case 'image':
        return 'transparent';
      default:
        return 'transparent';
    }
  };

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            backgroundColor: getBgColor(),
            borderRadius: annotation.type === 'text' ? 4 : 2,
            overflow: 'visible',
            zIndex: isSelected ? 30 : 20, // Always above form fields (z-index 10)
          },
          animatedStyle,
        ]}
      >

        {/* Content */}
        {annotation.type === 'text' && (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 4 }}>
            <Text
              style={{
                fontSize: annotation.fontSize,
                color: annotation.fontColor || '#000',
                fontFamily: 'Montserrat-Medium',
              }}
              numberOfLines={0}
            >
              {annotation.content}
            </Text>
          </View>
        )}

        {annotation.type === 'image' && (
          <Animated.Image
            source={{ uri: annotation.content }}
            style={{ width: '100%', height: '100%', borderRadius: 2 }}
            resizeMode="cover"
          />
        )}

        {/* Border Ring (absolute to prevent layout shift) */}
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            borderWidth: isSelected ? 2 : (annotation.type === 'eraser' ? 1 : 0),
            borderColor: isSelected
              ? (annotation.isCropping ? '#3B82F6' : primaryColor)
              : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
            borderStyle: (isSelected && annotation.isCropping) ? 'dashed' : (isSelected ? 'solid' : 'dashed'),
            borderRadius: annotation.type === 'text' ? 4 : 2,
            pointerEvents: 'none',
          }}
        />

        {/* Crop mode: 8-point handles on corners and edge midpoints */}
        {annotation.isCropping && isSelected && (
          <>
            {/* Corner handles */}
            <GestureDetector gesture={resizeTL}><Animated.View className="absolute bg-white border border-[#3B82F6] rounded-[2] w-3 h-3 z-50" style={[{ top: -5, left: -5 }, shadows.sm]} /></GestureDetector>
            <GestureDetector gesture={resizeTR}><Animated.View className="absolute bg-white border border-[#3B82F6] rounded-[2] w-3 h-3 z-50" style={[{ top: -5, right: -5 }, shadows.sm]} /></GestureDetector>
            <GestureDetector gesture={resizeBL}><Animated.View className="absolute bg-white border border-[#3B82F6] rounded-[2] w-3 h-3 z-50" style={[{ bottom: -5, left: -5 }, shadows.sm]} /></GestureDetector>
            {/* Edge midpoint handles */}
            <GestureDetector gesture={resizeTC}><Animated.View className="absolute bg-white border border-[#3B82F6] rounded-[2] w-3 h-3 z-50" style={[{ top: -5, left: '50%', marginLeft: -5 }, shadows.sm]} /></GestureDetector>
            <GestureDetector gesture={resizeBC}><Animated.View className="absolute bg-white border border-[#3B82F6] rounded-[2] w-3 h-3 z-50" style={[{ bottom: -5, left: '50%', marginLeft: -5 }, shadows.sm]} /></GestureDetector>
            <GestureDetector gesture={resizeML}><Animated.View className="absolute bg-white border border-[#3B82F6] rounded-[2] w-3 h-3 z-50" style={[{ top: '50%', left: -5, marginTop: -5 }, shadows.sm]} /></GestureDetector>
            <GestureDetector gesture={resizeMR}><Animated.View className="absolute bg-white border border-[#3B82F6] rounded-[2] w-3 h-3 z-50" style={[{ top: '50%', right: -5, marginTop: -5 }, shadows.sm]} /></GestureDetector>
            {/* Bottom-right is the resize handle for cropping */}
            <GestureDetector gesture={resizeGesture}>
              <Animated.View className="absolute bg-white border border-[#3B82F6] rounded-[2] w-3 h-3 z-50" style={[{ bottom: -5, right: -5 }, shadows.sm]} />
            </GestureDetector>
          </>
        )}

        {/* Selected Controls (hide when cropping — handles above are used instead) */}
        {isSelected && !annotation.isCropping && (
          <>
            {/* Rotation handle — top center */}
            <GestureDetector gesture={rotateGesture}>
              <Animated.View
                className="absolute w-6 h-6 rounded-full items-center justify-center"
                style={[{
                  top: -28,
                  alignSelf: 'center',
                  left: '50%',
                  marginLeft: -11,
                  backgroundColor: '#3B82F6',
                }, shadows.sm]}
              >
                <RefreshCw size={10} color="#FFF" />
              </Animated.View>
            </GestureDetector>

            {/* Resize handle — bottom right */}
            <GestureDetector gesture={resizeGesture}>
              <Animated.View
                className="absolute w-4 h-4 rounded-full right-[-8] bottom-[-8]"
                style={[{
                  backgroundColor: primaryColor,
                }, shadows.sm]}
              />
            </GestureDetector>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Form Field Component ─────────────────────────────
interface FormFieldItemProps {
  field: FormField;
  canvasScale: SharedValue<number>;
  onUpdate: (name: string, value: string | boolean | string[]) => void;
  onReset: () => void;
  onFocusNext?: (currentId: string) => void;
  isDark: boolean;
  primaryColor: string;
  dialog: any;
  inputRef?: (ref: any) => void;
}

function FormFieldItem({
  field,
  canvasScale,
  onUpdate,
  onReset,
  onFocusNext,
  isDark,
  primaryColor,
  dialog,
  inputRef,
}: FormFieldItemProps) {
  const innerInputRef = useRef<any>(null);
  const fieldRefs = useRef<Record<string, any>>({});

  const animatedStyle = useAnimatedStyle(() => ({
    left: field.x,
    top: field.y,
    width: field.width,
    height: field.height,
  }));

  const commonBoxStyle: any = {
    flex: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 2,
    borderWidth: 0, // No border, let PDF lines show
    justifyContent: 'center',
  };

  if (field.type === 'checkbox') {
    return (
      <Animated.View style={[{ position: 'absolute', zIndex: 10 }, animatedStyle]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            onUpdate(field.name, !field.value);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={[
            commonBoxStyle,
            {
              backgroundColor: field.value ? primaryColor : commonBoxStyle.backgroundColor,
              borderColor: field.value ? primaryColor : commonBoxStyle.borderColor,
              alignItems: 'center',
            },
          ]}
        >
          {field.value && <X size={Math.min(field.width, field.height) * 0.8} color="#FFF" />}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (field.type === 'radio') {
    const isSelected = field.value === field.optionValue;
    return (
      <Animated.View style={[{ position: 'absolute', zIndex: 10 }, animatedStyle]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (field.optionValue) {
              onUpdate(field.name, field.optionValue);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
          style={[
            commonBoxStyle,
            {
              borderRadius: field.width / 2, // Circle for radio
              alignItems: 'center',
            },
          ]}
        >
          {isSelected && (
            <View
              style={{
                width: '60%',
                height: '60%',
                borderRadius: 100,
                backgroundColor: primaryColor,
              }}
            />
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (field.type === 'dropdown') {
    return (
      <Animated.View style={[{ position: 'absolute', zIndex: 10 }, animatedStyle]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (field.options) {
              dialog.show({
                title: 'Selecionar Opção',
                buttons: field.options.map((opt) => ({
                  text: opt,
                  onPress: () => {
                    onUpdate(field.name, opt);
                    dialog.hide();
                  },
                })),
              });
            }
          }}
          style={[commonBoxStyle, { paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center' }]}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: field.fontSize || 10,
              color: '#000',
              fontFamily: 'Montserrat-Medium',
            }}
          >
            {field.value || 'Selecionar...'}
          </Text>
          <ChevronDown size={12} color="#000" />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (field.type === 'listbox') {
    const totalOptions = field.options?.length || 1;
    const itemHeight = field.height / totalOptions;
    
    return (
      <Animated.View style={[{ position: 'absolute', zIndex: 10 }, animatedStyle]}>
        <View style={[commonBoxStyle, { padding: 0, overflow: 'hidden', borderWidth: 0, backgroundColor: 'transparent' }]}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {field.options?.map((opt, i) => {
              const isSelected = Array.isArray(field.value) ? field.value.includes(opt) : field.value === opt;
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.8}
                  onPress={() => {
                    onUpdate(field.name, opt);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    height: itemHeight,
                    width: '100%',
                    backgroundColor: isSelected ? withOpacity(primaryColor, 0.25) : 'transparent',
                  }}
                >
                  {/* No extra text layer - use the background highlight only to match original labels */}
                  {/* Show selection border if selected */}
                  {isSelected && (
                    <View style={{ 
                      position: 'absolute', 
                      left: 0, 
                      right: 0, 
                      top: 0, 
                      bottom: 0, 
                      borderWidth: 1, 
                      borderColor: primaryColor,
                    }} />
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      </Animated.View>
    );
  }

  if (field.type === 'button') {
    const isReset = field.name.toLowerCase().includes('reset');
    return (
      <Animated.View style={[{ position: 'absolute', zIndex: 10 }, animatedStyle]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (isReset) {
              onReset();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
          }}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
          }}
        />
      </Animated.View>
    );
  }

  // Adaptive font size calculation for fields
  const getAdaptiveFontSize = () => {
    let size = field.fontSize || 12;
    if (!field.value) return size;
    
    const text = String(field.value);
    const charCount = text.length;
    
    if (field.multiline) {
      // Estimate capacity based on average character width and line height
      // Montserrat-Medium is approx 0.55 * size
      const charsPerRow = Math.floor(Math.max(1, (field.width - 12) / (size * 0.55)));
      const maxRows = Math.floor(Math.max(1, (field.height - 6) / (size * 1.3)));
      
      // Only shrink if we actually have multiple lines of text that exceed capacity
      if (charCount > charsPerRow * maxRows && maxRows > 0) {
        // Scale down proportionally to fill the area
        const ratio = (charsPerRow * maxRows) / charCount;
        size = Math.max(5, size * Math.sqrt(ratio) * 0.95);
      }
    } else {
      // Single line text: scale down if it exceeds the width
      const estimatedWidth = charCount * (size * 0.55);
      const availableWidth = field.width - 8; // account for padding
      
      if (estimatedWidth > availableWidth && availableWidth > 0) {
        // Scale down proportionally to fit the width
        const ratio = availableWidth / estimatedWidth;
        size = Math.max(5, size * ratio * 0.95);
      }
    }
    return size;
  };

  const adaptiveFontSize = getAdaptiveFontSize();

  const handleCombChangeText = (text: string, index: number) => {
    const chars = String(field.value || '').padEnd(field.maxLength || 0, ' ').split('');
    const maxLength = field.maxLength || 1;
    
    // Fix for Android adding letter without selecting
    let typedChar = text;
    if (text.length === 2) {
      if (text[0] === chars[index]) typedChar = text[1];
      else if (text[1] === chars[index]) typedChar = text[0];
    } else if (text.length > 2) {
      // Real paste
      const paste = text.substring(0, maxLength - index);
      const newChars = [...chars];
      for(let i=0; i<paste.length; i++) {
        newChars[index+i] = paste[i];
      }
      onUpdate(field.name, newChars.join('').trimEnd());
      
      const nextIdx = Math.min(index + paste.length, maxLength - 1);
      setTimeout(() => fieldRefs.current[`${field.id}_${nextIdx}`]?.focus(), 50);
      return;
    }

    const newChars = [...chars];
    newChars[index] = typedChar || ' ';
    
    // Fill gaps
    for (let i = 0; i < maxLength; i++) {
       if (!newChars[i]) newChars[i] = ' ';
    }
    const finalVal = newChars.join('').trimEnd();
    onUpdate(field.name, finalVal);

    if (typedChar.length === 1 && typedChar !== ' ') {
      if (index < maxLength - 1) {
        fieldRefs.current[`${field.id}_${index + 1}`]?.focus();
      } else if (index === maxLength - 1 && onFocusNext) {
        onFocusNext(field.id);
      }
    }
  };

  const handleCombKeyPress = (e: any, index: number) => {
    const chars = String(field.value || '');
    if (e.nativeEvent.key === 'Backspace' && (!chars[index] || chars[index] === ' ') && index > 0) {
      fieldRefs.current[`${field.id}_${index - 1}`]?.focus();
    }
  };

  // Custom rendering for Comb (segmented) fields
  if (field.isComb && field.maxLength) {
    const chars = String(field.value || '').padEnd(field.maxLength, ' ').split('');
    const boxWidth = field.width / field.maxLength;
    
    return (
      <Animated.View style={[{ position: 'absolute', zIndex: 10, flexDirection: 'row' }, animatedStyle]}>
        {Array.from({ length: field.maxLength }).map((_, i) => (
          <View 
            key={i}
            style={{
              width: boxWidth,
              height: field.height,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 0,
            }}
          >
            <TextInput
              ref={(ref) => {
                fieldRefs.current[`${field.id}_${i}`] = ref;
                if (i === 0) inputRef?.(ref);
              }}
              value={chars[i] !== ' ' ? chars[i] : ''}
              onChangeText={(text) => handleCombChangeText(text, i)}
              onKeyPress={(e) => handleCombKeyPress(e, i)}
              maxLength={1} // Force OTP behavior
              keyboardType="default"
              selectTextOnFocus
              style={{
                width: '100%',
                height: '100%',
                textAlign: 'center',
                fontSize: Math.min(boxWidth * 0.7, field.height * 0.8),
                color: '#000',
                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                fontWeight: 'bold',
                padding: 0,
                margin: 0,
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                // Ensure text is centered
                includeFontPadding: false,
                textAlignVertical: 'center',
              }}
            />
          </View>
        ))}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ position: 'absolute', zIndex: 10 }, animatedStyle]}>
      <View style={[commonBoxStyle, { paddingHorizontal: field.multiline ? 0 : 4 }]}>
        <TextInput
          ref={inputRef}
          value={field.value as string}
          onChangeText={(val) => {
            onUpdate(field.name, val);
            if (field.maxLength && val.length >= field.maxLength && onFocusNext) {
              onFocusNext(field.id);
            }
          }}
          multiline={field.multiline}
          textAlignVertical={field.multiline ? 'top' : 'center'}
          style={{
            fontSize: adaptiveFontSize,
            color: '#000',
            fontFamily: 'Montserrat-Medium',
            padding: field.multiline ? 4 : 0,
            paddingVertical: 0,
            margin: 0,
            textAlign: 'left',
            flex: 1,
            width: '100%',
            height: '100%',
            includeFontPadding: false,
          }}
          placeholder="..."
          placeholderTextColor="#A1A1AA"
          maxLength={field.maxLength}
        />
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────
export default function PdfEditorTool() {
  const insets = useSafeAreaInsets();
  const { sharedUri } = useLocalSearchParams<{ sharedUri?: string }>();
  const router = useRouter();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const dialog = useDialog();

  // Store
  const pdfUri = usePdfEditorStore((s) => s.pdfUri);
  const pdfFileName = usePdfEditorStore((s) => s.pdfFileName);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pagesDimensions = usePdfEditorStore((s) => s.pagesDimensions);
  const annotations = usePdfEditorStore((s) => s.annotations);
  const formFields = usePdfEditorStore((s) => s.formFields);
  const selectedId = usePdfEditorStore((s) => s.selectedId);
  const setPdf = usePdfEditorStore((s) => s.setPdf);
  const setFormFields = usePdfEditorStore((s) => s.setFormFields);
  const updateFormField = usePdfEditorStore((s) => s.updateFormField);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);
  const setPagesDimensions = usePdfEditorStore((s) => s.setPagesDimensions);
  const addText = usePdfEditorStore((s) => s.addText);
  const addImage = usePdfEditorStore((s) => s.addImage);
  const addEraser = usePdfEditorStore((s) => s.addEraser);
  const updateAnnotation = usePdfEditorStore((s) => s.updateAnnotation);
  const deleteAnnotation = usePdfEditorStore((s) => s.deleteAnnotation);
  const selectAnnotation = usePdfEditorStore((s) => s.selectAnnotation);
  const reset = usePdfEditorStore((s) => s.reset);
  const resetFormFields = usePdfEditorStore((s) => s.resetFormFields);

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState<'text' | 'image' | 'eraser' | null>(null);
  // Canvas transform shared values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // PDF view dimensions (the rendered area)
  const [viewLayout, setViewLayout] = useState({ width: SCREEN_W, height: SCREEN_H - 200 });
  
  // Refs for auto-focus jumping between form fields
  const fieldRefs = useRef<Record<string, any>>({});
  
  const handleFocusNext = useCallback((currentId: string) => {
    // Filter fields on current page and sort by top-to-bottom, left-to-right
    const fieldsOnPage = formFields
      .filter(f => f.page === currentPage && (f.type === 'text' || f.type === 'checkbox'))
      .sort((a, b) => (Math.abs(a.y - b.y) < 5 ? a.x - b.x : a.y - b.y));
    
    const currentIndex = fieldsOnPage.findIndex(f => f.id === currentId);
    if (currentIndex !== -1 && currentIndex < fieldsOnPage.length - 1) {
      const nextField = fieldsOnPage[currentIndex + 1];
      fieldRefs.current[nextField.id]?.focus();
    }
  }, [formFields, currentPage]);

  const pdfRef = useRef<any>(null);

  // explicitly change pdf page via ref when `currentPage` updates, only if needed
  React.useEffect(() => {
    if (pdfRef.current) {
      try {
        pdfRef.current.setPage(currentPage + 1);
      } catch (e) {
        console.error('Failed to set PDF page:', e);
      }
    }
  }, [currentPage]);

  const currentPageDim = pagesDimensions[currentPage] || pagesDimensions[0] || { width: 1, height: 1 };
  
  const displayDim = useMemo(() => {
    if (!viewLayout.width || !viewLayout.height || !currentPageDim.width || !currentPageDim.height) {
      return { width: viewLayout.width, height: viewLayout.height };
    }
    
    const containerW = viewLayout.width;
    const containerH = viewLayout.height;
    const pageW = currentPageDim.width;
    const pageH = currentPageDim.height;
    
    const scaleW = containerW / pageW;
    const scaleH = containerH / pageH;
    const scale = Math.min(scaleW, scaleH);
    
    return {
      width: pageW * scale,
      height: pageH * scale,
    };
  }, [currentPageDim, viewLayout]);

  const pdfDisplayWidth = displayDim.width;
  const pdfDisplayHeight = displayDim.height;

  // Bottom sheets
  const editSheetRef = useRef<BottomSheetModal>(null);
  const exportSheetRef = useRef<BottomSheetModal>(null);
  const editSnapPoints = useMemo(() => ['40%'], []);
  const exportSnapPoints = useMemo(() => ['35%'], []);

  // Text editing state
  const [editText, setEditText] = useState('');
  const [editFontSize, setEditFontSize] = useState(16);
  const [editColor, setEditColor] = useState('#000000');

  const TEXT_COLORS = ['#000000', '#EF4444', '#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#EC4899', '#FFFFFF'];

  // ─── Import PDF ───────────────────────────────────
  const handleImportPdf = useCallback(async (customUri?: string) => {
    try {
      let uri = customUri;
      if (!uri) {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf'],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        uri = result.assets[0].uri;
      }

      setIsProcessing(true);

      // Extract accurate page count via pdf-lib
      const fileBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const pdfDoc = await PDFDocument.load(fileBase64);
      const exactPageCount = pdfDoc.getPageCount();
      const pages = pdfDoc.getPages();
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      const extractedFields: FormField[] = [];

      const fieldsFoundCount = fields.length;
      fields.forEach((field) => {
        const name = field.getName();
        let type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'button' | 'listbox' = 'text';
        let value: string | boolean | string[] = '';
        let options: string[] = [];

        const constructorName = (field as any).constructor.name;
        let maxLength: number | undefined;
        let isComb = false;
        let multiline = false;

        console.log(`[PDF Form] Found field: ${name}, Type: ${constructorName}`);

        if (field instanceof PDFTextField || constructorName === 'PDFTextField') {
          type = 'text';
          value = (field as any).getText() || '';
          try {
            maxLength = typeof (field as any).getMaxLength === 'function' ? (field as any).getMaxLength() : undefined;
            isComb = typeof (field as any).isComb === 'function' ? (field as any).isComb() : false;
            multiline = typeof (field as any).isMultiline === 'function' ? (field as any).isMultiline() : false;
            
            // Force isComb if the flag is set in the AcroField (Bit 25 = 1 << 24)
            const flags = (field as any).acroField?.getFlags() || 0;
            if (!isComb && (flags & (1 << 24))) {
              isComb = true;
              console.log(`[PDF Form] Field ${name} flagged as Comb via flags (flags: ${flags})`);
            }

            // Heuristic fallback for ID fields explicitly named "ID" or similar
            const lowerName = name.toLowerCase();
            if (
              !isComb && maxLength && 
              (lowerName.includes('id') || 
               lowerName.includes('cpf') || 
               lowerName.includes('cnpj') || 
               lowerName.includes('ssn') || 
               lowerName.includes('zip') ||
               lowerName.includes('code') ||
               maxLength <= 20) && !multiline
            ) {
              isComb = true;
              console.log(`[PDF Form] Heuristically identified ${name} as Comb field (maxLength: ${maxLength})`);
            }

            if (!multiline && (lowerName.includes('note') || lowerName.includes('message') || lowerName.includes('address'))) {
              multiline = true;
            }
            console.log(`[PDF Form] Extracted field ${name}: type=${type}, isComb=${isComb}, maxLength=${maxLength}, multiline=${multiline}`);
          } catch (e) {
            console.warn(`[PDF Form] Error extracting properties for ${name}:`, e);
          }
        } else if (field instanceof PDFCheckBox || constructorName === 'PDFCheckBox') {
          type = 'checkbox';
          value = (field as any).isChecked();
        } else if (field instanceof PDFRadioGroup || constructorName === 'PDFRadioGroup') {
          type = 'radio';
          value = (field as any).getSelected() || '';
          options = (field as any).getOptions();
        } else if (field instanceof PDFDropdown || constructorName === 'PDFDropdown') {
          type = 'dropdown';
          value = (field as any).getSelected()[0] || '';
          options = (field as any).getOptions();
        } else if (field instanceof PDFOptionList || constructorName === 'PDFOptionList' || constructorName === 'PDFListBox') {
          type = 'listbox';
          value = (field as any).getSelected() || [];
          options = (field as any).getOptions();
        } else if (field instanceof PDFButton || constructorName === 'PDFButton') {
          type = 'button';
          value = '';
        } else {
          // Fallback: try to treat others as text for visibility
          type = 'text';
          try {
            value = (field as any).getText?.() || '';
          } catch {
            value = '';
          }
        }

        const widgets = field.acroField.getWidgets();
        
        // Try to extract font size from default appearance (DA)
        let extractedFontSize: number | undefined;
        let autoSize = false;
        
        try {
          const acroField = field.acroField as any;
          const da = acroField.getDA?.() || acroField.getDefaultAppearance?.() || acroField.dict?.get(acroField.pdfDoc.context.obj('DA'))?.toString();
          if (da) {
            // DA string format is typically "/FontName FontSize Tf ..."
            const match = da.match(/\/[\w\d-]+\s+([\d.]+)\s+Tf/);
            if (match && match[1]) {
              extractedFontSize = parseFloat(match[1]);
              if (extractedFontSize === 0) {
                autoSize = true;
                extractedFontSize = undefined;
              }
            }
          }
        } catch (daErr) {
          console.log('[PDF Form] Could not extract DA for', name);
        }

        widgets.forEach((widget, index) => {
          const rect = widget.getRectangle();
          const widgetPageRef = widget.P();
          
          let page = -1;
          if (widgetPageRef) {
            page = pages.findIndex((p) => p.ref === widgetPageRef);
          }
          
          if (page === -1) {
            for (let i = 0; i < pages.length; i++) {
              const annots = pages[i].node.Annots();
              if (annots) {
                const annotsArray = annots.asArray();
                const index = annotsArray.findIndex((a: any) => 
                  a === (widget as any).ref || (a.ref && a.ref === (widget as any).ref) || (a.toString() === (widget as any).ref.toString())
                );
                if (index !== -1) {
                  page = i;
                  break;
                }
              }
            }
          }

          if (page === -1) return;

          const pdfPage = pages[page];
          const pdfH = pdfPage.getHeight();

          // Radio buttons: each widget corresponds to an optionValue
          let optionValue: string | undefined;
          if (type === 'radio' && options.length > 0) {
            // In pdf-lib, radio widgets often match options by index or appearance name
            // For simplicity, we'll try to match by index if widgets match options count
            if (widgets.length === options.length) {
              optionValue = options[index];
            } else {
              // Try to get onValue from the widget
              try {
                optionValue = (widget as any).getOnValue();
              } catch {
                optionValue = options[index] || `option_${index}`;
              }
            }
          }

          let finalMultiline = multiline;
          if (!finalMultiline && type === 'text' && !isComb && rect.height > 35) {
            finalMultiline = true;
          }

          let finalMaxLength = maxLength;
          if (isComb && !finalMaxLength && rect.width > 0 && rect.height > 0) {
            // Estimate maxLength based on typical comb field proportions
            finalMaxLength = Math.max(1, Math.round(rect.width / (rect.height * 0.65)));
          }

          // Font size logic: 
          // 1. Use extracted font size if available
          // 2. For multiline, use a standard 12pt default and let it auto-scale
          // 3. For listbox/dropdown, use 9pt (unless DA specified)
          // 4. For single-line, use 70% of height, but cap at 16pt for sanity
          let finalFontSize = extractedFontSize;
          if (!finalFontSize) {
            if (type === 'listbox' || type === 'dropdown') {
              finalFontSize = 9;
            } else if (finalMultiline) {
              finalFontSize = 12;
            } else {
              finalFontSize = Math.min(rect.height * 0.7, 16);
            }
          }

          extractedFields.push({
            id: `field_${name}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            type,
            page,
            x: rect.x,
            y: pdfH - rect.y - rect.height,
            width: rect.width,
            height: rect.height,
            value,
            options: options.length > 0 ? options : undefined,
            optionValue,
            fontSize: finalFontSize,
            autoSize,
            maxLength: finalMaxLength,
            isComb,
            multiline: finalMultiline,
          });
        });
      });

      if (extractedFields.length === 0 && fieldsFoundCount > 0) {
        console.warn(`[PDF Form] Found ${fieldsFoundCount} fields but could not locate positions.`);
      } else if (extractedFields.length === 0) {
        console.log('[PDF Form] No editable form fields found.');
      } else {
        console.log(`[PDF Form] Successfully extracted ${extractedFields.length} fields.`);
      }

      // Reset canvas transform
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;

      setPdf(uri, customUri ? 'Documento Compartilhado' : 'Novo PDF', exactPageCount, extractedFields);
      if (pages.length > 0) {
        setPagesDimensions(pages.map(p => ({ width: p.getWidth(), height: p.getHeight() })));
      }
      setIsProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setIsProcessing(false);
      console.error('Import PDF error:', e);
      dialog.show({ title: 'Erro', description: 'Não foi possível importar o PDF.' });
    }
  }, [setPdf, setPagesDimensions, setIsProcessing, scale, translateX, translateY, savedScale, savedTranslateX, savedTranslateY, dialog]);

  useEffect(() => {
    if (sharedUri) {
      handleImportPdf(sharedUri);
    }
  }, [sharedUri, handleImportPdf]);

  // ─── Add Annotation ───────────────────────────────
  const handleAddText = useCallback(() => {
    if (!pdfUri) return;
    // Add text at center of current viewport (in PDF point space)
    const centerX = (-translateX.value / scale.value) + (pdfDisplayWidth / scale.value) / 2 - 100;
    const centerY = (-translateY.value / scale.value) + (pdfDisplayHeight / scale.value) / 2 - 20;
    addText(currentPage, Math.max(0, centerX), Math.max(0, centerY));
    setActiveTool(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [pdfUri, currentPage, addText, pdfDisplayWidth, pdfDisplayHeight, translateX, translateY, scale]);

  const handleAddImage = useCallback(async () => {
    if (!pdfUri) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const imgW = Math.min(asset.width || 200, pdfDisplayWidth * 0.6);
      const imgH = imgW * ((asset.height || 200) / (asset.width || 200));

      const centerX = (-translateX.value / scale.value) + (pdfDisplayWidth / scale.value) / 2 - imgW / 2;
      const centerY = (-translateY.value / scale.value) + (pdfDisplayHeight / scale.value) / 2 - imgH / 2;

      addImage(currentPage, Math.max(0, centerX), Math.max(0, centerY), imgW, imgH, asset.uri, asset.width || 200, asset.height || 200);
      setActiveTool(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Add image error:', e);
    }
  }, [pdfUri, currentPage, addImage, pdfDisplayWidth, pdfDisplayHeight, translateX, translateY, scale]);

  const handleReplaceImage = useCallback(async () => {
    if (!selectedId) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      
      updateAnnotation(selectedId, {
        content: asset.uri,
        originalWidth: asset.width || 200,
        originalHeight: asset.height || 200,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Replace image error:', e);
    }
  }, [selectedId, updateAnnotation]);

  const handleAddEraser = useCallback(() => {
    if (!pdfUri) return;
    const centerX = (-translateX.value / scale.value) + (pdfDisplayWidth / scale.value) / 2 - 60;
    const centerY = (-translateY.value / scale.value) + (pdfDisplayHeight / scale.value) / 2 - 20;
    addEraser(currentPage, Math.max(0, centerX), Math.max(0, centerY));
    setActiveTool(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [pdfUri, currentPage, addEraser, pdfDisplayWidth, pdfDisplayHeight, translateX, translateY, scale]);

  // ─── Edit Annotation ──────────────────────────────
  const openEditSheet = useCallback((id: string) => {
    const ann = annotations.find((a) => a.id === id);
    if (!ann || ann.type !== 'text') return;
    selectAnnotation(id);
    setEditText(ann.content);
    setEditFontSize(ann.fontSize);
    setEditColor(ann.fontColor);
    editSheetRef.current?.present();
  }, [annotations, selectAnnotation]);

  const saveEdit = useCallback(() => {
    if (selectedId) {
      updateAnnotation(selectedId, {
        content: editText || 'Texto',
        fontSize: editFontSize,
        fontColor: editColor,
      });
    }
    editSheetRef.current?.dismiss();
  }, [selectedId, editText, editFontSize, editColor, updateAnnotation]);

  // ─── Drag / Resize Handlers ───────────────────────
  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    updateAnnotation(id, { x: Math.max(0, x), y: Math.max(0, y) });
  }, [updateAnnotation]);

  const handleResizeEnd = useCallback((id: string, w: number, h: number) => {
    updateAnnotation(id, { width: w, height: h });
  }, [updateAnnotation]);

  const handleRotateEnd = useCallback((id: string, rotation: number) => {
    updateAnnotation(id, { rotation });
  }, [updateAnnotation]);

  const handleDeleteAnnotation = useCallback((id: string) => {
    deleteAnnotation(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [deleteAnnotation]);

  const actionSheetRef = useRef<BottomSheetModal>(null);
  const [actionAnnotationId, setActionAnnotationId] = useState<string | null>(null);

  const handleLongPress = useCallback((id: string) => {
    selectAnnotation(id);
    setActionAnnotationId(id);
    actionSheetRef.current?.present();
  }, [selectAnnotation]);

  const handleToggleCrop = useCallback((id: string) => {
    usePdfEditorStore.getState().toggleCropping(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // ─── Export ───────────────────────────────────────
  const handleExport = useCallback(async (mode: 'share' | 'save') => {
    if (!pdfUri) return;
    Keyboard.dismiss();
    exportSheetRef.current?.dismiss();
    setIsProcessing(true);
    try {
      const result = await exportEditedPdf(pdfUri, annotations, formFields, { width: pdfDisplayWidth, height: pdfDisplayHeight });
      if (!result) {
        dialog.show({ title: 'Erro', description: 'Falha ao exportar o PDF.' });
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}editado-${Date.now()}.pdf`;
      console.log(`[PDF Export] Saving to: ${fileUri}`);
      await FileSystem.writeAsStringAsync(fileUri, result, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (mode === 'share') {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      } else {
        if (Platform.OS === 'android') {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const uri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              `editado-${Date.now()}.pdf`,
              'application/pdf',
            );
            await FileSystem.writeAsStringAsync(uri, result, {
              encoding: FileSystem.EncodingType.Base64,
            });
            dialog.show({ title: 'Sucesso', description: 'PDF salvo com sucesso.' });
          }
        } else {
          await Sharing.shareAsync(fileUri, { UTI: 'com.adobe.pdf' });
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Export error:', e);
      dialog.show({ title: 'Erro', description: 'Falha ao salvar o PDF.' });
    } finally {
      setIsProcessing(false);
    }
  }, [pdfUri, annotations, formFields, pdfDisplayWidth, pdfDisplayHeight, dialog]);

  // ─── Canvas Gestures ──────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(5, savedScale.value * e.scale));
    });

  // Pan: 1 finger when zoomed, 2 fingers always
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  // Single tap deselects
  const backgroundTapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(selectAnnotation)(null);
    });

  // Double tap resets zoom
  const doubleTapZoomGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd(() => {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const canvasGesture = Gesture.Race(
    Gesture.Exclusive(doubleTapZoomGesture, backgroundTapGesture),
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const canvasAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Current page annotations
  const currentAnnotations = annotations.filter((a) => a.page === currentPage);

  // renderBackdrop removed, handled by BottomSheet component

  // ─── Empty State ──────────────────────────────────
  if (!pdfUri) {
    return (
      <View style={{ paddingTop: insets.top }} className="flex-1 bg-surface">
        {/* Header */}
        <View className="flex-row items-center border-b border-border/10 px-4 pb-4 pt-2">
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} className="mr-3 p-2 -ml-2">
            <ChevronLeft size={28} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className="font-sans-semibold text-xl text-on-surface">Editor de PDF</Text>
        </View>

        <View className="flex-1 justify-center items-center px-8">
          <View
            style={{ backgroundColor: withOpacity("#EAB308", isDark ? 0.15 : 0.1) }}
            className="mb-8 h-24 w-24 items-center justify-center rounded-full"
          >
            <FilePen size={48} color="#EAB308" />
          </View>
          <Text className="font-sans-semibold text-xl text-on-surface text-center mb-2">
            Editor de PDF
          </Text>
          <Text className="font-sans text-base text-on-surface-secondary text-center mb-10">
            Edite seus arquivos PDF adicionando textos, imagens ou ocultando informações com a ferramenta borracha.
          </Text>

          <ToolActions>
            <ToolActions.Button
              onPress={() => handleImportPdf()}
              icon={<FileText size={24} color="#EAB308" />}
              color="#EAB308"
              title="Abrir PDF"
              description="Selecionar arquivo para editar"
            />
          </ToolActions>
        </View>
      </View>
    );
  }

  // ─── Editor View ──────────────────────────────────
  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border/10 px-4 pb-3 pt-2">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              reset();
              router.back();
            }}
            className="mr-3 p-2 -ml-2"
          >
            <ChevronLeft size={28} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className="font-sans-semibold text-lg text-on-surface flex-1" numberOfLines={1}>
            {pdfFileName || 'Editor de PDF'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Keyboard.dismiss();
              exportSheetRef.current?.present();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="p-2"
          >
            <Share2 size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas Area */}
      <View
        className="flex-1"
        style={{ overflow: 'hidden' }}
        onLayout={(e) => {
          setViewLayout({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          });
        }}
      >
        <GestureDetector gesture={canvasGesture}>
          {/* Stationary invisible wrapper to catch full-screen gestures without moving */}
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Animated.View style={[{ flex: 1, width: viewLayout.width, height: viewLayout.height, alignItems: 'center', justifyContent: 'flex-start' }, canvasAnimatedStyle]}>
              <View style={{ width: pdfDisplayWidth, height: pdfDisplayHeight, overflow: 'visible' }}>
                {/* PDF Background */}
                <Pdf
                  key={`pdf-${pdfUri}-${pdfDisplayWidth.toFixed(0)}-${pdfDisplayHeight.toFixed(0)}`}
                  ref={pdfRef}
                  source={{ uri: pdfUri }}
                  // @ts-ignore - Internal prop required for singlePage mode
                  currentPage={currentPage}
                  page={currentPage + 1}
                  style={{ flex: 1 }}
                  enablePaging={true}
                  horizontal={true}
                  fitPolicy={2}
                  singlePage={true}
                  spacing={0}
                  enableAntialiasing
                  onLoadComplete={(numberOfPages, path, dims) => {
                    // Only set if not already present from pdf-lib
                    const existing = usePdfEditorStore.getState().pagesDimensions;
                    if (existing.length === 0 && dims && dims.width && dims.height) {
                      usePdfEditorStore.getState().setPagesDimensions([{ width: dims.width, height: dims.height }]);
                    }
                  }}
                  onPageSingleTap={() => {
                    selectAnnotation(null);
                  }}
                  minScale={1.0}
                  maxScale={1.0}
                  scale={1.0}
                  onError={(error) => {
                    console.error('PDF Error:', error);
                  }}
                />

                <View className="absolute inset-0" pointerEvents="box-none">
                  {/* Form Fields - Rendered First (Bottom Layer) */}
                  {pagesDimensions.length > 0 && formFields.filter(f => f.page === currentPage).map((field) => {
                    // Map PDF points to view space
                    const currentDim = pagesDimensions[field.page] || pagesDimensions[0];
                    const pdfW = currentDim.width;
                    const s = pdfDisplayWidth / pdfW;

                    return (
                      <FormFieldItem
                        key={field.id}
                        field={{
                          ...field,
                          x: field.x * s,
                          y: field.y * s,
                          width: field.width * s,
                          height: field.height * s,
                          fontSize: (field.fontSize || 12) * s,
                          multiline: field.multiline,
                          isComb: field.isComb,
                          maxLength: field.maxLength,
                        }}
                        canvasScale={scale}
                        onUpdate={updateFormField}
                        onReset={resetFormFields}
                        onFocusNext={handleFocusNext}
                        isDark={isDark}
                        primaryColor={primaryColor}
                        dialog={dialog}
                        inputRef={(ref) => { fieldRefs.current[field.id] = ref; }}
                      />
                    );
                  })}

                  {/* Annotations Layer - Rendered Last (Top Layer) */}
                  {currentAnnotations.map((ann) => (
                    <DraggableAnnotation
                      key={ann.id}
                      annotation={ann}
                      isSelected={selectedId === ann.id}
                      canvasScale={scale}
                      onSelect={selectAnnotation}
                      onDragEnd={handleDragEnd}
                      onResizeEnd={handleResizeEnd}
                      onRotateEnd={handleRotateEnd}
                      onDoubleTap={openEditSheet}
                      onToggleCrop={handleToggleCrop}
                      onLongPress={handleLongPress}
                      isDark={isDark}
                      primaryColor={primaryColor}
                    />
                  ))}
                </View>
            </View>
          </Animated.View>
          </View>
        </GestureDetector>

        {/* Floating Page Indicator */}
        {pageCount > 0 && (
          <View
            className="absolute bottom-6 left-0 right-0 items-center justify-center"
            pointerEvents="box-none"
          >
            <View
              className="flex-row items-center gap-4 px-4 py-2 rounded-full"
              style={{
                backgroundColor: isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5
              }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (currentPage > 0) setCurrentPage(currentPage - 1);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                disabled={currentPage === 0}
                className="px-2 py-2 rounded-full"
              >
                <ChevronLeft size={24} color={currentPage === 0 ? (isDark ? '#555' : '#CCC') : primaryColor} />
              </TouchableOpacity>
              
              <Text className="font-sans-medium text-sm text-center" style={{ color: isDark ? '#E4E4E7' : '#27272A', minWidth: 50 }}>
                {currentPage + 1} / {pageCount}
              </Text>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (currentPage < pageCount - 1) setCurrentPage(currentPage + 1);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                disabled={currentPage >= pageCount - 1}
                className="px-2 py-2 rounded-full"
              >
                <ChevronRight size={24} color={currentPage >= pageCount - 1 ? (isDark ? '#555' : '#CCC') : primaryColor} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Toolbar */}
      <View
        className="border-t border-border/10 bg-surface"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {selectedId ? (() => {
          const selectedAnnotation = annotations.find(a => a.id === selectedId);
          if (selectedAnnotation?.type === 'image') {
            return (
              <View className="flex-row items-center justify-around py-3 px-4">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    updateAnnotation(selectedId, { isCropping: false });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="items-center gap-1 px-4 py-2 rounded-2xl"
                  style={{
                    backgroundColor: !selectedAnnotation.isCropping ? withOpacity(primaryColor, 0.15) : 'transparent',
                  }}
                >
                  <Maximize size={22} color={!selectedAnnotation.isCropping ? primaryColor : (isDark ? '#D4D4D8' : '#52525B')} />
                  <Text className="font-sans-medium text-xs" style={{ color: !selectedAnnotation.isCropping ? primaryColor : (isDark ? '#D4D4D8' : '#52525B') }}>
                    Escalar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    updateAnnotation(selectedId, { isCropping: true });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="items-center gap-1 px-4 py-2 rounded-2xl"
                  style={{
                    backgroundColor: selectedAnnotation.isCropping ? withOpacity(primaryColor, 0.15) : 'transparent',
                  }}
                >
                  <Crop size={22} color={selectedAnnotation.isCropping ? primaryColor : (isDark ? '#D4D4D8' : '#52525B')} />
                  <Text className="font-sans-medium text-xs" style={{ color: selectedAnnotation.isCropping ? primaryColor : (isDark ? '#D4D4D8' : '#52525B') }}>
                    Recortar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleReplaceImage}
                  className="items-center gap-1 px-4 py-2 rounded-2xl"
                >
                  <ImagePlus size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
                  <Text className="font-sans-medium text-xs" style={{ color: isDark ? '#D4D4D8' : '#52525B' }}>
                    Substituir
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleDeleteAnnotation(selectedId)}
                  className="items-center gap-1 px-4 py-2 rounded-2xl"
                >
                  <Trash2 size={22} color="#EF4444" />
                  <Text className="font-sans-medium text-xs text-red-500">
                    Excluir
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => selectAnnotation(null)}
                  className="items-center gap-1 px-4 py-2 rounded-2xl"
                >
                  <X size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
                  <Text className="font-sans-medium text-xs" style={{ color: isDark ? '#D4D4D8' : '#52525B' }}>
                    Fechar
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }
          if (selectedAnnotation?.type === 'text') {
            return (
              <View className="flex-row items-center justify-around py-3 px-4">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => openEditSheet(selectedId)}
                  className="items-center gap-1 px-4 py-2 rounded-2xl"
                >
                  <Type size={22} color={primaryColor} />
                  <Text className="font-sans-medium text-xs" style={{ color: primaryColor }}>
                    Editar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleDeleteAnnotation(selectedId)}
                  className="items-center gap-1 px-4 py-2 rounded-2xl"
                >
                  <Trash2 size={22} color="#EF4444" />
                  <Text className="font-sans-medium text-xs text-red-500">
                    Excluir
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => selectAnnotation(null)}
                  className="items-center gap-1 px-4 py-2 rounded-2xl"
                >
                  <X size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
                  <Text className="font-sans-medium text-xs" style={{ color: isDark ? '#D4D4D8' : '#52525B' }}>
                    Fechar
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

          // Generic selected view (for eraser)
          return (
            <View className="flex-row items-center justify-around py-3 px-4">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleDeleteAnnotation(selectedId)}
                className="items-center gap-1 px-4 py-2 rounded-2xl"
              >
                <Trash2 size={22} color="#EF4444" />
                <Text className="font-sans-medium text-xs text-red-500">
                  Excluir
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => selectAnnotation(null)}
                className="items-center gap-1 px-4 py-2 rounded-2xl"
              >
                <X size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
                <Text className="font-sans-medium text-xs" style={{ color: isDark ? '#D4D4D8' : '#52525B' }}>
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
          );
        })() : (
          <View className="flex-row items-center justify-around py-3 px-4">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAddText}
              className="items-center gap-1 px-4 py-2 rounded-2xl"
              style={{
                backgroundColor: activeTool === 'text'
                  ? withOpacity(primaryColor, 0.15)
                  : 'transparent',
              }}
            >
              <Type size={22} color={activeTool === 'text' ? primaryColor : (isDark ? '#D4D4D8' : '#52525B')} />
              <Text
                className="font-sans-medium text-xs"
                style={{ color: activeTool === 'text' ? primaryColor : (isDark ? '#D4D4D8' : '#52525B') }}
              >
                Texto
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAddImage}
              className="items-center gap-1 px-4 py-2 rounded-2xl"
              style={{
                backgroundColor: activeTool === 'image'
                  ? withOpacity(primaryColor, 0.15)
                  : 'transparent',
              }}
            >
              <ImageIcon size={22} color={activeTool === 'image' ? primaryColor : (isDark ? '#D4D4D8' : '#52525B')} />
              <Text
                className="font-sans-medium text-xs"
                style={{ color: activeTool === 'image' ? primaryColor : (isDark ? '#D4D4D8' : '#52525B') }}
              >
                Imagem
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAddEraser}
              className="items-center gap-1 px-4 py-2 rounded-2xl"
              style={{
                backgroundColor: activeTool === 'eraser'
                  ? withOpacity(primaryColor, 0.15)
                  : 'transparent',
              }}
            >
              <Eraser size={22} color={activeTool === 'eraser' ? primaryColor : (isDark ? '#D4D4D8' : '#52525B')} />
              <Text
                className="font-sans-medium text-xs"
                style={{ color: activeTool === 'eraser' ? primaryColor : (isDark ? '#D4D4D8' : '#52525B') }}
              >
                Borracha
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleImportPdf()}
              className="items-center gap-1 px-4 py-2 rounded-2xl"
            >
              <Download size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
              <Text className="font-sans-medium text-xs" style={{ color: isDark ? '#D4D4D8' : '#52525B' }}>
                Abrir
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Edit Text Bottom Sheet */}
      <BottomSheet
        sheetRef={editSheetRef}
        snapPoints={editSnapPoints}
      >
        <BottomSheet.View>
          <BottomSheet.Header title="Editar Texto" />

          {/* Text input */}
          <BottomSheet.ItemGroup>
            <View className="p-4 bg-surface-secondary">
               <TextInput
                 value={editText}
                 onChangeText={setEditText}
                 placeholder="Digite seu texto..."
                 placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                 multiline
                 autoFocus
                 className="text-base font-sans-medium"
                 style={[
                   {
                     color: isDark ? '#FAFAFA' : '#18181B',
                     minHeight: 60,
                   },
                 ]}
               />
            </View>
          </BottomSheet.ItemGroup>

          {/* Font size */}
          <View className="flex-row items-center gap-3">
            <Text className="font-sans-medium text-sm text-on-surface-secondary">Tamanho:</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setEditFontSize(Math.max(8, editFontSize - 2))}
              className="h-8 w-8 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? '#27272A' : '#E5E7EB' }}
            >
              <Text className="font-sans-bold text-on-surface">−</Text>
            </TouchableOpacity>
            <Text className="font-sans-bold text-base text-on-surface w-8 text-center">{editFontSize}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setEditFontSize(Math.min(72, editFontSize + 2))}
              className="h-8 w-8 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? '#27272A' : '#E5E7EB' }}
            >
              <Text className="font-sans-bold text-on-surface">+</Text>
            </TouchableOpacity>
          </View>

          {/* Color picker */}
          <View className="flex-row items-center gap-2">
            <Text className="font-sans-medium text-sm text-on-surface-secondary mr-1">Cor:</Text>
            {TEXT_COLORS.map((c) => (
              <TouchableOpacity
                activeOpacity={0.8}
                key={c}
                onPress={() => setEditColor(c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: c,
                  borderWidth: editColor === c ? 3 : 1,
                  borderColor: editColor === c ? primaryColor : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                }}
              />
            ))}
          </View>

          {/* Save button */}
          <BottomSheet.Button onPress={saveEdit}>
            Salvar
          </BottomSheet.Button>

        </BottomSheet.View>
      </BottomSheet>

      {/* Export Bottom Sheet */}
      <BottomSheet
        sheetRef={exportSheetRef}
        snapPoints={exportSnapPoints}
      >
        <BottomSheet.View>
          <BottomSheet.Header title="Exportar PDF Editado" />

          <View className="flex-row gap-3">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleExport('save')}
              className="flex-1 rounded-2xl py-6 items-center justify-center gap-2 border border-border"
              style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }}
            >
              <Download size={24} color={isDark ? '#D4D4D8' : '#52525B'} />
              <Text className="font-sans-medium text-sm text-on-surface text-center">
                Salvar{'\n'}Localmente
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleExport('share')}
              className="flex-1 rounded-2xl py-6 items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <Share2 size={24} color="#FFF" />
              <Text className="font-sans-bold text-sm text-white text-center">
                Compartilhar{'\n'}PDF
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheet.View>
      </BottomSheet>

      {/* Action Sheet (Delete) */}
      <BottomSheet
        sheetRef={actionSheetRef}
        snapPoints={['20%']}
      >
        <BottomSheet.View>
          <BottomSheet.Header title="Opções do Item" />

          <BottomSheet.ItemGroup>
            <BottomSheet.Item
              icon={<Trash2 size={20} color="#EF4444" />}
              iconBackgroundColor="rgba(239, 68, 68, 0.2)"
              title="Excluir Item"
              onPress={() => {
                if (actionAnnotationId) {
                  handleDeleteAnnotation(actionAnnotationId);
                  actionSheetRef.current?.dismiss();
                }
              }}
              containerStyle={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                borderWidth: 1,
              }}
            />
          </BottomSheet.ItemGroup>
        </BottomSheet.View>
      </BottomSheet>

      {/* Loading overlay */}
      <LoadingOverlay
        visible={isProcessing}
        title="Processando..."
      />
    </View>
  );
}

