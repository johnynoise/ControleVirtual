import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Separa bibliotecas grandes em chunks próprios: o navegador guarda
        // o Recharts em cache e o pacote inicial do app fica menor.
        manualChunks: {
          recharts: ["recharts"],
          "react-vendor": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
