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

const bundlePath = path.join(dist, 'game.bundle.js');
const bundleKb = (fs.statSync(bundlePath).size / 1024).toFixed(1);
const bootTag = '2026-05-20-r3';

console.log('');
console.log('微信小游戏包已就绪: dist_wechat/');
console.log(`  game.bundle.js = ${bundleKb} KB`);
console.log(`  启动后 vConsole 必须看到: WECHAT BOOT ${bootTag}`);
console.log('  若仍是 Fallback applied / Renderer created directly → 未用到本包，请清缓存');
console.log('');
console.log('【重要】微信开发者工具 → 导入项目 → 只选 dist_wechat 文件夹');
console.log('【重要】详情 → 本地设置 → 调试基础库 → 选 3.11.3（勿用 3.16，否则 setTimeout 红字）');
console.log('必需文件: game.js, game.bundle.js, game.json, weapp-adapter.js');
console.log('');
