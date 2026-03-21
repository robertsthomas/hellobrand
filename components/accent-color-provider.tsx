"use client";

import { useEffect } from "react";

/**
 * Converts a hex color (#rrggbb) to an RGB triplet string ("r g b").
 */
function hexToRgbTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

/**
 * Compute a lighter variant suitable for dark mode.
 * Shifts the color towards white by blending ~45%.
 */
function lightenForDark(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = 0.45;
  const lr = Math.round(r + (255 - r) * mix);
  const lg = Math.round(g + (255 - g) * mix);
  const lb = Math.round(b + (255 - b) * mix);
  return `${lr} ${lg} ${lb}`;
}

function lightenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = 0.45;
  const lr = Math.round(r + (255 - r) * mix);
  const lg = Math.round(g + (255 - g) * mix);
  const lb = Math.round(b + (255 - b) * mix);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

const CSS_VARS_LIGHT = [
  "--primary-rgb",
  "--ocean-rgb",
  "--ring-rgb"
] as const;

const CSS_VARS_DARK = [
  "--primary-rgb",
  "--ocean-rgb",
  "--ring-rgb"
] as const;

export function AccentColorProvider({ accentColor }: { accentColor: string | null }) {
  useEffect(() => {
    if (!accentColor) return;

    const root = document.documentElement;
    const lightRgb = hexToRgbTriplet(accentColor);
    const darkRgb = lightenForDark(accentColor);
    const darkHex = lightenHex(accentColor);

    // Create a <style> tag so we can target :root and html.dark separately,
    // which has proper specificity rather than inline styles that can't
    // distinguish light/dark.
    const style = document.createElement("style");
    style.setAttribute("data-accent-color", "true");
    style.textContent = `
      :root {
        ${CSS_VARS_LIGHT.map((v) => `${v}: ${lightRgb};`).join("\n        ")}
        --primary: ${accentColor};
      }
      html.dark {
        ${CSS_VARS_DARK.map((v) => `${v}: ${darkRgb};`).join("\n        ")}
        --primary: ${darkHex};
      }
    `;

    // Remove any previous accent style tag
    document.querySelector("style[data-accent-color]")?.remove();
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [accentColor]);

  return null;
}
