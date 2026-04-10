/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        dark: "#0C0F14",
        "dark-card": "rgba(21, 25, 33, 0.35)",
        "dark-card-alt": "rgba(28, 32, 41, 0.35)",
        "dark-border": "#252A35",
        "accent-blue": "#A855F7",
        "accent-purple": "#A855F7",
        "accent-pink": "#F472B6",
        "accent-violet": "#A78BFA",
        "accent-amber": "#FBBF24",
        "gradient-start": "#A855F7",
        "gradient-end": "#38BDF8",
        primary: {
          DEFAULT: "#38BDF8",
          light: "#7DD3FC",
          tint: "#0C1A2E",
        },
        success: {
          DEFAULT: "#34D399",
          bg: "#0D261A",
        },
        error: {
          DEFAULT: "#F87171",
          dark: "#DC2626",
          light: "#FCA5A5",
          bg: "#261515",
        },
        warning: {
          DEFAULT: "#FBBF24",
          bg: "#26210F",
        },
        streak: "#FBBF24",
        surface: {
          DEFAULT: "rgba(21, 25, 33, 0.35)",
          alt: "rgba(28, 32, 41, 0.35)",
        },
        border: "#252A35",
        "input-border": "#333A48",
        "text-primary": "#F1F5F9",
        "text-secondary": "#94A3B8",
        "text-tertiary": "#64748B",
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.35)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.5)',
        glow: '0 0 20px rgba(56,189,248,0.15)',
        'glow-purple': '0 0 20px rgba(168,85,247,0.15)',
        'glow-gradient': '0 0 24px rgba(120,119,250,0.2)',
      },
      letterSpacing: {
        tight: '-0.02em',
      },
    },
  },
  plugins: [],
};
