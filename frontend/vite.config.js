import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, /api is proxied to the backend (mirrors the Nginx setup in
// production). Override the target with BACKEND_URL, e.g.
//   BACKEND_URL=http://localhost:8000 npm run dev
const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    port: 3000,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  test: {
    environment: "node",
  },
});
