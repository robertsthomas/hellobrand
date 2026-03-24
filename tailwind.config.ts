import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

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
        popover: "rgb(var(--popover-rgb) / <alpha-value>)",
        "popover-foreground": "rgb(var(--popover-foreground-rgb) / <alpha-value>)",
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
        "input-background": "rgb(var(--input-background-rgb) / <alpha-value>)",
        ring: "rgb(var(--ring-rgb) / <alpha-value>)",
        sand: "rgb(var(--sand-rgb) / <alpha-value>)",
        dune: "rgb(var(--dune-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        ocean: "rgb(var(--ocean-rgb) / <alpha-value>)",
        clay: "rgb(var(--clay-rgb) / <alpha-value>)",
        sage: "rgb(var(--sage-rgb) / <alpha-value>)",
        sidebar: "rgb(var(--sidebar-rgb) / <alpha-value>)",
        "sidebar-foreground":
          "rgb(var(--sidebar-foreground-rgb) / <alpha-value>)",
        "sidebar-primary":
          "rgb(var(--sidebar-primary-rgb) / <alpha-value>)",
        "sidebar-primary-foreground":
          "rgb(var(--sidebar-primary-foreground-rgb) / <alpha-value>)",
        "sidebar-accent": "rgb(var(--sidebar-accent-rgb) / <alpha-value>)",
        "sidebar-accent-foreground":
          "rgb(var(--sidebar-accent-foreground-rgb) / <alpha-value>)",
        "sidebar-border": "rgb(var(--sidebar-border-rgb) / <alpha-value>)",
        "sidebar-ring": "rgb(var(--sidebar-ring-rgb) / <alpha-value>)",
        "chart-1": "rgb(var(--chart-1-rgb) / <alpha-value>)",
        "chart-2": "rgb(var(--chart-2-rgb) / <alpha-value>)",
        "chart-3": "rgb(var(--chart-3-rgb) / <alpha-value>)",
        "chart-4": "rgb(var(--chart-4-rgb) / <alpha-value>)",
        "chart-5": "rgb(var(--chart-5-rgb) / <alpha-value>)"
      },
      borderRadius: {
        sm: "calc(var(--radius-base) - 2px)",
        md: "var(--radius-base)",
        lg: "calc(var(--radius-base) + 4px)",
        xl: "calc(var(--radius-base) + 8px)",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        floating: "var(--shadow-floating)"
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        serif: ["var(--font-inter)"]
      }
    }
  },
  plugins: [forms]
};

export default config;
