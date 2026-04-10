// ==============================
// 微信小游戏启动入口 (究极稳健版)
// ==============================

// 核心：彻底避免同步调用阻塞内核。
// 某些 3.x 版本的 lib 在启动瞬间调用 wx API 可能导致 Bridge 挂死
setTimeout(function() {
    // 同步获取系统信息作为兜底
    try {
        const sys = wx.getSystemInfoSync();
        GameGlobal.__wxSystemInfo = sys;
    } catch(e) {}
    
    // 修复：微信小游戏 JS 运行时缺少 Intl，PIXI.js TextMetrics 依赖它
    // Intl?.Segmenter 在 Intl 完全未声明时会抛 ReferenceError，用空对象兜底
    if (typeof Intl === 'undefined') { globalThis.Intl = {}; }

    // 载入适配器与主程序
    require('./weapp-adapter.js');
    require('./game.bundle.js');
}, 50);
