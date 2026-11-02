'use no memo';
/** @jsxImportSource react */
import React from 'react';
import { SvgWidget, type ColorProp } from 'react-native-android-widget';
import { resolveGroupIcon } from '../utils/groupIcons';
import { widgetIconPaths } from './iconPaths';

const groupNames = { folder: 'folder', home: 'house', work: 'briefcase', books: 'book-open', art: 'palette', games: 'gamepad-2', star: 'star', flame: 'flame', idea: 'lightbulb', brain: 'brain', cards: 'layers', note: 'file-text' } as const;
export function WidgetIcon({ value, color, reminder = false }: { value?: string | null; color: string; reminder?: boolean }) {
  const name = reminder ? 'bell' : groupNames[resolveGroupIcon(value)];
  return <SvgWidget svg={`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${widgetIconPaths[name]}</svg>`} style={{ width: 20, height: 20, marginRight: 8 }} />;
}

export function WidgetAddIcon({ color }: { color: ColorProp }) {
  return <SvgWidget svg={`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`} style={{ width: 18, height: 18 }} />;
}
