// client/vite.config.js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "fs";
import path from "path";

export default defineConfig(({ command }) => {
  // Use function form to access command
  const isProduction = command === "build"; // Check if running 'vite build'

  return {
    plugins: [tailwindcss()],
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
    // --- Add this build configuration ---
    build: {
      minify: "terser", // Use terser for minification
      terserOptions: {
        compress: {
          // Drop console logs and warnings in production builds
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },
    },
    // -----------------------------------
  };
});
