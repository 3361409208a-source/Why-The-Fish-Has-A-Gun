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
    var names = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'];
    for (var i = 0; i < names.length; i++) {
        var n = names[i];
        if (typeof g[n] !== 'function' && typeof wx[n] === 'function') {
            var fn = wx[n].bind(wx);
            g[n] = fn;
            if (typeof globalThis !== 'undefined') globalThis[n] = fn;
            if (typeof global !== 'undefined') global[n] = fn;
            if (typeof window !== 'undefined') window[n] = fn;
        }
    }
    g.__wxTimerReady = true;
})();

console.log('===== ANTIGRAVITY TIMERS INJECTED V3.0 (3.16 compat) =====');

try {
    var sys = wx.getSystemInfoSync();
    GameGlobal.__wxSystemInfo = sys;
    console.log('[Boot] WeChat SDKVersion:', sys.SDKVersion || 'unknown');
} catch (e) {}

if (typeof Intl === 'undefined') {
    globalThis.Intl = {};
}

require('./weapp-adapter.js');
require('./game.bundle.js');
