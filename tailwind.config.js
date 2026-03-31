/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Brand */
        brand: {
          DEFAULT: "#1D9E75",
          light: "#5DCAA5",
          dark: "#0F6E56",
          muted: "rgba(29,158,117,0.12)",
          border: "rgba(29,158,117,0.25)",
        },
        /* App surfaces – dark mode first, light toggled via .light class */
        app: {
          bg:       "#0f1117",
          sidebar:  "#0a0c10",
          surface:  "#161820",
          elevated: "#1c1f2a",
          border:   "rgba(255,255,255,0.07)",
          "border-hover": "rgba(255,255,255,0.14)",
        },
        /* Text */
        ink: {
          primary:   "rgba(255,255,255,0.92)",
          secondary: "rgba(255,255,255,0.55)",
          muted:     "rgba(255,255,255,0.28)",
          faint:     "rgba(255,255,255,0.12)",
        },
        /* Semantic */
        amber:  { DEFAULT: "#EF9F27", muted: "rgba(239,159,39,0.12)" },
        coral:  { DEFAULT: "#D85A30", muted: "rgba(216,90,48,0.12)" },
        violet: { DEFAULT: "#7F77DD", muted: "rgba(127,119,221,0.12)" },
        sky:    { DEFAULT: "#378ADD", muted: "rgba(55,138,221,0.12)" },
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      borderRadius: {
        sm:  "6px",
        md:  "10px",
        lg:  "14px",
        xl:  "18px",
        "2xl": "22px",
      },
      fontSize: {
        "2xs": ["10px", "14px"],
        xs:   ["11px", "16px"],
        sm:   ["13px", "20px"],
        base: ["14px", "22px"],
        md:   ["15px", "22px"],
        lg:   ["17px", "26px"],
        xl:   ["20px", "28px"],
        "2xl":["24px", "32px"],
      },
    },
  },
  plugins: [],
};
