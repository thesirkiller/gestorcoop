---
name: GestorCoop
description: Visual design tokens and component guidelines for the cooperative management system.
colors:
  primary: "#4f46e5"
  primary-light: "#eef2ff"
  primary-dark: "#4338ca"
  neutral-bg: "#f8fafc"
  neutral-surface: "#ffffff"
  neutral-border: "#e2e8f0"
  neutral-border-light: "#f1f5f9"
  text-dark: "#0f172a"
  text-medium: "#475569"
  text-muted: "#64748b"
typography:
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "rgba(248, 250, 252, 0.5)"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: GestorCoop

## 1. Overview

**Creative North Star: "The Operational Control Room"**

GestorCoop is designed as a precise, high-density dashboard that prioritizes quick lookups, operational audits, and clear state flows. The user interface aims to represent authority, precision, and ease of use in logistically complex medical care workflows. Spacing is tight and uniform, layouts are structured to show data hierarchy, and color is used sparingly as indicators rather than decoration.

**Key Characteristics:**
- **High-Density Focus**: Minimal margins, highly aligned structures, and clean tabular information.
- **Action-Driven Transitions**: Core transitions are backed by auditable actions rather than direct inputs.
- **Sparse, High-Contrast Signaling**: Colors are reserved almost exclusively for action elements, state tags, and user guidance.

## 2. Colors

The color palette is built around Indigo for brand presence and clean Slate neutrals for structure.

### Primary
- **Cooperop Indigo** (#4f46e5): Used for brand markers, active navigation elements, and primary call-to-actions.
- **Cooperop Light Indigo** (#eef2ff): Soft background tint for active selections and tags.
- **Cooperop Dark Indigo** (#4338ca): Primary button hover state.

### Neutral
- **Deep Ink** (#0f172a): Main body text. High-contrast Slate-900.
- **Medium Ink** (#475569): Secondary text and utility labels.
- **Muted Ink** (#64748b): Table headers, inactive navigation icons, and placeholder text.
- **Border Slate** (#e2e8f0): Table lines, divider lines, and card borders.
- **Canvas Gray** (#f8fafc): General page background.
- **Canvas White** (#ffffff): Card container and sidebar backgrounds.

**The Functional Color Rule.** Accent color must not exceed 10% of any operational screen. Let the data and statuses hold focus.

## 3. Typography

**Display Font:** Inter (or default sans-serif system stack)
**Body Font:** Inter (or default sans-serif system stack)
**Label/Mono Font:** JetBrains Mono or monospace fallbacks for codes/barcodes

### Hierarchy
- **Headline** (Bold, 18px, 1.25): Module titles and dashboard highlights.
- **Title** (SemiBold, 14px, 1.2): Section headings and card labels.
- **Body** (Regular, 14px, 1.4): General description text, data cell values. Maximum measure is 75ch.
- **Label** (Bold, 11px, 1.15, uppercase, tracking-wider): Table headers, status categories.

## 4. Elevation

The system is flat-by-default to ensure performance and reduce visual clutter. Depth is communicated via subtle borders and light canvas styling.

### Shadow Vocabulary
- **Modal Shadow** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1)`): Used exclusively for dialog overlays.
- **Sidebar Glow** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05)`): Subtle branding separator.

## 5. Components

### Buttons
- **Shape:** Rounded-lg (8px) or Rounded-md (6px) depending on size.
- **Primary:** Background `#4f46e5` with text `#ffffff` and padding `8px 16px`.
- **Hover:** Background `#4338ca`.
- **Icon Buttons:** Uniform icon centering, `p-2` with `rounded-lg` on hover.

### Cards / Containers
- **Corner Style:** Rounded-xl (12px) or Rounded-lg (8px) depending on size.
- **Background:** Canvas White (`#ffffff`).
- **Border:** Slate-200 (`#e2e8f0`) thin stroke (1px).

### Navigation
- **Sidebar Nav**: `font-semibold text-sm rounded-lg`. Active item uses Indigo-50 background and Indigo-700 text. Hover item uses Slate-100 background.
- **Underline Tabs**: Flat navigation bar where active option is indicated by an Indigo bottom border (`indigo-650`) and dark text.

### Status Badges
- **Style**: Small pill-shaped tag, uppercase tracking-wide, text size `10px`. High contrast text on 10% opacity background of the state color.
- **Disponível**: Emerald background/border (`bg-emerald-500/10 text-emerald-700 border-emerald-500/20`).
- **Implantado / Alugado**: Blue background/border (`bg-blue-500/10 text-blue-700 border-blue-500/20`).
- **Manutenção**: Amber background/border (`bg-amber-500/10 text-amber-700 border-amber-500/20`).

## 6. Do's and Don'ts

### Do:
- **Do** write status badges using high-contrast combinations (e.g. green text on light-green tint, never dark text on dark green).
- **Do** align tables and lists meticulously. Numbers should be right-aligned, strings left-aligned.
- **Do** restrict card rounding to `rounded-xl` (12px) or below.

### Don't:
- **Don't** use over-rounded buttons or inputs (e.g. `rounded-3xl` or `rounded-full` for anything other than icons or circular avatars).
- **Don't** use generic color gradients or glassmorphism effects in the manager dashboard.
- **Don't** add colored side-stripes to alert items or cards. Use simple icons and text color instead.
