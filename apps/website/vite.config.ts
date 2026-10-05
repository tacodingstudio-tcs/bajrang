import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5174,
    proxy: {
      // Only the public, unauthenticated API is reachable from the website.
      '/api/public': {
        target:       'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
