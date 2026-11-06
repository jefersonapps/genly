import { shapeAnnotationPath } from '@/lib/pdfEditor/drawingTools';
import type { Annotation } from '@/lib/pdfEditor/usePdfEditorStore';
import React, { useState } from 'react';
import { PixelRatio, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export function PdfShapeAnnotation({ annotation }: { annotation: Annotation }) {
  const [bounds, setBounds] = useState({ width: annotation.width, height: annotation.height });
  const density = PixelRatio.get();
  const padding = Math.ceil((annotation.strokeWidth / 2 + 1) * density) / density;
  return (
    <View style={{ flex: 1 }} onLayout={({ nativeEvent: { layout } }) => {
      setBounds(previous => previous.width === layout.width && previous.height === layout.height
        ? previous : { width: layout.width, height: layout.height });
    }}>
      {/* Numeric SVG dimensions are parsed as integers. A native viewport with
          percentage SVG dimensions retains fractional document coordinates. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -padding, top: -padding,
        width: bounds.width + padding * 2, height: bounds.height + padding * 2, overflow: 'visible' }}>
      <Svg width="100%" height="100%"
        viewBox={`${-padding} ${-padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`}
        style={{ overflow: 'visible' }} pointerEvents="none">
        <Path d={shapeAnnotationPath({ ...annotation, ...bounds }, true)} fill="none"
          stroke={annotation.strokeColor} strokeWidth={annotation.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      </View>
    </View>
  );
}
