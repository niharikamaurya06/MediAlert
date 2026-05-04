import forms from '@tailwindcss/forms'
import containerQueries from '@tailwindcss/container-queries'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      "colors": {
        "surface-variant": "#e1e2e4",
        "secondary-container": "#c0d5ff",
        "on-primary-container": "#cadcff",
        "on-tertiary-fixed": "#341100",
        "surface-container-high": "#e7e8ea",
        "on-secondary-fixed-variant": "#324769",
        "primary-container": "#005fb8",
        "on-error-container": "#93000a",
        "error": "#ba1a1a",
        "primary": "#00488d",
        "inverse-on-surface": "#f0f1f3",
        "error-container": "#ffdad6",
        "secondary-fixed": "#d6e3ff",
        "tertiary-fixed-dim": "#ffb691",
        "on-primary": "#ffffff",
        "on-primary-fixed-variant": "#00468b",
        "on-error": "#ffffff",
        "surface-container-lowest": "#ffffff",
        "on-tertiary-fixed-variant": "#783100",
        "primary-fixed": "#d6e3ff",
        "primary-fixed-dim": "#a8c8ff",
        "on-secondary": "#ffffff",
        "outline-variant": "#c2c6d4",
        "surface": "#f8f9fb",
        "on-secondary-fixed": "#011b3c",
        "surface-tint": "#005db5",
        "on-surface-variant": "#424752",
        "on-secondary-container": "#475c7f",
        "secondary": "#4a5f83",
        "inverse-primary": "#a8c8ff",
        "outline": "#727783",
        "secondary-fixed-dim": "#b2c7f0",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#a04401",
        "inverse-surface": "#2e3132",
        "on-background": "#191c1e",
        "surface-container-low": "#f2f4f6",
        "background": "#f8f9fb",
        "surface-container-highest": "#e1e2e4",
        "surface-container": "#edeef0",
        "tertiary-fixed": "#ffdbcb",
        "surface-dim": "#d9dadc",
        "on-primary-fixed": "#001b3d",
        "tertiary": "#7b3200",
        "surface-bright": "#f8f9fb",
        "on-surface": "#191c1e",
        "on-tertiary-container": "#ffd1bc"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "1rem",
        "xl": "1.25rem",
        "full": "9999px"
      },
      "fontFamily": {
        "headline": ["Manrope", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"],
        "manrope": ["Manrope", "sans-serif"],
        "inter": ["Inter", "sans-serif"],
      }
    },
  },
  plugins: [
    forms,
    containerQueries
  ],
}

