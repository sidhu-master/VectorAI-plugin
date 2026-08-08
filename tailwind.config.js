/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        base: {
          900: "#090b0e",
          800: "#0d1014",
          700: "#12161b",
          600: "#1a2027",
          500: "#242c35",
        },
        accent: {
          DEFAULT: "#6da9d2",
          dark: "#4f86ad",
          light: "#8dbddd",
          glow: "rgba(109, 169, 210, 0.12)",
        },
        highlight: {
          DEFAULT: "#6da9d2",
          dark: "#4f86ad",
          light: "#8dbddd",
        },
        relation: {
          DEFAULT: "#7893a6",
          dark: "#596f7e",
          light: "#9aafbd",
        },
        danger: {
          DEFAULT: "#ef6a6a",
          dark: "#d95757",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'dash-flow': 'dash-flow 1s linear infinite',
        'breathe': 'breathe 3s ease-in-out infinite',
      },
      keyframes: {
        'dash-flow': {
          'to': { 'stroke-dashoffset': '-20' },
        },
        'breathe': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};
