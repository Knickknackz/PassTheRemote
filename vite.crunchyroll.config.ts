import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'src/content/crunchyroll.ts'),
      output: {
        entryFileNames: 'crunchyroll.js',
        inlineDynamicImports: true,  // ✅ Single file output
        manualChunks: undefined
      }
    },
    outDir: 'crunchyroll-dist',
    emptyOutDir: true  // so it doesn’t erase your main build
  }
});
