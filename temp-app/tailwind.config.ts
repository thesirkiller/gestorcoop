import type { Config } from "tailwindcss";

// Cada chave aqui vira `bg-*`, `text-*`, `border-*`, `divide-*`, `ring-*`,
// `placeholder-*` e `ring-offset-*` (o Tailwind deriva todas essas escalas de
// `colors`). Os valores são as variáveis semânticas de `globals.css` — nunca
// hex direto —, então o tema escuro é só a redefinição dessas variáveis.
//
// NÃO use modificador de opacidade nestes tokens (`bg-surface/50`): o valor é
// uma var(), não um canal, e o Tailwind não consegue injetar alpha. Onde a
// transparência é necessária de propósito (scrim, anel de foco) o alpha já vem
// embutido no próprio token.
const token = (name: string) => `var(--c-${name})`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Rampa da marca. ATENÇÃO: apesar do nome, isto não é indigo — é um
        // azul (600 = #0066e0, não o #4f46e5 do DESIGN.md). Mantida com o nome
        // antigo porque telas fora do módulo de prontuário ainda a consomem.
        // Código novo deve usar os tokens semânticos `accent-*`.
        indigo: {
          50: "#f0f7ff",
          100: "#e0efff",
          200: "#badcff",
          250: "#99ccff",
          300: "#7abaff",
          400: "#4da2ff",
          500: "#1c82ff", // rgb(28, 130, 255)
          600: "#0066e0",
          700: "#004eb8",
          800: "#003b8f",
          850: "#002c6b",
          900: "#00204d",
          950: "#001029",
        },

        // --- Superfícies (elevação = luminosidade) e estrutura
        base: token("base"),
        canvas: token("canvas"),
        surface: token("surface"),
        raised: token("raised"),
        "surface-hover": token("surface-hover"),
        chip: token("chip"),
        "chip-hover": token("chip-hover"),
        line: token("line"),
        "line-soft": token("line-soft"),
        "line-strong": token("line-strong"),
        scrim: token("scrim"),

        // --- Tinta
        ink: token("ink"),
        "ink-body": token("ink-body"),
        muted: token("muted"),
        faint: token("faint"),
        invert: token("invert"),
        "invert-hover": token("invert-hover"),
        "on-invert": token("on-invert"),
        disabled: token("disabled"),
        "disabled-ink": token("disabled-ink"),

        // --- Marca
        accent: token("accent"),
        "accent-hover": token("accent-hover"),
        "on-accent": token("on-accent"),
        "on-accent-muted": token("on-accent-muted"),
        "accent-ink": token("accent-ink"),
        "accent-soft": token("accent-soft"),
        "accent-line": token("accent-line"),
        "accent-soft-ink": token("accent-soft-ink"),
        "accent-deep": token("accent-deep"),
        "accent-deeper": token("accent-deeper"),
        "accent-band-line": token("accent-band-line"),
        focus: token("focus"),

        // --- Estados
        "pos-soft": token("pos-soft"),
        "pos-line": token("pos-line"),
        "pos-ink": token("pos-ink"),
        "pos-solid": token("pos-solid"),
        "pos-solid-hover": token("pos-solid-hover"),
        "on-pos": token("on-pos"),
        "pos-on-accent": token("pos-on-accent"),

        "warn-soft": token("warn-soft"),
        "warn-line": token("warn-line"),
        "warn-ink": token("warn-ink"),
        "warn-solid": token("warn-solid"),
        "warn-solid-hover": token("warn-solid-hover"),
        "on-warn": token("on-warn"),
        "warn-on-accent": token("warn-on-accent"),

        "crit-soft": token("crit-soft"),
        "crit-line": token("crit-line"),
        "crit-ink": token("crit-ink"),
        "crit-solid": token("crit-solid"),
        "crit-solid-hover": token("crit-solid-hover"),
        "on-crit": token("on-crit"),

        "info-soft": token("info-soft"),
        "info-line": token("info-line"),
        "info-ink": token("info-ink"),
        "info-solid": token("info-solid"),
        "info-solid-hover": token("info-solid-hover"),
        "on-info": token("on-info"),

        "idle-soft": token("idle-soft"),
        "idle-line": token("idle-line"),
        "idle-ink": token("idle-ink"),
      },

      // `font-strong` / `font-heavy` descem um degrau no tema escuro.
      fontWeight: {
        strong: "var(--w-strong)",
        heavy: "var(--w-heavy)",
      },

      // No escuro `shadow-card` e `shadow-raised` viram `none`: a profundidade
      // passa a vir da escala de superfície.
      boxShadow: {
        card: "var(--sh-card)",
        raised: "var(--sh-raised)",
        float: "var(--sh-float)",
      },
    },
  },
  plugins: [],
};
export default config;
