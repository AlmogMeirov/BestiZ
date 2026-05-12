/**
 * Vite development server configuration.
 * This file configures the Vite dev server used by the React client.
 * Settings here control the dev server host, port, and file-watching behavior
 * (useful when running inside Docker on Windows/macOS).
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the dev server is reachable from outside the container.
    host: '0.0.0.0',
    port: 5173,
    // Enable polling for file watching in Docker on some hosts (Windows/macOS).
    watch: {
      usePolling: true,
    },
  },
});