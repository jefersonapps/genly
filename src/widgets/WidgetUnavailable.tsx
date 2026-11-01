'use no memo';
/** @jsxImportSource react */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetThemeColors } from './theme';

export function WidgetUnavailable({ colors }: { colors: WidgetThemeColors }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ width: 'match_parent', height: 'match_parent', backgroundColor: colors.bg, borderRadius: 20, padding: 16, justifyContent: 'center' }}
    >
      <TextWidget text="Genly" style={{ fontSize: 16, color: colors.text, fontFamily: 'Montserrat-Bold', marginBottom: 8 }} />
      <TextWidget text="Toque para abrir o app e atualizar o widget." style={{ fontSize: 14, color: colors.textSecondary }} />
    </FlexWidget>
  );
}
