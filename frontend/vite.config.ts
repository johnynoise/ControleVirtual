import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Escuta em todas as interfaces de rede, não só localhost. Permite
    // acessar o modo dev (npm run dev) de outros dispositivos na mesma
    // rede pelo IP do notebook, ex.: http://192.168.3.194:5173
    host: true,
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
