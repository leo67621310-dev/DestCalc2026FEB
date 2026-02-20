import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // SECURITY: Disable source maps in production to prevent source code exposure in browser DevTools
    sourcemap: false,
    outDir: 'dist',
  },
  server: {
    proxy: {
      // Proxy API requests to Vercel/Local server function during development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
});