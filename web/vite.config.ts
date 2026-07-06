import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://187.127.158.26:8083',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://187.127.158.26:8083',
        changeOrigin: true,
      },
    },
  },
})
