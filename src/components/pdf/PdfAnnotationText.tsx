import { loadAnnotationTypeface } from '@/lib/pdfEditor/annotationFont';
import { nativeTextLayoutKey, type NativeTextLayout } from '@/lib/pdfEditor/nativeTextLayout';
import { TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT, TEXT_PADDING } from '@/lib/pdfEditor/textLayout';
import type { Annotation } from '@/lib/pdfEditor/usePdfEditorStore';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

interface Props {
  annotation: Annotation;
  isEditing?: boolean;
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
  onChangeText?: (text: string) => void;
  onBlur?: () => void;
  onContentHeight?: (height: number) => void;
  onNativeLayout: (id: string, layout: NativeTextLayout) => void;
}

/** Keep the same native text view mounted when entering/leaving edit mode. */
export function PdfAnnotationText({ annotation, isEditing = false, inputRef, onChangeText, onBlur, onContentHeight, onNativeLayout }: Props) {
  const [loadedFamily, setLoadedFamily] = useState<string>();
  const family = annotation.fontFamily || TEXT_FONT_FAMILY;
  useEffect(() => {
    let active = true;
    loadAnnotationTypeface(family).then(() => { if (active) setLoadedFamily(family); })
      .catch(error => console.error('Unable to load PDF annotation font', error));
    return () => { active = false; };
  }, [family]);
  const typography = {
    fontFamily: family, fontSize: annotation.fontSize,
    lineHeight: annotation.fontSize * (annotation.lineSpacing ?? TEXT_LINE_HEIGHT),
    letterSpacing: 0, includeFontPadding: false, padding: 0, margin: 0,
    color: annotation.fontColor || '#000000',
  };
  return (
    <View style={{ flex: 1, paddingHorizontal: TEXT_PADDING }} pointerEvents={isEditing ? 'auto' : 'none'}>
      {loadedFamily === family && <>
        <TextInput ref={inputRef} value={annotation.content} editable={isEditing} autoFocus={isEditing}
          multiline allowFontScaling={false} scrollEnabled={false} textBreakStrategy="simple"
          underlineColorAndroid="transparent" caretHidden={!isEditing}
          onChangeText={onChangeText} onBlur={onBlur}
          style={[typography, { flex: 1, textAlign: 'left', textAlignVertical: 'center' }]} />
        {/* Measure only the committed width, never the live animated resize width.
            This avoids a JS layout/render/font-measurement cycle on every frame. */}
        <Text key={JSON.stringify(nativeTextLayoutKey(annotation))} accessible={false} pointerEvents="none"
          allowFontScaling={false} textBreakStrategy="simple" android_hyphenationFrequency="none"
          style={[typography, { position: 'absolute', left: TEXT_PADDING, top: 0,
            width: Math.max(1, annotation.width - TEXT_PADDING * 2), opacity: 0 }]}
          onTextLayout={({ nativeEvent: { lines } }) => {
            onNativeLayout(annotation.id, { ...nativeTextLayoutKey(annotation), lines });
            if (isEditing && lines.length) onContentHeight?.(Math.max(...lines.map(line => line.y + line.height)));
          }}>
          {annotation.content}
        </Text>
      </>}
    </View>
  );
}
