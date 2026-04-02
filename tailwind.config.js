/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1D9E75",
          light:   "#0F7A5A",
          dark:    "#0A5C42",
          muted:   "rgba(29,158,117,0.10)",
          border:  "rgba(29,158,117,0.25)",
        },
        app: {
          bg:             "#F4F6F3",
          sidebar:        "#ECEEE9",
          surface:        "#FFFFFF",
          elevated:       "#F9FAF8",
          border:         "rgba(0,0,0,0.08)",
          "border-hover": "rgba(0,0,0,0.16)",
        },
        ink: {
          primary:   "#1A1D1B",
          secondary: "#4A5250",
          muted:     "#8A9490",
          faint:     "#C0C8C4",
        },
        amber:  { DEFAULT: "#D4850A", muted: "rgba(212,133,10,0.10)" },
        coral:  { DEFAULT: "#C04A28", muted: "rgba(192,74,40,0.10)"  },
        violet: { DEFAULT: "#6B63CC", muted: "rgba(107,99,204,0.10)" },
        sky:    { DEFAULT: "#2E7BC4", muted: "rgba(46,123,196,0.10)" },
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      borderRadius: {
        sm:    "6px",
        md:    "10px",
        lg:    "14px",
        xl:    "18px",
        "2xl": "22px",
      },
      fontSize: {
        "2xs": ["10px", "14px"],
        xs:    ["11px", "16px"],
        sm:    ["13px", "20px"],
        base:  ["14px", "22px"],
        md:    ["15px", "22px"],
        lg:    ["17px", "26px"],
        xl:    ["20px", "28px"],
        "2xl": ["24px", "32px"],
      },
    },
  },
  plugins: [],
};