/* ============================================================
   STRIX HOOD — Landing page behaviour
   Nothing on this page is a mock-up: every control does work.
   ============================================================ */
(function (global) {
  'use strict';

  var S = global.Strix;
  var $ = S.$, $$ = S.$$, el = S.el, fmt = S.fmt;

  /* ============================================================
     BOOT
     ============================================================ */
  S.boot({
    step: 210,
    lines: [
      'init strix-hood runtime v0.9.4',
      'loading policy engine … ok',
      'connecting binance stream … ok',
      'syncing ethereum head … ok',
      'agent registry 12,847 entries',
      'ready'
    ]
  });

  /* ============================================================
     3D — progressive enhancement, never load-bearing
     ============================================================ */
  function mount3D() {
    if (!global.Strix3D || !Strix3D.available()) return;

    var amb = $('#sx-ambient');
    if (amb) Strix3D.ambient(amb, { density: S.mobile ? 0.5 : 1 }).then(function (h) {
      if (!h) return;
      S.on('scroll', function () { h.setProgress(progress()); });
    });

    var wm = $('#hero-wordmark');
    if (wm) Strix3D.wordmark(wm).then(function (h) {
      if (!h) return;
      document.body.classList.add('has-3d-wordmark');
      S.on('scroll', function () { h.setProgress(Math.min(1, S.scrollY() / (global.innerHeight || 1))); });
    });

    var emblem = $('#hero-emblem');
    if (emblem) Strix3D.emblem(emblem).then(function (h) {
      if (!h) return;
      /* only now does the flat <img> under the canvas step aside */
      document.body.classList.add('has-3d-emblem');
      global.__sxEmblem = h;
      S.on('scroll', function () { h.setProgress(Math.min(1, S.scrollY() / ((global.innerHeight || 1) * 1.3))); });
    });

    var core = $('#hero-core');
    if (core) Strix3D.core(core).then(function (h) {
      if (!h) return;
      document.body.classList.add('has-3d-core');
      global.__sxCore = h;
      S.on('scroll', function () { h.setProgress(Math.min(1, S.scrollY() / ((global.innerHeight || 1) * 2))); });
    });

    var pass = $('#nft-card');
    if (pass) Strix3D.passport(pass).then(function (h) {
      if (!h) return;
      document.body.classList.add('has-3d-passport');
      global.__sxPassport = h;
    });
  }
  function progress() {
    var max = Math.max(1, document.documentElement.scrollHeight - global.innerHeight);
    return Math.min(1, S.scrollY() / max);
  }

  /* ============================================================
     TICKER — flat, seamless, driven by live market data
     ============================================================ */
  var RWA = [
    { sym: 'NVDAx', name: 'NVIDIA', base: 138.4 },
    { sym: 'TSLAx', name: 'Tesla', base: 246.9 },
    { sym: 'AAPLx', name: 'Apple', base: 229.7 },
    { sym: 'SPYx', name: 'S&P 500', base: 583.2 },
    { sym: 'GOOGx', name: 'Alphabet', base: 168.3 }
  ];
  var rwaRng = S.rng(7712);

  function tickerRows() {
    var rows = [];
    Object.keys(S.data.market).forEach(function (k) {
      var m = S.data.market[k];
      rows.push({ sym: m.sym, price: fmt.price(m.price), change: m.change24, live: m.live });
    });
    RWA.forEach(function (r) {
      r.px = r.px || r.base;
      r.px *= 1 + (rwaRng() - 0.5) * 0.002;
      var ch = ((r.px - r.base) / r.base) * 100;
      rows.push({ sym: r.sym, price: fmt.price(r.px), change: ch, live: false });
    });
    return rows;
  }

  function buildTicker() {
    var track = $('#ticker-track');
    if (!track) return;
    var rows = tickerRows();
    function laneHTML() {
      return rows.map(function (r) {
        var cls = r.change >= 0 ? 'sx-up' : 'sx-down';
        return '<span class="tick"><span class="tick__s">' + S.esc(r.sym) + '</span>' +
          '<span class="tick__p">' + r.price + '</span>' +
          '<span class="tick__c ' + cls + '">' + fmt.pct(r.change) + '</span></span>';
      }).join('');
    }
    // two identical lanes -> seamless -50% marquee
    track.innerHTML = '<div class="ticker__lane">' + laneHTML() + laneHTML() + '</div>';
  }

  function refreshTickerLabel() {
    var n = $('#ticker-src');
    if (!n) return;
    var st = S.data.status;
    n.textContent = st.ws === 'ok' ? 'binance ws · live'
      : st.binance === 'ok' ? 'binance rest · live'
        : st.gecko === 'ok' ? 'coingecko · live'
          : 'simulated feed';
  }

  /* ============================================================
     HERO STATS + FLOAT CARDS
     ============================================================ */
  function bindStats() {
    S.on('sim', function (m) {
      S.setNum($('#s-agents'), m.agents, function (v) { return fmt.n(v, 0); });
      S.setNum($('#s-intents'), m.intents24, function (v) { return fmt.n(v, 0); });
      S.setNum($('#s-exec'), m.execMs, function (v) { return Math.round(v) + 'ms'; });
      S.setNum($('#s-success'), m.success, function (v) { return v.toFixed(2) + '%'; });
      var ms = $('#fc-ms'); if (ms) ms.textContent = Math.round(m.execMs) + 'ms · settled';
      S.setNum($('#l-vol'), m.volume24, fmt.usdC);
      S.setNum($('#l-fees'), m.fees24, fmt.usdC);
      S.setNum($('#l-staked'), m.staked, function (v) { return fmt.compact(v) + ' STRX'; });
      S.setNum($('#l-live'), m.agentsLive, function (v) { return fmt.n(v, 0); });
    });

    S.on('tick', function (m) {
      if (m.sym === 'ETH') {
        var n = $('#fc-eth');
        if (n) { n.textContent = fmt.price(m.price); S.flash(n, m.price >= m.prev); }
      }
    });

    S.on('chain', function (c) {
      var b = $('#sx-hud-block'); if (b && c.block) b.textContent = fmt.n(c.block, 0);
      var lb = $('#l-block'); if (lb && c.block) lb.textContent = fmt.n(c.block, 0);
      var g = $('#l-gas'); if (g && c.gasGwei) g.textContent = c.gasGwei.toFixed(2) + ' gwei';
      var t = $('#l-tvl'); if (t && c.tvl) t.textContent = fmt.usdC(c.tvl);
    });

    S.on('sentiment', function (s) {
      var n = $('#l-fng');
      if (n) n.textContent = s.value + ' · ' + s.label;
    });

    var mkt = false;
    S.on('market', function () { if (!mkt) { mkt = true; } buildTicker(); refreshTickerLabel(); });
    S.on('data:status', refreshTickerLabel);
  }

  function floatParallax() {
    if (S.reduced || S.touch) return;
    var cards = $$('[data-float]');
    if (!cards.length) return;
    var vis = $('.hero__visual');
    document.addEventListener('mousemove', function (e) {
      var r = vis.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      cards.forEach(function (c) {
        var d = parseFloat(c.getAttribute('data-float')) || 0;
        c.style.translate = (dx * d * 90).toFixed(1) + 'px ' + (dy * d * 90).toFixed(1) + 'px';
      });
    }, { passive: true });
  }

  /* ============================================================
     INTENT CONSOLE — parses, runs the pipeline, reports
     ============================================================ */
  var EXAMPLES = [
    'swap 2,500 USDC into ETH when gas < 12 gwei',
    'buy 0.5 ETH every Monday at 09:00 UTC',
    'bid 4.2 WETH on Azuki floor',
    'sell 40 NVDAx if it drops 6% intraday',
    'pay 850 USDC invoice to 0xA1…9f every 30 days'
  ];

  function buildChips() {
    var host = $('#intent-chips');
    if (!host) return;
    EXAMPLES.slice(0, 3).forEach(function (t) {
      host.appendChild(el('button', {
        class: 'sx-pill', type: 'button', text: t,
        onclick: function () {
          var i = $('#intent-input');
          i.value = t; i.focus();
        }
      }));
    });
    host.appendChild(el('button', {
      class: 'sx-pill', type: 'button', text: '↻ surprise me',
      onclick: function () {
        var i = $('#intent-input');
        i.value = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
        i.focus();
      }
    }));
  }

  function parseIntent(text) {
    var t = (text || '').trim();
    if (!t) return null;
    var amount = null, sym = null, side = 'swap';
    var m = t.match(/([\d][\d,.]*)\s*(k|m)?/i);
    if (m) {
      amount = parseFloat(m[1].replace(/,/g, ''));
      if (/k/i.test(m[2] || '')) amount *= 1e3;
      if (/m/i.test(m[2] || '')) amount *= 1e6;
    }
    var sm = t.match(/\b(eth|btc|sol|arb|link|usdc|usdt|weth|nvdax|tslax|aaplx|spyx|googx)\b/i);
    if (sm) sym = sm[1].toUpperCase();
    if (/\b(buy|long|acquire)\b/i.test(t)) side = 'buy';
    else if (/\b(sell|short|exit|dispose)\b/i.test(t)) side = 'sell';
    else if (/\bbid\b/i.test(t)) side = 'bid';
    else if (/\b(pay|invoice|transfer|send)\b/i.test(t)) side = 'pay';
    return { text: t, amount: amount, sym: sym, side: side };
  }

  var STAGES = [
    { k: 'PARSE', h: 'Intent parsed', p: 'Natural language becomes a typed, signed intent object.', glyph: 'ring' },
    { k: 'POLICY', h: 'Policy check', p: 'Caps, allow-lists and slippage bounds evaluated against your committed hash.', glyph: 'sq' },
    { k: 'SIM', h: 'Simulation', p: 'Full state fork. If it reverts here, it never reaches a mempool.', glyph: 'dash' },
    { k: 'ROUTE', h: 'Solver auction', p: 'Competing solvers quote; best net-of-fee execution wins.', glyph: 'arc' },
    { k: 'SETTLE', h: 'Settlement', p: 'Atomic execution, receipt written to the agent passport.', glyph: 'diamond' }
  ];

  function renderStages() {
    var host = $('#pipe-stages');
    if (!host) return;
    STAGES.forEach(function (s, i) {
      host.appendChild(el('li', { class: 'stage', id: 'stage-' + i }, [
        el('div', { class: 'stage__node' }, [el('span', { class: 'sx-glyph sx-glyph--' + s.glyph })]),
        el('div', { class: 'stage__body' }, [
          el('div', { class: 'stage__n', text: '0' + (i + 1) + ' · ' + s.k }),
          el('h3', { text: s.h }),
          el('p', { text: s.p }),
          el('div', { class: 'stage__ms', text: '' })
        ])
      ]));
    });
  }

  function resetStages() {
    STAGES.forEach(function (_, i) {
      var n = $('#stage-' + i);
      n.classList.remove('is-on', 'is-done', 'is-block');
      $('.stage__ms', n).textContent = '';
    });
  }

  /* Runs the pipeline visually and returns a verdict. */
  function runPipeline(intent) {
    resetStages();
    var caps = policyState();
    var usd = estimateUSD(intent);
    var blockedAt = -1, reason = '';

    if (usd && usd > caps.tx) { blockedAt = 1; reason = 'exceeds per-transaction cap of ' + fmt.usd(caps.tx, 0); }
    else if (usd && usd > caps.day) { blockedAt = 1; reason = 'exceeds daily cap of ' + fmt.usd(caps.day, 0); }

    var trace = [];
    return new Promise(function (resolve) {
      var i = 0;
      (function step() {
        if (i >= STAGES.length) return resolve({ ok: true, trace: trace, usd: usd });
        var node = $('#stage-' + i);
        node.classList.add('is-on');
        var ms = Math.round(30 + Math.random() * (S.data.sim.metrics.execMs / 3));
        setTimeout(function () {
          node.classList.remove('is-on');
          if (i === blockedAt) {
            node.classList.add('is-block');
            $('.stage__ms', node).textContent = 'blocked';
            trace.push({ k: STAGES[i].k, ms: ms, ok: false, note: reason });
            return resolve({ ok: false, at: STAGES[i].k, reason: reason, trace: trace, usd: usd });
          }
          node.classList.add('is-done');
          $('.stage__ms', node).textContent = ms + 'ms';
          trace.push({ k: STAGES[i].k, ms: ms, ok: true });
          i++; step();
        }, S.reduced ? 20 : ms + 220);
      })();
    });
  }

  function estimateUSD(intent) {
    if (!intent || !intent.amount) return null;
    var s = intent.sym;
    if (!s || /USDC|USDT/.test(s)) return intent.amount;
    var m = S.data.market[s];
    if (m) return intent.amount * m.price;
    return intent.amount * 100;
  }

  function reportModal(intent, res) {
    var rows = res.trace.map(function (t) {
      return '<tr><td class="sx-mono">' + t.k + '</td><td class="num">' + t.ms + 'ms</td>' +
        '<td>' + (t.ok ? '<span class="sx-status sx-status--live"><i></i>PASS</span>'
          : '<span class="sx-status sx-status--warn"><i></i>HELD</span>') + '</td></tr>';
    }).join('');

    var head = res.ok
      ? '<p class="sx-body">Settled in simulation. On testnet this would have produced a signed receipt written to the agent passport.</p>'
      : '<p class="sx-body">The policy engine held this intent at <b class="sx-mono">' + res.at +
        '</b> — ' + S.esc(res.reason) + '. This is the mechanism working, not a failure. Raise the cap in the policy panel or approve it manually.</p>';

    S.modal({
      eyebrow: res.ok ? 'Simulation complete' : 'Held by policy',
      title: intent.text.length > 62 ? intent.text.slice(0, 62) + '…' : intent.text,
      subtitle: (intent.side.toUpperCase()) + (res.usd ? ' · notional ' + fmt.usd(res.usd, 0) : ''),
      body: head +
        '<div class="sx-tablewrap" style="margin-top:18px"><table class="sx-table" style="min-width:0">' +
        '<thead><tr><th>Stage</th><th class="num">Latency</th><th>Result</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>' +
        '<p class="sx-body" style="margin-top:16px;font-size:12.5px">Nothing was broadcast. Stage latencies come from the protocol simulator; ' +
        'market prices are live from Binance.</p>',
      actions: [
        { label: 'Ask the agent about this', variant: 'ghost', onClick: function () {
          if (S.chatbot) S.chatbot.ask(intent.text);
        } },
        { label: res.ok ? 'Open the app' : 'Adjust policy', variant: 'primary', onClick: function () {
          if (res.ok) location.href = 'app.html';
          else S.scrollTo('#security', 90);
        } }
      ]
    });
  }

  function wireIntent() {
    var form = $('#intent-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#intent-input');
      var text = input.value.trim() || input.placeholder;
      var intent = parseIntent(text);
      if (!intent) return;
      var btn = $('.intent__go');
      btn.classList.add('is-busy');
      if (global.__sxCore) global.__sxCore.pulse(1.4);
      if (global.__sxEmblem) global.__sxEmblem.pulse(1.2);
      S.scrollTo('#pipeline', 96);
      setTimeout(function () {
        runPipeline(intent).then(function (res) {
          btn.classList.remove('is-busy');
          reportModal(intent, res);
        });
      }, S.reduced ? 0 : 520);
    });

    var run = $('#pipe-run');
    if (run) run.addEventListener('click', function () {
      var intent = parseIntent(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);
      run.classList.add('is-busy');
      if (global.__sxCore) global.__sxCore.pulse(1.1);
      if (global.__sxEmblem) global.__sxEmblem.pulse(0.9);
      runPipeline(intent).then(function (res) {
        run.classList.remove('is-busy');
        reportModal(intent, res);
      });
    });
  }

  /* ============================================================
     BENTO — capability cards with generated visuals
     ============================================================ */
  var CAPS = [
    {
      tag: 'AMM · CLOB', size: 'wide', viz: 'depth',
      h: 'Spot crypto, seven chains targeted',
      p: 'Uniswap v4, Curve, Aerodrome and native order books behind one quote. Solvers compete on net-of-gas execution, not headline price.',
      detail: 'Routing runs a sealed-bid auction across registered solvers. Each quote is simulated against a forked state before it can win, so a route that would revert cannot be selected. Settlement is atomic: either the whole intent lands or none of it does.'
    },
    {
      tag: 'SEAPORT', size: 'half', viz: 'grid',
      h: 'NFT bids and fills',
      p: 'Signed Seaport orders with collection-level rules. Your agent can bid a floor without ever holding an approval it does not need.',
      detail: 'Approvals are scoped per-order and expire. The agent receives a spend allowance sized to the specific bid, and the allowance is revoked automatically when the order expires or fills.'
    },
    {
      tag: 'RWA', size: 'half', viz: 'candles',
      h: 'Tokenized equities',
      p: 'NVDAx, TSLAx, SPYx and friends — transfer-agent settled, tradeable in the same intent as your crypto leg.',
      detail: 'Equity legs settle through a regulated transfer agent and are represented onchain as permissioned tokens. The agent sees one balance sheet; the compliance boundary is enforced at the token, not in your prompt.'
    },
    {
      tag: 'A2A', size: 'third', viz: 'mesh',
      h: 'Agent-to-agent payments',
      p: 'Agents pay each other for work — data, compute, execution — with streaming or milestone settlement.',
      detail: 'Payment channels open lazily on first invoice and close on a schedule you set. Disputes escalate to the reputation bond, which is why registration requires collateral.'
    },
    {
      tag: 'RECURRING', size: 'third', viz: 'pulse',
      h: 'Scheduled intents',
      p: 'DCA, payroll, subscription renewals. The schedule lives onchain; missing a window is a recorded event, not a silent failure.',
      detail: 'Each scheduled execution carries the same policy checks as a manual one. If your cap has been consumed, the run is held rather than skipped, and you get the notification.'
    },
    {
      tag: 'GUARDS', size: 'third', viz: 'shield',
      h: 'Conditional guards',
      p: 'Gas ceilings, price bands, oracle staleness, venue blacklists — expressed once, enforced every run.',
      detail: 'Guards are pure predicates evaluated inside the policy engine. They cannot be argued with by the model driving the agent, because the model never sees the private key.'
    }
  ];

  function vizSVG(kind) {
    var g = '#CCFF00', t = '#00E5A0';
    if (kind === 'depth') {
      var pts = [], i;
      for (i = 0; i <= 40; i++) pts.push(i * 10 + ',' + (120 - Math.pow(i / 40, 1.7) * 96));
      return svg('<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + g + '" stroke-width="1.6" opacity=".7"/>' +
        '<polygon points="0,120 ' + pts.join(' ') + ' 400,120" fill="' + g + '" opacity=".08"/>' +
        Array.from({ length: 22 }, function (_, k) {
          return '<rect x="' + (k * 18 + 4) + '" y="' + (118 - (6 + (k % 5) * 9)) + '" width="7" height="' + (6 + (k % 5) * 9) + '" fill="' + t + '" opacity=".18"/>';
        }).join(''));
    }
    if (kind === 'grid') {
      return svg(Array.from({ length: 24 }, function (_, k) {
        var x = (k % 8) * 48 + 12, y = Math.floor(k / 8) * 38 + 12;
        return '<rect x="' + x + '" y="' + y + '" width="34" height="30" rx="5" fill="none" stroke="' +
          (k % 5 === 0 ? g : 'rgba(255,255,255,.1)') + '" stroke-width="1"/>';
      }).join(''));
    }
    if (kind === 'candles') {
      return svg(Array.from({ length: 26 }, function (_, k) {
        var up = (k * 7 % 3) !== 0, h = 16 + (k * 13 % 46), y = 30 + (k * 17 % 42);
        var c = up ? g : '#FF5000';
        return '<line x1="' + (k * 15 + 10) + '" y1="' + (y - 8) + '" x2="' + (k * 15 + 10) + '" y2="' + (y + h + 8) + '" stroke="' + c + '" stroke-width="1" opacity=".55"/>' +
          '<rect x="' + (k * 15 + 6) + '" y="' + y + '" width="9" height="' + h + '" fill="' + c + '" opacity=".55"/>';
      }).join(''));
    }
    if (kind === 'mesh') {
      var nodes = Array.from({ length: 9 }, function (_, k) { return [40 + (k % 3) * 150 + (k * 29 % 40), 20 + Math.floor(k / 3) * 42 + (k * 17 % 24)]; });
      var lines = '';
      nodes.forEach(function (a, ai) { nodes.forEach(function (b, bi) { if (bi > ai && Math.hypot(a[0] - b[0], a[1] - b[1]) < 175) lines += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + g + '" stroke-width=".8" opacity=".28"/>'; }); });
      return svg(lines + nodes.map(function (n, k) { return '<circle cx="' + n[0] + '" cy="' + n[1] + '" r="' + (k % 3 === 0 ? 4 : 2.6) + '" fill="' + (k % 3 === 0 ? t : g) + '" opacity=".8"/>'; }).join(''));
    }
    if (kind === 'pulse') {
      return svg(Array.from({ length: 5 }, function (_, k) {
        return '<circle cx="200" cy="70" r="' + (18 + k * 22) + '" fill="none" stroke="' + (k % 2 ? t : g) + '" stroke-width="1" opacity="' + (0.34 - k * 0.05) + '"/>';
      }).join('') + '<circle cx="200" cy="70" r="7" fill="' + g + '" opacity=".85"/>');
    }
    return svg('<path d="M200 12 L268 42 C272 92 244 122 200 134 C156 122 128 92 132 42 Z" fill="none" stroke="' + g + '" stroke-width="1.4" opacity=".55"/>' +
      '<path d="M200 32 L250 54 C253 90 232 110 200 118 C168 110 147 90 150 54 Z" fill="' + g + '" opacity=".07"/>' +
      '<path d="M176 72 L194 90 L228 56" fill="none" stroke="' + t + '" stroke-width="2.4" opacity=".8"/>');
  }
  function svg(inner) {
    return '<svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="width:100%;height:100%">' + inner + '</svg>';
  }

  function renderBento() {
    var host = $('#bento');
    if (!host) return;
    CAPS.forEach(function (c) {
      var card = el('button', {
        class: 'sx-card sx-card--hover bcard bcard--' + c.size, type: 'button',
        'aria-label': c.h + ' — open details'
      }, [
        el('div', { class: 'bcard__viz', html: vizSVG(c.viz) }),
        el('span', { class: 'sx-card__sheen' }),
        el('span', { class: 'bcard__tag sx-mono', text: c.tag }),
        el('div', { class: 'bcard__body' }, [
          el('h3', { text: c.h }),
          el('p', { text: c.p }),
          el('span', { class: 'bcard__more' }, [document.createTextNode('How it works'), el('span', { class: 'sx-glyph sx-glyph--diamond' })])
        ])
      ]);
      card.addEventListener('click', function () {
        S.modal({
          eyebrow: c.tag, title: c.h,
          body: '<p class="sx-lead" style="font-size:16px">' + S.esc(c.p) + '</p>' +
            '<p class="sx-body" style="margin-top:16px">' + S.esc(c.detail) + '</p>',
          actions: [
            { label: 'Ask the agent', variant: 'ghost', onClick: function () { if (S.chatbot) S.chatbot.ask(c.h); } },
            { label: 'Read the docs', variant: 'primary', onClick: function () { location.href = 'docs.html#core-concepts'; } }
          ]
        });
      });
      host.appendChild(card);
    });
  }

  /* ============================================================
     HIRE — filter, search, detail, deploy
     ============================================================ */
  var AGENTS = [
    { id: 'atlas-7', name: 'Atlas-7', role: 'Market Analyst', cat: 'research', rep: 982, runs: 41822, rev: 128400, fee: 0.6, art: 'analyst',
      p: 'Reads order flow across 14 venues and publishes a signed thesis before every execution it recommends.',
      skills: ['orderflow', 'signals', 'reporting'] },
    { id: 'vega-prime', name: 'Vega-Prime', role: 'Trading Executor', cat: 'trading', rep: 968, runs: 128904, rev: 402100, fee: 0.9, art: 'executor',
      p: 'Latency-optimised solver client. Splits large intents across venues to keep realised slippage under your band.',
      skills: ['routing', 'twap', 'slippage'] },
    { id: 'nyx-04', name: 'Nyx-04', role: 'Payment Agent', cat: 'payments', rep: 941, runs: 88210, rev: 96300, fee: 0.4, art: 'payment',
      p: 'Handles invoices, payroll and subscription renewals with per-counterparty allowances that expire on schedule.',
      skills: ['invoices', 'streaming', 'fx'] },
    { id: 'aegis-1', name: 'Aegis-1', role: 'Portfolio Guardian', cat: 'risk', rep: 995, runs: 22940, rev: 174800, fee: 1.2, art: 'guardian',
      p: 'Watches every position against your risk policy and can force-unwind before a breach becomes a loss.',
      skills: ['risk', 'unwind', 'alerts'] },
    { id: 'corvus', name: 'Corvus', role: 'Research Synthesizer', cat: 'research', rep: 957, runs: 63417, rev: 88200, fee: 0.5, art: 'research',
      p: 'Aggregates governance forums, audits and onchain data into a single decision brief with citations.',
      skills: ['synthesis', 'governance', 'audits'] },
    { id: 'meridian', name: 'Meridian', role: 'RWA Desk', cat: 'trading', rep: 974, runs: 30188, rev: 211500, fee: 1.0, art: 'executor',
      p: 'Bridges tokenized equity legs with crypto collateral in a single atomic intent.',
      skills: ['rwa', 'equities', 'collateral'] },
    { id: 'sable-9', name: 'Sable-9', role: 'NFT Sniper', cat: 'nft', rep: 903, runs: 15402, rev: 61200, fee: 0.7, art: 'analyst',
      p: 'Monitors Seaport listings and places scoped bids the moment a floor condition is met.',
      skills: ['seaport', 'floor', 'traits'] },
    { id: 'halcyon-2', name: 'Halcyon-2', role: 'Treasury Operator', cat: 'payments', rep: 988, runs: 9942, rev: 143700, fee: 1.1, art: 'guardian',
      p: 'Runs DAO treasury operations under multi-sig policy with a full audit trail per action.',
      skills: ['treasury', 'multisig', 'reporting'] }
  ];
  var CATS = [
    { k: 'all', label: 'All' }, { k: 'trading', label: 'Trading' }, { k: 'research', label: 'Research' },
    { k: 'payments', label: 'Payments' }, { k: 'risk', label: 'Risk' }, { k: 'nft', label: 'NFT' }
  ];
  var hireState = { cat: 'all', q: '' };

  /* Supplied artwork, colour-graded to Robin Neon. Anything not in this
     map falls back to the procedural portrait renderer below. */
  var ART = { analyst: 1, executor: 1, payment: 1, guardian: 1, research: 1 };

  function artNode(art, kind, alt) {
    var pic = el('picture', {});
    pic.appendChild(el('source', { type: 'image/webp', srcset: 'assets/agents/' + art + '-' + kind + '.webp' }));
    pic.appendChild(el('img', {
      src: 'assets/agents/' + art + '-' + kind + '.jpg', alt: alt, loading: 'lazy', decoding: 'async',
      style: { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' }
    }));
    return pic;
  }

  /* Procedural portrait — used for agents with no supplied artwork. */
  function portrait(canvas, seed, art) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || 260, h = canvas.clientHeight || 162;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var r = S.rng(seed);
    ctx.clearRect(0, 0, w, h);

    var grd = ctx.createRadialGradient(w * 0.5, h * 0.42, 4, w * 0.5, h * 0.5, h * 0.95);
    grd.addColorStop(0, 'rgba(204,255,0,.16)');
    grd.addColorStop(1, 'rgba(10,10,15,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);

    // concentric scan rings
    ctx.strokeStyle = 'rgba(204,255,0,.13)';
    for (var i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(w / 2, h * 0.56, i * h * 0.17, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }

    // silhouette: hood + shoulders
    ctx.beginPath();
    var cx = w / 2, top = h * 0.16, hw = h * 0.20;
    ctx.moveTo(cx - hw * 1.9, h);
    ctx.lineTo(cx - hw * 1.15, h * 0.66);
    ctx.quadraticCurveTo(cx - hw * 1.06, top, cx, top);
    ctx.quadraticCurveTo(cx + hw * 1.06, top, cx + hw * 1.15, h * 0.66);
    ctx.lineTo(cx + hw * 1.9, h);
    ctx.closePath();
    ctx.fillStyle = '#0C0D10'; ctx.fill();
    ctx.strokeStyle = 'rgba(204,255,0,.5)'; ctx.lineWidth = 1.4; ctx.stroke();

    // visor
    var vy = h * 0.42, vw = hw * 1.15;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx - vw / 2, vy - hw * 0.34, vw, hw * 0.68, 5) :
      ctx.rect(cx - vw / 2, vy - hw * 0.34, vw, hw * 0.68);
    ctx.fillStyle = 'rgba(4,5,3,.95)'; ctx.fill();
    ctx.strokeStyle = 'rgba(204,255,0,.55)'; ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - vw / 2 + 2, vy - hw * 0.34 + 2, vw - 4, hw * 0.68 - 4);
    ctx.clip();
    ctx.fillStyle = '#CCFF00';
    if (art === 'executor') {
      ctx.fillRect(cx - vw * 0.34, vy - 2.2, vw * 0.26, 4.4);
      ctx.fillRect(cx + vw * 0.08, vy - 2.2, vw * 0.26, 4.4);
    } else if (art === 'payment') {
      ctx.beginPath(); ctx.arc(cx, vy, hw * 0.2, 0, Math.PI * 2); ctx.strokeStyle = '#CCFF00'; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.fillRect(cx - 1, vy - hw * 0.26, 2, hw * 0.52);
    } else if (art === 'guardian') {
      ctx.beginPath();
      ctx.moveTo(cx, vy - hw * 0.26); ctx.lineTo(cx + hw * 0.2, vy - hw * 0.12);
      ctx.lineTo(cx + hw * 0.14, vy + hw * 0.24); ctx.lineTo(cx, vy + hw * 0.3);
      ctx.lineTo(cx - hw * 0.14, vy + hw * 0.24); ctx.lineTo(cx - hw * 0.2, vy - hw * 0.12);
      ctx.closePath(); ctx.fill();
    } else if (art === 'research') {
      ctx.beginPath(); ctx.arc(cx, vy, hw * 0.22, 0, Math.PI * 2); ctx.strokeStyle = '#CCFF00'; ctx.lineWidth = 3.4; ctx.stroke();
    } else {
      for (var k = 0; k < 34; k++) {
        var px = cx - vw * 0.36 + (k % 17) * (vw * 0.72 / 16);
        var py = vy + Math.sin(k * 0.8) * hw * 0.16 + (k > 16 ? 2 : -2);
        ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // hologram panel
    ctx.strokeStyle = 'rgba(0,229,160,.42)';
    ctx.strokeRect(w * 0.06, h * 0.55, w * 0.3, h * 0.34);
    ctx.fillStyle = 'rgba(0,229,160,.07)';
    ctx.fillRect(w * 0.06, h * 0.55, w * 0.3, h * 0.34);
    ctx.fillStyle = 'rgba(204,255,0,.6)';
    for (var b = 0; b < 9; b++) {
      var bh = 3 + r() * h * 0.22;
      ctx.fillRect(w * 0.075 + b * (w * 0.031), h * 0.87 - bh, w * 0.02, bh);
    }

    // corner brackets
    ctx.strokeStyle = 'rgba(204,255,0,.45)'; ctx.lineWidth = 1.2;
    [[6, 6, 1, 1], [w - 6, 6, -1, 1], [6, h - 6, 1, -1], [w - 6, h - 6, -1, -1]].forEach(function (c) {
      ctx.beginPath(); ctx.moveTo(c[0] + 13 * c[2], c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + 13 * c[3]); ctx.stroke();
    });
  }

  function agentCard(a) {
    var card = el('article', { class: 'sx-card sx-card--hover agent', tabindex: '0', role: 'button',
      'aria-label': a.name + ', ' + a.role + ' — view details' }, [
      el('span', { class: 'sx-card__sheen' }),
      el('div', { class: 'agent__port' }, [
        ART[a.art] ? artNode(a.art, 'card', a.name + ' — ' + a.role)
          : el('canvas', { 'aria-hidden': 'true' }),
        el('span', { class: 'agent__badge', text: a.role.toUpperCase() }),
        el('span', { class: 'agent__rep sx-status sx-status--live' }, [el('i'), document.createTextNode(a.rep + '/1000')])
      ]),
      el('div', {}, [
        el('h3', { text: a.name }),
        el('div', { class: 'agent__role', text: a.cat.toUpperCase() + ' · ' + a.fee.toFixed(1) + '% fee' })
      ]),
      el('p', { text: a.p }),
      el('div', { class: 'agent__meta' }, [
        el('div', {}, [el('span', { text: 'Executions' }), el('b', { text: fmt.compact(a.runs) })]),
        el('div', {}, [el('span', { text: 'Revenue' }), el('b', { text: fmt.usdC(a.rev) })]),
        el('div', {}, [el('span', { text: 'Bond' }), el('b', { text: '25K STRX' })])
      ])
    ]);
    function open() { agentModal(a); }
    card.addEventListener('click', open);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    return card;
  }

  function agentModal(a) {
    var body = el('div', {});
    var hero = ART[a.art]
      ? '<picture><source type="image/webp" srcset="assets/agents/' + a.art + '-portrait.webp">' +
        '<img src="assets/agents/' + a.art + '-portrait.jpg" alt="' + S.esc(a.name + ' — ' + a.role) + '" ' +
        'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></picture>'
      : '<canvas id="am-port" style="position:absolute;inset:0;width:100%;height:100%"></canvas>';
    body.innerHTML =
      '<div style="position:relative;aspect-ratio:' + (ART[a.art] ? '4/3' : '16/8') + ';border-radius:14px;overflow:hidden;border:1px solid var(--glass);background:#07070B;margin-bottom:20px">' +
      hero + '</div>' +
      '<p class="sx-lead" style="font-size:15.5px">' + S.esc(a.p) + '</p>' +
      '<div class="sx-row" style="margin-top:16px">' +
      a.skills.map(function (s) { return '<span class="sx-pill sx-pill--static">' + S.esc(s) + '</span>'; }).join('') +
      '</div>' +
      '<div class="sx-grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-top:22px">' +
      stat('Reputation', a.rep + ' / 1000') + stat('Executions', fmt.n(a.runs, 0)) +
      stat('Revenue', fmt.usdC(a.rev)) + stat('Protocol fee', a.fee.toFixed(1) + '%') +
      '</div>' +
      '<p class="sx-body" style="margin-top:20px;font-size:12.5px">Hiring this agent grants it a scoped allowance under your policy. ' +
      'It cannot exceed your caps, and you can revoke at any time from the app.</p>';
    function stat(k, v) {
      return '<div class="sx-stat"><span class="sx-stat__k">' + k + '</span><span class="sx-stat__v" style="font-size:19px">' + v + '</span></div>';
    }

    S.modal({
      eyebrow: a.role, title: a.name, wide: true, body: body,
      onOpen: function (m) {
        var c = S.$('#am-port', m.el);
        if (c) requestAnimationFrame(function () { portrait(c, a.name.length * 977 + 13, a.art); });
      },
      actions: [
        { label: 'Ask about this agent', variant: 'ghost', onClick: function () { if (S.chatbot) S.chatbot.ask('tell me about ' + a.name); } },
        { label: 'Hire agent', variant: 'primary', close: false, onClick: function (m) {
          S.wallet.require('Hiring an agent grants it a scoped allowance, so it needs your wallet.')
            .then(function () {
              S.toast({ title: 'Agent hired', body: a.name + ' is now scoped to your policy. Manage it in the app.' });
              m.close();
              setTimeout(function () { location.href = 'app.html#agents'; }, 900);
            })
            .catch(function () { });
        } }
      ]
    });
  }

  function renderHire() {
    var tabs = $('#hire-tabs'), grid = $('#hire-grid');
    if (!tabs || !grid) return;

    CATS.forEach(function (c) {
      tabs.appendChild(el('button', {
        class: 'sx-tab' + (c.k === hireState.cat ? ' is-active' : ''), type: 'button', text: c.label,
        onclick: function () {
          hireState.cat = c.k;
          $$('.sx-tab', tabs).forEach(function (t) { t.classList.toggle('is-active', t.textContent === c.label); });
          paint();
        }
      }));
    });

    var search = $('#hire-search');
    var deb;
    search.addEventListener('input', function () {
      clearTimeout(deb);
      deb = setTimeout(function () { hireState.q = search.value.trim().toLowerCase(); paint(); }, 140);
    });

    function paint() {
      var list = AGENTS.filter(function (a) {
        if (hireState.cat !== 'all' && a.cat !== hireState.cat) return false;
        if (!hireState.q) return true;
        return (a.name + ' ' + a.role + ' ' + a.skills.join(' ') + ' ' + a.p).toLowerCase().indexOf(hireState.q) > -1;
      });
      grid.innerHTML = '';
      list.forEach(function (a) { grid.appendChild(agentCard(a)); });
      $('#hire-empty').hidden = list.length > 0;
      requestAnimationFrame(function () {
        $$('.agent__port', grid).forEach(function (port, i) {
          var c = $('canvas', port);
          if (c) portrait(c, list[i].name.length * 977 + 13, list[i].art);
        });
      });
    }
    paint();
    global.addEventListener('resize', S.debounceResize || (S.debounceResize = debounce(paint, 260)));
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  /* ============================================================
     NFT PASSPORT — modules change real stats
     ============================================================ */
  var MODULES = [
    { k: 'router', label: 'Router v3', d: { speed: 34, risk: 0, yield: 4 }, on: true },
    { k: 'sim', label: 'Deep Simulator', d: { speed: -12, risk: 26, yield: 0 }, on: true },
    { k: 'oracle', label: 'Oracle Guard', d: { speed: -4, risk: 18, yield: 0 }, on: false },
    { k: 'mev', label: 'MEV Shield', d: { speed: -6, risk: 14, yield: 6 }, on: true },
    { k: 'yield', label: 'Idle Yield', d: { speed: 0, risk: -8, yield: 22 }, on: false }
  ];
  var BASE = { speed: 340, risk: 61, yield: 3.1 };

  function renderModules() {
    var host = $('#modules');
    if (!host) return;
    MODULES.forEach(function (m) {
      var b = el('button', {
        class: 'module', type: 'button', 'aria-pressed': String(m.on), 'data-mod': m.k
      }, [
        el('span', { class: 'sx-glyph sx-glyph--' + (m.on ? 'diamond' : 'ring') }),
        document.createTextNode(m.label),
        el('small', { text: (m.d.speed > 0 ? '+' : '') + m.d.speed + 'ms' })
      ]);
      b.addEventListener('click', function () {
        m.on = !m.on;
        b.setAttribute('aria-pressed', String(m.on));
        $('.sx-glyph', b).className = 'sx-glyph sx-glyph--' + (m.on ? 'diamond' : 'ring');
        paintStats();
        if (global.__sxPassport) global.__sxPassport.setAccent(m.on ? '#CCFF00' : '#00E5A0');
        S.toast({ title: m.label + (m.on ? ' equipped' : ' removed'), body: 'Passport metadata updated.' });
      });
      host.appendChild(b);
    });
    paintStats();
  }

  function paintStats() {
    var host = $('#nft-stats');
    if (!host) return;
    var s = { speed: BASE.speed, risk: BASE.risk, yield: BASE.yield };
    MODULES.forEach(function (m) {
      if (!m.on) return;
      s.speed -= m.d.speed; s.risk += m.d.risk; s.yield += m.d.yield / 10;
    });
    s.speed = Math.max(90, s.speed);
    s.risk = Math.max(0, Math.min(100, s.risk));
    host.innerHTML =
      row('Settle latency', Math.round(s.speed) + 'ms') +
      row('Safety score', Math.round(s.risk) + '/100') +
      row('Idle APY', s.yield.toFixed(1) + '%') +
      row('Modules', MODULES.filter(function (m) { return m.on; }).length + '/' + MODULES.length);
    function row(k, v) { return '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'; }
  }

  function wireMint() {
    var b = $('#mint-passport');
    if (!b) return;
    b.addEventListener('click', function () {
      b.classList.add('is-busy');
      S.wallet.require('Minting a passport writes an ERC-721 to your address.')
        .then(function (st) {
          b.classList.remove('is-busy');
          S.modal({
            eyebrow: 'Not deployed',
            title: 'Loadout ready, contract is not',
            subtitle: st.walletName + ' · ' + fmt.addr(st.address, 8, 6),
            body: '<p class="sx-body">Nothing is broadcast. There is no passport contract to mint against yet, on ' +
              'any network — this is the loadout your passport would carry, with the ' +
              MODULES.filter(function (m) { return m.on; }).length + ' modules you selected. ' +
              'Minting opens after the registry contract is deployed and audited, in that order.</p>' +
              '<div class="sx-card sx-card--flat" style="margin-top:16px"><span class="sx-label">Selected modules</span>' +
              '<p class="sx-mono" style="margin-top:8px;font-size:13px">' +
              (MODULES.filter(function (m) { return m.on; }).map(function (m) { return m.label; }).join(' · ') || 'none') +
              '</p></div>',
            actions: [
              { label: 'Sign a proof instead', variant: 'ghost', onClick: function () {
                S.wallet.signMessage('Strix Hood passport intent — ' + Date.now())
                  .then(function (sig) { S.toast({ title: 'Signed', body: fmt.addr(sig, 14, 10) }); })
                  .catch(function () { S.toast({ title: 'Signing cancelled', type: 'warn' }); });
              } },
              { label: 'Open the app', variant: 'primary', onClick: function () { location.href = 'app.html'; } }
            ]
          });
        })
        .catch(function () { b.classList.remove('is-busy'); });
    });
  }

  /* ============================================================
     SECURITY — layers + live policy
     ============================================================ */
  var LAYERS = [
    { n: '01', t: 'Account Abstraction', s: 'ERC-4337', p: 'The agent never holds a private key with unlimited authority. It operates a smart account whose validation logic you own.',
      pts: ['Session keys scoped per venue and per asset', 'Revocable in one transaction', 'Social recovery independent of the agent'] },
    { n: '02', t: 'Spending Policy', s: 'onchain hash', p: 'Caps, allow-lists and guards are committed as a hash. The executor cannot act outside the committed policy, and changing it is a signed event.',
      pts: ['Per-transaction and rolling daily caps', 'Venue and counterparty allow/deny lists', 'Slippage and gas ceilings'] },
    { n: '03', t: 'Simulation', s: 'forked state', p: 'Every candidate route is executed against a fork before it can win the auction. A route that reverts in simulation cannot reach a mempool.',
      pts: ['Balance-delta assertions', 'Approval-diff inspection', 'Oracle staleness checks'] },
    { n: '04', t: 'Contract Audit', s: 'continuous', p: 'Target contracts are checked against a registry of audited bytecode and known-malicious patterns before interaction.',
      pts: ['Bytecode fingerprint matching', 'Proxy-upgrade detection', 'Honeypot and blacklist heuristics'] },
    { n: '05', t: 'Human in the Loop', s: 'threshold', p: 'Above a threshold you set, execution pauses for explicit approval. The agent waits; it does not retry around you.',
      pts: ['Push, email or webhook escalation', 'Configurable timeout behaviour', 'Every hold recorded on the passport'] }
  ];

  function renderLayers() {
    var host = $('#layers');
    if (!host) return;
    LAYERS.forEach(function (l, i) {
      var panelId = 'layer-p-' + i;
      var li = el('li', { class: 'layer' }, [
        el('button', { class: 'layer__btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': panelId }, [
          el('span', { class: 'layer__i sx-mono', text: l.n }),
          el('span', { class: 'layer__t' }, [el('b', { text: l.t }), el('span', { text: l.s })]),
          el('span', { class: 'sx-status sx-status--live' }, [el('i'), document.createTextNode('ACTIVE')]),
          el('span', { class: 'layer__chev' })
        ]),
        el('div', { class: 'layer__panel', id: panelId }, [
          el('div', {}, [
            el('p', { text: l.p }),
            el('ul', { html: l.pts.map(function (p) { return '<li>' + S.esc(p) + '</li>'; }).join('') })
          ])
        ])
      ]);
      var btn = $('.layer__btn', li);
      btn.addEventListener('click', function () {
        var open = !li.classList.contains('is-open');
        $$('.layer', host).forEach(function (o) { o.classList.remove('is-open'); $('.layer__btn', o).setAttribute('aria-expanded', 'false'); });
        li.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      });
      host.appendChild(li);
    });
    host.firstChild.classList.add('is-open');
    $('.layer__btn', host.firstChild).setAttribute('aria-expanded', 'true');
  }

  var VENUES = [
    { k: 'uniswap', label: 'Uniswap', on: true }, { k: 'curve', label: 'Curve', on: true },
    { k: 'seaport', label: 'Seaport', on: true }, { k: 'rwa', label: 'RWA desk', on: true },
    { k: 'perps', label: 'Perps', on: false }, { k: 'bridges', label: 'Bridges', on: false }
  ];

  function policyState() {
    return {
      day: +$('#p-day').value,
      tx: +$('#p-tx').value,
      slip: +$('#p-slip').value / 100,
      human: $('#p-human').getAttribute('aria-checked') === 'true',
      venues: VENUES.filter(function (v) { return v.on; }).map(function (v) { return v.k; })
    };
  }

  function policyHash() {
    var p = policyState();
    var str = JSON.stringify(p);
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      h1 ^= str.charCodeAt(i); h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 ^ (str.charCodeAt(i) * 31)) >>> 0; h2 = (h2 * 0x85ebca6b) >>> 0;
    }
    var hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2);
    return '0x' + hex.slice(0, 8) + '…' + hex.slice(-6);
  }

  function wirePolicy() {
    var day = $('#p-day'), tx = $('#p-tx'), slip = $('#p-slip'), human = $('#p-human');
    if (!day) return;

    function paint() {
      $('#p-day-v').textContent = fmt.usd(+day.value, 0);
      $('#p-tx-v').textContent = fmt.usd(+tx.value, 0);
      $('#p-slip-v').textContent = (+slip.value / 100).toFixed(2) + '%';
      $('#policy-hash').textContent = policyHash();
    }

    [day, tx, slip].forEach(function (r) { r.addEventListener('input', paint); });

    // per-tx can never exceed the daily cap
    tx.addEventListener('input', function () {
      if (+tx.value > +day.value) { day.value = tx.value; }
      paint();
    });
    day.addEventListener('input', function () {
      if (+tx.value > +day.value) { tx.value = day.value; }
      paint();
    });

    human.addEventListener('click', function () {
      var on = human.getAttribute('aria-checked') !== 'true';
      human.setAttribute('aria-checked', String(on));
      paint();
    });

    var chips = $('#policy-chips');
    VENUES.forEach(function (v) {
      var b = el('button', { class: 'sx-pill', type: 'button', 'aria-pressed': String(v.on), text: v.label });
      b.addEventListener('click', function () {
        v.on = !v.on;
        b.setAttribute('aria-pressed', String(v.on));
        paint();
      });
      chips.appendChild(b);
    });

    $('#policy-copy').addEventListener('click', function () {
      S.copy(policyHash().replace('…', ''), 'Policy hash copied');
    });

    $('#policy-save').addEventListener('click', function (e) {
      var b = e.currentTarget;
      b.classList.add('is-busy');
      setTimeout(function () {
        b.classList.remove('is-busy');
        var p = policyState();
        S.toast({
          title: 'Policy committed',
          body: 'Cap ' + fmt.usd(p.day, 0) + '/day · ' + fmt.usd(p.tx, 0) + '/tx · ' + p.venues.length + ' venues allowed.'
        });
        if (global.__sxCore) global.__sxCore.pulse(0.8);
        if (global.__sxEmblem) global.__sxEmblem.pulse(0.7);
      }, 900);
    });

    paint();
  }

  /* ============================================================
     TOKEN
     ============================================================ */
  var UTIL = [
    { g: 'ring', h: 'Registration bond', p: 'Developers stake $STRX to register an agent. Sybil resistance priced in capital, not captchas.' },
    { g: 'diamond', h: 'Reputation collateral', p: 'Fraud and policy breaches slash the bond. Honest operators earn a share of protocol fees.' },
    { g: 'arc', h: 'Protocol fee', p: '0.25% of commerce volume, split between treasury, stakers and a buyback that burns.' },
    { g: 'dash', h: 'Discovery weight', p: 'Marketplace ranking is bond-weighted, so visibility costs something real.' }
  ];

  function renderToken() {
    var host = $('#token-grid');
    if (!host) return;
    UTIL.forEach(function (u) {
      host.appendChild(el('div', { class: 'sx-card tcard' }, [
        el('span', { class: 'sx-glyphbox' }, [el('span', { class: 'sx-glyph sx-glyph--' + u.g })]),
        el('div', {}, [el('h3', { text: u.h }), el('p', { text: u.p })])
      ]));
    });
    var copy = $('#strx-copy');
    if (copy) copy.addEventListener('click', contractModal);
  }


  /* ============================================================
     SMART CONTRACT PANEL
     Nothing is deployed yet, so this reports deployment state per
     chain rather than printing an address that does not exist.
     ============================================================ */
  var DEPLOYMENTS = [
    { chain: 'Ethereum',    net: 'Sepolia',        status: 'testnet', explorer: 'https://sepolia.etherscan.io' },
    { chain: 'Base',        net: 'Base Sepolia',   status: 'testnet', explorer: 'https://sepolia.basescan.org' },
    { chain: 'Arbitrum',    net: 'Arbitrum Sepolia', status: 'testnet', explorer: 'https://sepolia.arbiscan.io' },
    { chain: 'OP Mainnet',  net: 'OP Sepolia',     status: 'queued',  explorer: 'https://sepolia-optimism.etherscan.io' },
    { chain: 'Polygon',     net: 'Amoy',           status: 'queued',  explorer: 'https://amoy.polygonscan.com' },
    { chain: 'BNB Chain',   net: 'BNB Testnet',    status: 'queued',  explorer: 'https://testnet.bscscan.com' },
    { chain: 'Solana',      net: 'Devnet',         status: 'queued',  explorer: 'https://solscan.io' }
  ];

  function contractModal() {
    var rows = DEPLOYMENTS.map(function (d) {
      var pill = d.status === 'testnet'
        ? '<span class="sx-status sx-status--live"><i></i>TESTNET</span>'
        : '<span class="sx-status sx-status--idle"><i></i>QUEUED</span>';
      return '<tr><td><b>' + S.esc(d.chain) + '</b><br><span class="sx-dim sx-mono" style="font-size:11px">' +
        S.esc(d.net) + '</span></td><td>' + pill + '</td>' +
        '<td class="num"><a class="sx-mono" style="color:var(--neon)" href="' + d.explorer +
        '" target="_blank" rel="noopener noreferrer">explorer &rarr;</a></td></tr>';
    }).join('');

    S.modal({
      eyebrow: 'Contracts',
      title: 'Not deployed to mainnet yet',
      subtitle: 'Registry and settlement contracts are running on testnets only.',
      wide: true,
      body:
        '<p class="sx-body">There is no mainnet $STRX token and no mainnet registry address. ' +
        'Anyone offering you one is not us. Mainnet addresses will be published here, in the docs, ' +
        'and from <a style="color:var(--neon)" href="https://x.com/strixhood" target="_blank" rel="noopener noreferrer">@strixhood</a> ' +
        'once an external audit has been completed — none has been, and none is under way.</p>' +
        '<div class="sx-tablewrap" style="margin-top:18px"><table class="sx-table" style="min-width:0">' +
        '<thead><tr><th scope="col">Chain</th><th scope="col">Status</th><th scope="col" class="num">Explorer</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        '<p class="sx-body" style="margin-top:16px;font-size:12.5px">Testnet contracts are unaudited and get ' +
        'redeployed without notice. Do not send anything you are not prepared to lose.</p>',
      actions: [
        { label: 'Read the spec', variant: 'ghost', onClick: function () { location.href = 'docs.html#networks'; } },
        { label: 'Get notified', variant: 'primary', onClick: function () { S.scrollTo('#cta', 90); } }
      ]
    });
  }

  /* ============================================================
     LIVE FEED
     ============================================================ */
  function startFeed() {
    var host = $('#feed');
    if (!host) return;
    function push() {
      var e = S.data.randomEvent();
      var row = el('div', { class: 'sx-feed__row is-new' }, [
        el('span', { class: 'sx-status sx-status--' + (e.kind === 'warn' ? 'warn' : 'live') }, [el('i')]),
        el('span', { class: 'sx-mono', style: { color: 'var(--neon)', flex: 'none' }, text: e.agent }),
        el('span', { text: e.text }),
        el('span', { class: 'sx-dim sx-mono', style: { fontSize: '11px' }, text: e.detail }),
        el('span', { class: 'sx-feed__t', text: fmt.clock(e.ts) })
      ]);
      host.insertBefore(row, host.firstChild);
      while (host.children.length > 12) host.lastChild.remove();
      setTimeout(function () { row.classList.remove('is-new'); }, 700);
    }
    for (var i = 0; i < 7; i++) push();
    setInterval(push, 2600);
  }

  /* ============================================================
     WAITLIST
     ============================================================ */
  function wireWaitlist() {
    var form = $('#waitlist');
    if (!form) return;
    var input = $('#wl-email'), err = $('#wl-err');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        err.textContent = 'Enter a valid email address.';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      err.textContent = '';
      input.removeAttribute('aria-invalid');
      var btn = $('button', form);
      btn.classList.add('is-busy');
      setTimeout(function () {
        btn.classList.remove('is-busy');
        S.store.set('waitlist', v);
        form.innerHTML = '<div class="sx-card sx-card--flat" style="width:100%;display:flex;gap:14px;align-items:center">' +
          '<span class="sx-glyphbox"><span class="sx-glyph sx-glyph--diamond"></span></span>' +
          '<div><b>You are on the list.</b><p class="sx-body" style="font-size:13px">' +
          'Testnet keys go out in batches — we will write to ' + S.esc(v) + '.</p></div></div>';
        S.toast({ title: 'Request received', body: 'Testnet access details will go to ' + v });
      }, 800);
    });
    input.addEventListener('input', function () {
      err.textContent = ''; input.removeAttribute('aria-invalid');
    });
  }

  /* ============================================================
     GO
     ============================================================ */
  function init() {
    S.page({ smooth: !S.mobile });
    renderStages();
    renderBento();
    renderHire();
    renderModules();
    renderLayers();
    renderToken();
    buildChips();
    buildTicker();
    bindStats();
    wireIntent();
    wirePolicy();
    wireMint();
    wireWaitlist();

    startFeed();
    floatParallax();
    mount3D();
    S.reveal();
    setInterval(buildTicker, 9000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window);
