import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}'
  },
  build: {
    minify: false, // 👈 prevents minified React
    lib: {
      entry: resolve(__dirname, 'src/content/overlay.tsx'),
      name: 'Overlay',
      formats: ['iife'],
      fileName: () => 'overlay.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    },
    outDir: 'overlay-dist',
    emptyOutDir: true
  }
});