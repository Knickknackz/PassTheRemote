//import manifest from './manifest.json';
//import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
//import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/*export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic'
    })
  ],
  css: {
    modules: {
      localsConvention: 'camelCase',
    }
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/index.html'),
        rooms: resolve(__dirname, 'src/rooms/index.html'),
        crunchyroll: resolve(__dirname, 'src/content/crunchyroll.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
        crunchyrollParentPage: resolve(__dirname, 'src/content/crunchyrollParentPage.ts'),
        netflix: resolve(__dirname, 'src/content/netflix.ts'),
        //twitch: resolve(__dirname, 'src/content/twitch.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        manualChunks: undefined,
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  }
});*/


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

