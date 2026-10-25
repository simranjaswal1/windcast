import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy /api to the FastAPI server; in production FastAPI serves the built files itself.
export default defineConfig({
  build: { rollupOptions: { output: { manualChunks: { charts: ["recharts"] } } } },
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
