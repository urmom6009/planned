import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // brand palette
      colors: {
        brand: {
          DEFAULT: "#06b6d4", // cyan
          pink: "#ec4899", // pink
          ink: "#0f172a", // slate-900-ish
          paper: "#0b1020", // dark bg (future dark mode)
          neon: "#22d3ee",
          matrix: "#00ff9c",
        },
      },
      // soft shadow + extra radius token
      boxShadow: {
        soft: "0 6px 24px -8px rgba(2,6,23,0.12)",
        neon: "0 0 24px rgba(236,72,153,.35), 0 0 48px rgba(34,211,238,.25)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
