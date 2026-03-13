import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        card: "rgb(var(--card-rgb) / <alpha-value>)",
        "card-foreground": "rgb(var(--card-foreground-rgb) / <alpha-value>)",
        primary: "rgb(var(--primary-rgb) / <alpha-value>)",
        "primary-foreground": "rgb(var(--primary-foreground-rgb) / <alpha-value>)",
        secondary: "rgb(var(--secondary-rgb) / <alpha-value>)",
        "secondary-foreground":
          "rgb(var(--secondary-foreground-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-foreground-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        "accent-foreground": "rgb(var(--accent-foreground-rgb) / <alpha-value>)",
        success: "rgb(var(--success-rgb) / <alpha-value>)",
        "success-foreground": "rgb(var(--success-foreground-rgb) / <alpha-value>)",
        warning: "rgb(var(--warning-rgb) / <alpha-value>)",
        "warning-foreground": "rgb(var(--warning-foreground-rgb) / <alpha-value>)",
        destructive: "rgb(var(--destructive-rgb) / <alpha-value>)",
        "destructive-foreground":
          "rgb(var(--destructive-foreground-rgb) / <alpha-value>)",
        "switch-background": "rgb(var(--switch-background-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        input: "rgb(var(--input-rgb) / <alpha-value>)",
        ring: "rgb(var(--ring-rgb) / <alpha-value>)",
        sand: "rgb(var(--sand-rgb) / <alpha-value>)",
        dune: "rgb(var(--dune-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        ocean: "rgb(var(--ocean-rgb) / <alpha-value>)",
        clay: "rgb(var(--clay-rgb) / <alpha-value>)",
        sage: "rgb(var(--sage-rgb) / <alpha-value>)"
      },
      boxShadow: {
        panel: "0 10px 28px rgba(30, 28, 24, 0.06)"
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        serif: ["var(--font-inter)"]
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};

export default config;
