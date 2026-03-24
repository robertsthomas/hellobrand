export type DesignSystemColorToken = {
  name: string;
  tailwindToken: string;
  cssVariable: string;
  usage: string;
};

export type DesignSystemTypeRole = {
  name: string;
  className: string;
  usage: string;
};

export type DesignSystemLayer = {
  name: string;
  path: string;
  purpose: string;
  rules: string[];
};

export const designSystemColorTokens: DesignSystemColorToken[] = [
  {
    name: "Background",
    tailwindToken: "bg-background",
    cssVariable: "--background-rgb",
    usage: "App canvas, page backgrounds, and default surfaces.",
  },
  {
    name: "Foreground",
    tailwindToken: "text-foreground",
    cssVariable: "--foreground-rgb",
    usage: "Primary text and high-contrast icons.",
  },
  {
    name: "Card",
    tailwindToken: "bg-card",
    cssVariable: "--card-rgb",
    usage: "Contained surfaces and elevated content blocks.",
  },
  {
    name: "Primary",
    tailwindToken: "bg-primary",
    cssVariable: "--primary-rgb",
    usage: "Primary actions, emphasis, and key stateful affordances.",
  },
  {
    name: "Secondary",
    tailwindToken: "bg-secondary",
    cssVariable: "--secondary-rgb",
    usage: "Subtle containers, toggles, and less prominent actions.",
  },
  {
    name: "Muted",
    tailwindToken: "bg-muted",
    cssVariable: "--muted-rgb",
    usage: "Passive surfaces and supporting text treatment.",
  },
  {
    name: "Accent",
    tailwindToken: "bg-accent",
    cssVariable: "--accent-rgb",
    usage: "Highlights, callouts, and selective secondary emphasis.",
  },
  {
    name: "Success",
    tailwindToken: "bg-success",
    cssVariable: "--success-rgb",
    usage: "Positive state messaging and confirmed outcomes.",
  },
  {
    name: "Warning",
    tailwindToken: "bg-warning",
    cssVariable: "--warning-rgb",
    usage: "Caution states and risk attention without destructive meaning.",
  },
  {
    name: "Destructive",
    tailwindToken: "bg-destructive",
    cssVariable: "--destructive-rgb",
    usage: "Destructive actions and high-severity errors.",
  },
  {
    name: "Border",
    tailwindToken: "border-border",
    cssVariable: "--border-rgb",
    usage: "Component boundaries and separators.",
  },
  {
    name: "Input Background",
    tailwindToken: "bg-input-background",
    cssVariable: "--input-background-rgb",
    usage: "Text fields, checkbox fills, and OTP inputs.",
  },
  {
    name: "Sidebar",
    tailwindToken: "bg-sidebar",
    cssVariable: "--sidebar-rgb",
    usage: "Sidebar shells and sidebar-specific accents.",
  },
];

export const designSystemTypeRoles: DesignSystemTypeRole[] = [
  {
    name: "Display",
    className: "text-5xl font-semibold tracking-[-0.06em]",
    usage: "Top-level marketing and destination page headings.",
  },
  {
    name: "Section Title",
    className: "text-2xl font-semibold tracking-[-0.04em]",
    usage: "Major section headers inside product and docs screens.",
  },
  {
    name: "Card Title",
    className: "text-base font-medium",
    usage: "Panel headings and dense content modules.",
  },
  {
    name: "Body",
    className: "text-sm leading-6 text-muted-foreground",
    usage: "Default supporting copy inside the product.",
  },
  {
    name: "Label",
    className: "text-xs font-medium uppercase tracking-[0.14em]",
    usage: "Metadata, column labels, and compact section markers.",
  },
];

export const designSystemLayers: DesignSystemLayer[] = [
  {
    name: "Primitives",
    path: "components/ui",
    purpose: "Framework-agnostic presentational building blocks.",
    rules: [
      "Compose low-level behavior and styling only.",
      "Never fetch data or import product-specific components.",
      "Expose generic names, props, and variants.",
    ],
  },
  {
    name: "Patterns",
    path: "components/patterns",
    purpose: "Reusable app-facing compositions built from primitives.",
    rules: [
      "May compose multiple primitives into common product patterns.",
      "May encode HelloBrand-specific layout conventions.",
      "Remain domain-light and avoid data fetching or business logic.",
    ],
  },
  {
    name: "Features",
    path: "components and app routes",
    purpose: "Product flows, business logic, and data-aware UI.",
    rules: [
      "Own domain state, data loading, and feature-specific behavior.",
      "Consume patterns first, then primitives when no pattern exists.",
      "Promote repeated UI upward into patterns or primitives.",
    ],
  },
];

export const designSystemRules = [
  "Use semantic tokens before raw hex values in shared layers.",
  "Keep typography on named roles, not ad hoc one-off sizes, in reusable UI.",
  "Primitives stay generic; app language belongs in patterns and features.",
  "New repeated feature UI should be extracted into components/patterns before it spreads.",
  "When a utility class combination repeats across patterns, convert it into a primitive variant or token-backed style.",
];

export const designSystemShapeTokens = [
  {
    name: "Radius Base",
    token: "--radius-base",
    value: "0.5rem",
    usage: "Default curve for shared controls and cards.",
  },
  {
    name: "Shadow Panel",
    token: "--shadow-panel",
    value: "Surface elevation",
    usage: "Standard raised panel treatment.",
  },
  {
    name: "Shadow Floating",
    token: "--shadow-floating",
    value: "Overlay elevation",
    usage: "Dialogs, popovers, and floating layers.",
  },
  {
    name: "Motion Fast",
    token: "--motion-fast",
    value: "160ms",
    usage: "Quick hover and state feedback.",
  },
  {
    name: "Motion Base",
    token: "--motion-base",
    value: "200ms",
    usage: "Default component transitions.",
  },
];

export const primitiveComponentNames = [
  "Button",
  "Input",
  "Textarea",
  "Select",
  "Checkbox",
  "Switch",
  "Tabs",
  "Dialog",
  "Sheet",
  "Popover",
  "Tooltip",
  "Card",
  "Badge",
  "Table",
  "Accordion",
];

export const patternComponentNames = ["SectionIntro", "EmptyState"];

export const designSystemExport = {
  version: 1,
  name: "HelloBrand Design System",
  foundations: {
    colors: designSystemColorTokens,
    typography: designSystemTypeRoles,
    shape: designSystemShapeTokens,
  },
  layers: designSystemLayers,
  rules: designSystemRules,
  inventory: {
    primitives: primitiveComponentNames,
    patterns: patternComponentNames,
  },
};
