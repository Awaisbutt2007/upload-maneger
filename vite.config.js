import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
    open: true,
    proxy: {
      // Keep the browser's Host header so OAuth redirect URIs point at this dev server.
      '/api': { target: 'http://127.0.0.1:4001', changeOrigin: false },
    },
  }
})
