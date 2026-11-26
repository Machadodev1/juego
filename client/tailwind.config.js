/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        neon: "0 0 18px rgba(34, 211, 238, 0.35)",
        "neon-pink": "0 0 18px rgba(236, 72, 153, 0.35)",
      },
    },
  },
  plugins: [],
};
