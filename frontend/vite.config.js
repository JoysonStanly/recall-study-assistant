import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = process.env.PORT || 8787;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    // The browser only ever talks to /api on its own origin.
    // In dev, Vite forwards that to the Express server that holds the API key.
    proxy: {
      '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
  },
});
