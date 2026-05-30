import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  base: '/Speakiq/',
  plugins: [react(), basicSsl()],
  server: {
    proxy: {
      '/system': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
      '/app-health': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
        rewrite: () => '/system/status',
      },
      '/speak-topic': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
        rewrite: () => '/sessions/topic',
      },
      '/sessions': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
      '/api/dashboard': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dashboard/, '/dashboard'),
      },
    },
  },
})
