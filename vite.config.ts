import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API routes to handle them properly in development
      '/api': {
        target: 'http://localhost:3000', // This would be your Cloudflare dev server
        changeOrigin: true,
        // If Cloudflare dev server is not running, we'll fallback to mock responses
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('API proxy error, using mock responses');
            // Don't actually proxy - let the frontend handle it with mocks
          });
        }
      }
    }
  }
})
