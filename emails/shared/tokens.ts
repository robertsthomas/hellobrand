/**
 * This file defines static email-safe visual tokens shared by React Email templates.
 * These values avoid CSS variables so rendered transactional emails remain portable.
 */
export const emailColors = {
  canvas: "#f7f8fa",
  surface: "#ffffff",
  ink: "#0e1116",
  body: "#4a4034",
  muted: "#636c79",
  border: "#e0e4e9",
  primary: "#1a4d3e",
  warning: "#e07a5f",
  success: "#81b29a",
  critical: "#c2410c",
  neutral: "#636c79",
} as const;

export const emailSpacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "40px",
} as const;

export const emailType = {
  fontFamily: "Arial, sans-serif",
  label: "12px",
  small: "13px",
  body: "15px",
  title: "24px",
  lineHeight: {
    tight: "1.2",
    body: "1.6",
  },
} as const;

export const emailRadii = {
  none: "0",
  sm: "4px",
  md: "6px",
  lg: "8px",
} as const;

export type EmailStatusVariant = "success" | "warning" | "critical" | "neutral";

export const emailStatusColors = {
  success: emailColors.success,
  warning: emailColors.warning,
  critical: emailColors.critical,
  neutral: emailColors.border,
} as const satisfies Record<EmailStatusVariant, string>;
