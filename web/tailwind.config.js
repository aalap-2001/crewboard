import colors from "tailwindcss/colors";

/** Change `brand` to colors.teal (and BRAND.color in functions/src/email/brand.ts) to rebrand. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: { brand: colors.indigo },
      fontFamily: {
        sans: ["Figtree", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        display: ["'Bricolage Grotesque'", "Figtree", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
