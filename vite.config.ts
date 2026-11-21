import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // La carpeta de Rust la vigila Tauri; Vite no debe tocarla (archivos bloqueados al compilar).
    watch: { ignored: ["**/src-tauri/**", "**/sensors/**"] },
  },
});
