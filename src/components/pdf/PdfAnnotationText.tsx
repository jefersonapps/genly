import { loadAnnotationPreviewFont } from '@/lib/pdfEditor/annotationFont';
import { layoutAnnotationText, TEXT_FONT_FAMILY, TEXT_PADDING } from '@/lib/pdfEditor/textLayout';
import type { Annotation } from '@/lib/pdfEditor/usePdfEditorStore';
import type { PDFFont } from 'pdf-lib';
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

export function PdfAnnotationText({ annotation }: { annotation: Annotation }) {
  const [font, setFont] = useState<PDFFont>();
  const [bounds, setBounds] = useState({ width: annotation.width, height: annotation.height });
  useEffect(() => {
    let active = true;
    loadAnnotationPreviewFont().then(value => { if (active) setFont(value); })
      .catch(error => console.error('Unable to load PDF annotation font', error));
    return () => { active = false; };
  }, []);
  const layout = useMemo(() => font && layoutAnnotationText({ ...annotation, ...bounds }, font), [annotation, bounds, font]);

  return (
    <View style={{ flex: 1 }} onLayout={({ nativeEvent: { layout } }) => {
      setBounds(previous => previous.width === layout.width && previous.height === layout.height
        ? previous : { width: layout.width, height: layout.height });
    }}>
      {layout ? (
        <Svg width="100%" height="100%" style={{ overflow: 'visible' }} pointerEvents="none">
          {layout.lines.map((line, index) => line.text ? (
            <SvgText key={index} x={line.x} y={line.baseline}
              fontFamily={TEXT_FONT_FAMILY} fontSize={annotation.fontSize}
              fill={annotation.fontColor || '#000000'}
              textLength={line.width} lengthAdjust="spacingAndGlyphs">
              {line.text}
            </SvgText>
          ) : null)}
        </Svg>
      ) : (
        <Text allowFontScaling={false} style={{ paddingHorizontal: TEXT_PADDING, fontFamily: TEXT_FONT_FAMILY, fontSize: annotation.fontSize, color: annotation.fontColor }}>{annotation.content}</Text>
      )}
    </View>
  );
}
