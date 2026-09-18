import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Proxying in development keeps the browser on a single origin, so the auth
    // cookies behave exactly as they will in production behind one domain.
    // In a split deployment the client instead calls VITE_API_URL directly and
    // the server's CORS allowlist takes over.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
});
