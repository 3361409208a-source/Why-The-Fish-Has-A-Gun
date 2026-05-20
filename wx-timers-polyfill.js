/**
 * 微信小游戏定时器补丁 — 必须在 game.js 最顶部同步 require。
 */
(function () {
    var g = typeof GameGlobal !== 'undefined' ? GameGlobal
        : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (!g) return;

    var wxApi = (typeof wx !== 'undefined' ? wx : null) || g.wx;

    function bindFromWx(name) {
        if (!wxApi || typeof wxApi[name] !== 'function') return null;
        return wxApi[name].bind(wxApi);
    }

    function install(name, fn) {
        if (typeof fn !== 'function') return;
        g[name] = fn;
        if (typeof globalThis !== 'undefined') globalThis[name] = fn;
        if (typeof global !== 'undefined') global[name] = fn;
        if (typeof window !== 'undefined') window[name] = fn;
    }

    var timerNames = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'];
    for (var i = 0; i < timerNames.length; i++) {
        if (typeof g[timerNames[i]] !== 'function') {
            var bound = bindFromWx(timerNames[i]);
            if (bound) install(timerNames[i], bound);
        }
    }

    if (typeof g.setTimeout === 'function' && typeof g.requestAnimationFrame === 'function') return;

    var pending = [];
    var nextId = 1;
    var rafHandle = 0;
    var rafScheduled = false;

    var nativeRaf = (typeof g.requestAnimationFrame === 'function')
        ? g.requestAnimationFrame.bind(g)
        : bindFromWx('requestAnimationFrame');
    var nativeCancelRaf = (typeof g.cancelAnimationFrame === 'function')
        ? g.cancelAnimationFrame.bind(g)
        : bindFromWx('cancelAnimationFrame');

    function pump(now) {
        rafScheduled = false;
        var t = typeof now === 'number' ? now : Date.now();
        var rest = [];
        for (var j = 0; j < pending.length; j++) {
            var item = pending[j];
            if (t >= item.at) {
                try { item.fn(); } catch (e) { console.error('[timers]', e); }
                if (item.repeat > 0) {
                    item.at = t + item.repeat;
                    rest.push(item);
                }
            } else {
                rest.push(item);
            }
        }
        pending = rest;
        if (pending.length && nativeRaf) {
            rafScheduled = true;
            rafHandle = nativeRaf(pump);
        }
    }

    function schedulePump() {
        if (!nativeRaf || rafScheduled) return;
        rafScheduled = true;
        rafHandle = nativeRaf(pump);
    }

    if (typeof g.setTimeout !== 'function') {
        install('setTimeout', function (fn, delay) {
            var id = nextId++;
            pending.push({ id: id, fn: fn, at: Date.now() + (delay || 0), repeat: 0 });
            schedulePump();
            return id;
        });
        install('clearTimeout', function (id) {
            pending = pending.filter(function (p) { return p.id !== id; });
            if (!pending.length && nativeCancelRaf) nativeCancelRaf(rafHandle);
        });
    }

    if (typeof g.setInterval !== 'function') {
        install('setInterval', function (fn, delay) {
            var id = nextId++;
            var ms = delay || 16;
            pending.push({ id: id, fn: fn, at: Date.now() + ms, repeat: ms });
            schedulePump();
            return id;
        });
        install('clearInterval', function (id) {
            pending = pending.filter(function (p) { return p.id !== id; });
            if (!pending.length && nativeCancelRaf) nativeCancelRaf(rafHandle);
        });
    }

    if (typeof g.requestAnimationFrame !== 'function' && nativeRaf) {
        install('requestAnimationFrame', nativeRaf);
    }
    if (typeof g.cancelAnimationFrame !== 'function' && nativeCancelRaf) {
        install('cancelAnimationFrame', nativeCancelRaf);
    }
})();
