const { withAndroidStyles } = require("@expo/config-plugins");

const withMaterialPickerStyles = (config) => {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;
    const appTheme = styles.resources.style?.find((s) => s.$.name === "AppTheme");

    if (appTheme) {
      // Update parent to Material3
      appTheme.$.parent = "Theme.Material3.DayNight.NoActionBar";

      // Ensure item array exists
      if (!appTheme.item) {
        appTheme.item = [];
      }

      // Add android:colorAccent (important for buttons)
      const primaryColor = "#208AEF";
      if (!appTheme.item.find((i) => i.$.name === "android:colorAccent")) {
        appTheme.item.push({
          $: { name: "android:colorAccent" },
          _: primaryColor,
        });
      } else {
        appTheme.item.find((i) => i.$.name === "android:colorAccent")._ = primaryColor;
      }

      // Add materialCalendarTheme if not present
      if (!appTheme.item.find((i) => i.$.name === "materialCalendarTheme")) {
        appTheme.item.push({
          _: "@style/AppCalendar",
          $: { name: "materialCalendarTheme" },
        });
      }

      // Add materialTimePickerTheme if not present
      if (!appTheme.item.find((i) => i.$.name === "materialTimePickerTheme")) {
        appTheme.item.push({
          _: "@style/AppTimePicker",
          $: { name: "materialTimePickerTheme" },
        });
      }
    }

    // Add AppCalendar style
    if (!styles.resources.style) {
      styles.resources.style = [];
    }

    if (!styles.resources.style.find((s) => s.$.name === "AppCalendar")) {
      styles.resources.style.push({
        $: { name: "AppCalendar", parent: "ThemeOverlay.Material3.MaterialCalendar" },
        item: [
          { _: "#208AEF", $: { name: "colorPrimary" } },
        ]
      });
    }

    // Add AppTimePicker style
    if (!styles.resources.style.find((s) => s.$.name === "AppTimePicker")) {
      styles.resources.style.push({
        $: { name: "AppTimePicker", parent: "ThemeOverlay.Material3.MaterialTimePicker" },
        item: [
          { _: "#208AEF", $: { name: "colorPrimary" } },
          { _: "#208AEF", $: { name: "android:numbersInnerTextColor" } },
        ]
      });
    }

    return config;
  });
};

module.exports = withMaterialPickerStyles;
