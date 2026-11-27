import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, "./index.html"),
    path.join(__dirname, "./src/**/*.{js,ts,jsx,tsx}"),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
        display: ["'Chakra Petch'", "system-ui", "sans-serif"],
        mono: ["'Chakra Petch'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        amber: "0 0 20px rgba(245, 158, 11, 0.25)",
      },
    },
  },
  plugins: [],
};
