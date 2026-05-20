import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist_wechat');

const copyToDist = [
    'game.json',
    'game.js',
    'weapp-adapter.js',
    'project.config.json',
    'project.private.config.json',
];

if (!fs.existsSync(dist)) {
    fs.mkdirSync(dist, { recursive: true });
}

if (!fs.existsSync(path.join(dist, 'game.bundle.js'))) {
    console.error('[wechat] 缺少 dist_wechat/game.bundle.js，请先执行 vite build --mode wechat');
    process.exit(1);
}

for (const name of copyToDist) {
    const src = path.join(root, name);
    if (!fs.existsSync(src)) {
        console.warn(`[wechat] 跳过（不存在）: ${name}`);
        continue;
    }
    fs.copyFileSync(src, path.join(dist, name));
}

// 同步到项目根，避免在根目录打开工具时缺 bundle
fs.copyFileSync(path.join(dist, 'game.bundle.js'), path.join(root, 'game.bundle.js'));

console.log('');
console.log('微信小游戏包已就绪: dist_wechat/');
console.log('请在微信开发者工具中【导入项目】并选择该文件夹（不要选上一级 src 目录）');
console.log('必需文件: game.js, game.bundle.js, game.json, weapp-adapter.js');
console.log('');
