// ==============================
// 微信小游戏启动入口（兼容基础库 3.13 ~ 3.16）
// ==============================
// LifeCycle.load 红字：微信框架在加载 game.js 之前调用 setTimeout 的已知缺陷，业务代码无法消除。
// 真机 Lib 3.16 下游戏仍可启动（见后续 ANTIGRAVITY / Game Started 日志），该错误可视为非致命。
// 业务内定时器请用 src/utils/wxTimer.ts（打包后走 wx / GameGlobal）。

(function () {
    var g = typeof GameGlobal !== 'undefined' ? GameGlobal
        : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (!g || typeof wx === 'undefined') return;
    g.__BUILD_TARGET__ = 'wechat';
    var names = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'];
    for (var i = 0; i < names.length; i++) {
        var n = names[i];
        var fn = typeof g[n] === 'function' ? g[n] : (typeof wx[n] === 'function' ? wx[n].bind(wx) : null);
        if (!fn) continue;
        g[n] = fn;
        try { globalThis[n] = fn; } catch (e) {}
        try { if (typeof global !== 'undefined') global[n] = fn; } catch (e) {}
        try { if (typeof window !== 'undefined') window[n] = fn; } catch (e) {}
    }
    g.__wxTimerReady = true;
})();

GameGlobal.__WECHAT_BOOT_TAG__ = '2026-05-20-r3';
console.log('===== WECHAT BOOT ' + GameGlobal.__WECHAT_BOOT_TAG__ + ' =====');
console.log('===== ANTIGRAVITY TIMERS INJECTED V3.0 (3.16 compat) =====');

try {
    var sys = wx.getSystemInfoSync();
    GameGlobal.__wxSystemInfo = sys;
    console.log('[Boot] WeChat SDKVersion:', sys.SDKVersion || 'unknown');
    if (sys.SDKVersion && parseFloat(sys.SDKVersion) >= 3.13) {
        console.warn('[Boot] 基础库>=3.13 可能先报 setTimeout 红字，若随后有 Lobby UI ready 可忽略；卡顿请用 3.11.3 调试基础库');
    }
} catch (e) {}

if (typeof Intl === 'undefined') {
    globalThis.Intl = {};
}

require('./weapp-adapter.js');
require('./game.bundle.js');
