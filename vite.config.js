import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    // Vite 8.0.16 elimina la declaración estándar `backdrop-filter` al
    // minificar cuando también existe el prefijo WebKit. El servidor de
    // desarrollo no pasa por esa transformación, por eso localhost sí
    // mostraba el glassmorphism y el artefacto de Vercel no. Conservar el
    // CSS mantiene ambas declaraciones para Chromium y Safari.
    cssMinify: false,
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    sourcemapIgnoreList: false,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
