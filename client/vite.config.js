// client/vite.config.js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "fs";
import path from "path";

export default defineConfig(({ command }) => {
  // Determine if we are running the build command
  const isProduction = command === "build";

  return {
    plugins: [tailwindcss()],
    server: {
      // Frontend server runs on HTTPS (optional, but often convenient)
      https: {
        key: readFileSync(path.resolve(__dirname, "../localhost+2-key.pem")),
        cert: readFileSync(path.resolve(__dirname, "../localhost+2.pem")),
      },
      port: 5173,
      strictPort: true,
      // Proxy API requests during development
      proxy: {
        "/api": {
          // Target the backend server running on HTTP for local dev
          target: "http://localhost:3000", // <-- Corrected target
          changeOrigin: true, // Recommended for virtual hosts
          // 'secure: false' is mainly for HTTPS targets with self-signed certs,
          // less critical for HTTP but doesn't hurt.
          secure: false,
        },
      },
    },
    preview: {
      // Configuration for the 'vite preview' command (optional)
      port: 5173,
      https: {
        key: readFileSync(path.resolve(__dirname, "../localhost+2-key.pem")),
        cert: readFileSync(path.resolve(__dirname, "../localhost+2.pem")),
      },
    },
    build: {
      // Enable source maps for production builds to aid debugging
      sourcemap: true, // <--- ADDED THIS LINE

      // Keep existing minification options
      minify: "terser",
      terserOptions: {
        compress: {
          // Drop console logs and debugger statements only in production builds
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },
    },
  };
});
