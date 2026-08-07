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
        // 深色背景层次
        base: {
          900: "#0a0f1a",      // 最深底色
          800: "#0d1117",      // 画布背景
          700: "#131923",      // 面板背景
          600: "#1a2133",      // 悬停背景
          500: "#222b3f",      // 活跃背景
        },
        // 青色技术强调色
        accent: {
          DEFAULT: "#22d3ee",
          dark: "#0891b2",
          light: "#67e8f9",
          glow: "rgba(34, 211, 238, 0.15)",
        },
        // 琥珀色选中高亮
        highlight: {
          DEFAULT: "#f59e0b",
          dark: "#d97706",
          light: "#fbbf24",
        },
        // 紫色关系连接
        relation: {
          DEFAULT: "#a78bfa",
          dark: "#7c3aed",
          light: "#c4b5fd",
        },
        // 错误/删除
        danger: {
          DEFAULT: "#ef4444",
          dark: "#dc2626",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Sora"', 'system-ui', 'sans-serif'],
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
