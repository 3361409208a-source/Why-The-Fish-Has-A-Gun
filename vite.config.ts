import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isWechat = mode === 'wechat';

  return {
    base: './',
    build: {
      lib: {
        entry: resolve(__dirname, 'src/main.ts'),
        name: 'GameLogic',
        formats: ['iife'],
        fileName: () => 'game.bundle.js',
      },
      outDir: isWechat ? 'dist_wechat' : 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          extend: true,
          // 确保所有资源都在根目录 flat 部署，减少路径层级问题
          assetFileNames: '[name][extname]'
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
