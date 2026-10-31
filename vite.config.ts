/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // During development the game server runs separately (`npm run dev:server`); forward its socket.
  server: { proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } } },
  test: { environment: 'node', globals: true },
});
