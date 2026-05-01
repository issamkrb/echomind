import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm palette — "the seduction"
        cream: {
          50: "#FDFBF7",
          100: "#FAF7F2",
          200: "#F3ECE0",
          300: "#E8DCC6",
        },
        sage: {
          300: "#B5CBB0",
          500: "#8BA888",
          700: "#5C7A5A",
          900: "#2F3F2E",
        },
        clay: {
          100: "#FAEFE6",
          300: "#E9CFB8",
          500: "#C89F82",
          700: "#8B6F5A",
          900: "#5A3F2A",
        },
        // Cold palette — "the auction"
        terminal: {
          bg: "#0A0A0B",
          panel: "#111113",
          border: "#1F1F22",
          text: "#D4D4D8",
          dim: "#6B6B70",
          green: "#00FF88",
          red: "#FF3B3B",
          amber: "#FFB020",
          blue: "#3B82F6",
        },
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      animation: {
        "breathe": "breathe 8s ease-in-out infinite",
        "pulse-slow": "pulseSlow 4s ease-in-out infinite",
        "ticker": "ticker 20s linear infinite",
        "fade-in": "fadeIn 0.8s ease-out forwards",
        "fade-in-up": "fadeInUp 1s ease-out forwards",
        "blink": "blink 1s steps(2, start) infinite",
        "scan": "scan 3s ease-in-out infinite",
        "bid-bump": "bidBump 1.4s ease-out forwards",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.12)", opacity: "1" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        scan: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(100%)" },
        },
        bidBump: {
          "0%": { opacity: "0", transform: "translateY(0)" },
          "15%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(-26px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
