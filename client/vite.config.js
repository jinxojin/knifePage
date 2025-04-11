// client/vite.config.js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "fs";
import path, { resolve } from "path"; // Import resolve from path

export default defineConfig(({ command }) => {
  // Determine if we are running the build command for conditional logic
  const isProduction = command === "build";

  return {
    plugins: [
      // Apply TailwindCSS processing
      tailwindcss(),
    ],
    server: {
      // Configure the development server
      https: {
        // Use self-signed certs for local HTTPS development
        key: readFileSync(path.resolve(__dirname, "../localhost+2-key.pem")),
        cert: readFileSync(path.resolve(__dirname, "../localhost+2.pem")),
      },
      port: 5173, // Port for the dev server
      strictPort: true, // Fail if port is already in use
      // Proxy API requests to the backend server during development
      proxy: {
        "/api": {
          target: "http://localhost:3000", // Target backend (HTTP for local backend)
          changeOrigin: true, // Recommended for virtual hosts
          secure: false, // Not needed for HTTP target, but doesn't hurt
        },
      },
    },
    preview: {
      // Configuration for the 'vite preview' command (serves build output locally)
      port: 5173, // Port for the preview server
      https: {
        // Use same certs for local HTTPS preview if needed
        key: readFileSync(path.resolve(__dirname, "../localhost+2-key.pem")),
        cert: readFileSync(path.resolve(__dirname, "../localhost+2.pem")),
      },
    },
    build: {
      // Enable source maps for easier debugging in production builds
      sourcemap: true,

      // Configure Rollup options for building
      rollupOptions: {
        // Define multiple entry points for a Multi-Page Application (MPA)
        input: {
          // Each key (e.g., 'main', 'admin') becomes the chunk name
          // The value is the path to the HTML file entry point
          main: resolve(__dirname, "index.html"),
          admin: resolve(__dirname, "admin.html"),
          article: resolve(__dirname, "article.html"),
          articles: resolve(__dirname, "articles.html"),
          competitions: resolve(__dirname, "competitions.html"),
          mission: resolve(__dirname, "mission.html"),
          forgotPassword: resolve(__dirname, "forgot-password.html"),
          resetPassword: resolve(__dirname, "reset-password.html"),
          changeInitialPassword: resolve(
            __dirname,
            "change-initial-password.html",
          ),
          // Add any other top-level HTML files here if created later
          // e.g., contact: resolve(__dirname, 'contact.html'),
        },
      },

      // Configure minification using Terser
      minify: "terser",
      terserOptions: {
        compress: {
          // Remove console.log and debugger statements only in production builds
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },
    },
  };
});
