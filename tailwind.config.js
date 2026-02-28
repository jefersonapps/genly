/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-secondary": "rgb(var(--color-surface-secondary) / <alpha-value>)",
        "on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
        "on-surface-secondary": "rgb(var(--color-on-surface-secondary) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Montserrat-Regular"],
        "sans-medium": ["Montserrat-Medium"],
        "sans-semibold": ["Montserrat-SemiBold"],
        "sans-bold": ["Montserrat-Bold"],
      },
    },
  },
  plugins: [
    ({ addBase }) => {
      addBase({
        ":root": {
          "--color-primary": "0 0 0",
          "--color-surface": "255 255 255",
          "--color-surface-secondary": "245 245 245",
          "--color-on-surface": "10 10 10",
          "--color-on-surface-secondary": "115 115 115",
          "--color-muted": "163 163 163",
          "--color-border": "229 229 229",
        },
        ".dark": {
          "--color-surface": "10 10 10",
          "--color-surface-secondary": "23 23 23",
          "--color-on-surface": "245 245 245",
          "--color-on-surface-secondary": "163 163 163",
          "--color-muted": "115 115 115",
          "--color-border": "38 38 38",
        },
      });
    },
  ],
};
