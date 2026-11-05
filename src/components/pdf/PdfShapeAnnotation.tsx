import { shapeAnnotationPath } from '@/lib/pdfEditor/drawingTools';
import type { Annotation } from '@/lib/pdfEditor/usePdfEditorStore';
import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export function PdfShapeAnnotation({ annotation }: { annotation: Annotation }) {
  const [bounds, setBounds] = useState({ width: annotation.width, height: annotation.height });
  return (
    <View style={{ flex: 1 }} onLayout={({ nativeEvent: { layout } }) => {
      setBounds(previous => previous.width === layout.width && previous.height === layout.height
        ? previous : { width: layout.width, height: layout.height });
    }}>
      <Svg width="100%" height="100%" style={{ overflow: 'visible' }} pointerEvents="none">
        <Path d={shapeAnnotationPath({ ...annotation, ...bounds }, true)} fill="none"
          stroke={annotation.strokeColor} strokeWidth={annotation.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
