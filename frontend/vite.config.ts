import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vite.dev/config/
export default defineConfig({
  base: '/Speakiq/',
  plugins: [react()],
  server: {
    proxy: {
      // During local dev, proxy all API calls to the local FastAPI backend
      '/sessions': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
      '/dashboard': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
      '/system': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
    },
  },
})
