import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'src/content/twitch.tsx'),
      output: {
        entryFileNames: 'twitch.js',
        inlineDynamicImports: true,  // ✅ Single file output
        manualChunks: undefined
      }
    },
    outDir: 'twitch-dist',
    emptyOutDir: true  // so it doesn’t erase your main build
  }
});
