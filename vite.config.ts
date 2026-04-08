import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isWechat = mode === 'wechat';

  return {
    build: {
      lib: isWechat ? {
        entry: resolve(__dirname, 'src/main.ts'),
        name: 'GameLogic',
        formats: ['iife'],
        fileName: () => 'game.bundle.js',
      } : undefined,
      outDir: isWechat ? 'dist' : 'dist_h5',
      emptyOutDir: true,
      rollupOptions: isWechat ? {
        output: {
          extend: true,
        },
      } : {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      host: true,
      port: 3000,
      strictPort: false,
    }
  };
});
