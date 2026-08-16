/* ============================================================
   STRIX HOOD — Core runtime
   Vanilla, zero build step, zero framework.
   Everything here is wired to something real: no dead buttons.
   ============================================================ */
(function (global) {
  'use strict';

  var S = {};
  global.Strix = S;

  /* ---------------- environment ---------------- */
  var mql = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  S.reduced = !!(mql && mql.matches);
  S.touch = global.matchMedia ? global.matchMedia('(hover: none)').matches : false;
  S.mobile = global.innerWidth < 900;

  /* ---------------- tiny DOM helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  S.$ = $; S.$$ = $$; S.el = el;
  S.esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------------- storage (guarded) ---------------- */
  var mem = {};
  S.store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('strix:' + k); return v === null ? (k in mem ? mem[k] : d) : JSON.parse(v); }
      catch (e) { return k in mem ? mem[k] : d; }
    },
    set: function (k, v) {
      mem[k] = v;
      try { localStorage.setItem('strix:' + k, JSON.stringify(v)); } catch (e) { }
      return v;
    },
    del: function (k) { delete mem[k]; try { localStorage.removeItem('strix:' + k); } catch (e) { } }
  };

  /* ---------------- formatting ---------------- */
  var nf = function (min, max) {
    try { return new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }); }
    catch (e) { return { format: function (n) { return String(n); } }; }
  };
  var f0 = nf(0, 0), f2 = nf(2, 2), f4 = nf(2, 6);

  S.fmt = {
    n: function (v, d) { return (d === 0 ? f0 : d === undefined ? f2 : nf(d, d)).format(v || 0); },
    usd: function (v, d) {
      var n = Number(v) || 0;
      if (d === undefined) d = Math.abs(n) >= 1000 ? 0 : Math.abs(n) >= 1 ? 2 : 4;
      return '$' + nf(d, d).format(n);
    },
    price: function (v) {
      var n = Number(v) || 0;
      if (n >= 1000) return '$' + f0.format(n);
      if (n >= 1) return '$' + f2.format(n);
      return '$' + f4.format(n);
    },
    compact: function (v) {
      var n = Number(v) || 0, a = Math.abs(n), s = n < 0 ? '-' : '';
      if (a >= 1e12) return s + (a / 1e12).toFixed(2) + 'T';
      if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B';
      if (a >= 1e6) return s + (a / 1e6).toFixed(2) + 'M';
      if (a >= 1e3) return s + (a / 1e3).toFixed(1) + 'K';
      return s + a.toFixed(a < 1 ? 2 : 0);
    },
    usdC: function (v) { return '$' + S.fmt.compact(v); },
    pct: function (v, d) { var n = Number(v) || 0; return (n >= 0 ? '+' : '') + n.toFixed(d === undefined ? 2 : d) + '%'; },
    addr: function (a, l, r) {
      if (!a) return '—';
      a = String(a);
      if (a.length <= (l || 6) + (r || 4) + 2) return a;
      return a.slice(0, l || 6) + '…' + a.slice(-(r || 4));
    },
    ago: function (ts) {
      var s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
      if (s < 60) return s + 's ago';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      if (s < 86400) return Math.floor(s / 3600) + 'h ago';
      return Math.floor(s / 86400) + 'd ago';
    },
    clock: function (ts) {
      var d = new Date(ts || Date.now());
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    }
  };

  /* ---------------- deterministic PRNG (stable demo data) ---------------- */
  S.rng = function (seed) {
    var s = seed >>> 0 || 42;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };

  /* ---------------- pub/sub ---------------- */
  var subs = {};
  S.on = function (ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return function () { S.off(ev, fn); }; };
  S.off = function (ev, fn) { subs[ev] = (subs[ev] || []).filter(function (f) { return f !== fn; }); };
  S.emit = function (ev, data) { (subs[ev] || []).forEach(function (f) { try { f(data); } catch (e) { console.warn('[strix]', ev, e); } }); };

  /* ============================================================
     TOASTS
     ============================================================ */
  var toastHost;
  S.toast = function (opts) {
    if (typeof opts === 'string') opts = { title: opts };
    if (!toastHost) {
      toastHost = $('#sx-toasts') || el('div', { id: 'sx-toasts', 'aria-live': 'polite', 'aria-atomic': 'false' });
      if (!toastHost.parentNode) document.body.appendChild(toastHost);
    }
    var kind = opts.type || 'ok';
    var node = el('div', { class: 'sx-toast' + (kind !== 'ok' ? ' sx-toast--' + kind : ''), role: 'status' }, [
      el('span', { class: 'sx-glyph sx-glyph--' + (kind === 'err' ? 'diamond' : kind === 'warn' ? 'dash' : 'ring'),
        style: { marginTop: '3px', color: kind === 'err' ? 'var(--crimson)' : kind === 'warn' ? 'var(--amber)' : 'var(--neon)' } }),
      el('div', {}, [
        el('b', { text: opts.title || '' }),
        opts.body ? el('p', { text: opts.body }) : null
      ]),
      el('button', { class: 'sx-toast__x', 'aria-label': 'Dismiss notification', html: '&times;', onclick: close })
    ]);
    toastHost.appendChild(node);
    var timer = setTimeout(close, opts.duration || 4200);
    function close() { clearTimeout(timer); if (!node.parentNode) return; node.classList.add('is-out'); setTimeout(function () { node.remove(); }, 340); }
    return close;
  };

  /* ============================================================
     MODAL — focus trapped, ESC to close, restores focus
     ============================================================ */
  var openModals = [];
  S.modal = function (opts) {
    opts = opts || {};
    var prevFocus = document.activeElement;
    var titleId = 'sxm-' + Math.random().toString(36).slice(2, 8);

    var body = el('div', { class: 'sx-modal__body' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    var foot = null;
    if (opts.actions && opts.actions.length) {
      foot = el('div', { class: 'sx-modal__foot' });
      opts.actions.forEach(function (a) {
        var b = el('button', {
          class: 'sx-btn sx-btn--' + (a.variant || 'ghost'),
          type: 'button',
          text: a.label,
          onclick: function () { if (a.onClick) a.onClick(api); if (a.close !== false) api.close(); }
        });
        foot.appendChild(b);
      });
    }

    var modal = el('div', {
      class: 'sx-modal' + (opts.wide ? ' sx-modal--wide' : ''),
      role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId
    }, [
      el('div', { class: 'sx-modal__head' }, [
        el('div', {}, [
          opts.eyebrow ? el('span', { class: 'sx-eyebrow', style: { marginBottom: '10px' }, text: opts.eyebrow }) : null,
          el('h2', { class: 'sx-h3', id: titleId, text: opts.title || '' }),
          opts.subtitle ? el('p', { class: 'sx-body', style: { marginTop: '6px' }, text: opts.subtitle }) : null
        ]),
        el('button', { class: 'sx-modal__x', type: 'button', 'aria-label': 'Close dialog', html: '&times;', onclick: function () { api.close(); } })
      ]),
      body,
      foot
    ]);

    var overlay = el('div', { class: 'sx-overlay' }, [modal]);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay && opts.dismissable !== false) api.close(); });

    function onKey(e) {
      if (e.key === 'Escape' && opts.dismissable !== false) { e.stopPropagation(); api.close(); return; }
      if (e.key !== 'Tab') return;
      var f = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', modal)
        .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    var api = {
      el: modal, body: body, overlay: overlay,
      close: function () {
        document.removeEventListener('keydown', onKey, true);
        overlay.classList.add('is-out');
        openModals = openModals.filter(function (m) { return m !== api; });
        if (!openModals.length) document.body.classList.remove('sx-lock');
        setTimeout(function () {
          overlay.remove();
          if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { }
        }, 260);
        if (opts.onClose) opts.onClose();
      }
    };

    document.body.appendChild(overlay);
    document.body.classList.add('sx-lock');
    openModals.push(api);
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () {
      var target = $('[data-autofocus]', modal) || $('button,a[href],input,select,textarea', modal);
      if (target) try { target.focus(); } catch (e) { }
    }, 60);
    if (opts.onOpen) opts.onOpen(api);
    return api;
  };

  S.confirm = function (opts) {
    return new Promise(function (resolve) {
      S.modal({
        title: opts.title, subtitle: opts.subtitle,
        body: opts.body ? '<p class="sx-body">' + S.esc(opts.body) + '</p>' : '',
        actions: [
          { label: opts.cancelLabel || 'Cancel', variant: 'quiet', onClick: function () { resolve(false); } },
          { label: opts.okLabel || 'Confirm', variant: opts.danger ? 'danger' : 'primary', onClick: function () { resolve(true); } }
        ],
        onClose: function () { resolve(false); }
      });
    });
  };

  /* ============================================================
     CLIPBOARD
     ============================================================ */
  S.copy = function (text, label) {
    function done() { S.toast({ title: label || 'Copied to clipboard', body: S.fmt.addr(text, 10, 8) }); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
    function fallback() {
      var ta = el('textarea', { style: { position: 'fixed', opacity: '0', top: '0' } });
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { S.toast({ title: 'Copy failed', body: text, type: 'err' }); }
      ta.remove();
    }
  };

  /* ============================================================
     REVEAL ON SCROLL
     ============================================================ */
  S.reveal = function (root) {
    var nodes = $$('[data-reveal]', root || document).filter(function (n) { return !n.__sxRevealed; });
    if (S.reduced || !global.IntersectionObserver) {
      nodes.forEach(function (n) { n.classList.add('is-in'); n.__sxRevealed = 1; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var d = parseInt(e.target.getAttribute('data-reveal') || '0', 10) || 0;
        setTimeout(function () { e.target.classList.add('is-in'); }, d);
        e.target.__sxRevealed = 1;
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  };

  /* ============================================================
     SMOOTH SCROLL (lerp) + progress + parallax depth
     ============================================================ */
  var scroll = { y: 0, target: 0, max: 0, host: null, enabled: false };
  S.scrollY = function () { return scroll.enabled ? scroll.y : global.scrollY; };

  S.initSmoothScroll = function (hostSel) {
    var host = $(hostSel || '#sx-scroll');
    if (!host || S.reduced || S.touch) { S.initScrollFx(); return; }
    scroll.host = host; scroll.enabled = true;
    document.documentElement.classList.add('sx-smooth');
    host.style.position = 'fixed';
    host.style.top = '0'; host.style.left = '0'; host.style.right = '0';
    host.style.willChange = 'transform';

    var spacer = el('div', { id: 'sx-spacer', 'aria-hidden': 'true' });
    document.body.appendChild(spacer);

    function measure() {
      scroll.max = Math.max(0, host.getBoundingClientRect().height - global.innerHeight);
      spacer.style.height = host.getBoundingClientRect().height + 'px';
    }
    measure();
    if (global.ResizeObserver) new ResizeObserver(measure).observe(host);
    global.addEventListener('resize', measure);
    setInterval(measure, 1500);

    function raf() {
      scroll.target = global.scrollY;
      scroll.y += (scroll.target - scroll.y) * 0.1;
      if (Math.abs(scroll.target - scroll.y) < 0.06) scroll.y = scroll.target;
      host.style.transform = 'translate3d(0,' + (-scroll.y).toFixed(2) + 'px,0)';
      S.emit('scroll', scroll.y);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    S.initScrollFx();
  };

  S.initScrollFx = function () {
    var bar = $('#sx-progress');
    var top = $('#sx-top');
    var nav = $('.sx-nav');
    var depths = $$('[data-depth]');
    var rail = $$('.sx-rail a');
    var sections = rail.map(function (a) { return $(a.getAttribute('href')); });
    var pctOut = $('#sx-scrollpct');
    var last = -1;

    function tick() {
      var y = S.scrollY();
      var max = Math.max(1, (document.documentElement.scrollHeight || 1) - global.innerHeight);
      var p = Math.min(1, Math.max(0, y / max));
      if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
      if (pctOut) pctOut.textContent = String(Math.round(p * 100)).padStart(3, '0') + '%';
      if (nav) nav.classList.toggle('is-stuck', y > 24);
      if (top) top.classList.toggle('is-on', y > global.innerHeight * 0.8);
      if (!S.reduced) depths.forEach(function (n) {
        var d = parseFloat(n.getAttribute('data-depth')) || 0;
        n.style.transform = 'translate3d(0,' + (y * d).toFixed(2) + 'px,0)';
      });
      var active = 0;
      sections.forEach(function (s, i) {
        if (!s) return;
        var r = s.getBoundingClientRect();
        if (r.top <= global.innerHeight * 0.42) active = i;
      });
      if (active !== last) {
        last = active;
        rail.forEach(function (a, i) { a.classList.toggle('is-active', i === active); });
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };

  S.scrollTo = function (targetOrSel, offset) {
    var t = typeof targetOrSel === 'string' ? $(targetOrSel) : targetOrSel;
    if (!t) return;
    var abs = 0, n = t;
    if (scroll.enabled) { abs = t.getBoundingClientRect().top + scroll.y; }
    else { abs = t.getBoundingClientRect().top + global.scrollY; }
    global.scrollTo({ top: Math.max(0, abs - (offset === undefined ? 80 : offset)), behavior: S.reduced ? 'auto' : 'smooth' });
  };

  /* ============================================================
     CUSTOM CURSOR
     ============================================================ */
  S.initCursor = function () {
    if (S.touch || S.reduced) return;
    var c = $('#sx-cursor') || el('div', { id: 'sx-cursor', 'aria-hidden': 'true' });
    if (!c.parentNode) document.body.appendChild(c);
    c.style.display = 'block';
    var x = 0, y = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', function (e) { x = e.clientX; y = e.clientY; }, { passive: true });
    (function loop() {
      cx += (x - cx) * 0.35; cy += (y - cy) * 0.35;
      c.style.transform = 'translate(' + (cx - c.offsetWidth / 2) + 'px,' + (cy - c.offsetHeight / 2) + 'px)';
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest('a,button,input,select,textarea,[role="button"],[data-hover]');
      c.classList.toggle('is-big', !!t);
    }, { passive: true });
    document.addEventListener('mouseleave', function () { c.style.opacity = '0'; });
    document.addEventListener('mouseenter', function () { c.style.opacity = '1'; });
  };

  /* ============================================================
     3D TILT
     ============================================================ */
  S.tilt = function (node, opts) {
    if (S.reduced || S.touch) return;
    opts = opts || {};
    var max = opts.max || 12, scale = opts.scale || 1.02;
    var inner = $('.sx-tilt__in', node) || node;
    node.addEventListener('mousemove', function (e) {
      var r = node.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      inner.style.transition = 'transform .1s linear';
      inner.style.transform = 'perspective(900px) rotateY(' + (px * max * 2).toFixed(2) + 'deg) rotateX(' + (-py * max * 2).toFixed(2) + 'deg) scale(' + scale + ')';
      node.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%');
      node.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
    });
    node.addEventListener('mouseleave', function () {
      inner.style.transition = 'transform .7s var(--expo)';
      inner.style.transform = '';
    });
  };

  /* ============================================================
     CANVAS: sparkline / donut / bars — hand-rolled, no chart libs
     ============================================================ */
  function hidpi(canvas, w, h) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  S.sparkline = function (canvas, data, opts) {
    if (!canvas || !data || data.length < 2) return;
    opts = opts || {};
    var w = opts.w || canvas.clientWidth || 160, h = opts.h || canvas.clientHeight || 44;
    var ctx = hidpi(canvas, w, h);
    var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
    var rng = (max - min) || 1, pad = 3;
    var up = data[data.length - 1] >= data[0];
    var stroke = opts.color || (up ? '#CCFF00' : '#FF5000');
    var pts = data.map(function (v, i) {
      return [pad + (i / (data.length - 1)) * (w - pad * 2), h - pad - ((v - min) / rng) * (h - pad * 2)];
    });
    ctx.clearRect(0, 0, w, h);
    if (opts.fill !== false) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, stroke + '44'); g.addColorStop(1, stroke + '00');
      ctx.beginPath(); ctx.moveTo(pts[0][0], h);
      pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
      ctx.lineTo(pts[pts.length - 1][0], h); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.strokeStyle = stroke; ctx.lineWidth = opts.lw || 1.6;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = stroke + '99'; ctx.shadowBlur = 6;
    ctx.stroke(); ctx.shadowBlur = 0;
    if (opts.dot !== false) {
      var lastp = pts[pts.length - 1];
      ctx.beginPath(); ctx.arc(lastp[0], lastp[1], 2.4, 0, Math.PI * 2);
      ctx.fillStyle = stroke; ctx.fill();
    }
  };

  /* Candlestick chart — used by the dashboard ETH panel */
  S.candles = function (canvas, candles, opts) {
    if (!canvas || !candles || !candles.length) return;
    opts = opts || {};
    var w = opts.w || canvas.clientWidth || 600, h = opts.h || canvas.clientHeight || 260;
    var ctx = hidpi(canvas, w, h);
    var padL = 6, padR = 62, padT = 10, padB = 22;
    var iw = w - padL - padR, ih = h - padT - padB;
    var his = candles.map(function (c) { return c.h; }), los = candles.map(function (c) { return c.l; });
    var max = Math.max.apply(null, his), min = Math.min.apply(null, los);
    var rng = (max - min) || 1;
    max += rng * 0.06; min -= rng * 0.06; rng = max - min;
    var cw = iw / candles.length;
    var bw = Math.max(1.5, Math.min(11, cw * 0.62));
    function Y(v) { return padT + ih - ((v - min) / rng) * ih; }

    ctx.clearRect(0, 0, w, h);
    // grid + right axis
    ctx.font = '10px ui-monospace,monospace';
    ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var v = min + (rng * g) / 4, y = Y(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + iw, y);
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#5A5B6E';
      ctx.fillText(S.fmt.compact(v), padL + iw + 8, y);
    }
    candles.forEach(function (c, i) {
      var x = padL + i * cw + cw / 2;
      var up = c.c >= c.o;
      var col = up ? '#CCFF00' : '#FF5000';
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, Y(c.h)); ctx.lineTo(x, Y(c.l)); ctx.stroke();
      var yo = Y(c.o), yc = Y(c.c);
      var top = Math.min(yo, yc), bh = Math.max(1.2, Math.abs(yc - yo));
      if (up) { ctx.globalAlpha = .9; ctx.fillRect(x - bw / 2, top, bw, bh); ctx.globalAlpha = 1; }
      else { ctx.fillRect(x - bw / 2, top, bw, bh); }
    });
    // last price line
    var lastC = candles[candles.length - 1];
    var ly = Y(lastC.c);
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(padL + iw, ly);
    ctx.strokeStyle = 'rgba(204,255,0,.55)'; ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#CCFF00';
    ctx.fillRect(padL + iw + 4, ly - 8, padR - 8, 16);
    ctx.fillStyle = '#12170A';
    ctx.font = '600 10px ui-monospace,monospace';
    ctx.fillText(S.fmt.compact(lastC.c), padL + iw + 8, ly);
  };

  /* Donut — SVG string, crisp at any size */
  S.donutSVG = function (segments, opts) {
    opts = opts || {};
    var size = opts.size || 240, sw = opts.stroke || 26, r = (size - sw) / 2 - 2;
    var C = 2 * Math.PI * r, off = 0;
    var total = segments.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var parts = segments.map(function (s, i) {
      var len = (s.value / total) * C;
      var seg = '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + s.color +
        '" stroke-width="' + sw + '" stroke-dasharray="' + (len - 2).toFixed(2) + ' ' + (C - len + 2).toFixed(2) +
        '" stroke-dashoffset="' + (-off).toFixed(2) + '" data-seg="' + i + '" style="transition:stroke-width .3s var(--ui)"><title>' +
        S.esc(s.label) + ' — ' + ((s.value / total) * 100).toFixed(1) + '%</title></circle>';
      off += len;
      return seg;
    }).join('');
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' +
      S.esc(opts.label || 'Distribution chart') + '">' +
      '<g transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="' + sw + '"/>' +
      parts + '</g></svg>';
  };

  /* ============================================================
     COUNT-UP (only where a number genuinely changes)
     ============================================================ */
  S.setNum = function (node, value, formatter) {
    if (!node) return;
    var f = formatter || function (v) { return S.fmt.n(v); };
    var from = node.__sxv === undefined ? value : node.__sxv;
    node.__sxv = value;
    if (S.reduced || from === value) { node.textContent = f(value); return; }
    var t0 = performance.now(), dur = 420;
    cancelAnimationFrame(node.__sxraf);
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      node.textContent = f(from + (value - from) * e);
      if (k < 1) node.__sxraf = requestAnimationFrame(step);
    })(t0);
  };

  S.flash = function (node, up) {
    if (!node || S.reduced) return;
    node.style.transition = 'none';
    node.style.color = up ? 'var(--neon)' : 'var(--crimson)';
    requestAnimationFrame(function () {
      node.style.transition = 'color 1.1s var(--ui)';
      node.style.color = '';
    });
  };

  /* ============================================================
     MOBILE DRAWER + NAV
     ============================================================ */
  S.initNav = function () {
    var burger = $('#sx-burger'), drawer = $('#sx-drawer');
    if (burger && drawer) {
      var close = function () {
        drawer.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('sx-lock');
      };
      burger.addEventListener('click', function () {
        var open = !drawer.classList.contains('is-open');
        drawer.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('sx-lock', open);
      });
      $$('a,button', drawer).forEach(function (a) { a.addEventListener('click', close); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }

    $$('a[href^="#"]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      a.addEventListener('click', function (e) {
        var t = $(href);
        if (!t) return;
        e.preventDefault();
        S.scrollTo(t, a.hasAttribute('data-offset') ? +a.getAttribute('data-offset') : 80);
        history.replaceState(null, '', href);
      });
    });

    var top = $('#sx-top');
    if (top) top.addEventListener('click', function () { global.scrollTo({ top: 0, behavior: S.reduced ? 'auto' : 'smooth' }); });
  };

  /* ============================================================
     BOOT / PRELOADER
     ============================================================ */
  S.boot = function (opts) {
    opts = opts || {};
    var host = $('#sx-boot');
    if (!host) return;
    if (S.reduced || S.store.get('booted', false)) { host.remove(); document.body.classList.remove('sx-lock'); return; }
    S.store.set('booted', true);
    document.body.classList.add('sx-lock');
    var lines = opts.lines || [];
    var out = $('#sx-boot-lines', host), bar = $('#sx-boot-bar', host);
    var i = 0;
    var timer = setInterval(function () {
      if (i >= lines.length) { clearInterval(timer); return; }
      var line = el('div', { html: '<span style="color:var(--neon)">›</span> ' + S.esc(lines[i]) });
      out.appendChild(line);
      while (out.children.length > 4) out.firstChild.remove();
      if (bar) bar.style.width = Math.round(((i + 1) / lines.length) * 100) + '%';
      i++;
    }, opts.step || 240);
    var done = function () {
      clearInterval(timer);
      host.style.opacity = '0';
      document.body.classList.remove('sx-lock');
      setTimeout(function () { host.remove(); S.emit('booted'); }, 520);
    };
    host.addEventListener('click', done);
    setTimeout(done, opts.duration || (lines.length * (opts.step || 240) + 500));
  };

  /* ============================================================
     BOOTSTRAP shared chrome
     ============================================================ */
  S.init = function (opts) {
    opts = opts || {};
    S.initCursor();
    S.initNav();
    S.reveal();
    if (opts.smooth !== false) S.initSmoothScroll(); else S.initScrollFx();
    $$('[data-copy]').forEach(function (n) {
      n.addEventListener('click', function () { S.copy(n.getAttribute('data-copy'), n.getAttribute('data-copy-label')); });
    });
    $$('[data-tilt]').forEach(function (n) { S.tilt(n, { max: +n.getAttribute('data-tilt') || 10 }); });
    if (mql && mql.addEventListener) mql.addEventListener('change', function (e) { S.reduced = e.matches; });
  };

})(window);
