import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

export default defineConfig({
  root: 'src/ui',
  plugins: [preact()],
  build: {
    outDir: path.resolve(__dirname, 'ui-dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:2208',
      '/socket.io': { target: 'http://localhost:2208', ws: true },
    },
  },
});
