import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vite.dev/config/
export default defineConfig({
  // Use `/` for a custom domain. GitHub Pages deployments can set
  // Use `/` for the Fluently custom domain; configure VITE_BASE_PATH only
  // when deploying under a subpath.
  base: process.env.VITE_BASE_PATH || '/',
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
