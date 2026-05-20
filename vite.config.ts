import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isWechat = mode === 'wechat';

  return {
    base: './',
    // 微信模式：不复制 public/ 目录，避免 assets 出现在 dist_wechat 中
    publicDir: isWechat ? false : 'public',
    build: isWechat ? {
      // 微信模式：库编译模式，生成单文件 game.bundle.js
      lib: {
        entry: resolve(__dirname, 'src/main.ts'),
        name: 'GameLogic',
        formats: ['iife'],
        fileName: () => 'game.bundle.js',
      },
      outDir: 'dist_wechat',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          extend: true,
          assetFileNames: '[name][extname]'
        },
      },
    } : {
      // H5 模式：标准编译模式，处理 index.html
      outDir: 'dist',
      emptyOutDir: true,
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
