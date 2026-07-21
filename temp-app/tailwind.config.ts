import type { Config } from "tailwindcss";

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
      },
    },
  },
  plugins: [],
};
export default config;
