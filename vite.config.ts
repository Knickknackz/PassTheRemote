import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/index.html'),
        rooms: resolve(__dirname, 'src/rooms/index.html'),
        crunchyrollParentPage: resolve(__dirname, 'src/content/crunchyrollParentPage.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
        //crunchyroll: resolve(__dirname, 'src/content/crunchyroll.ts'),
        //netflix.ts, twitch.ts, and overlay.tsx are in seperate loaders to allow for imports.
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: undefined,          // ✅ bundle all imports per entry
      }
    }
  }
});

