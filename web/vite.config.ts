import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // "/" for Firebase Hosting; the Pages build sets BASE_PATH=/crewboard/.
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/functions"] },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
