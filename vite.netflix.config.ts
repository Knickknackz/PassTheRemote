import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'src/content/netflix.ts'),
      output: {
        entryFileNames: 'netflix.js',
        inlineDynamicImports: true,  // ✅ Single file output
        manualChunks: undefined
      }
    },
    outDir: 'netflix-dist',
    emptyOutDir: true  // so it doesn’t erase your main build
  }
});
