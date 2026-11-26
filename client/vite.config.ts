import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";

const clientRoot = fileURLToPath(new URL(".", import.meta.url));
const postcssConfigPath = fileURLToPath(new URL("./postcss.config.js", import.meta.url));
const sharedPath = fileURLToPath(new URL("../shared", import.meta.url));

export default defineConfig({
  root: clientRoot,
  plugins: [react()],
  css: {
    postcss: postcssConfigPath,
  },
  resolve: {
    alias: {
      "@shared": sharedPath,
    },
  },
  server: {
    port: 5173,
  },
});
