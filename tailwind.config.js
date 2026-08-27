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
        // Mirrors config/theme.ts — that file is canonical. Cards are OPAQUE
        // here: the glow layer supplies depth, so translucent card fills only
        // muddied it (see DESIGN.md §Glow).
        dark: "#08090F",
        "dark-raised": "#0E1119",
        "dark-card": "#151921",
        "dark-card-alt": "#1C212B",
        "dark-border": "rgba(255, 255, 255, 0.12)",
        "accent-blue": "#818CF8",
        "accent-purple": "#A855F7",
        "accent-pink": "#F472B6",
        "accent-violet": "#A78BFA",
        "accent-amber": "#FBBF24",
        "gradient-start": "#A855F7",
        "gradient-end": "#38BDF8",
        primary: {
          DEFAULT: "#4F46E5", // indigo.600 — fills (white 6.4:1)
          light: "#818CF8", // indigo.400 — text/icon accents on dark
          slab: "#3730A3", // indigo.800 — tactile slab
          tint: "rgba(99, 102, 241, 0.15)",
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
        flame: "#FBBF24",
        surface: {
          DEFAULT: "#151921",
          alt: "#1C212B",
        },
        border: "rgba(255, 255, 255, 0.12)",
        "input-border": "rgba(255, 255, 255, 0.24)",
        "text-primary": "#F1F5F9",
        "text-secondary": "#CBD5E1",
        "text-tertiary": "#94A3B8",
        "text-quaternary": "#64748B",
      },
      fontFamily: {
        sans: ['Nunito_400Regular'],
        'sans-medium': ['Nunito_500Medium'],
        'sans-semibold': ['Nunito_600SemiBold'],
        'sans-bold': ['Nunito_700Bold'],
        'sans-extrabold': ['Nunito_800ExtraBold'],
        serif: ['Fraunces_600SemiBold'],
        mono: ['JetBrainsMono_400Regular'],
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
