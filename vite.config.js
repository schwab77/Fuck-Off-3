import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite-Konfiguration (Root direkt im Projektverzeichnis)
export default defineConfig({
  plugins: [react()],
  root: '.',                       // wichtig: index.html liegt im Root
  build: {
    outDir: 'dist',                // Standard für Vercel
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
})
