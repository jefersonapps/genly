const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const headings = {
  RecentTasks: ['Notas', 'Carregando suas notas…'],
  Reminders: ['Lembretes', 'Carregando seus lembretes…'],
  RecentMindMaps: ['Mapas Mentais', 'Carregando seus mapas…'],
  RecentFlashcards: ['Flashcards', 'Carregando seus flashcards…'],
  GroupWidget: ['Grupo', 'Carregando suas notas…'],
};

// The library's initial layout is transparent until its headless JS task draws.
// Use native RemoteViews for the first frame, without waiting for JS startup.
module.exports = function withWidgetLoadingLayouts(config) {
  return withFinalizedMod(config, ['android', async (mod) => {
    const res = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
    for (const folder of ['layout', 'drawable', 'values', 'values-night']) {
      await fs.mkdir(path.join(res, folder), { recursive: true });
    }
    await fs.writeFile(path.join(res, 'drawable/genly_widget_loading_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="@color/genly_widget_loading_background" />
  <corners android:radius="20dp" />
</shape>
`);
    for (const [folder, background, text, secondary] of [
      ['values', '#FFFFFF', '#0A0A0A', '#737373'],
      ['values-night', '#0A0A0A', '#F5F5F5', '#A3A3A3'],
    ]) {
      await fs.writeFile(path.join(res, folder, 'genly_widget_loading.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="genly_widget_loading_background">${background}</color>
  <color name="genly_widget_loading_text">${text}</color>
  <color name="genly_widget_loading_secondary">${secondary}</color>
</resources>
`);
    }
    const widgetPlugin = config.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-android-widget');
    for (const widget of widgetPlugin?.[1]?.widgets ?? []) {
      const heading = headings[widget.name];
      if (!heading) continue;
      const name = widget.name.toLowerCase();
      const layout = `genly_widget_initial_${name}`;
      await fs.writeFile(path.join(res, 'layout', `${layout}.xml`), `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:layout_width="match_parent" android:layout_height="match_parent"
  android:orientation="vertical" android:padding="16dp"
  android:background="@drawable/genly_widget_loading_background">
  <TextView android:layout_width="match_parent" android:layout_height="wrap_content"
    android:text="${heading[0]}" android:textSize="16sp" android:textStyle="bold"
    android:textColor="@color/genly_widget_loading_text" />
  <LinearLayout android:layout_width="match_parent" android:layout_height="0dp"
    android:layout_weight="1" android:orientation="horizontal" android:gravity="center">
    <ProgressBar android:layout_width="20dp" android:layout_height="20dp"
      android:indeterminate="true" style="?android:attr/progressBarStyleSmall" />
    <TextView android:layout_width="wrap_content" android:layout_height="wrap_content"
      android:layout_marginStart="10dp" android:text="${heading[1]}" android:textSize="13sp"
      android:textColor="@color/genly_widget_loading_secondary" />
  </LinearLayout>
</LinearLayout>
`);
      const providerPath = path.join(res, 'xml', `widgetprovider_${name}.xml`);
      let provider = await fs.readFile(providerPath, 'utf8');
      if (widget.name === 'GroupWidget') {
        provider = provider.replace(/\s+android:previewImage="[^"]*"/g, '')
          .replace(/\s+android:previewLayout="[^"]*"/g, '')
          .replace('<appwidget-provider', '<appwidget-provider android:previewLayout="@layout/genly_group_widget_preview"');
      }
      await fs.writeFile(providerPath, provider.replace(
        /android:initialLayout="[^"]+"/,
        `android:initialLayout="@layout/${layout}"`,
      ));
    }
    return mod;
  }]);
};
