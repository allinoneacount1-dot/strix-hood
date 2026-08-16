/* ============================================================
   STRIX HOOD — Dashboard runtime
   Drives app.html (agent console) and admin.html (protocol).
   One file, two page modes, selected by <body data-dash>.

   Rules this file follows:
     · every control does work — no decorative buttons
     · every number carries its provenance (live source or sim)
     · a dead feed is reported, never papered over with a stale value
     · routes are hash-based, deep-linkable and Back-button correct
   ============================================================ */
(function (global) {
  'use strict';

  var S = global.Strix;
  if (!S) { console.error('[dash] strix.js must load first'); return; }
  var $ = S.$, $$ = S.$$, el = S.el, fmt = S.fmt, esc = S.esc;

  var PAGE = document.body.getAttribute('data-dash') || 'app';
  var IS_APP = PAGE === 'app';

  /* ============================================================
     0 · SMALL HELPERS
     ============================================================ */
  function txt(node, v) { if (node && node.textContent !== v) node.textContent = v; }
  function pct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function cls(n) { return n >= 0 ? 'sx-up' : 'sx-down'; }
  function hex(n, rnd) {
    var s = '', c = '0123456789abcdef';
    for (var i = 0; i < n; i++) s += c[Math.floor((rnd ? rnd() : Math.random()) * 16)];
    return s;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function startOfDay() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

  /* Source badge — the one place provenance is rendered. */
  function badge(kind, label) {
    return '<span class="d-src d-src--' + kind + '">' + esc(label) + '</span>';
  }
  function setBadge(node, kind, label) {
    if (!node) return;
    node.className = 'd-src d-src--' + kind;
    node.textContent = label;
  }

  /* What is actually behind the market numbers right now.
     Returns [kind, long label, short label]. */
  function marketSrc() {
    var st = S.data.status, m = S.data.market, live = false;
    Object.keys(m).forEach(function (k) { if (m[k].live) live = true; });
    if (live) {
      if (st.ws === 'ok') return ['live', 'binance ws · live', 'binance ws'];
      if (st.binance === 'ok') return ['live', 'binance rest · live', 'binance'];
      if (st.gecko === 'ok') return ['live', 'coingecko · live', 'coingecko'];
      return ['live', 'live feed', 'live'];
    }
    if (st.binance === 'fail' || st.gecko === 'fail' || st.ws === 'fail') {
      return ['down', 'market feed unreachable · simulated', 'feed down · sim'];
    }
    return ['sim', 'awaiting feed · simulated', 'awaiting feed'];
  }

  var FEEDS = [
    { k: 'binance', name: 'Binance REST', url: 'api.binance.com/api/v3', use: '24h ticker + candlesticks' },
    { k: 'ws', name: 'Binance WS', url: 'stream.binance.com:9443', use: 'realtime price ticks' },
    { k: 'gecko', name: 'CoinGecko', url: 'api.coingecko.com/api/v3', use: 'market cap + 7d series' },
    { k: 'llama', name: 'DeFiLlama', url: 'api.llama.fi', use: 'Ethereum TVL' },
    { k: 'rpc', name: 'PublicNode RPC', url: 'ethereum-rpc.publicnode.com', use: 'block height, gas, balances' },
    { k: 'fng', name: 'alternative.me', url: 'api.alternative.me/fng', use: 'fear & greed index' },
    { k: 'dex', name: 'DexScreener', url: 'api.dexscreener.com', use: 'on-chain pair liquidity' }
  ];
  var FEED_SHORT = { binance: 'BINANCE', ws: 'WS', gecko: 'GECKO', llama: 'LLAMA', rpc: 'RPC', fng: 'F&G', dex: 'DEX' };

  /* Feed states are not transaction states — give them their own vocabulary. */
  function feedPill(state) {
    var m = { ok: ['live', 'ANSWERED'], fail: ['err', 'UNREACHABLE'], closed: ['warn', 'DISCONNECTED'] }[state] ||
      ['idle', 'IDLE'];
    return '<span class="sx-status sx-status--' + m[0] + '"><i></i>' + m[1] + '</span>';
  }

  /* ============================================================
     1 · PREFERENCES — applied immediately, persisted
     ============================================================ */
  var PREFS = S.store.get('dash:prefs', { ambient: true, cursor: true, motion: false, flash: true });
  var ambientHandle = null, ambientToken = 0, ambientMounted = false;

  /* persist=true only when the user actually changed something — a page load
     must not silently re-create the storage the user just cleared. */
  function applyPrefs(persist) {
    var h = document.documentElement;
    h.classList.toggle('d-noambient', !PREFS.ambient);
    h.classList.toggle('d-nocursor', !PREFS.cursor);
    h.classList.toggle('d-noanim', !!PREFS.motion);
    S.reduced = !!PREFS.motion || (global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)').matches : false);
    if (PREFS.ambient) mountAmbient(); else disposeAmbient();
    if (persist) S.store.set('dash:prefs', PREFS);
  }

  function mountAmbient() {
    var cv = $('#sx-ambient');
    if (!cv || ambientHandle) return;
    if (!global.Strix3D || !Strix3D.available()) return;
    /* A disposed renderer leaves its WebGL context attached to the canvas, so a
       second scene on the same element re-initialises on top of the old one.
       Swap in a fresh canvas instead — cheap, and the new context starts clean. */
    if (ambientMounted) {
      var n = document.createElement('canvas');
      n.id = 'sx-ambient';
      n.setAttribute('aria-hidden', 'true');
      cv.parentNode.replaceChild(n, cv);
      cv = n;
    }
    ambientMounted = true;
    var token = ++ambientToken;
    Strix3D.ambient(cv, { density: S.mobile ? 0.28 : 0.45 }).then(function (h) {
      if (!h) return;
      if (!PREFS.ambient || token !== ambientToken) { try { h.dispose(); } catch (e) { } return; }
      ambientHandle = h;
      /* Dialled right down: the lattice must never compete with a number. */
      h.setProgress(0.35);
    });
  }
  function disposeAmbient() {
    ambientToken++;
    if (!ambientHandle) return;
    try { ambientHandle.dispose(); } catch (e) { }
    ambientHandle = null;
  }

  /* ============================================================
     2 · ROUTER
     ============================================================ */
  var APP_ROUTES = [
    { k: 'overview', label: 'Overview', glyph: 'ring', h1: 'Overview', sub: 'Book value, agent state and live intent activity.' },
    { k: 'agents', label: 'Agents', glyph: 'diamond', h1: 'Agents', sub: 'Executors registered to this account, and the scope each one runs under.' },
    { k: 'portfolio', label: 'Portfolio', glyph: 'arc', h1: 'Portfolio', sub: 'Allocation and per-asset performance, marked against the live feed.' },
    { k: 'transactions', label: 'Transactions', short: 'Txns', glyph: 'bar', h1: 'Transactions', sub: 'Every execution your agents attempted, settled or refused.' },
    { k: 'policy', label: 'Policy', glyph: 'sq', h1: 'Policy', sub: 'The caps and allow-lists the executor enforces before signing anything.' },
    { k: 'settings', label: 'Settings', glyph: 'dash', h1: 'Settings', sub: 'Wallet, interface preferences and the data this console reads.' }
  ];
  var ADMIN_ROUTES = [
    { k: 'overview', label: 'Network', glyph: 'ring', h1: 'Network', sub: 'Throughput, settlement quality and chain conditions.' },
    { k: 'registry', label: 'Registry', glyph: 'diamond', h1: 'Agent registry', sub: 'Every agent with an onchain identity, its bond and its record.' },
    { k: 'treasury', label: 'Treasury', glyph: 'arc', h1: 'Fee & treasury', sub: 'Where the 0.25% protocol fee goes, epoch by epoch.' },
    { k: 'security', label: 'Security', glyph: 'sq', h1: 'Security monitor', sub: 'Five independent gates between an agent and a user’s funds.' },
    { k: 'tokenomics', label: 'Tokenomics', glyph: 'bar', h1: '$STRX tokenomics', sub: 'Fixed supply, allocation and the unlock schedule written into the contract.' }
  ];
  var ROUTES = IS_APP ? APP_ROUTES : ADMIN_ROUTES;
  var route = ROUTES[0].k;
  var onShow = {};   /* route key -> [fn] */

  function whenShown(k, fn) { (onShow[k] = onShow[k] || []).push(fn); }

  function buildNav() {
    var nav = $('#d-nav'), bn = $('#d-bottomnav');
    ROUTES.forEach(function (r, i) {
      nav.appendChild(el('button', {
        class: 'sx-side__item', type: 'button', 'data-route': r.k,
        onclick: function () { go(r.k, true); }
      }, [
        el('span', { class: 'sx-glyph sx-glyph--' + r.glyph }),
        el('span', { text: r.label }),
        el('kbd', { text: String(i + 1), 'aria-hidden': 'true' })
      ]));
      bn.appendChild(el('button', {
        class: 'd-bn', type: 'button', 'data-route': r.k, 'aria-label': r.label,
        onclick: function () { go(r.k, true); }
      }, [
        el('span', { class: 'sx-glyph sx-glyph--' + r.glyph }),
        el('span', { text: r.short || r.label })
      ]));
    });
  }

  function apply(k, focus) {
    var r = ROUTES.filter(function (x) { return x.k === k; })[0];
    if (!r) return;
    route = k;
    $$('#d-views .sx-view').forEach(function (v) {
      var on = v.getAttribute('data-view') === k;
      v.hidden = !on;
      if (on) { v.classList.remove('sx-view'); void v.offsetWidth; v.classList.add('sx-view'); }
    });
    $$('[data-route]').forEach(function (b) {
      var on = b.getAttribute('data-route') === k;
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-active', on);
    });
    txt($('#d-title'), r.h1);
    txt($('#d-sub'), r.sub);
    document.title = r.h1 + ' — ' + (IS_APP ? 'Agent Console' : 'Protocol Dashboard') + ' — Strix Hood';
    (onShow[k] || []).forEach(function (fn) { try { fn(); } catch (e) { console.warn('[dash] onShow', k, e); } });
    if (focus) {
      global.scrollTo({ top: 0, behavior: S.reduced ? 'auto' : 'smooth' });
      var v = $('#view-' + k);
      if (v) try { v.focus({ preventScroll: true }); } catch (e) { }
    }
  }

  function go(k, user) {
    if (location.hash.slice(1) === k) { apply(k, user); return; }
    location.hash = '#' + k;               /* pushes history → Back works */
    if (user) pendingFocus = true;
  }
  var pendingFocus = false;

  function fromHash() {
    var k = (location.hash || '').replace('#', '');
    return ROUTES.some(function (r) { return r.k === k; }) ? k : null;
  }

  function initRouter() {
    buildNav();
    global.addEventListener('hashchange', function () {
      var k = fromHash();
      if (!k) return;                      /* ignore #main and friends */
      apply(k, pendingFocus);
      pendingFocus = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && t.closest && (t.closest('input,textarea,select,[contenteditable]') || t.closest('.sx-overlay') || t.closest('.sxc-panel'))) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= ROUTES.length) { e.preventDefault(); go(ROUTES[n - 1].k, true); }
    });
    apply(fromHash() || ROUTES[0].k, false);
  }

  /* Route buttons embedded in panels ("Manage", "Open portfolio", …) */
  function wireGoLinks() {
    $$('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.getAttribute('data-go'), true); });
    });
  }

  /* ============================================================
     3 · CLOCK + FEED HEALTH + SOURCES DIALOG
     ============================================================ */
  function initClock() {
    var host = $('#d-clock'), b = host && host.querySelector('b');
    if (!b) return;
    var off = $('#d-clock-off');
    if (off) {
      var m = -new Date().getTimezoneOffset() / 60;
      off.textContent = ' · local ' + (m >= 0 ? '+' : '') + m;
    }
    (function tick() {
      var d = new Date();
      b.textContent = String(d.getUTCHours()).padStart(2, '0') + ':' +
        String(d.getUTCMinutes()).padStart(2, '0') + ':' + String(d.getUTCSeconds()).padStart(2, '0');
      setTimeout(tick, 1000);
    })();
  }

  function healthClass(v) { return v === 'ok' ? 'is-ok' : v === 'fail' ? 'is-fail' : ''; }
  function renderHealth() {
    var host = $('#d-health');
    if (!host) return;
    var st = S.data.status;
    host.innerHTML = FEEDS.map(function (f) {
      var v = st[f.k] || 'idle';
      return '<span class="d-health__dot ' + healthClass(v) + '" title="' + esc(f.name + ' — ' + v) + '">' +
        '<i></i>' + FEED_SHORT[f.k] + '</span>';
    }).join('');
  }

  function sourcesModal() {
    var st = S.data.status;
    var rows = FEEDS.map(function (f) {
      return '<tr><td><b>' + esc(f.name) + '</b><div class="d-hash">' + esc(f.url) + '</div></td>' +
        '<td>' + esc(f.use) + '</td><td>' + feedPill(st[f.k] || 'idle') + '</td></tr>';
    }).join('');
    S.modal({
      eyebrow: 'Provenance', wide: true,
      title: 'Where these numbers come from',
      subtitle: 'Public, key-free endpoints. Anything they cannot answer is filled by the local simulator and labelled as such.',
      body: '<div class="sx-tablewrap"><table class="sx-table" style="min-width:0">' +
        '<thead><tr><th scope="col">Endpoint</th><th scope="col">Used for</th><th scope="col">State</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        '<p class="sx-body" style="margin-top:16px">Protocol-level metrics — settlement volume, fee revenue, agent counts, execution ' +
        'latency — have no public source on testnet. They are produced by a constrained random walk seeded at page load and are marked ' +
        '<span class="d-src d-src--sim">simulated</span> everywhere they appear.</p>',
      actions: [
        { label: 'Retry failed feeds', variant: 'ghost', onClick: retryFeeds },
        { label: 'Close', variant: 'quiet' }
      ]
    });
  }

  function retryFeeds() {
    S.data.fetchTickers(); S.data.fetchChain(); S.data.fetchGecko();
    S.data.fetchTVL(); S.data.fetchSentiment(); S.data.openStream();
    S.toast({ title: 'Re-querying every feed', body: 'Results land in the health strip within a few seconds.' });
  }

  /* ============================================================
     4 · CHART PANEL — TradingView widget + native canvas fallback
     ============================================================ */
  var TV_WARNED = false;
  var TV_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  var TV_TIMEOUT = 4500;
  var INTERVALS = [
    { k: '15m', tv: '15', bn: '15m', label: '15m' },
    { k: '1h', tv: '60', bn: '1h', label: '1H' },
    { k: '4h', tv: '240', bn: '4h', label: '4H' },
    { k: '1d', tv: 'D', bn: '1d', label: '1D' }
  ];
  var SYMS = ['ETH', 'BTC', 'SOL', 'ARB', 'LINK'];

  function chartPanel(host, opts) {
    opts = opts || {};
    var key = 'dash:chart:' + (opts.id || 'a');
    var st = S.store.get(key, { sym: 'ETH', iv: '1h', want: 'tv' });
    if (SYMS.indexOf(st.sym) < 0) st.sym = 'ETH';
    if (!INTERVALS.some(function (i) { return i.k === st.iv; })) st.iv = '1h';
    if (st.want !== 'native') st.want = 'tv';
    /* Only an explicit click changes the remembered renderer — an automatic
       fallback must not quietly opt the user out of TradingView forever. */
    var userWant = st.want;

    var active = null;       /* 'tv' | 'native' */
    var tvFailed = false, toasted = false;
    var candles = null, candlesSim = false, poll = null, tvScript = null;
    var tickScale = 1;       /* maps a simulated tick into simulated-candle space */
    var uid = 'ch-' + (opts.id || Math.random().toString(36).slice(2, 6));

    var art = el('article', { class: 'sx-card d-panel' });
    art.innerHTML =
      '<div class="d-panel__head">' +
      '<div><h2 id="' + uid + '-t">ETH / USDT</h2><p id="' + uid + '-p">Realtime price. TradingView where it loads, native canvas where it does not.</p></div>' +
      '<div class="d-panel__tools d-chart__ctl">' +
      '<div class="sx-tabs" role="group" aria-label="Symbol" id="' + uid + '-syms"></div>' +
      '<div class="sx-tabs" role="group" aria-label="Interval" id="' + uid + '-ivs"></div>' +
      '</div></div>' +
      '<div class="d-chart__frame" data-mode="native" id="' + uid + '-frame">' +
      '<div class="d-chart__tv" id="' + uid + '-tv"></div>' +
      '<div class="d-chart__native"><canvas id="' + uid + '-cv" role="img" aria-label="Candlestick chart"></canvas></div>' +
      '<div class="d-chart__load" id="' + uid + '-load"><i></i><span>initialising…</span></div>' +
      '</div>' +
      '<div class="d-chart__meta" id="' + uid + '-meta"></div>' +
      '<div class="d-panel__foot">' +
      '<span class="d-src" id="' + uid + '-badge">renderer</span>' +
      '<div class="sx-tabs" role="group" aria-label="Chart renderer" id="' + uid + '-mode" style="padding:2px"></div>' +
      '<span id="' + uid + '-note" style="flex:1;min-width:140px"></span>' +
      '</div>';
    host.appendChild(art);

    var frame = $('#' + uid + '-frame'), tvHost = $('#' + uid + '-tv'),
      cv = $('#' + uid + '-cv'), load = $('#' + uid + '-load'),
      metaHost = $('#' + uid + '-meta'), badgeEl = $('#' + uid + '-badge'),
      noteEl = $('#' + uid + '-note'), title = $('#' + uid + '-t');

    /* ---- controls ---- */
    var symBtns = {}, ivBtns = {}, modeBtns = {};
    SYMS.forEach(function (s) {
      var b = el('button', {
        class: 'sx-tab', type: 'button', text: s, 'aria-pressed': String(s === st.sym),
        onclick: function () { if (st.sym === s) return; st.sym = s; save(); paintCtl(); reload(); }
      });
      symBtns[s] = b; $('#' + uid + '-syms').appendChild(b);
    });
    INTERVALS.forEach(function (i) {
      var b = el('button', {
        class: 'sx-tab', type: 'button', text: i.label, 'aria-pressed': String(i.k === st.iv),
        onclick: function () { if (st.iv === i.k) return; st.iv = i.k; save(); paintCtl(); reload(); }
      });
      ivBtns[i.k] = b; $('#' + uid + '-ivs').appendChild(b);
    });
    [['tv', 'TradingView'], ['native', 'Native']].forEach(function (m) {
      var b = el('button', {
        class: 'sx-tab', type: 'button', text: m[1], 'aria-pressed': String(m[0] === st.want),
        onclick: function () {
          st.want = userWant = m[0];
          if (m[0] === 'tv') { tvFailed = false; toasted = false; }
          save(); paintCtl(); reload();
        }
      });
      modeBtns[m[0]] = b; $('#' + uid + '-mode').appendChild(b);
    });

    function save() { S.store.set(key, { sym: st.sym, iv: st.iv, want: userWant }); }
    function paintCtl() {
      SYMS.forEach(function (s) {
        symBtns[s].classList.toggle('is-active', s === st.sym);
        symBtns[s].setAttribute('aria-pressed', String(s === st.sym));
      });
      INTERVALS.forEach(function (i) {
        ivBtns[i.k].classList.toggle('is-active', i.k === st.iv);
        ivBtns[i.k].setAttribute('aria-pressed', String(i.k === st.iv));
      });
      Object.keys(modeBtns).forEach(function (m) {
        modeBtns[m].classList.toggle('is-active', m === st.want);
        modeBtns[m].setAttribute('aria-pressed', String(m === st.want));
      });
      title.textContent = st.sym + ' / USDT';
      cv.setAttribute('aria-label', st.sym + ' to USDT candlestick chart, ' + ivLabel() + ' candles');
    }
    function ivLabel() { return INTERVALS.filter(function (i) { return i.k === st.iv; })[0].label; }
    function ivDef() { return INTERVALS.filter(function (i) { return i.k === st.iv; })[0]; }
    function pair() { return st.sym + 'USDT'; }

    function setLoading(on, msg) {
      load.hidden = !on;
      load.style.display = on ? '' : 'none';
      if (on && msg) load.querySelector('span').textContent = msg;
    }

    /* ---- renderer badge: says which engine is painting, and why ---- */
    function paintBadge() {
      if (active === 'tv') {
        setBadge(badgeEl, 'live', 'tradingview · live');
        noteEl.textContent = 'Advanced Chart widget, ' + pair() + ' on Binance, ' + ivLabel() + ' candles.';
      } else {
        setBadge(badgeEl, candlesSim ? 'sim' : 'live',
          candlesSim ? 'native canvas · simulated candles' : 'native canvas · binance klines');
        noteEl.textContent = tvFailed && st.want === 'tv'
          ? 'TradingView could not load in this browser — swapped to the built-in renderer automatically.'
          : candlesSim
            ? 'Binance klines unreachable; the series below is a seeded random walk, not market data.'
            : 'Rendered locally from Binance klines. No third-party script involved.';
      }
    }

    /* ---- TradingView ---- */
    function clearTV() {
      if (poll) { clearInterval(poll); poll = null; }
      if (tvScript) { tvScript.onerror = null; tvScript = null; }
      tvHost.innerHTML = '';
    }

    function mountTV() {
      clearTV();
      frame.setAttribute('data-mode', 'tv');
      active = 'tv';
      setLoading(true, 'connecting to TradingView…');

      var box = el('div', { class: 'tradingview-widget-container', style: { width: '100%', height: '100%' } });
      var slot = el('div', { class: 'tradingview-widget-container__widget', style: { width: '100%', height: '100%' } });
      box.appendChild(slot);

      var s = document.createElement('script');
      s.src = TV_SRC; s.async = true; s.type = 'text/javascript';
      s.innerHTML = JSON.stringify({
        autosize: true,
        symbol: 'BINANCE:' + pair(),
        interval: ivDef().tv,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        enable_publishing: false,
        allow_symbol_change: false,
        save_image: false,
        hide_volume: false,
        backgroundColor: 'rgba(10,10,15,1)',
        gridColor: 'rgba(255,255,255,0.06)',
        support_host: 'https://www.tradingview.com'
      });
      s.onerror = function () { tvDown('the embed script was blocked'); };
      tvScript = s;
      box.appendChild(s);
      tvHost.appendChild(box);

      var t0 = Date.now();
      poll = setInterval(function () {
        if (tvHost.querySelector('iframe')) {
          clearInterval(poll); poll = null;
          setLoading(false);
          paintBadge();
        } else if (Date.now() - t0 > TV_TIMEOUT) {
          clearInterval(poll); poll = null;
          tvDown('the widget did not respond in ' + (TV_TIMEOUT / 1000) + 's');
        }
      }, 240);
    }

    function tvDown(why) {
      tvFailed = true;
      clearTV();
      /* The control must show what is actually painting, not what was asked
         for — flip the toggle to Native. Picking TradingView again retries. */
      st.want = 'native';
      paintCtl();
      if (!toasted && !TV_WARNED) {
        toasted = true;
        TV_WARNED = true;
        S.toast({
          title: 'TradingView unavailable',
          body: 'Switched to the native renderer — ' + why + '.',
          type: 'warn'
        });
      }
      mountNative();
    }

    /* ---- native canvas ---- */
    var drawT = 0;
    function draw() {
      if (!candles || !candles.length) return;
      /* hidpi() pins the canvas to a pixel size — release it before measuring
         or the chart can shrink but never grow again. */
      cv.style.width = '100%'; cv.style.height = '100%';
      var w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;                              /* hidden view */
      S.candles(cv, candles, { w: w, h: h });
    }
    function drawSoon() {
      var now = Date.now();
      if (now - drawT < 260) return;
      drawT = now; draw();
    }

    function mountNative() {
      clearTV();
      frame.setAttribute('data-mode', 'native');
      active = 'native';
      setLoading(true, 'loading ' + pair() + ' ' + ivLabel() + ' candles…');
      paintBadge();
      var want = pair() + st.iv;
      S.data.fetchCandles(pair(), ivDef().bn, 96).then(function (rows) {
        if (want !== pair() + st.iv) return;             /* a newer request won */
        candles = rows || [];
        candlesSim = S.data.status.binance !== 'ok';
        /* When the series is a local walk it does not share an origin with the
           ticker, so rebase incoming ticks instead of splicing a wild candle in. */
        var last = candles[candles.length - 1];
        var live = (S.data.market[st.sym] || {}).price;
        tickScale = (candlesSim && last && live) ? last.c / live : 1;
        setLoading(false);
        paintBadge();
        draw();
        paintMeta();
      });
    }

    function reload() {
      if (st.want === 'tv' && !tvFailed) mountTV(); else mountNative();
      paintMeta();
    }

    /* ---- meta strip: live market stats for the selected symbol ---- */
    function paintMeta() {
      var m = S.data.market[st.sym];
      if (!m) return;
      var src = marketSrc();
      var cells = [
        ['Last', fmt.price(m.price), 'd-chart__price ' + (m.price >= m.prev ? 'sx-up' : 'sx-down')],
        ['24h', pct(m.change24), cls(m.change24)],
        ['24h high', fmt.price(m.high24), ''],
        ['24h low', fmt.price(m.low24), ''],
        ['24h volume', m.vol24 ? '$' + fmt.compact(m.vol24) : '—', '']
      ];
      if (!metaHost.firstChild) {
        metaHost.innerHTML = cells.map(function (c, i) {
          return '<div><span>' + esc(c[0]) + '</span><b id="' + uid + '-m' + i + '">—</b></div>';
        }).join('') + '<div><span>Source</span><b style="font-size:11px" id="' + uid + '-msrc">—</b></div>';
      }
      cells.forEach(function (c, i) {
        var n = $('#' + uid + '-m' + i);
        if (!n) return;
        n.textContent = c[1];
        n.className = c[2];
      });
      var sn = $('#' + uid + '-msrc');
      if (sn) {
        sn.textContent = src[2];
        sn.title = src[1];
        sn.style.color = src[0] === 'live' ? 'var(--neon-2)' : src[0] === 'down' ? 'var(--crimson)' : 'var(--amber)';
      }
    }

    /* ---- live wiring ---- */
    S.on('tick', function (m) {
      if (m.sym !== st.sym) return;
      paintMeta();
      if (active !== 'native' || !candles || !candles.length) return;
      var last = candles[candles.length - 1];
      var p = m.price * tickScale;
      last.c = p;
      if (p > last.h) last.h = p;
      if (p < last.l) last.l = p;
      drawSoon();
    });
    S.on('market', paintMeta);
    S.on('data:status', function () { if (active === 'native') paintBadge(); paintMeta(); });

    var rzT;
    global.addEventListener('resize', function () {
      clearTimeout(rzT); rzT = setTimeout(draw, 180);
    });

    paintCtl();
    paintMeta();
    reload();

    return { redraw: function () { draw(); paintMeta(); }, el: art };
  }

  /* ============================================================
     5 · SHARED FIXTURES
     ============================================================ */
  var VENUES = [
    { k: 'uniswap', label: 'Uniswap v4', on: true },
    { k: 'curve', label: 'Curve', on: true },
    { k: 'aerodrome', label: 'Aerodrome', on: false },
    { k: 'seaport', label: 'Seaport', on: true },
    { k: 'clob', label: 'Native CLOB', on: true },
    { k: 'transfer', label: 'Transfer agent', on: false }
  ];

  function agentGlyph(kind) {
    var n = '#CCFF00', t = '#00E5A0';
    var body = {
      executor: '<path d="M12 2.5 20 7.5v9L12 21.5 4 16.5v-9Z" fill="none" stroke="' + n + '" stroke-width="1.3"/>' +
        '<path d="M12 7 16 9.5v5L12 17 8 14.5v-5Z" fill="' + n + '" opacity=".3"/><circle cx="12" cy="12" r="1.6" fill="' + t + '"/>',
      analyst: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="' + n + '" stroke-width="1.3"/>' +
        '<path d="M5 15.5 9.5 10l3 3L19 6" fill="none" stroke="' + t + '" stroke-width="1.5"/><circle cx="19" cy="6" r="1.6" fill="' + t + '"/>',
      payment: '<rect x="3.5" y="6" width="17" height="12" rx="2.5" fill="none" stroke="' + n + '" stroke-width="1.3"/>' +
        '<path d="M3.5 10.5h17" stroke="' + n + '" stroke-width="1.3"/><rect x="6.5" y="13" width="5" height="2" fill="' + t + '"/>',
      guardian: '<path d="M12 3 19.5 6v6c0 4-3.2 7.2-7.5 9-4.3-1.8-7.5-5-7.5-9V6Z" fill="none" stroke="' + n + '" stroke-width="1.3"/>' +
        '<path d="M8.5 12 11 14.5 15.8 9.6" fill="none" stroke="' + t + '" stroke-width="1.6"/>',
      research: '<circle cx="10" cy="10" r="5.5" fill="none" stroke="' + n + '" stroke-width="1.3"/>' +
        '<path d="M14.2 14.2 20 20" stroke="' + t + '" stroke-width="1.6"/><path d="M7.5 10h5M10 7.5v5" stroke="' + n + '" stroke-width="1.1"/>'
    }[kind] || '<circle cx="12" cy="12" r="8" fill="none" stroke="' + n + '" stroke-width="1.3"/>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }

  function statusPill(s) {
    var map = {
      live: ['live', 'LIVE'], idle: ['idle', 'IDLE'], paused: ['warn', 'PAUSED'], revoked: ['err', 'REVOKED'],
      settled: ['live', 'SETTLED'], pending: ['idle', 'PENDING'], held: ['warn', 'HELD'], failed: ['err', 'FAILED'],
      active: ['live', 'ACTIVE'], probation: ['warn', 'PROBATION'], slashed: ['err', 'SLASHED']
    }[s] || ['idle', String(s).toUpperCase()];
    return '<span class="sx-status sx-status--' + map[0] + '"><i></i>' + map[1] + '</span>';
  }

  /* Generic table sorter: wires <th data-sort> buttons. */
  function sortable(table, state, render) {
    function paintHead() {
      $$('th[data-sort]', table).forEach(function (th) {
        var on = th.getAttribute('data-sort') === state.key;
        if (on) th.setAttribute('aria-sort', state.dir === 'asc' ? 'ascending' : 'descending');
        else th.removeAttribute('aria-sort');
        var m = $('.d-sort', th);
        if (m) m.textContent = on ? (state.dir === 'asc' ? '↑' : '↓') : '↕';
      });
    }
    $$('th[data-sort] button', table).forEach(function (b) {
      var th = b.closest('th'), k = th.getAttribute('data-sort');
      b.addEventListener('click', function () {
        if (state.key === k) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
        else { state.key = k; state.dir = 'desc'; }
        paintHead();
        render();
      });
    });
    paintHead();
  }
  function sortRows(rows, state) {
    if (!state.key) return rows;
    var k = state.key, s = state.dir === 'asc' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var x = a[k], y = b[k];
      if (typeof x === 'string') return s * x.localeCompare(y);
      return s * ((x || 0) - (y || 0));
    });
  }

  function tabs(host, items, current, onPick) {
    host.innerHTML = '';
    items.forEach(function (i) {
      host.appendChild(el('button', {
        class: 'sx-tab' + (i.k === current ? ' is-active' : ''), type: 'button', text: i.label,
        'data-k': i.k, 'aria-pressed': String(i.k === current),
        onclick: function () {
          $$('button', host).forEach(function (b) {
            var on = b.getAttribute('data-k') === i.k;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', String(on));
          });
          onPick(i.k);
        }
      }));
    });
  }

  /* ============================================================
     6 · APP — data model
     ============================================================ */
  var rnd = S.rng(880417);

  var HOLDINGS = [
    { sym: 'ETH', name: 'Ethereum', qty: 18.4207, cost: 2764.10, color: '#CCFF00' },
    { sym: 'BTC', name: 'Bitcoin', qty: 0.7418, cost: 78420.00, color: '#FF9900' },
    { sym: 'SOL', name: 'Solana', qty: 412.60, cost: 151.20, color: '#00E5A0' },
    { sym: 'ARB', name: 'Arbitrum', qty: 62400, cost: 0.7130, color: '#E4FF4D' },
    { sym: 'LINK', name: 'Chainlink', qty: 1980, cost: 15.42, color: '#7FB400' },
    { sym: 'USDC', name: 'USD Coin', qty: 74250, cost: 1, color: '#8A8B9E', stable: true }
  ];

  function priceOf(h) { return h.stable ? 1 : (S.data.market[h.sym] || {}).price || 0; }
  function chOf(h) { return h.stable ? 0 : (S.data.market[h.sym] || {}).change24 || 0; }

  function book() {
    var val = 0, prev = 0, cost = 0;
    HOLDINGS.forEach(function (h) {
      var p = priceOf(h), c = chOf(h);
      val += h.qty * p;
      prev += h.qty * (c ? p / (1 + c / 100) : p);
      cost += h.qty * h.cost;
    });
    return { val: val, prev: prev, cost: cost, d24: val - prev, d24p: prev ? ((val - prev) / prev) * 100 : 0, pnl: val - cost, pnlp: cost ? ((val - cost) / cost) * 100 : 0 };
  }

  /* 7d series: CoinGecko when it answered, otherwise a seeded walk (labelled). */
  var sparkCache = {};
  function spark7(h) {
    var m = S.data.market[h.sym];
    if (m && m.spark && m.spark.length > 4) return { data: m.spark, live: true };
    if (!sparkCache[h.sym]) {
      var r = S.rng(h.sym.split('').reduce(function (a, c) { return a * 31 + c.charCodeAt(0); }, 7) >>> 0);
      var p = priceOf(h) || h.cost, out = [];
      for (var i = 0; i < 56; i++) { p *= 1 + (r() - 0.5) * (h.stable ? 0.0006 : 0.022); out.push(p); }
      out.push(priceOf(h) || p);
      sparkCache[h.sym] = out;
    }
    return { data: sparkCache[h.sym], live: false };
  }

  var MY_AGENTS = [
    {
      id: 'atlas-7', name: 'Atlas-7', role: 'Market Analyst', art: 'analyst', status: 'live',
      rep: 982, rev: 128400, runs: 41822, succ: 99.42, cap: 12000, spent: 4180, latency: 288,
      scope: 'quote · simulate · execute', venues: ['uniswap', 'curve', 'clob'],
      desc: 'Reads order flow across 14 venues and publishes a signed thesis before every execution it recommends. Cannot move funds without a passing policy check.'
    },
    {
      id: 'vega-prime', name: 'Vega-Prime', role: 'Trading Executor', art: 'executor', status: 'live',
      rep: 968, rev: 402100, runs: 128904, succ: 99.11, cap: 25000, spent: 18240, latency: 214,
      scope: 'execute · split · reroute', venues: ['uniswap', 'clob', 'aerodrome'],
      desc: 'Latency-optimised solver client. Splits large intents across venues to keep realised slippage inside your band, and aborts the whole route if any leg would exceed it.'
    },
    {
      id: 'nyx-04', name: 'Nyx-04', role: 'Payment Agent', art: 'payment', status: 'idle',
      rep: 941, rev: 96300, runs: 88210, succ: 99.87, cap: 8000, spent: 640, latency: 342,
      scope: 'pay · schedule', venues: ['transfer'],
      desc: 'Handles invoices, payroll and subscription renewals with per-counterparty allowances that expire on schedule rather than living forever.'
    },
    {
      id: 'aegis-1', name: 'Aegis-1', role: 'Portfolio Guardian', art: 'guardian', status: 'live',
      rep: 995, rev: 174800, runs: 22940, succ: 99.96, cap: 40000, spent: 0, latency: 176,
      scope: 'monitor · force-unwind', venues: ['uniswap', 'curve', 'clob'],
      desc: 'Watches every position against your risk policy and can force-unwind before a breach becomes a loss. Only agent permitted to exceed the per-tx cap, and only downward.'
    },
    {
      id: 'sable-9', name: 'Sable-9', role: 'NFT Sniper', art: 'analyst', status: 'paused',
      rep: 903, rev: 61200, runs: 15402, succ: 97.30, cap: 6000, spent: 0, latency: 402,
      scope: 'bid · cancel', venues: ['seaport'],
      desc: 'Monitors Seaport listings and places scoped bids the moment a floor condition is met. Approvals are sized per order and revoked on expiry.'
    },
    {
      id: 'meridian', name: 'Meridian', role: 'RWA Desk', art: 'research', status: 'idle',
      rep: 974, rev: 211500, runs: 30188, succ: 98.84, cap: 15000, spent: 2100, latency: 508,
      scope: 'quote · execute · settle', venues: ['transfer', 'clob'],
      desc: 'Bridges tokenized equity legs with crypto collateral in a single atomic intent. Equity side settles through a regulated transfer agent.'
    }
  ];

  /* ---- transaction ledger ----
     Action, venue and notional stay internally consistent: an NFT bid only
     ever lands on Seaport, an invoice only on the transfer agent, and the
     quantity shown is the notional divided by the price at execution. */
  var TX_AGENTS = MY_AGENTS.map(function (a) { return a.name; });
  var TX_KINDS = [
    { k: 'buy', venues: ['Uniswap v4', 'Curve', 'Native CLOB', 'Aerodrome'] },
    { k: 'sell', venues: ['Uniswap v4', 'Curve', 'Native CLOB', 'Aerodrome'] },
    { k: 'swap', venues: ['Uniswap v4', 'Curve', 'Aerodrome'] },
    { k: 'bid', venues: ['Seaport'] },
    { k: 'pay', venues: ['Transfer agent'] }
  ];
  var TX = [];
  var txScale = 1;

  function qtyStr(q) { return q >= 1000 ? fmt.n(q, 0) : q >= 1 ? fmt.n(q, 3) : fmt.n(q, 4); }

  function makeTx(ts, forceStatus) {
    var sym = ['ETH', 'BTC', 'SOL', 'ARB', 'LINK'][Math.floor(rnd() * 5)];
    var kind = TX_KINDS[Math.floor(rnd() * TX_KINDS.length)];
    var usd = Math.round((rnd() * 9400 + 180) * txScale * 100) / 100;
    var px = (S.data.market[sym] || {}).price || 1;
    var eth = (S.data.market.ETH || {}).price || 3000;
    var action;
    if (kind.k === 'buy') action = 'Buy ' + qtyStr(usd / px) + ' ' + sym;
    else if (kind.k === 'sell') action = 'Sell ' + qtyStr(usd / px) + ' ' + sym;
    else if (kind.k === 'swap') action = 'Swap ' + fmt.n(usd, 0) + ' USDC → ' + sym;
    else if (kind.k === 'bid') action = 'Bid ' + (usd / eth).toFixed(3) + ' WETH · collection floor';
    else action = 'Pay invoice · 0x' + hex(4, rnd) + '…' + hex(4, rnd);
    var r = rnd();
    var status = forceStatus || (r < 0.74 ? 'settled' : r < 0.86 ? 'pending' : r < 0.95 ? 'held' : 'failed');
    return {
      id: 'tx' + Math.random().toString(36).slice(2, 9),
      hash: '0x' + hex(40, rnd),
      agent: TX_AGENTS[Math.floor(rnd() * TX_AGENTS.length)],
      action: action, sym: kind.k === 'pay' ? 'USDC' : sym, kind: kind.k,
      venue: kind.venues[Math.floor(rnd() * kind.venues.length)],
      usd: usd, status: status, ts: ts,
      gas: Math.round((rnd() * 26 + 4) * 100) / 100,
      slip: Math.round(rnd() * 42) / 100,
      latency: Math.round(140 + rnd() * 520)
    };
  }

  function seedTx() {
    var now = Date.now();
    for (var i = 0; i < 46; i++) TX.push(makeTx(now - Math.round((i + 1) * (rnd() * 620000 + 90000))));
    TX.sort(function (a, b) { return b.ts - a.ts; });
    /* Rescale so the day's settled notional lands inside the committed cap —
       a console that opens already 600% over its own limit tells a lie. */
    var today = spendToday();
    if (today > 0) {
      txScale = clamp((POLICY.day * 0.62) / today, 0.04, 4);
      TX.forEach(function (t) { t.usd = Math.round(t.usd * txScale * 100) / 100; });
      rebuildActions();
    }
  }

  function rebuildActions() {
    TX.forEach(function (t) {
      var px = (S.data.market[t.sym] || {}).price || 1;
      var eth = (S.data.market.ETH || {}).price || 3000;
      if (t.kind === 'buy') t.action = 'Buy ' + qtyStr(t.usd / px) + ' ' + t.sym;
      else if (t.kind === 'sell') t.action = 'Sell ' + qtyStr(t.usd / px) + ' ' + t.sym;
      else if (t.kind === 'swap') t.action = 'Swap ' + fmt.n(t.usd, 0) + ' USDC → ' + t.sym;
      else if (t.kind === 'bid') t.action = 'Bid ' + (t.usd / eth).toFixed(3) + ' WETH · collection floor';
    });
  }

  /* ---- policy ---- */
  var POLICY = S.store.get('dash:policy', null) || {
    day: 25000, tx: 5000, slip: 50, human: true,
    venues: VENUES.filter(function (v) { return v.on; }).map(function (v) { return v.k; })
  };
  VENUES.forEach(function (v) { v.on = POLICY.venues.indexOf(v.k) >= 0; });

  function policyHash(p) {
    var str = JSON.stringify([p.day, p.tx, p.slip, p.human, p.venues.slice().sort()]);
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      h1 ^= str.charCodeAt(i); h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 ^ (str.charCodeAt(i) * 31)) >>> 0; h2 = (h2 * 0x85ebca6b) >>> 0;
    }
    var a = h1.toString(16).padStart(8, '0'), b = h2.toString(16).padStart(8, '0');
    return '0x' + a + b + b + a + a + b + b + a;
  }

  /* ============================================================
     7 · APP — views
     ============================================================ */
  function initApp() {
    seedTx();
    viewOverview();
    viewAgents();
    viewPortfolio();
    viewTransactions();
    viewPolicy();
    viewSettings();
  }

  /* ---------- OVERVIEW ---------- */
  function viewOverview() {
    var kpiHost = $('#ov-kpis');
    kpiHost.innerHTML = [
      ['Book value', 'ov-val', 'ov-val-d'],
      ['24h change', 'ov-d24', 'ov-d24-d'],
      ['Unrealised P&L', 'ov-pnl', 'ov-pnl-d'],
      ['Agents live', 'ov-live', 'ov-live-d'],
      ['Spend today', 'ov-spend', 'ov-spend-d']
    ].map(function (k) {
      return '<div class="d-kpi"><div class="sx-stat"><span class="sx-stat__k">' + k[0] + '</span>' +
        '<span class="sx-stat__v" id="' + k[1] + '">—</span></div>' +
        '<div class="d-kpi__d" id="' + k[2] + '"></div></div>';
    }).join('');

    var chart = chartPanel($('#ov-chart'), { id: 'ov' });
    whenShown('overview', chart.redraw);

    function paintKpis() {
      var b = book();
      S.setNum($('#ov-val'), b.val, function (v) { return fmt.usd(v, 0); });
      S.setNum($('#ov-d24'), b.d24, function (v) { return (v >= 0 ? '+' : '−') + fmt.usd(Math.abs(v), 0); });
      S.setNum($('#ov-pnl'), b.pnl, function (v) { return (v >= 0 ? '+' : '−') + fmt.usd(Math.abs(v), 0); });
      $('#ov-d24').className = 'sx-stat__v ' + cls(b.d24);
      $('#ov-pnl').className = 'sx-stat__v ' + cls(b.pnl);

      var src = marketSrc();
      $('#ov-val-d').innerHTML = badge(src[0], src[2]);
      $('#ov-d24-d').innerHTML = '<span class="' + cls(b.d24p) + '">' + pct(b.d24p) + '</span><span class="sx-dim">vs 24h ago</span>';
      $('#ov-pnl-d').innerHTML = '<span class="' + cls(b.pnlp) + '">' + pct(b.pnlp) + '</span><span class="sx-dim">cost ' + fmt.usdC(b.cost) + '</span>';

      var live = MY_AGENTS.filter(function (a) { return a.status === 'live'; }).length;
      var act = MY_AGENTS.filter(function (a) { return a.status !== 'revoked'; }).length;
      txt($('#ov-live'), live + ' / ' + act);
      $('#ov-live-d').innerHTML = badge('sim', 'simulated') + '<span class="sx-dim">' +
        MY_AGENTS.filter(function (a) { return a.status === 'paused'; }).length + ' paused</span>';

      var spent = spendToday();
      S.setNum($('#ov-spend'), spent, function (v) { return fmt.usd(v, 0); });
      var u = POLICY.day ? clamp(spent / POLICY.day, 0, 1) : 0;
      $('#ov-spend-d').innerHTML = '<span class="sx-dim">' + (u * 100).toFixed(0) + '% of ' + fmt.usd(POLICY.day, 0) + ' cap</span>';

      setBadge($('#ov-price-src'), src[0], src[1]);
    }

    function paintAgents() {
      $('#ov-agents').innerHTML = MY_AGENTS.map(function (a) {
        return '<button class="d-mini__row" type="button" data-agent="' + a.id + '">' +
          '<i class="d-dot d-dot--' + a.status + '"></i>' +
          '<span><b>' + esc(a.name) + '</b> <em>' + esc(a.role) + '</em></span>' +
          '<span class="d-mini__v">' + fmt.usdC(a.rev) + '</span></button>';
      }).join('');
      $$('#ov-agents [data-agent]').forEach(function (b) {
        b.addEventListener('click', function () { openAgent(byId(b.getAttribute('data-agent'))); });
      });
    }

    function paintQuick() {
      var m = S.data.sim.metrics;
      var mine = MY_AGENTS.filter(function (a) { return a.status !== 'revoked'; });
      var avgLat = mine.reduce(function (s, a) { return s + a.latency; }, 0) / (mine.length || 1);
      var avgSucc = mine.reduce(function (s, a) { return s + a.succ; }, 0) / (mine.length || 1);
      var since = Date.now() - 86400000;
      var day = TX.filter(function (t) { return t.ts >= since; });
      var mtd = day.filter(function (t) { return t.status === 'settled'; })
        .reduce(function (s, t) { return s + t.usd; }, 0);
      $('#ov-quick').innerHTML = [
        ['Median settle', Math.round(avgLat) + ' ms'],
        ['Success rate', avgSucc.toFixed(2) + '%'],
        ['Executions · 24h', fmt.n(day.length, 0)],
        ['Notional settled · 24h', fmt.usd(mtd, 0)],
        ['Refused by policy · 24h', fmt.n(day.filter(function (t) { return t.status === 'held'; }).length, 0)],
        ['Protocol latency', Math.round(m.execMs) + ' ms']
      ].map(function (r) {
        return '<div class="d-kv"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
      }).join('');
    }

    /* activity feed */
    var feedOn = true;
    var feedHost = $('#ov-feed');
    function pushFeed(agoMs) {
      if (!feedOn) return;
      var e = S.data.randomEvent();
      var agent = MY_AGENTS[Math.floor(rnd() * MY_AGENTS.length)];
      var row = el('div', { class: 'sx-feed__row' + (agoMs ? '' : ' is-new') + (e.kind === 'warn' ? ' d-feed__row--warn' : '') }, [
        el('span', { class: 'sx-status sx-status--' + (e.kind === 'warn' ? 'warn' : 'live') }, [el('i')]),
        el('span', { class: 'd-feed__agent', text: agent.name }),
        el('span', { text: e.text }),
        el('span', { class: 'd-feed__d', text: e.detail }),
        el('span', { class: 'sx-feed__t', text: fmt.clock(e.ts - (agoMs || 0)) })
      ]);
      feedHost.insertBefore(row, feedHost.firstChild);
      while (feedHost.children.length > 14) feedHost.lastChild.remove();
      setTimeout(function () { row.classList.remove('is-new'); }, 700);
    }
    /* Backfill oldest-first so the seeded rows carry believable clock times. */
    for (var i = 8; i > 0; i--) pushFeed(i * 3400 + Math.round(rnd() * 2000));
    setInterval(function () { if (route === 'overview') pushFeed(); }, 3200);

    $('#ov-feed-toggle').addEventListener('click', function () {
      feedOn = !feedOn;
      this.setAttribute('aria-pressed', String(!feedOn));
      this.textContent = feedOn ? 'Pause' : 'Resume';
      S.toast({ title: feedOn ? 'Feed resumed' : 'Feed paused', body: feedOn ? '' : 'New events keep arriving in the ledger.' });
    });

    paintKpis(); paintAgents(); paintQuick();
    S.on('tick', function () { if (route === 'overview') paintKpis(); });
    S.on('market', paintKpis);
    S.on('data:status', paintKpis);
    S.on('sim', function () { if (route === 'overview') paintQuick(); });
    S.on('dash:agents', function () { paintAgents(); paintKpis(); });
    S.on('dash:policy', paintKpis);
    S.on('dash:tx', function () { if (route === 'overview') { paintKpis(); paintQuick(); } });
  }

  function byId(id) { return MY_AGENTS.filter(function (a) { return a.id === id; })[0]; }
  function spendToday() {
    var t0 = startOfDay();
    return TX.filter(function (t) { return t.ts >= t0 && t.status === 'settled'; })
      .reduce(function (s, t) { return s + t.usd; }, 0);
  }

  /* ---------- AGENTS ---------- */
  function viewAgents() {
    var q = '', filter = 'all', sort = 'rev';
    var grid = $('#ag-grid'), empty = $('#ag-empty'), count = $('#ag-count');
    var TABS = [
      { k: 'all', label: 'All' }, { k: 'live', label: 'Live' }, { k: 'idle', label: 'Idle' },
      { k: 'paused', label: 'Paused' }, { k: 'revoked', label: 'Revoked' }
    ];

    tabs($('#ag-tabs'), TABS, 'all', function (k) { filter = k; render(); });

    $('#ag-search').addEventListener('input', function () { q = this.value.trim().toLowerCase(); render(); });
    $('#ag-sort').addEventListener('change', function () { sort = this.value; render(); });

    function clearFilters() {
      q = ''; filter = 'all'; $('#ag-search').value = '';
      tabs($('#ag-tabs'), TABS, 'all', function (k) { filter = k; render(); });
      render();
    }
    $('#ag-reset').addEventListener('click', clearFilters);
    $('#ag-clear').addEventListener('click', clearFilters);

    function render() {
      var rows = MY_AGENTS.filter(function (a) {
        if (filter !== 'all' && a.status !== filter) return false;
        if (!q) return true;
        return (a.name + ' ' + a.role + ' ' + a.scope + ' ' + a.venues.join(' ')).toLowerCase().indexOf(q) >= 0;
      });
      rows = rows.slice().sort(function (a, b) {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'rep') return b.rep - a.rep;
        if (sort === 'runs') return b.runs - a.runs;
        return b.rev - a.rev;
      });
      count.textContent = rows.length + ' of ' + MY_AGENTS.length + ' agents';
      empty.hidden = rows.length > 0;
      grid.hidden = rows.length === 0;
      $('#ag-clear').hidden = !q && filter === 'all';
      grid.innerHTML = rows.map(card).join('');
      $$('[data-agent]', grid).forEach(function (n) {
        n.addEventListener('click', function () { openAgent(byId(n.getAttribute('data-agent'))); });
      });
    }

    function card(a) {
      var util = a.cap ? clamp(a.spent / a.cap, 0, 1) : 0;
      var meter = util > 0.85 ? 'sx-meter--danger' : util > 0.6 ? 'sx-meter--warn' : '';
      return '<button class="sx-card sx-card--hover d-agent' + (a.status === 'paused' ? ' is-paused' : a.status === 'revoked' ? ' is-revoked' : '') +
        '" type="button" data-agent="' + a.id + '" aria-label="' + esc(a.name + ' — ' + a.role + ', open detail') + '">' +
        '<span class="sx-card__sheen"></span>' +
        '<div class="d-agent__top">' +
        '<span class="d-agent__glyph">' + agentGlyph(a.art) + '</span>' +
        '<span class="d-agent__id"><b>' + esc(a.name) + '</b><em>' + esc(a.role) + '</em></span>' +
        statusPill(a.status) +
        '</div>' +
        '<div class="d-agent__bar"><span>REP</span><span class="sx-meter"><i style="width:' + (a.rep / 10).toFixed(1) + '%"></i></span><b>' + a.rep + '</b></div>' +
        '<div class="d-agent__rows">' +
        '<div class="d-agent__row"><span>Revenue 30d</span><b>' + fmt.usdC(a.rev) + '</b></div>' +
        '<div class="d-agent__row"><span>Executions</span><b>' + fmt.n(a.runs, 0) + '</b></div>' +
        '<div class="d-agent__row"><span>Success</span><b>' + a.succ.toFixed(2) + '%</b></div>' +
        '<div class="d-agent__row"><span>Median settle</span><b>' + a.latency + ' ms</b></div>' +
        '</div>' +
        '<div class="d-agent__bar"><span>CAP</span><span class="sx-meter ' + meter + '"><i style="width:' + (util * 100).toFixed(1) + '%"></i></span>' +
        '<b>' + fmt.usdC(a.spent) + ' / ' + fmt.usdC(a.cap) + '</b></div>' +
        '</button>';
    }

    render();
    S.on('dash:agents', render);
  }

  function openAgent(a) {
    if (!a) return;
    var body = el('div');
    function paint() {
      body.innerHTML =
        '<div class="sx-between" style="align-items:flex-start;gap:14px">' +
        '<p class="sx-body" style="max-width:52ch">' + esc(a.desc) + '</p>' + statusPill(a.status) + '</div>' +
        '<div class="sx-tablewrap" style="margin-top:18px"><table class="sx-table" style="min-width:0"><tbody>' +
        row('Agent ID', '<span class="sx-mono">' + esc(a.id) + '</span>') +
        row('Reputation', a.rep + ' / 1000') +
        row('Executions', fmt.n(a.runs, 0) + ' · ' + a.succ.toFixed(2) + '% success') +
        row('Revenue 30d', fmt.usd(a.rev, 0)) +
        row('Median settle', a.latency + ' ms') +
        row('Daily allowance', fmt.usd(a.spent, 0) + ' used of ' + fmt.usd(a.cap, 0)) +
        row('Capabilities', esc(a.scope)) +
        row('Venues', a.venues.map(function (v) {
          var def = VENUES.filter(function (x) { return x.k === v; })[0];
          var on = def && def.on;
          return '<span class="sx-pill sx-pill--static' + (on ? ' is-on' : '') + '">' + esc(def ? def.label : v) + (on ? '' : ' · blocked') + '</span>';
        }).join(' ')) +
        '</tbody></table></div>' +
        '<p class="sx-body" style="margin-top:16px;font-size:12.5px">' +
        'Telemetry is simulated. Pausing stops the agent accepting new intents immediately; revoking burns its allowance and requires a new policy commit to restore.</p>';
    }
    function row(k, v) { return '<tr><td style="color:var(--gray);width:38%">' + k + '</td><td>' + v + '</td></tr>'; }
    paint();

    var m = S.modal({
      eyebrow: a.role, title: a.name, wide: true,
      subtitle: 'Scoped to policy ' + fmt.addr(policyHash(POLICY), 10, 6),
      body: body,
      actions: [
        {
          label: 'Copy agent ID', variant: 'quiet', close: false,
          onClick: function () { S.copy(a.id, 'Agent ID copied'); }
        },
        {
          label: a.status === 'paused' ? 'Resume agent' : 'Pause agent',
          variant: 'ghost', close: false,
          onClick: function (api) {
            if (a.status === 'revoked') { S.toast({ title: 'Agent is revoked', body: 'Commit a new policy to re-register it.', type: 'warn' }); return; }
            a.status = a.status === 'paused' ? (a.spent > 0 ? 'live' : 'idle') : 'paused';
            paint();
            var btn = $$('.sx-modal__foot .sx-btn', api.el)[1];
            if (btn) btn.textContent = a.status === 'paused' ? 'Resume agent' : 'Pause agent';
            S.emit('dash:agents', MY_AGENTS);
            S.toast({ title: a.status === 'paused' ? a.name + ' paused' : a.name + ' resumed',
              body: a.status === 'paused' ? 'It will not accept new intents until resumed.' : 'Back in the rotation.' });
          }
        },
        {
          label: 'Revoke allowance', variant: 'danger', close: false,
          onClick: function (api) {
            api.close();
            S.confirm({
              title: 'Revoke ' + a.name + '?',
              subtitle: 'This burns the agent’s spend allowance immediately.',
              body: 'In-flight intents are cancelled and the agent drops out of the executor set. Restoring it requires committing a new policy — the old hash will not authorise it again.',
              okLabel: 'Revoke allowance', danger: true
            }).then(function (ok) {
              if (!ok) return;
              a.status = 'revoked'; a.spent = 0;
              S.emit('dash:agents', MY_AGENTS);
              S.toast({ title: a.name + ' revoked', body: 'Allowance burned. Policy hash unchanged.', type: 'warn' });
            });
          }
        }
      ]
    });
    return m;
  }

  /* ---------- PORTFOLIO ---------- */
  function viewPortfolio() {
    var chart = chartPanel($('#pf-chart'), { id: 'pf' });
    var sortState = { key: 'val', dir: 'desc' };

    $('#pf-kpis').innerHTML = [
      ['Book value', 'pf-val'], ['24h change', 'pf-d24'], ['Unrealised P&L', 'pf-pnl'],
      ['Cost basis', 'pf-cost'], ['Assets', 'pf-n']
    ].map(function (k) {
      return '<div class="d-kpi"><div class="sx-stat"><span class="sx-stat__k">' + k[0] + '</span>' +
        '<span class="sx-stat__v" id="' + k[1] + '">—</span></div><div class="d-kpi__d" id="' + k[1] + '-d"></div></div>';
    }).join('');

    sortable($('#pf-table'), sortState, paintTable);

    $('#pf-export').addEventListener('click', function () {
      var lines = ['asset,quantity,price_usd,change_24h_pct,value_usd,unrealised_usd'];
      HOLDINGS.forEach(function (h) {
        var p = priceOf(h);
        lines.push([h.sym, h.qty, p.toFixed(6), chOf(h).toFixed(2), (h.qty * p).toFixed(2), (h.qty * (p - h.cost)).toFixed(2)].join(','));
      });
      S.copy(lines.join('\n'), 'Holdings copied as CSV');
    });

    function paintKpis() {
      var b = book();
      S.setNum($('#pf-val'), b.val, function (v) { return fmt.usd(v, 0); });
      S.setNum($('#pf-d24'), b.d24, function (v) { return (v >= 0 ? '+' : '−') + fmt.usd(Math.abs(v), 0); });
      S.setNum($('#pf-pnl'), b.pnl, function (v) { return (v >= 0 ? '+' : '−') + fmt.usd(Math.abs(v), 0); });
      S.setNum($('#pf-cost'), b.cost, function (v) { return fmt.usd(v, 0); });
      txt($('#pf-n'), String(HOLDINGS.length));
      $('#pf-d24').className = 'sx-stat__v ' + cls(b.d24);
      $('#pf-pnl').className = 'sx-stat__v ' + cls(b.pnl);
      var src = marketSrc();
      $('#pf-val-d').innerHTML = badge(src[0], src[2]);
      $('#pf-d24-d').innerHTML = '<span class="' + cls(b.d24p) + '">' + pct(b.d24p) + '</span>';
      $('#pf-pnl-d').innerHTML = '<span class="' + cls(b.pnlp) + '">' + pct(b.pnlp) + '</span>';
      $('#pf-cost-d').innerHTML = badge('sim', 'simulated basis');
      $('#pf-n-d').innerHTML = '<span class="sx-dim">1 stable · ' + (HOLDINGS.length - 1) + ' volatile</span>';
      setBadge($('#pf-src'), src[0], src[1]);
      setBadge($('#pf-foot-src'), src[0], src[1]);
    }

    function paintDonut() {
      var b = book();
      var segs = HOLDINGS.map(function (h) {
        return { label: h.sym, value: h.qty * priceOf(h), color: h.color };
      }).filter(function (s) { return s.value > 0; });
      var size = 208;
      $('#pf-donut').innerHTML = S.donutSVG(segs, { size: size, stroke: 22, label: 'Portfolio allocation by asset' }) +
        '<div class="d-alloc__mid"><span>Book value</span><b>' + fmt.usdC(b.val) + '</b></div>';
      var total = segs.reduce(function (s, x) { return s + x.value; }, 0) || 1;
      $('#pf-legend').innerHTML = segs.slice().sort(function (x, y) { return y.value - x.value; }).map(function (s) {
        return '<div class="d-legend__row"><span class="d-legend__sw" style="background:' + s.color + '"></span>' +
          '<span>' + esc(s.label) + '</span><em>' + ((s.value / total) * 100).toFixed(1) + '%</em>' +
          '<b>' + fmt.usdC(s.value) + '</b></div>';
      }).join('');
    }

    function paintTable() {
      var rows = HOLDINGS.map(function (h) {
        var p = priceOf(h), c = chOf(h), val = h.qty * p;
        return { h: h, sym: h.sym, qty: h.qty, price: p, ch: c, val: val, pnl: h.qty * (p - h.cost) };
      });
      rows = sortRows(rows, sortState);
      $('#pf-body').innerHTML = rows.map(function (r) {
        return '<tr data-row="' + esc(r.sym) + '">' +
          '<td><b>' + esc(r.sym) + '</b><div class="d-hash">' + esc(r.h.name) + '</div></td>' +
          '<td class="num">' + fmt.n(r.qty, r.qty >= 1000 ? 0 : 4) + '</td>' +
          '<td class="num" data-c="px">' + fmt.price(r.price) + '</td>' +
          '<td class="num ' + cls(r.ch) + '" data-c="ch">' + pct(r.ch) + '</td>' +
          '<td class="num" data-c="val">' + fmt.usd(r.val, 0) + '</td>' +
          '<td class="num ' + cls(r.pnl) + '" data-c="pnl">' + (r.pnl >= 0 ? '+' : '−') + fmt.usd(Math.abs(r.pnl), 0) + '</td>' +
          '<td><canvas class="d-spark" data-spark="' + esc(r.sym) + '"></canvas></td>' +
          '</tr>';
      }).join('');
      paintSparks();
    }

    function paintSparks() {
      $$('#pf-body [data-spark]').forEach(function (cv) {
        var h = HOLDINGS.filter(function (x) { return x.sym === cv.getAttribute('data-spark'); })[0];
        if (!h) return;
        var s = spark7(h);
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', h.sym + ' 7 day price series' + (s.live ? ' from CoinGecko' : ' — simulated'));
        cv.title = s.live ? '7d · CoinGecko' : '7d · simulated (CoinGecko unreachable)';
        S.sparkline(cv, s.data, { w: 74, h: 26, color: s.live ? undefined : '#8A8B9E', lw: 1.3, dot: false });
      });
    }

    /* Update the whole row in place on every tick — a fresh price next to a
       stale value column is worse than no update at all. */
    function paintPrices() {
      $$('#pf-body tr[data-row]').forEach(function (tr) {
        var h = HOLDINGS.filter(function (x) { return x.sym === tr.getAttribute('data-row'); })[0];
        if (!h) return;
        var m = S.data.market[h.sym] || {};
        var p = priceOf(h), c = chOf(h), val = h.qty * p, pnl = h.qty * (p - h.cost);
        var px = $('[data-c="px"]', tr), ch = $('[data-c="ch"]', tr),
          vl = $('[data-c="val"]', tr), pl = $('[data-c="pnl"]', tr);
        var now = fmt.price(p);
        if (px && px.textContent !== now) {
          px.textContent = now;
          if (PREFS.flash) S.flash(px, m.price >= m.prev);
        }
        if (ch) { ch.textContent = pct(c); ch.className = 'num ' + cls(c); }
        if (vl) vl.textContent = fmt.usd(val, 0);
        if (pl) { pl.textContent = (pnl >= 0 ? '+' : '−') + fmt.usd(Math.abs(pnl), 0); pl.className = 'num ' + cls(pnl); }
      });
    }

    function paintAll() { paintKpis(); paintDonut(); paintTable(); }
    paintAll();

    whenShown('portfolio', function () { chart.redraw(); paintSparks(); });
    S.on('tick', function () { if (route === 'portfolio') { paintKpis(); paintPrices(); paintDonut(); } });
    S.on('market', function () { if (route === 'portfolio') paintAll(); else paintKpis(); });
    S.on('data:status', paintKpis);
  }

  /* ---------- TRANSACTIONS ---------- */
  function viewTransactions() {
    var q = '', filter = 'all', liveOn = true;
    var body = $('#tx-body'), empty = $('#tx-empty'), count = $('#tx-count');

    var TABS = [
      { k: 'all', label: 'All' }, { k: 'settled', label: 'Settled' }, { k: 'pending', label: 'Pending' },
      { k: 'held', label: 'Held' }, { k: 'failed', label: 'Failed' }
    ];
    tabs($('#tx-tabs'), TABS, 'all', function (k) { filter = k; render(); });

    $('#tx-search').addEventListener('input', function () { q = this.value.trim().toLowerCase(); render(); });
    function clearFilters() {
      q = ''; filter = 'all'; $('#tx-search').value = '';
      tabs($('#tx-tabs'), TABS, 'all', function (k) { filter = k; render(); });
      render();
    }
    $('#tx-reset').addEventListener('click', clearFilters);
    $('#tx-clear').addEventListener('click', clearFilters);
    $('#tx-live').addEventListener('click', function () {
      liveOn = !liveOn;
      this.setAttribute('aria-pressed', String(liveOn));
      this.textContent = liveOn ? 'Live · on' : 'Live · off';
      S.toast({ title: liveOn ? 'Live ledger resumed' : 'Live ledger paused' });
    });

    function match(t) {
      if (filter !== 'all' && t.status !== filter) return false;
      if (!q) return true;
      return (t.hash + ' ' + t.agent + ' ' + t.action + ' ' + t.venue + ' ' + t.sym).toLowerCase().indexOf(q) >= 0;
    }

    function rowHTML(t, fresh) {
      return '<tr class="d-tr' + (fresh ? ' sx-fresh' : '') + '" data-tx="' + t.id + '">' +
        '<td>' + statusPill(t.status) + '</td>' +
        '<td><button class="d-linkbtn sx-mono" type="button" data-open="' + t.id + '">' + fmt.addr(t.hash, 10, 6) + '</button></td>' +
        '<td>' + esc(t.agent) + '</td>' +
        '<td>' + esc(t.action) + '</td>' +
        '<td class="sx-dim">' + esc(t.venue) + '</td>' +
        '<td class="num">' + fmt.usd(t.usd, 0) + '</td>' +
        '<td class="num sx-dim">' + fmt.ago(t.ts) + '</td>' +
        '</tr>';
    }

    function render() {
      var rows = TX.filter(match);
      count.textContent = rows.length + ' of ' + TX.length + ' executions';
      empty.hidden = rows.length > 0;
      $('#tx-table').hidden = rows.length === 0;
      $('#tx-clear').hidden = !q && filter === 'all';
      body.innerHTML = rows.slice(0, 80).map(function (t) { return rowHTML(t, false); }).join('');
    }

    body.addEventListener('click', function (e) {
      var tr = e.target.closest('[data-tx]');
      if (!tr) return;
      openTx(TX.filter(function (t) { return t.id === tr.getAttribute('data-tx'); })[0]);
    });

    /* live arrivals + pending promotion */
    setInterval(function () {
      if (!liveOn) return;
      var t = makeTx(Date.now());
      TX.unshift(t);
      if (TX.length > 220) TX.pop();
      /* settle an older pending row */
      for (var i = TX.length - 1; i >= 0; i--) {
        if (TX[i].status === 'pending' && Date.now() - TX[i].ts > 12000) {
          TX[i].status = rnd() > 0.12 ? 'settled' : 'failed';
          break;
        }
      }
      S.emit('dash:tx', TX);
      if (route !== 'transactions') return;
      if (match(t)) {
        body.insertAdjacentHTML('afterbegin', rowHTML(t, true));
        while (body.children.length > 80) body.lastChild.remove();
        count.textContent = TX.filter(match).length + ' of ' + TX.length + ' executions';
        empty.hidden = true; $('#tx-table').hidden = false;
      }
    }, 5600);

    /* keep relative timestamps honest */
    setInterval(function () { if (route === 'transactions') render(); }, 30000);

    render();
  }

  function openTx(t) {
    if (!t) return;
    function row(k, v) { return '<tr><td style="color:var(--gray);width:36%">' + k + '</td><td>' + v + '</td></tr>'; }
    S.modal({
      eyebrow: 'Receipt', wide: true,
      title: t.action,
      subtitle: t.agent + ' · ' + t.venue,
      body: '<div class="sx-between" style="gap:12px">' + statusPill(t.status) +
        '<span class="d-src d-src--sim">simulated ledger</span></div>' +
        '<div class="sx-tablewrap" style="margin-top:16px"><table class="sx-table" style="min-width:0"><tbody>' +
        row('Transaction hash', '<span class="sx-mono" style="word-break:break-all">' + esc(t.hash) + '</span>') +
        row('Notional', fmt.usd(t.usd, 2)) +
        row('Asset', esc(t.sym)) +
        row('Venue', esc(t.venue)) +
        row('Gas price', t.gas.toFixed(2) + ' gwei') +
        row('Realised slippage', t.slip.toFixed(2) + '% <span class="sx-dim">(band ' + (POLICY.slip / 100).toFixed(2) + '%)</span>') +
        row('Latency', t.latency + ' ms') +
        row('Timestamp', new Date(t.ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC') +
        row('Policy hash', '<span class="sx-mono">' + fmt.addr(policyHash(POLICY), 12, 8) + '</span>') +
        '</tbody></table></div>' +
        (t.status === 'held'
          ? '<p class="sx-body" style="margin-top:16px">Held at the policy gate: the notional exceeded your per-transaction cap of ' +
          fmt.usd(POLICY.tx, 0) + '. With human-in-the-loop ' + (POLICY.human ? 'on' : 'off') + ', this ' +
          (POLICY.human ? 'is waiting for your signature.' : 'was refused outright.') + '</p>'
          : t.status === 'failed'
            ? '<p class="sx-body" style="margin-top:16px">The route reverted during simulation and was never broadcast. No gas was spent.</p>'
            : '') +
        '<p class="sx-body" style="margin-top:14px;font-size:12.5px">This hash was generated locally for the testnet console — a public explorer will not resolve it.</p>',
      actions: [
        { label: 'Copy hash', variant: 'quiet', close: false, onClick: function () { S.copy(t.hash, 'Hash copied'); } },
        {
          label: 'Open in Etherscan', variant: 'ghost', close: false,
          onClick: function () { global.open('https://etherscan.io/tx/' + t.hash, '_blank', 'noopener'); }
        },
        { label: 'Close', variant: 'primary' }
      ]
    });
  }

  /* ---------- POLICY ---------- */
  function viewPolicy() {
    var day = $('#pol-day'), tx = $('#pol-tx'), slip = $('#pol-slip'), human = $('#pol-human');
    day.value = POLICY.day; tx.value = POLICY.tx; slip.value = POLICY.slip;
    human.setAttribute('aria-checked', String(!!POLICY.human));

    var chips = $('#pol-venues');
    VENUES.forEach(function (v) {
      var b = el('button', { class: 'sx-pill', type: 'button', 'aria-pressed': String(v.on), text: v.label });
      b.addEventListener('click', function () {
        v.on = !v.on;
        b.setAttribute('aria-pressed', String(v.on));
        paint();
      });
      chips.appendChild(b);
    });

    function read() {
      return {
        day: +day.value, tx: +tx.value, slip: +slip.value, human: human.getAttribute('aria-checked') === 'true',
        venues: VENUES.filter(function (v) { return v.on; }).map(function (v) { return v.k; })
      };
    }

    function paint() {
      var p = read();
      txt($('#pol-day-v'), fmt.usd(p.day, 0));
      txt($('#pol-tx-v'), fmt.usd(p.tx, 0));
      txt($('#pol-slip-v'), (p.slip / 100).toFixed(2) + '%');
      var h = policyHash(p);
      txt($('#pol-hash'), fmt.addr(h, 14, 10));
      $('#pol-hash').setAttribute('title', h);
      $('#pol-json').innerHTML =
        '<span class="k">{</span>\n' +
        '  <span class="k">"dailyCapUsd"</span>: <span class="v">' + p.day + '</span>,\n' +
        '  <span class="k">"perTxCapUsd"</span>: <span class="v">' + p.tx + '</span>,\n' +
        '  <span class="k">"maxSlippageBps"</span>: <span class="v">' + p.slip + '</span>,\n' +
        '  <span class="k">"humanInTheLoop"</span>: <span class="v">' + p.human + '</span>,\n' +
        '  <span class="k">"venues"</span>: [' + p.venues.map(function (v) { return '<span class="s">"' + v + '"</span>'; }).join(', ') + '],\n' +
        '  <span class="k">"agents"</span>: <span class="v">' + MY_AGENTS.filter(function (a) { return a.status !== 'revoked'; }).length + '</span>\n' +
        '<span class="k">}</span>';
      paintUtil(p);
    }

    function paintUtil(p) {
      var spent = spendToday();
      var biggest = TX.filter(function (t) { return t.ts >= startOfDay() && t.status === 'settled'; })
        .reduce(function (m, t) { return Math.max(m, t.usd); }, 0);
      var held = TX.filter(function (t) { return t.status === 'held'; }).length;
      function meter(used, cap) {
        var u = cap ? clamp(used / cap, 0, 1) : 0;
        var c = u > 0.9 ? ' sx-meter--danger' : u > 0.7 ? ' sx-meter--warn' : '';
        /* .sx-meter carries no display rule of its own — as a block-level div it
           renders; as a bare inline span it collapses to nothing. */
        return '<div class="sx-meter d-meter' + c + '" role="img" aria-label="' +
          (u * 100).toFixed(0) + ' percent of cap used"><i style="width:' + (u * 100).toFixed(1) + '%"></i></div>';
      }
      $('#pol-util').innerHTML =
        '<div style="padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.045)">' +
        '<div class="sx-between"><span class="sx-label">Daily cap</span><b class="sx-mono">' + fmt.usd(spent, 0) + ' / ' + fmt.usd(p.day, 0) + '</b></div>' +
        meter(spent, p.day) + '</div>' +
        '<div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.045)">' +
        '<div class="sx-between"><span class="sx-label">Largest execution</span><b class="sx-mono">' + fmt.usd(biggest, 0) + ' / ' + fmt.usd(p.tx, 0) + '</b></div>' +
        meter(biggest, p.tx) + '</div>' +
        '<div class="d-kv" style="padding-top:14px"><span>Refused today</span><b>' + held + ' intents</b></div>' +
        '<div class="d-kv"><span>Venues enabled</span><b>' + p.venues.length + ' of ' + VENUES.length + '</b></div>' +
        '<div class="d-kv"><span>Human approval</span><b>' + (p.human ? 'required' : 'off') + '</b></div>';
    }

    /* per-tx can never exceed daily */
    [day, tx, slip].forEach(function (r) { r.addEventListener('input', paint); });
    tx.addEventListener('input', function () { if (+tx.value > +day.value) day.value = tx.value; paint(); });
    day.addEventListener('input', function () { if (+tx.value > +day.value) tx.value = day.value; paint(); });

    human.addEventListener('click', function () {
      human.setAttribute('aria-checked', String(human.getAttribute('aria-checked') !== 'true'));
      paint();
    });

    $('#pol-copy').addEventListener('click', function () { S.copy(policyHash(read()), 'Policy hash copied'); });

    $('#pol-save').addEventListener('click', function (e) {
      var b = e.currentTarget;
      b.classList.add('is-busy');
      setTimeout(function () {
        b.classList.remove('is-busy');
        POLICY = read();
        S.store.set('dash:policy', POLICY);
        MY_AGENTS.forEach(function (a) {
          a.cap = Math.min(a.cap, POLICY.day);
          if (a.spent > a.cap) a.spent = a.cap;
        });
        S.emit('dash:policy', POLICY);
        S.emit('dash:agents', MY_AGENTS);
        S.toast({
          title: 'Policy committed',
          body: 'Hash ' + fmt.addr(policyHash(POLICY), 10, 6) + ' · ' + POLICY.venues.length + ' venues · cap ' + fmt.usd(POLICY.day, 0)
        });
      }, 700);
    });

    paint();
    S.on('dash:tx', function () { if (route === 'policy') paintUtil(read()); });
  }

  /* ---------- SETTINGS ---------- */
  function viewSettings() {
    /* wallet */
    function paintWallet() {
      var st = S.wallet.state, host = $('#set-wallet');
      if (!host) return;
      if (!st.connected) {
        var d = S.wallet.detect();
        var found = d.evm.map(function (p) { return p.name; }).concat(d.solana ? [d.solana.name] : []);
        host.innerHTML =
          '<div class="sx-empty" style="padding:24px 20px">' +
          '<b>No wallet connected</b>' +
          '<p class="sx-body">Connecting shares your public address only. Strix Hood never sees a seed phrase and cannot move funds without a transaction you sign.</p>' +
          '<div class="sx-row" style="gap:10px"><button class="sx-btn sx-btn--primary sx-btn--sm" type="button" data-wallet data-wallet-idle="Connect wallet"><span data-wallet-label>Connect wallet</span></button>' +
          (found.length ? '' : '<a class="sx-btn sx-btn--ghost sx-btn--sm" href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">Get MetaMask</a>') +
          '</div>' +
          '<p class="sx-body" style="font-size:12px">' +
          (found.length ? 'Detected in this browser: ' + esc(found.join(', ')) + '.' : 'No EIP-1193 or Solana provider is injected in this browser.') +
          '</p></div>';
        S.wallet.render();
        return;
      }
      var chain = st.kind === 'evm' ? S.wallet.chainName(st.chainId) : 'Solana mainnet-beta';
      var native = st.kind === 'evm' ? ((S.wallet.chains[st.chainId] || {}).native || 'ETH') : 'SOL';
      host.innerHTML =
        '<div class="d-kv"><span>Wallet</span><b>' + esc(st.walletName || '—') + '</b></div>' +
        '<div class="d-kv"><span>Address</span><b class="sx-mono" style="font-size:12px">' + esc(st.address) + '</b></div>' +
        '<div class="d-kv"><span>Network</span><b>' + esc(chain) + (st.kind === 'evm' ? ' <span class="sx-dim">' + esc(st.chainId) + '</span>' : '') + '</b></div>' +
        '<div class="d-kv"><span>Native balance</span><b>' + (st.balance === null ? '—' : fmt.n(st.balance, 4) + ' ' + native) + '</b></div>' +
        (st.kind === 'evm' ? '<div style="margin-top:14px"><span class="sx-label">Switch network</span><div class="d-chips" id="set-nets" style="margin-top:9px"></div></div>' : '') +
        '<div class="sx-row" style="gap:9px;margin-top:16px">' +
        '<button class="sx-btn sx-btn--ghost sx-btn--sm" type="button" id="set-sign">Sign test message</button>' +
        '<button class="sx-btn sx-btn--quiet sx-btn--sm" type="button" id="set-copy">Copy address</button>' +
        '<button class="sx-btn sx-btn--quiet sx-btn--sm" type="button" id="set-refresh">Refresh balance</button>' +
        '<button class="sx-btn sx-btn--danger sx-btn--sm" type="button" id="set-dc">Disconnect</button>' +
        '</div>';
      if (st.kind === 'evm') {
        var nets = $('#set-nets');
        ['0x1', '0xa4b1', '0x2105', '0x89'].forEach(function (id) {
          nets.appendChild(el('button', {
            class: 'sx-pill' + (id === st.chainId ? ' is-on' : ''), type: 'button', text: S.wallet.chainName(id),
            'aria-pressed': String(id === st.chainId),
            onclick: function () { S.wallet.switchChain(id).catch(function () { }); }
          }));
        });
      }
      $('#set-sign').addEventListener('click', function () {
        var b = this; b.classList.add('is-busy');
        S.wallet.signMessage('Strix Hood — proving control of ' + st.address + '\nNonce: ' + Date.now())
          .then(function (sig) { S.toast({ title: 'Signature verified', body: fmt.addr(sig, 14, 10) }); })
          .catch(function () { S.toast({ title: 'Signing cancelled', type: 'warn' }); })
          .then(function () { b.classList.remove('is-busy'); });
      });
      $('#set-copy').addEventListener('click', function () { S.copy(st.address, 'Address copied'); });
      $('#set-refresh').addEventListener('click', function () { S.wallet.refreshBalance(); S.toast({ title: 'Balance re-queried' }); });
      $('#set-dc').addEventListener('click', function () { S.wallet.disconnect(); });
    }
    paintWallet();
    S.on('wallet', paintWallet);

    /* preferences */
    function bindPref(id, key, after) {
      var b = $(id);
      if (!b) return;
      b.setAttribute('aria-checked', String(!!PREFS[key]));
      b.addEventListener('click', function () {
        PREFS[key] = !PREFS[key];
        b.setAttribute('aria-checked', String(!!PREFS[key]));
        applyPrefs(true);
        if (after) after(PREFS[key]);
      });
    }
    bindPref('#pref-ambient', 'ambient', function (on) {
      S.toast({ title: on ? 'Ambient background on' : 'Ambient background off',
        body: on ? 'WebGL lattice re-mounted.' : 'Render loop stopped and the scene released.' });
    });
    bindPref('#pref-cursor', 'cursor');
    bindPref('#pref-motion', 'motion', function (on) {
      S.toast({ title: on ? 'Motion reduced' : 'Motion restored', body: on ? 'Transitions and loops suppressed site-wide.' : '' });
    });
    bindPref('#pref-flash', 'flash');
    if (S.touch) {
      var c = $('#pref-cursor');
      if (c) { c.setAttribute('aria-disabled', 'true'); c.disabled = true; }
    }
    $('#set-prefs-reset').addEventListener('click', function () {
      PREFS = { ambient: true, cursor: true, motion: false, flash: true };
      ['ambient', 'cursor', 'motion', 'flash'].forEach(function (k) {
        var b = $('#pref-' + k); if (b) b.setAttribute('aria-checked', String(!!PREFS[k]));
      });
      applyPrefs(true);
      S.toast({ title: 'Interface preferences reset' });
    });

    /* data sources */
    function paintSources() {
      var st = S.data.status;
      $('#set-sources').innerHTML = FEEDS.map(function (f) {
        return '<div class="d-kv"><span>' + esc(f.name) + '<br><span class="d-hash" style="text-transform:none;letter-spacing:0">' +
          esc(f.url) + '</span></span>' + feedPill(st[f.k] || 'idle') + '</div>';
      }).join('');
    }
    paintSources();
    S.on('data:status', function () { paintSources(); });
    $('#set-retry').addEventListener('click', retryFeeds);

    /* local state — enumerated from storage, never a hardcoded guess */
    var KEY_NAMES = {
      'dash:policy': 'Spending policy',
      'dash:prefs': 'Interface preferences',
      'dash:chart:ov': 'Chart · overview',
      'dash:chart:pf': 'Chart · portfolio',
      'wallet:last': 'Last wallet used',
      'chat:v1': 'Agent chat transcript',
      'booted': 'Boot sequence seen',
      'waitlist': 'Waitlist email'
    };
    function storedKeys() {
      var out = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('strix:') === 0) out.push({ k: k.slice(6), raw: k, bytes: (localStorage.getItem(k) || '').length });
        }
      } catch (e) { }
      return out.sort(function (a, b) { return a.k.localeCompare(b.k); });
    }

    function paintState() {
      var keys = storedKeys();
      $('#set-state').innerHTML =
        (keys.length
          ? keys.map(function (e) {
            return '<div class="d-kv"><span>' + esc(KEY_NAMES[e.k] || e.k) +
              '<br><span class="d-hash" style="text-transform:none;letter-spacing:0">' + esc(e.raw) + '</span></span>' +
              '<b>stored · ' + e.bytes + ' B</b></div>';
          }).join('')
          : '<p class="sx-body">Nothing is stored for this site yet. Committing a policy or changing a preference writes one key.</p>') +
        '<button class="sx-btn sx-btn--danger sx-btn--sm sx-btn--block" type="button" id="set-clear" style="margin-top:16px"' +
        (keys.length ? '' : ' disabled') + '>Clear local state</button>' +
        '<p class="sx-body" style="font-size:12px;margin-top:11px">Removes every <span class="sx-mono">strix:</span> key, then reloads with defaults. ' +
        'The chat widget immediately writes a fresh empty transcript. Your wallet stays connected until you disconnect it.</p>';
      $('#set-clear').addEventListener('click', function () {
        S.confirm({
          title: 'Clear local state?',
          subtitle: keys.length + ' key' + (keys.length === 1 ? '' : 's') + ' stored in this browser only.',
          body: 'Policy, interface preferences, chart settings and the chat transcript are removed. This cannot be undone — the page reloads with defaults.',
          okLabel: 'Clear and reload', danger: true
        }).then(function (ok) {
          if (!ok) return;
          storedKeys().forEach(function (e) { S.store.del(e.k); });
          location.reload();
        });
      });
    }
    paintState();
    whenShown('settings', function () { paintState(); paintSources(); paintWallet(); });
  }

  /* ============================================================
     8 · ADMIN — data model
     ============================================================ */
  var CATS = [
    { k: 'all', label: 'All' }, { k: 'trading', label: 'Trading' }, { k: 'research', label: 'Research' },
    { k: 'payments', label: 'Payments' }, { k: 'risk', label: 'Risk' }, { k: 'nft', label: 'NFT' },
    { k: 'data', label: 'Data' }, { k: 'infra', label: 'Infra' }
  ];
  var CAT_KEYS = CATS.slice(1).map(function (c) { return c.k; });
  var REG_NAMES = [
    'Atlas-7', 'Vega-Prime', 'Nyx-04', 'Orion-Δ', 'Kestrel', 'Meridian', 'Halcyon-2', 'Corvus', 'Sable-9',
    'Lyra-X', 'Tessera', 'Pallas', 'Ferrum', 'Zephyr-3', 'Quill', 'Umbra', 'Cygnet', 'Basalt',
    'Vireo', 'Solace-8', 'Draco-II', 'Mirren', 'Onyx-5', 'Perse', 'Cinder', 'Ilex-9', 'Aegis-1'
  ];
  /* Agents that also appear on the landing page or in a user console keep the
     same identity here — a registry that renames them is a registry nobody
     believes. */
  var CANON = {
    'Atlas-7': ['research', 'Market Analyst'],
    'Vega-Prime': ['trading', 'Execution Solver'],
    'Nyx-04': ['payments', 'Payment Agent'],
    'Meridian': ['trading', 'RWA Desk'],
    'Halcyon-2': ['payments', 'Treasury Operator'],
    'Corvus': ['research', 'Research Synthesizer'],
    'Sable-9': ['nft', 'NFT Sniper'],
    'Aegis-1': ['risk', 'Portfolio Guardian'],
    'Kestrel': ['infra', 'Solver Node'],
    'Orion-Δ': ['data', 'Oracle Relay']
  };
  var REG_ROLES = {
    trading: ['Execution Solver', 'Market Maker', 'RWA Desk', 'Arbitrage Router'],
    research: ['Market Analyst', 'Research Synthesizer', 'Governance Watch'],
    payments: ['Payment Agent', 'Payroll Operator', 'Invoice Settler'],
    risk: ['Portfolio Guardian', 'Risk Auditor', 'Unwind Operator'],
    nft: ['NFT Sniper', 'Collection Curator', 'Floor Watcher'],
    data: ['Oracle Relay', 'Index Builder', 'Onchain Indexer'],
    infra: ['Solver Node', 'Simulation Fork', 'Relayer']
  };
  var REGISTRY = [];
  function buildRegistry() {
    var r = S.rng(19940521);
    REG_NAMES.forEach(function (name, i) {
      var fixed = CANON[name];
      var cat = fixed ? fixed[0] : CAT_KEYS[i % CAT_KEYS.length];
      var roles = fixed ? [fixed[1]] : REG_ROLES[cat];
      var slash = r() < 0.16 ? Math.ceil(r() * 3) : 0;
      var rep = Math.round(720 + r() * 279 - slash * 60);
      var status = slash >= 2 ? 'slashed' : slash === 1 ? 'probation' : r() < 0.12 ? 'idle' : 'active';
      REGISTRY.push({
        id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: name,
        role: roles[Math.floor(r() * roles.length)],
        cat: cat,
        operator: '0x' + hex(40, r),
        rep: clamp(rep, 400, 999),
        runs: Math.round(2000 + r() * 148000),
        bond: Math.round((5000 + r() * 145000) / 500) * 500,
        rev: Math.round(8000 + r() * 480000),
        succ: Math.round((9600 + r() * 399)) / 100,
        slash: slash,
        status: status,
        joined: Date.now() - Math.round(r() * 340 + 20) * 86400000
      });
    });
  }

  var LAYERS = [
    {
      k: 'aa', n: '01', name: 'Account abstraction', sub: 'ERC-4337 session keys',
      p: 'Agents never hold a private key with unlimited authority. Every execution is a UserOperation signed by a session key that is scoped, time-boxed and independently revocable.',
      criteria: ['Session key expiry enforced onchain', 'Paymaster refuses unsponsored ops', 'Key scope cannot widen without a new signature']
    },
    {
      k: 'policy', n: '02', name: 'Spending policy', sub: 'committed hash',
      p: 'Caps, allow-lists and guards are committed as a hash. The executor cannot act outside the committed policy, and changing it is a signed, timestamped event.',
      criteria: ['Per-tx and daily notional caps', 'Venue allow-list', 'Slippage band', 'Oracle staleness ceiling']
    },
    {
      k: 'sim', n: '03', name: 'Simulation', sub: 'forked state',
      p: 'Every candidate route is executed against a forked head before it can win the solver auction. A route that reverts in simulation never reaches a mempool.',
      criteria: ['Full state fork per quote', 'Revert = disqualified', 'Balance delta must match the intent']
    },
    {
      k: 'audit', n: '04', name: 'Contract audit', sub: 'immutable core',
      p: 'The settlement core is immutable and audited. Modules are opt-in per agent and are sandboxed behind a delegate boundary with its own allow-list.',
      criteria: ['No proxy admin on the core', 'Modules cannot call the core directly', 'Emergency pause is 3-of-5, 24h timelock']
    },
    {
      k: 'human', n: '05', name: 'Human in the loop', sub: 'above-cap holds',
      p: 'Anything above your per-transaction cap is held for a human signature rather than refused silently. A hold is a recorded event with a deadline, not a dropped intent.',
      criteria: ['Hold queue with expiry', 'Notification on every hold', 'Expired holds are cancelled, never auto-approved']
    }
  ];
  var REFUSALS = [];
  function buildRefusals() {
    var r = S.rng(70311);
    var reasons = {
      aa: ['session key expired', 'operation outside key scope', 'paymaster refused sponsorship'],
      policy: ['exceeds per-tx cap', 'venue not in allow-list', 'slippage band exceeded', 'daily cap consumed'],
      sim: ['route reverts on fork', 'balance delta mismatch', 'oracle stale by 412s'],
      audit: ['module not allow-listed', 'delegate target unverified'],
      human: ['awaiting signature', 'hold expired uncancelled', 'approver declined']
    };
    for (var i = 0; i < 34; i++) {
      var k = LAYERS[Math.floor(r() * LAYERS.length)].k;
      REFUSALS.push({
        layer: k,
        agent: REG_NAMES[Math.floor(r() * REG_NAMES.length)],
        reason: reasons[k][Math.floor(r() * reasons[k].length)],
        usd: Math.round(r() * 84000 + 300),
        ts: Date.now() - Math.round(r() * 7200000)
      });
    }
    REFUSALS.sort(function (a, b) { return b.ts - a.ts; });
  }

  var TOKEN = {
    supply: 1000000000,
    genesis: Date.UTC(2026, 1, 1),
    contract: '0x5771780000000000000000000000000000000d17',
    buckets: [
      { k: 'community', label: 'Community & Ecosystem', pctv: 40, color: '#CCFF00', tge: 5, cliff: 0, vest: 48, why: 'Incentives, grants and agent operator rewards' },
      { k: 'team', label: 'Team & Advisors', pctv: 20, color: '#00E5A0', tge: 0, cliff: 12, vest: 36, why: 'Core contributors, 12-month cliff' },
      { k: 'treasury', label: 'Protocol Treasury', pctv: 15, color: '#E4FF4D', tge: 10, cliff: 0, vest: 36, why: 'Governed spend: audits, integrations, insurance' },
      { k: 'liquidity', label: 'Liquidity', pctv: 15, color: '#FF9900', tge: 100, cliff: 0, vest: 0, why: 'Onchain depth and CEX market making, unlocked at TGE' },
      { k: 'early', label: 'Early Contributors', pctv: 10, color: '#7FB400', tge: 0, cliff: 6, vest: 24, why: 'Pre-seed and seed, 6-month cliff' }
    ]
  };
  function unlockedAt(b, month) {
    var total = TOKEN.supply * b.pctv / 100;
    var tge = total * b.tge / 100;
    if (b.vest === 0) return total;
    if (month < b.cliff) return tge;
    var p = clamp((month - b.cliff) / b.vest, 0, 1);
    return tge + (total - tge) * p;
  }
  function monthNow() {
    return Math.max(0, Math.round((Date.now() - TOKEN.genesis) / (30.44 * 86400000)));
  }

  /* ============================================================
     9 · ADMIN — views
     ============================================================ */
  function initAdmin() {
    buildRegistry();
    buildRefusals();
    adminOverview();
    adminRegistry();
    adminTreasury();
    adminSecurity();
    adminTokenomics();
  }

  /* ---------- NETWORK ---------- */
  function adminOverview() {
    $('#ad-kpis').innerHTML = [
      ['Volume · 24h', 'ad-vol24'], ['Protocol fees · 24h', 'ad-fee24'], ['Agents live', 'ad-agents'],
      ['Intents · 24h', 'ad-intents'], ['Median settle', 'ad-exec'], ['Success rate', 'ad-succ']
    ].map(function (k) {
      return '<div class="d-kpi"><div class="sx-stat"><span class="sx-stat__k">' + k[0] + '</span>' +
        '<span class="sx-stat__v" id="' + k[1] + '">—</span></div><div class="d-kpi__d" id="' + k[1] + '-d"></div></div>';
    }).join('');

    /* volume series — one seeded walk, resampled per window */
    var volR = S.rng(50291);
    var HOURS = [];
    (function () {
      var base = S.data.sim.metrics.volume24 / 24;
      for (var i = 0; i < 168; i++) {
        base *= 1 + (volR() - 0.5) * 0.16;
        base = clamp(base, 400000, 6000000);
        HOURS.push(base);
      }
    })();
    var win = 48;
    tabs($('#ad-vol-tabs'), [
      { k: '24', label: '24H' }, { k: '48', label: '48H' }, { k: '168', label: '7D' }
    ], '48', function (k) { win = +k; paintVol(); });

    function paintVol() {
      var data = HOURS.slice(HOURS.length - win);
      var cv = $('#ad-vol');
      cv.style.width = '100%';
      if (cv.clientWidth) S.sparkline(cv, data, { w: cv.clientWidth, h: 150, lw: 1.8 });
      var sum = data.reduce(function (a, b) { return a + b; }, 0);
      var peak = Math.max.apply(null, data), mean = sum / data.length;
      $('#ad-vol-meta').innerHTML = [
        ['Window', win + 'h'], ['Total settled', '$' + fmt.compact(sum)],
        ['Peak hour', '$' + fmt.compact(peak)], ['Mean hour', '$' + fmt.compact(mean)],
        ['Latest', '$' + fmt.compact(data[data.length - 1])]
      ].map(function (c) { return '<div><span>' + c[0] + '</span><b>' + c[1] + '</b></div>'; }).join('');
    }

    function paintKpis(m) {
      m = m || S.data.sim.metrics;
      S.setNum($('#ad-vol24'), m.volume24, fmt.usdC);
      S.setNum($('#ad-fee24'), m.fees24, fmt.usdC);
      S.setNum($('#ad-agents'), m.agentsLive, function (v) { return fmt.n(v, 0); });
      S.setNum($('#ad-intents'), m.intents24, function (v) { return fmt.n(v, 0); });
      S.setNum($('#ad-exec'), m.execMs, function (v) { return Math.round(v) + ' ms'; });
      S.setNum($('#ad-succ'), m.success, function (v) { return v.toFixed(2) + '%'; });
      $('#ad-vol24-d').innerHTML = '<span class="sx-dim">fee ' + fmt.usdC(m.volume24 * 0.0025) + '</span>';
      $('#ad-fee24-d').innerHTML = '<span class="sx-dim">' + fmt.usdC(m.fees24 * 0.4) + ' to treasury</span>';
      $('#ad-agents-d').innerHTML = '<span class="sx-dim">of ' + fmt.compact(m.agents) + ' · ' +
        ((m.agentsLive / m.agents) * 100).toFixed(1) + '% online</span>';
      $('#ad-intents-d').innerHTML = '<span class="sx-dim">' + fmt.n(m.intents24 / 1440, 0) + ' / min</span>';
      $('#ad-exec-d').innerHTML = '<span class="sx-dim">p50 · all venues</span>';
      $('#ad-succ-d').innerHTML = '<span class="' + (m.success > 99 ? 'sx-up' : 'sx-down') + '">' +
        (100 - m.success).toFixed(2) + '% refused</span>';
    }

    function paintChain() {
      var c = S.data.chain, st = S.data.status, s = S.data.sentiment;
      function row(k, v, ok, src) {
        return '<div class="d-kv"><span>' + k + '</span><b>' + v +
          (src ? ' <span class="d-src d-src--' + (ok ? 'live' : 'down') + '" style="margin-left:8px">' + src + '</span>' : '') + '</b></div>';
      }
      $('#ad-chain').innerHTML =
        row('Block height', c.block ? fmt.n(c.block, 0) : 'unavailable', st.rpc === 'ok', st.rpc === 'ok' ? 'publicnode' : 'rpc down') +
        row('Gas price', c.gasGwei ? c.gasGwei.toFixed(2) + ' gwei' : 'unavailable', st.rpc === 'ok', st.rpc === 'ok' ? 'publicnode' : 'rpc down') +
        row('Ethereum TVL', c.tvl ? fmt.usdC(c.tvl) : 'unavailable', st.llama === 'ok', st.llama === 'ok' ? 'defillama' : 'llama down') +
        row('Fear & greed', s.live ? s.value + ' · ' + s.label : 'unavailable', st.fng === 'ok', st.fng === 'ok' ? 'alternative.me' : 'feed down') +
        row('ETH price', fmt.price(S.data.market.ETH.price), S.data.market.ETH.live, marketSrc()[2]) +
        '<p class="sx-body" style="font-size:12px;margin-top:12px">Chain values are read directly from public infrastructure. When an endpoint does not answer this panel says so rather than showing the last good number as if it were current.</p>';
    }

    /* global feed */
    var feedOn = true, feedHost = $('#ad-feed');
    function push(agoMs) {
      if (!feedOn) return;
      var e = S.data.randomEvent();
      var row = el('div', { class: 'sx-feed__row' + (agoMs ? '' : ' is-new') + (e.kind === 'warn' ? ' d-feed__row--warn' : '') }, [
        el('span', { class: 'sx-status sx-status--' + (e.kind === 'warn' ? 'warn' : 'live') }, [el('i')]),
        el('span', { class: 'd-feed__agent', text: e.agent }),
        el('span', { text: e.text }),
        el('span', { class: 'd-feed__d', text: e.detail }),
        el('span', { class: 'sx-mono sx-dim', style: { fontSize: '11px' }, text: e.hash }),
        el('span', { class: 'sx-feed__t', text: fmt.clock(e.ts - (agoMs || 0)) })
      ]);
      feedHost.insertBefore(row, feedHost.firstChild);
      while (feedHost.children.length > 16) feedHost.lastChild.remove();
      setTimeout(function () { row.classList.remove('is-new'); }, 700);
    }
    /* Backfill oldest-first so the seeded rows carry believable clock times. */
    for (var i = 10; i > 0; i--) push(i * 2600 + Math.round(rnd() * 1400));
    setInterval(function () { if (route === 'overview') push(); }, 2400);
    $('#ad-feed-toggle').addEventListener('click', function () {
      feedOn = !feedOn;
      this.setAttribute('aria-pressed', String(!feedOn));
      this.textContent = feedOn ? 'Pause' : 'Resume';
    });

    paintKpis(); paintChain(); paintVol();
    whenShown('overview', paintVol);
    S.on('sim', function (m) { if (route === 'overview') paintKpis(m); });
    S.on('chain', function () { if (route === 'overview') paintChain(); });
    S.on('sentiment', function () { if (route === 'overview') paintChain(); });
    S.on('data:status', function () { if (route === 'overview') paintChain(); });
    S.on('tick', function () { if (route === 'overview') paintChain(); });
    global.addEventListener('resize', function () { if (route === 'overview') paintVol(); });
  }

  /* ---------- REGISTRY ---------- */
  function adminRegistry() {
    var q = '', cat = 'all', slashedOnly = false;
    var sortState = { key: 'rep', dir: 'desc' };
    var body = $('#rg-body'), empty = $('#rg-empty'), count = $('#rg-count');

    tabs($('#rg-tabs'), CATS, 'all', function (k) { cat = k; render(); });
    $('#rg-search').addEventListener('input', function () { q = this.value.trim().toLowerCase(); render(); });
    $('#rg-slashed').addEventListener('click', function () {
      slashedOnly = !slashedOnly;
      this.setAttribute('aria-pressed', String(slashedOnly));
      this.classList.toggle('sx-btn--danger', slashedOnly);
      this.classList.toggle('sx-btn--quiet', !slashedOnly);
      render();
    });
    function clearFilters() {
      q = ''; cat = 'all'; slashedOnly = false;
      $('#rg-search').value = '';
      var b = $('#rg-slashed');
      b.setAttribute('aria-pressed', 'false');
      b.classList.add('sx-btn--quiet'); b.classList.remove('sx-btn--danger');
      tabs($('#rg-tabs'), CATS, 'all', function (k) { cat = k; render(); });
      render();
    }
    $('#rg-reset').addEventListener('click', clearFilters);
    $('#rg-clear').addEventListener('click', clearFilters);
    sortable($('#rg-table'), sortState, render);

    function render() {
      var rows = REGISTRY.filter(function (a) {
        if (cat !== 'all' && a.cat !== cat) return false;
        if (slashedOnly && !a.slash) return false;
        if (!q) return true;
        return (a.name + ' ' + a.role + ' ' + a.operator + ' ' + a.cat).toLowerCase().indexOf(q) >= 0;
      });
      rows = sortRows(rows, sortState);
      count.textContent = rows.length + ' of ' + REGISTRY.length + ' agents';
      empty.hidden = rows.length > 0;
      $('#rg-table').hidden = rows.length === 0;
      $('#rg-clear').hidden = !q && cat === 'all' && !slashedOnly;
      body.innerHTML = rows.map(function (a) {
        return '<tr class="d-tr" data-reg="' + a.id + '">' +
          '<td><button class="d-linkbtn" type="button">' + esc(a.name) + '</button>' +
          '<div class="d-hash">' + esc(a.role) + '</div></td>' +
          '<td><span class="sx-pill sx-pill--static">' + esc(a.cat) + '</span></td>' +
          '<td class="sx-mono sx-dim">' + fmt.addr(a.operator, 6, 4) + '</td>' +
          '<td class="num">' + a.rep + '</td>' +
          '<td class="num">' + fmt.n(a.runs, 0) + '</td>' +
          '<td class="num">' + fmt.compact(a.bond) + ' STRX</td>' +
          '<td>' + statusPill(a.status) + (a.slash ? ' <span class="d-flag">⚑ ' + a.slash + '</span>' : '') + '</td>' +
          '</tr>';
      }).join('');
    }

    body.addEventListener('click', function (e) {
      var tr = e.target.closest('[data-reg]');
      if (!tr) return;
      var a = REGISTRY.filter(function (x) { return x.id === tr.getAttribute('data-reg'); })[0];
      openReg(a);
    });

    function openReg(a) {
      if (!a) return;
      function row(k, v) { return '<tr><td style="color:var(--gray);width:38%">' + k + '</td><td>' + v + '</td></tr>'; }
      var recent = REFUSALS.filter(function (r) { return r.agent === a.name; }).slice(0, 4);
      S.modal({
        eyebrow: a.role, title: a.name, wide: true,
        subtitle: a.cat + ' · registered ' + new Date(a.joined).toISOString().slice(0, 10),
        body: '<div class="sx-between">' + statusPill(a.status) +
          (a.slash ? '<span class="d-flag">⚑ ' + a.slash + ' slashing event' + (a.slash > 1 ? 's' : '') + '</span>' : '<span class="d-src d-src--live">no slashing events</span>') +
          '</div>' +
          '<div class="sx-tablewrap" style="margin-top:16px"><table class="sx-table" style="min-width:0"><tbody>' +
          row('Operator', '<span class="sx-mono" style="word-break:break-all">' + esc(a.operator) + '</span>') +
          row('Reputation', a.rep + ' / 1000') +
          row('Executions', fmt.n(a.runs, 0) + ' · ' + a.succ.toFixed(2) + '% success') +
          row('Revenue 30d', fmt.usd(a.rev, 0)) +
          row('Staked bond', fmt.n(a.bond, 0) + ' STRX') +
          row('Category', esc(a.cat)) +
          '</tbody></table></div>' +
          (recent.length
            ? '<p class="sx-label" style="margin-top:18px">Recent refusals</p><div class="sx-tablewrap" style="margin-top:8px"><table class="sx-table" style="min-width:0"><tbody>' +
            recent.map(function (r) {
              return '<tr><td class="sx-mono">' + esc(r.layer) + '</td><td>' + esc(r.reason) + '</td><td class="num">' + fmt.usd(r.usd, 0) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
            : '') +
          '<p class="sx-body" style="margin-top:16px;font-size:12.5px">Registry records are simulated testnet fixtures. A slashing event burns a share of the bond and is permanently attached to the agent passport — selling the agent does not clear it.</p>',
        actions: [
          { label: 'Copy operator', variant: 'quiet', close: false, onClick: function () { S.copy(a.operator, 'Operator address copied'); } },
          { label: 'Close', variant: 'primary' }
        ]
      });
    }

    render();
  }

  /* ---------- TREASURY ---------- */
  function adminTreasury() {
    var win = 24;
    tabs($('#tr-window'), [{ k: '24', label: '24H' }, { k: '168', label: '7D' }, { k: '720', label: '30D' }],
      '24', function (k) { win = +k; paintFlow(); paintEpochs(); });

    function scaled() {
      var m = S.data.sim.metrics;
      var v = m.volume24 * (win / 24) * (win === 24 ? 1 : win === 168 ? 0.94 : 0.88);
      return { vol: v, fee: v * 0.0025 };
    }

    function paintFlow() {
      var s = scaled();
      var label = win === 24 ? '24 hours' : win === 168 ? '7 days' : '30 days';
      $('#tr-flow').innerHTML =
        '<div class="d-flow__node"><span>Commerce volume · ' + label + '</span><b>' + fmt.usdC(s.vol) + '</b>' +
        '<em>' + fmt.n(S.data.sim.metrics.intents24 * (win / 24), 0) + ' intents settled</em></div>' +
        '<span class="d-flow__arrow" aria-hidden="true"><i></i></span>' +
        '<div class="d-flow__node d-flow__node--fee"><span>Protocol fee · 0.25%</span><b>' + fmt.usdC(s.fee) + '</b>' +
        '<em>charged on settlement, never on quotes</em></div>' +
        '<span class="d-flow__arrow" aria-hidden="true"><i></i></span>' +
        '<div class="d-flow__split">' +
        splitNode('Treasury', 40, s.fee) + splitNode('Stakers', 30, s.fee) + splitNode('Buyback &amp; burn', 30, s.fee) +
        '</div>';
    }
    function splitNode(name, p, fee) {
      return '<div class="d-flow__node"><span>' + name + '</span><em>' + p + '%</em><b>' + fmt.usdC(fee * p / 100) + '</b></div>';
    }

    function paintDonut() {
      var cum = S.data.sim.metrics.volume24 * 0.0025 * 0.4 * 214;   /* cumulative treasury, epochs to date */
      var segs = [
        { label: 'USDC', value: cum * 0.46, color: '#CCFF00' },
        { label: 'ETH', value: cum * 0.28, color: '#00E5A0' },
        { label: '$STRX', value: cum * 0.18, color: '#E4FF4D' },
        { label: 'Other', value: cum * 0.08, color: '#8A8B9E' }
      ];
      $('#tr-donut').innerHTML = S.donutSVG(segs, { size: 200, stroke: 22, label: 'Treasury holdings by asset' }) +
        '<div class="d-alloc__mid"><span>Treasury</span><b>' + fmt.usdC(cum) + '</b></div>';
      $('#tr-legend').innerHTML = segs.map(function (s) {
        return '<div class="d-legend__row"><span class="d-legend__sw" style="background:' + s.color + '"></span>' +
          '<span>' + s.label + '</span><em>' + ((s.value / cum) * 100).toFixed(0) + '%</em><b>' + fmt.usdC(s.value) + '</b></div>';
      }).join('') +
        '<div class="d-legend__row" style="margin-top:8px;border-top:1px solid rgba(255,255,255,.07);padding-top:12px">' +
        '<span class="sx-dim" style="font-size:12px">Cumulative since genesis, net of grants paid.</span></div>';
    }

    function paintEpochs() {
      var r = S.rng(6612);
      var base = S.data.sim.metrics.volume24 / 4;
      var rows = [];
      for (var i = 0; i < 14; i++) {
        var v = base * (0.72 + r() * 0.62);
        var fee = v * 0.0025;
        rows.push({
          n: 4118 - i, vol: v, fee: fee,
          ts: Date.now() - (i * 6 * 3600000 + 2400000)
        });
      }
      $('#tr-count').textContent = rows.length + ' epochs · 6h each';
      $('#tr-body').innerHTML = rows.map(function (e) {
        return '<tr>' +
          '<td class="sx-mono">#' + e.n + '</td>' +
          '<td class="num">' + fmt.usdC(e.vol) + '</td>' +
          '<td class="num" style="color:var(--neon-2)">' + fmt.usdC(e.fee) + '</td>' +
          '<td class="num">' + fmt.usdC(e.fee * 0.4) + '</td>' +
          '<td class="num">' + fmt.usdC(e.fee * 0.3) + '</td>' +
          '<td class="num">' + fmt.usdC(e.fee * 0.3) + '</td>' +
          '<td class="sx-dim">' + fmt.ago(e.ts) + '</td>' +
          '</tr>';
      }).join('');
    }

    paintFlow(); paintDonut(); paintEpochs();
    S.on('sim', function () { if (route === 'treasury') { paintFlow(); paintDonut(); } });
  }

  /* ---------- SECURITY ---------- */
  function adminSecurity() {
    var r = S.rng(31337);
    LAYERS.forEach(function (l) {
      l.checks = Math.round(40000 + r() * 160000);
      l.blocked = Math.round(l.checks * (0.002 + r() * 0.02));
      l.ms = Math.round(4 + r() * 60);
    });

    function paintLayers() {
      $('#sec-layers').innerHTML = LAYERS.map(function (l) {
        var pass = ((1 - l.blocked / l.checks) * 100).toFixed(2);
        return '<li><button class="d-layer" type="button" data-layer="' + l.k + '">' +
          '<span class="d-layer__n">' + l.n + '</span>' +
          '<span class="d-layer__b">' +
          '<h3>' + esc(l.name) + ' <span class="sx-status sx-status--live"><i></i>ACTIVE</span>' +
          '<span class="sx-dim sx-mono" style="font-size:11px">' + esc(l.sub) + '</span></h3>' +
          '<p>' + esc(l.p) + '</p>' +
          '<span class="d-layer__stats">' +
          '<span><span>Checks · 24h</span><b>' + fmt.n(l.checks, 0) + '</b></span>' +
          '<span><span>Refused</span><b>' + fmt.n(l.blocked, 0) + '</b></span>' +
          '<span><span>Pass rate</span><b>' + pass + '%</b></span>' +
          '<span><span>Median cost</span><b>' + l.ms + ' ms</b></span>' +
          '</span></span></button></li>';
      }).join('');
      $$('#sec-layers [data-layer]').forEach(function (b) {
        b.addEventListener('click', function () {
          var l = LAYERS.filter(function (x) { return x.k === b.getAttribute('data-layer'); })[0];
          S.modal({
            eyebrow: 'Layer ' + l.n, title: l.name,
            subtitle: l.sub,
            body: '<p class="sx-lead" style="font-size:15.5px">' + esc(l.p) + '</p>' +
              '<p class="sx-label" style="margin-top:20px">Refusal criteria</p>' +
              '<ul class="sx-body" style="margin:10px 0 0;padding-left:18px;line-height:1.9">' +
              l.criteria.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
              '<div class="sx-tablewrap" style="margin-top:18px"><table class="sx-table" style="min-width:0"><tbody>' +
              '<tr><td style="color:var(--gray)">Checks · 24h</td><td class="num">' + fmt.n(l.checks, 0) + '</td></tr>' +
              '<tr><td style="color:var(--gray)">Actions refused</td><td class="num">' + fmt.n(l.blocked, 0) + '</td></tr>' +
              '<tr><td style="color:var(--gray)">Median added latency</td><td class="num">' + l.ms + ' ms</td></tr>' +
              '</tbody></table></div>' +
              '<p class="sx-body" style="margin-top:16px;font-size:12.5px">Counters are simulated. Each layer refuses independently — a pass here is not a pass anywhere else.</p>',
            actions: [{ label: 'Close', variant: 'primary' }]
          });
        });
      });
    }

    var filter = 'all';
    tabs($('#sec-tabs'), [{ k: 'all', label: 'All layers' }].concat(LAYERS.map(function (l) {
      return { k: l.k, label: l.name };
    })), 'all', function (k) { filter = k; paintTable(); });

    function paintTable() {
      var rows = REFUSALS.filter(function (x) { return filter === 'all' || x.layer === filter; });
      $('#sec-empty').hidden = rows.length > 0;
      $('#sec-table').hidden = rows.length === 0;
      $('#sec-body').innerHTML = rows.map(function (x) {
        var l = LAYERS.filter(function (y) { return y.k === x.layer; })[0];
        return '<tr>' +
          '<td><span class="sx-pill sx-pill--static">' + esc(l ? l.n + ' · ' + l.name : x.layer) + '</span></td>' +
          '<td>' + esc(x.agent) + '</td>' +
          '<td class="sx-dim">' + esc(x.reason) + '</td>' +
          '<td class="num">' + fmt.usd(x.usd, 0) + '</td>' +
          '<td class="num sx-dim">' + fmt.ago(x.ts) + '</td>' +
          '</tr>';
      }).join('');
    }

    /* a new refusal every so often, so the log is alive */
    setInterval(function () {
      if (route !== 'security') return;
      var l = LAYERS[Math.floor(rnd() * LAYERS.length)];
      REFUSALS.unshift({
        layer: l.k, agent: REG_NAMES[Math.floor(rnd() * REG_NAMES.length)],
        reason: l.criteria[Math.floor(rnd() * l.criteria.length)].toLowerCase(),
        usd: Math.round(rnd() * 60000 + 400), ts: Date.now()
      });
      if (REFUSALS.length > 80) REFUSALS.pop();
      l.blocked++; l.checks += Math.round(rnd() * 40);
      paintTable(); paintLayers();
    }, 9000);

    paintLayers(); paintTable();
  }

  /* ---------- TOKENOMICS ---------- */
  function adminTokenomics() {
    var mNow = monthNow();
    var scrub = $('#tk-scrub');
    scrub.value = String(mNow);

    function circulating(month) {
      return TOKEN.buckets.reduce(function (s, b) { return s + unlockedAt(b, month); }, 0);
    }

    function paintKpis() {
      var circ = circulating(mNow);
      $('#tk-kpis').innerHTML = [
        ['Total supply', fmt.compact(TOKEN.supply) + ' STRX', 'fixed at deployment'],
        ['Circulating', fmt.compact(circ) + ' STRX', ((circ / TOKEN.supply) * 100).toFixed(1) + '% of supply'],
        ['Locked', fmt.compact(TOKEN.supply - circ) + ' STRX', 'released on schedule'],
        ['Staked', fmt.compact(S.data.sim.metrics.staked) + ' STRX', 'agent bonds + delegation'],
        ['Month since TGE', String(mNow), new Date(TOKEN.genesis).toISOString().slice(0, 10)]
      ].map(function (k) {
        return '<div class="d-kpi"><div class="sx-stat"><span class="sx-stat__k">' + k[0] + '</span>' +
          '<span class="sx-stat__v" style="font-size:21px">' + k[1] + '</span></div>' +
          '<div class="d-kpi__d"><span class="sx-dim">' + k[2] + '</span></div></div>';
      }).join('');
    }

    function paintDonut() {
      var segs = TOKEN.buckets.map(function (b) {
        return { label: b.label, value: b.pctv, color: b.color };
      });
      $('#tk-donut').innerHTML = S.donutSVG(segs, { size: 208, stroke: 24, label: 'Token distribution at genesis' }) +
        '<div class="d-alloc__mid"><span>Total supply</span><b>1.00B</b></div>';
      $('#tk-legend').innerHTML = segs.map(function (s) {
        return '<div class="d-legend__row"><span class="d-legend__sw" style="background:' + s.color + '"></span>' +
          '<span>' + esc(s.label) + '</span><em>' + s.value + '%</em><b>' + fmt.compact(TOKEN.supply * s.value / 100) + '</b></div>';
      }).join('');
    }

    function paintVest(month) {
      var W = 640, H = 210, padL = 6, padR = 46, padB = 22, padT = 8;
      var iw = W - padL - padR, ih = H - padT - padB;
      var months = 49;
      function X(m) { return padL + (m / (months - 1)) * iw; }
      function Y(v) { return padT + ih - (v / TOKEN.supply) * ih; }

      /* True stacked bands: each allocation is the ribbon between the running
         total below it and the running total including it. */
      var tops = [], acc = [], m;
      for (m = 0; m < months; m++) acc.push(0);
      TOKEN.buckets.forEach(function (b) {
        var top = [];
        for (var i = 0; i < months; i++) { acc[i] += unlockedAt(b, i); top.push(acc[i]); }
        tops.push(top);
      });

      var paths = '';
      TOKEN.buckets.forEach(function (b, i) {
        var top = tops[i], bot = i ? tops[i - 1] : null;
        var line = 'M' + X(0).toFixed(1) + ' ' + Y(top[0]).toFixed(1);
        for (m = 1; m < months; m++) line += ' L' + X(m).toFixed(1) + ' ' + Y(top[m]).toFixed(1);
        var area = line;
        for (m = months - 1; m >= 0; m--) {
          area += ' L' + X(m).toFixed(1) + ' ' + Y(bot ? bot[m] : 0).toFixed(1);
        }
        area += 'Z';
        paths += '<path d="' + area + '" fill="' + b.color + '" opacity=".68"><title>' +
          esc(b.label) + ' — ' + b.pctv + '%</title></path>' +
          '<path d="' + line + '" fill="none" stroke="' + b.color + '" stroke-width="1.2" opacity=".95"/>';
      });

      var grid = '';
      for (var g = 0; g <= 4; g++) {
        var v = (TOKEN.supply / 4) * g, y = Y(v);
        grid += '<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + iw) + '" y2="' + y + '" stroke="rgba(255,255,255,.06)"/>' +
          '<text x="' + (padL + iw + 7) + '" y="' + (y + 3) + '">' + fmt.compact(v) + '</text>';
      }
      var ticks = '';
      [0, 12, 24, 36, 48].forEach(function (m) {
        ticks += '<text x="' + X(m) + '" y="' + (H - 6) + '" text-anchor="middle">M' + m + '</text>';
      });

      var nowX = X(clamp(mNow, 0, months - 1)), selX = X(clamp(month, 0, months - 1));
      var marks =
        '<line x1="' + nowX + '" y1="' + padT + '" x2="' + nowX + '" y2="' + (padT + ih) + '" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 4"/>' +
        '<line x1="' + selX + '" y1="' + padT + '" x2="' + selX + '" y2="' + (padT + ih) + '" stroke="#CCFF00" stroke-width="1.4"/>' +
        '<circle cx="' + selX + '" cy="' + Y(circulating(month)) + '" r="3.6" fill="#CCFF00"/>';

      $('#tk-vest').innerHTML =
        '<svg class="d-vest" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
        'aria-label="Stacked unlock curve: circulating supply by month for each allocation">' +
        grid + paths + marks + ticks + '</svg>';
      $('#tk-month').textContent = 'month ' + month + ' · ' + fmt.compact(circulating(month)) + ' circulating (' +
        ((circulating(month) / TOKEN.supply) * 100).toFixed(1) + '%)';
    }

    function paintTable() {
      $('#tk-body').innerHTML = TOKEN.buckets.map(function (b) {
        var total = TOKEN.supply * b.pctv / 100;
        var un = unlockedAt(b, mNow);
        return '<tr>' +
          '<td><span class="d-legend__sw" style="background:' + b.color + ';display:inline-block;margin-right:9px"></span><b>' + esc(b.label) + '</b></td>' +
          '<td class="num">' + b.pctv + '%</td>' +
          '<td class="num">' + fmt.compact(total) + '</td>' +
          '<td class="num">' + (b.cliff ? b.cliff + ' mo' : '—') + '</td>' +
          '<td class="num">' + (b.vest ? b.vest + ' mo' : 'none') + '</td>' +
          '<td class="num" style="color:' + (un > 0 ? 'var(--neon-2)' : 'var(--gray-dim)') + '">' + fmt.compact(un) +
          ' <span class="sx-dim">(' + ((un / total) * 100).toFixed(0) + '%)</span></td>' +
          '<td class="sx-dim">' + esc(b.why) + '</td>' +
          '</tr>';
      }).join('') +
        '<tr><td><b>Genesis contract</b></td><td colspan="6" class="sx-mono" style="word-break:break-all">' + TOKEN.contract + '</td></tr>';
    }

    scrub.addEventListener('input', function () { paintVest(+this.value); });
    $('#tk-copy').addEventListener('click', function () { S.copy(TOKEN.contract, 'Contract address copied'); });

    paintKpis(); paintDonut(); paintVest(mNow); paintTable();
    whenShown('tokenomics', function () { paintVest(+scrub.value); });
    S.on('sim', function () { if (route === 'tokenomics') paintKpis(); });
  }

  /* ============================================================
     10 · BOOT
     ============================================================ */
  function init() {
    S.page({ smooth: false });

    applyPrefs();
    initRouter();
    wireGoLinks();
    initClock();
    renderHealth();
    S.on('data:status', renderHealth);
    $('#d-sources').addEventListener('click', sourcesModal);

    if (IS_APP) initApp(); else initAdmin();

    /* re-apply the route once views are populated so onShow hooks fire */
    apply(route, false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window);
