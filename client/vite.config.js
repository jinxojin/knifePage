// client/vite.config.js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite"; // Keep your Tailwind plugin
import { readFileSync } from "fs";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss()], // Keep Tailwind
  server: {
    https: {
      key: readFileSync(path.resolve(__dirname, "../localhost+2-key.pem")),
      cert: readFileSync(path.resolve(__dirname, "../localhost+2.pem")),
    },
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
  },
});
