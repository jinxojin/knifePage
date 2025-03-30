// client/vite.config.js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "fs";
import path from "path";

export default defineConfig(({ command }) => {
  const isProduction = command === "build";

  return {
    plugins: [tailwindcss()],
    server: {
      https: {
        key: readFileSync(path.resolve(__dirname, "../localhost+2-key.pem")),
        cert: readFileSync(path.resolve(__dirname, "../localhost+2.pem")),
      },
      port: 5173,
      strictPort: true,
      // ++++++++++ PROXY CONFIGURATION ++++++++++
      proxy: {
        "/api": {
          // Proxy requests starting with /api
          target: "https://localhost:3000", // Your backend server address
          changeOrigin: true, // Recommended
          secure: false, // IMPORTANT for self-signed certs on backend
        },
      },
      // +++++++++++++++++++++++++++++++++++++++++++++
    },
    preview: {
      port: 5173,
      https: {
        // Also configure HTTPS for preview if needed
        key: readFileSync(path.resolve(__dirname, "../localhost+2-key.pem")),
        cert: readFileSync(path.resolve(__dirname, "../localhost+2.pem")),
      },
    },
    build: {
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },
    },
  };
});
