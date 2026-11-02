const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createSourceLoader } = require('../tests/load-source.cjs');

const ROOT = path.resolve(__dirname, '..');
const WIDTH = 320;
const HEIGHT = 240;
const SCALE = 3;
const definitions = [
  ['RecentTasks', 'RecentTasksWidget', 'recent-tasks.png', ['Organizar a semana', 'Ideias para o projeto', 'Leitura de hoje']],
  ['Reminders', 'RemindersWidget', 'reminders.png', ['Revisar minhas anotações', 'Enviar o relatório']],
  ['RecentMindMaps', 'RecentMindMapsWidget', 'mind-maps.png', ['Grécia Antiga', 'Sistema Solar', 'Plano de estudos']],
  ['RecentFlashcards', 'RecentFlashcardsWidget', 'flashcards.png', ['Sistema Solar', 'O que caracteriza as briófitas', 'Verbos em inglês']],
  ['GroupWidget', 'GroupWidget', 'group.png', ['Minhas ideias', 'Planejar a próxima semana', 'Organizar referências']],
];

// Only adapt widget primitives to browser flex layout. The layouts, texts, icon
// paths, colors and status badges come from the application's actual components.
function browserStyle(style = {}) {
  const result = {};
  for (const [key, value] of Object.entries(style)) {
    if (value == null) continue;
    if (key === 'paddingHorizontal' || key === 'marginHorizontal') {
      const prefix = key.startsWith('padding') ? 'padding' : 'margin';
      result[`${prefix}Left`] = result[`${prefix}Right`] = value;
    } else if (key === 'paddingVertical' || key === 'marginVertical') {
      const prefix = key.startsWith('padding') ? 'padding' : 'margin';
      result[`${prefix}Top`] = result[`${prefix}Bottom`] = value;
    } else if (key === 'width' || key === 'height') {
      result[key] = value === 'match_parent' ? '100%' : value === 'wrap_content' ? 'auto' : value;
    } else result[key] = value;
  }
  if (result.borderWidth && !result.borderStyle) result.borderStyle = 'solid';
  if (result.flex) { result.flexBasis = 0; result.minWidth = 0; result.minHeight = 0; }
  return result;
}
function FlexWidget({ style, children }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', flexShrink: 0, ...browserStyle(style) } }, children);
}
function ListWidget({ style, children }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, ...browserStyle(style) } }, children);
}
function TextWidget({ text, style, maxLines = 1 }) {
  return React.createElement('div', { style: {
    flexShrink: 1, minWidth: 0, lineHeight: 1.3,
    ...(maxLines === 1 ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
      : { display: '-webkit-box', WebkitLineClamp: maxLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
    ...browserStyle(style),
  } }, text);
}
function SvgWidget({ svg, style }) {
  return React.createElement('div', { style: { display: 'flex', flexShrink: 0, ...browserStyle(style) }, dangerouslySetInnerHTML: { __html: svg } });
}
function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function buildPreviews(now = new Date()) {
  const real = createSourceLoader();
  const { getReminderStatus } = real(path.join(ROOT, 'src/utils/reminderStatus.ts'));
  const load = createSourceLoader({
    'react-native-android-widget': { FlexWidget, ListWidget, TextWidget, SvgWidget },
    '../utils/reminderStatus': { getReminderStatus: (date, time, completed) => getReminderStatus(date, time, completed, now) },
  });
  const { getWidgetColors } = load(path.join(ROOT, 'src/widgets/theme.ts'));
  const colors = getWidgetColors('dark', '#208AEF');
  const group = { id: 1, name: 'Meu grupo', emoji: 'folder', color: '#208AEF', createdAt: '' };
  const fonts = ['Regular', 'Medium', 'SemiBold', 'Bold'].map(weight => {
    const base64 = fs.readFileSync(path.join(ROOT, `assets/fonts/Montserrat-${weight}.ttf`)).toString('base64');
    return `@font-face{font-family:'Montserrat-${weight}';src:url(data:font/ttf;base64,${base64}) format('truetype');font-weight:normal;font-display:block;}`;
  }).join('');
  return definitions.map(([widgetName, componentName, filename, titles]) => {
    const Component = load(path.join(ROOT, `src/widgets/${componentName}.tsx`))[componentName];
    const tasks = titles.map((title, i) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (i === 0 ? 1 : -1), 9);
      return { id: i + 1, title, completed: 0, deliveryDate: widgetName === 'Reminders' ? localDate(date) : null, deliveryTime: widgetName === 'Reminders' ? '09:00' : null };
    });
    const markup = renderToStaticMarkup(React.createElement(Component, { tasks, colors, group }));
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
      *{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent;overflow:hidden}
      body{width:${WIDTH * SCALE}px;height:${HEIGHT * SCALE}px}
      .stage{width:${WIDTH}px;height:${HEIGHT}px;transform:scale(${SCALE});transform-origin:top left;overflow:hidden}
      .stage>div{overflow:hidden}svg{display:block;width:100%;height:100%}
    </style></head><body><div class="stage">${markup}</div></body></html>`;
    return { widgetName, filename, html, markup, width: WIDTH * SCALE, height: HEIGHT * SCALE };
  });
}
module.exports = { buildPreviews, browserStyle };
