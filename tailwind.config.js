/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1D9E75",
          light:   "#5DCAA5",
          dark:    "#0F6E56",
          muted:   "#1D9E7520",
          border:  "#1D9E7540",
        },
        app: {
          bg:             "#0f1117",
          sidebar:        "#0a0c10",
          surface:        "#161820",
          elevated:       "#1c1f2a",
          border:         "#ffffff12",
          "border-hover": "#ffffff24",
        },
        ink: {
          primary:   "#ebebeb",
          secondary: "#8c8c8c",
          muted:     "#484848",
          faint:     "#1f1f1f",
        },
        amber:  { DEFAULT: "#EF9F27", muted: "#EF9F2720" },
        coral:  { DEFAULT: "#D85A30", muted: "#D85A3020" },
        violet: { DEFAULT: "#7F77DD", muted: "#7F77DD20" },
        sky:    { DEFAULT: "#378ADD", muted: "#378ADD20" },
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      borderRadius: {
        sm:   "6px",
        md:   "10px",
        lg:   "14px",
        xl:   "18px",
        "2xl":"22px",
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
