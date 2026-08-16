/* ============================================================
   STRIX HOOD — Live data layer
   Every source below is free / no-API-key / CORS-enabled.

     Binance public REST + WebSocket ... spot price, 24h stats, klines
     CoinGecko  (free tier) ........... market cap, 7d sparkline
     DeFiLlama  (open API) ............ chain TVL
     alternative.me ................... crypto Fear & Greed index
     PublicNode ETH RPC ............... block height, gas price, balances
     DexScreener (open API) ........... on-chain pair liquidity/volume

   Every fetch is wrapped: on failure the simulation engine takes
   over so the UI is never empty and never shows a broken state.
   ============================================================ */
(function (global) {
  'use strict';

  var S = global.Strix;
  if (!S) { console.error('[strix-data] strix.js must load first'); return; }

  var D = {};
  S.data = D;

  /* ---------------- endpoints ---------------- */
  var EP = {
    binance: 'https://api.binance.com/api/v3',
    binanceWS: 'wss://stream.binance.com:9443/stream?streams=',
    gecko: 'https://api.coingecko.com/api/v3',
    llama: 'https://api.llama.fi',
    fng: 'https://api.alternative.me/fng/?limit=1',
    rpc: 'https://ethereum-rpc.publicnode.com',
    rpcFallback: 'https://cloudflare-eth.com',
    dexscreener: 'https://api.dexscreener.com/latest/dex'
  };
  D.endpoints = EP;

  D.status = { binance: 'idle', gecko: 'idle', llama: 'idle', fng: 'idle', rpc: 'idle', ws: 'idle', dex: 'idle' };
  function mark(k, v) { D.status[k] = v; S.emit('data:status', D.status); }

  function withTimeout(url, ms, init) {
    var ctrl = global.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 8000);
    return fetch(url, Object.assign({ signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' }, init || {}))
      .then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw new Error(url.split('?')[0] + ' → HTTP ' + r.status);
        return r.json();
      }, function (e) { clearTimeout(t); throw e; });
  }

  /* ---------------- asset universe ---------------- */
  D.assets = [
    { sym: 'ETH', pair: 'ETHUSDT', gecko: 'ethereum', name: 'Ethereum', kind: 'crypto' },
    { sym: 'BTC', pair: 'BTCUSDT', gecko: 'bitcoin', name: 'Bitcoin', kind: 'crypto' },
    { sym: 'SOL', pair: 'SOLUSDT', gecko: 'solana', name: 'Solana', kind: 'crypto' },
    { sym: 'ARB', pair: 'ARBUSDT', gecko: 'arbitrum', name: 'Arbitrum', kind: 'crypto' },
    { sym: 'LINK', pair: 'LINKUSDT', gecko: 'chainlink', name: 'Chainlink', kind: 'crypto' }
  ];

  /* Seed values keep the UI honest-looking before the first fetch
     resolves and give the simulator a plausible anchor if offline. */
  var SEED = { ETH: 3120, BTC: 92500, SOL: 178, ARB: 0.64, LINK: 17.4 };

  D.market = {};
  D.assets.forEach(function (a) {
    D.market[a.sym] = {
      sym: a.sym, name: a.name, pair: a.pair,
      price: SEED[a.sym], prev: SEED[a.sym], change24: 0,
      high24: SEED[a.sym] * 1.02, low24: SEED[a.sym] * 0.98,
      vol24: 0, mcap: 0, spark: null, live: false, source: 'seed'
    };
  });

  D.chain = { block: 0, gasGwei: 0, tvl: 0, live: false };
  D.sentiment = { value: 50, label: 'Neutral', live: false };

  /* ============================================================
     1. Binance REST — 24h ticker for the whole universe
     ============================================================ */
  D.fetchTickers = function () {
    var syms = JSON.stringify(D.assets.map(function (a) { return a.pair; }));
    return withTimeout(EP.binance + '/ticker/24hr?symbols=' + encodeURIComponent(syms), 9000)
      .then(function (rows) {
        rows.forEach(function (r) {
          var a = D.assets.filter(function (x) { return x.pair === r.symbol; })[0];
          if (!a) return;
          var m = D.market[a.sym];
          m.prev = m.price;
          m.price = parseFloat(r.lastPrice);
          m.change24 = parseFloat(r.priceChangePercent);
          m.high24 = parseFloat(r.highPrice);
          m.low24 = parseFloat(r.lowPrice);
          m.vol24 = parseFloat(r.quoteVolume);
          m.live = true; m.source = 'binance';
        });
        mark('binance', 'ok');
        S.emit('market', D.market);
        return D.market;
      })
      .catch(function (e) { mark('binance', 'fail'); console.warn('[strix-data] binance ticker:', e.message); return null; });
  };

  /* ============================================================
     2. Binance klines — candles for the dashboard chart
     ============================================================ */
  D.fetchCandles = function (pair, interval, limit) {
    return withTimeout(EP.binance + '/klines?symbol=' + (pair || 'ETHUSDT') +
      '&interval=' + (interval || '1h') + '&limit=' + (limit || 96), 9000)
      .then(function (rows) {
        mark('binance', 'ok');
        return rows.map(function (k) {
          return { t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] };
        });
      })
      .catch(function (e) {
        mark('binance', 'fail');
        console.warn('[strix-data] klines:', e.message);
        return D.sim.candles(SEED[(pair || 'ETHUSDT').replace('USDT', '')] || 3000, limit || 96);
      });
  };

  /* ============================================================
     3. Binance WebSocket — true realtime ticks
     ============================================================ */
  var ws = null, wsRetry = 0, wsWanted = false;
  D.openStream = function () {
    if (!global.WebSocket) return;
    wsWanted = true;
    var streams = D.assets.map(function (a) { return a.pair.toLowerCase() + '@miniTicker'; }).join('/');
    try { ws = new WebSocket(EP.binanceWS + streams); }
    catch (e) { mark('ws', 'fail'); return; }

    ws.onopen = function () { wsRetry = 0; mark('ws', 'ok'); };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      var d = msg.data || msg;
      if (!d || !d.s) return;
      var a = D.assets.filter(function (x) { return x.pair === d.s; })[0];
      if (!a) return;
      var m = D.market[a.sym];
      m.prev = m.price;
      m.price = parseFloat(d.c);
      m.high24 = parseFloat(d.h); m.low24 = parseFloat(d.l);
      m.vol24 = parseFloat(d.q);
      var open = parseFloat(d.o);
      if (open) m.change24 = ((m.price - open) / open) * 100;
      m.live = true; m.source = 'binance-ws';
      S.emit('tick', m);
    };
    ws.onclose = function () {
      mark('ws', 'closed');
      if (!wsWanted) return;
      wsRetry++;
      if (wsRetry > 6) { mark('ws', 'fail'); return; }
      setTimeout(D.openStream, Math.min(30000, 1200 * Math.pow(2, wsRetry)));
    };
    ws.onerror = function () { mark('ws', 'fail'); try { ws.close(); } catch (e) { } };
  };
  D.closeStream = function () { wsWanted = false; if (ws) try { ws.close(); } catch (e) { } };

  /* ============================================================
     4. CoinGecko — market cap + 7d sparkline
     ============================================================ */
  D.fetchGecko = function () {
    var ids = D.assets.map(function (a) { return a.gecko; }).join(',');
    return withTimeout(EP.gecko + '/coins/markets?vs_currency=usd&ids=' + ids + '&sparkline=true&price_change_percentage=24h', 11000)
      .then(function (rows) {
        rows.forEach(function (r) {
          var a = D.assets.filter(function (x) { return x.gecko === r.id; })[0];
          if (!a) return;
          var m = D.market[a.sym];
          m.mcap = r.market_cap;
          if (r.sparkline_in_7d && r.sparkline_in_7d.price) {
            var p = r.sparkline_in_7d.price;
            var step = Math.max(1, Math.floor(p.length / 60));
            m.spark = p.filter(function (_, i) { return i % step === 0; });
          }
          if (!m.live) { m.price = r.current_price; m.change24 = r.price_change_percentage_24h || 0; m.live = true; m.source = 'coingecko'; }
        });
        mark('gecko', 'ok');
        S.emit('market', D.market);
        return D.market;
      })
      .catch(function (e) { mark('gecko', 'fail'); console.warn('[strix-data] coingecko:', e.message); return null; });
  };

  /* ============================================================
     5. DeFiLlama — Ethereum TVL
     ============================================================ */
  D.fetchTVL = function () {
    return withTimeout(EP.llama + '/v2/chains', 9000)
      .then(function (rows) {
        var eth = rows.filter(function (c) { return c.gecko_id === 'ethereum' || c.name === 'Ethereum'; })[0];
        if (eth) { D.chain.tvl = eth.tvl; D.chain.live = true; }
        mark('llama', 'ok');
        S.emit('chain', D.chain);
        return D.chain;
      })
      .catch(function (e) { mark('llama', 'fail'); console.warn('[strix-data] defillama:', e.message); return null; });
  };

  /* ============================================================
     6. Fear & Greed index
     ============================================================ */
  D.fetchSentiment = function () {
    return withTimeout(EP.fng, 8000)
      .then(function (j) {
        var d = j && j.data && j.data[0];
        if (d) { D.sentiment = { value: +d.value, label: d.value_classification, live: true }; }
        mark('fng', 'ok');
        S.emit('sentiment', D.sentiment);
        return D.sentiment;
      })
      .catch(function (e) { mark('fng', 'fail'); console.warn('[strix-data] fng:', e.message); return null; });
  };

  /* ============================================================
     7. Ethereum JSON-RPC — block height, gas, balances
     ============================================================ */
  var rpcId = 1;
  D.rpc = function (method, params, url) {
    return withTimeout(url || EP.rpc, 9000, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method: method, params: params || [] })
    }).then(function (j) {
      if (j.error) throw new Error(j.error.message || 'rpc error');
      return j.result;
    }).catch(function (e) {
      if (url) throw e;
      return D.rpc(method, params, EP.rpcFallback);
    });
  };

  D.fetchChain = function () {
    return Promise.all([
      D.rpc('eth_blockNumber'),
      D.rpc('eth_gasPrice')
    ]).then(function (r) {
      D.chain.block = parseInt(r[0], 16);
      D.chain.gasGwei = parseInt(r[1], 16) / 1e9;
      D.chain.live = true;
      mark('rpc', 'ok');
      S.emit('chain', D.chain);
      return D.chain;
    }).catch(function (e) { mark('rpc', 'fail'); console.warn('[strix-data] rpc:', e.message); return null; });
  };

  D.balanceOf = function (address) {
    return D.rpc('eth_getBalance', [address, 'latest']).then(function (hex) {
      return parseInt(hex, 16) / 1e18;
    });
  };

  /* ============================================================
     8. DexScreener — on-chain pair data
     ============================================================ */
  D.dexSearch = function (q) {
    return withTimeout(EP.dexscreener + '/search?q=' + encodeURIComponent(q), 9000)
      .then(function (j) {
        mark('dex', 'ok');
        return (j.pairs || []).slice(0, 12).map(function (p) {
          return {
            base: p.baseToken && p.baseToken.symbol, quote: p.quoteToken && p.quoteToken.symbol,
            chain: p.chainId, dex: p.dexId, price: parseFloat(p.priceUsd || 0),
            change24: p.priceChange ? p.priceChange.h24 : 0,
            liq: p.liquidity ? p.liquidity.usd : 0,
            vol24: p.volume ? p.volume.h24 : 0,
            url: p.url
          };
        });
      })
      .catch(function (e) { mark('dex', 'fail'); console.warn('[strix-data] dexscreener:', e.message); return []; });
  };

  /* ============================================================
     SIMULATION ENGINE
     Protocol metrics have no public source — they are simulated
     with a constrained random walk and labelled as such in the UI.
     ============================================================ */
  var rnd = S.rng(20260814);

  D.sim = {
    metrics: {
      agents: 12847, agentsLive: 9312, volume24: 48200000, fees24: 120500,
      execMs: 340, success: 99.4, intents24: 184203, staked: 41200000
    },
    candles: function (base, n) {
      var out = [], p = base, t = Date.now() - n * 3600000;
      for (var i = 0; i < n; i++) {
        var o = p, drift = (rnd() - 0.485) * base * 0.012;
        var c = Math.max(base * 0.5, o + drift);
        var h = Math.max(o, c) * (1 + rnd() * 0.004);
        var l = Math.min(o, c) * (1 - rnd() * 0.004);
        out.push({ t: t + i * 3600000, o: o, h: h, l: l, c: c, v: rnd() * 1000 });
        p = c;
      }
      return out;
    },
    step: function () {
      var m = D.sim.metrics;
      m.agents += Math.floor(rnd() * 3);
      m.agentsLive = Math.max(0, Math.min(m.agents, m.agentsLive + Math.floor((rnd() - 0.45) * 12)));
      m.volume24 = Math.max(1e6, m.volume24 * (1 + (rnd() - 0.48) * 0.004));
      m.fees24 = m.volume24 * 0.0025;
      m.execMs = Math.max(120, Math.min(900, m.execMs + (rnd() - 0.5) * 22));
      m.success = Math.max(96, Math.min(99.99, m.success + (rnd() - 0.5) * 0.06));
      m.intents24 += Math.floor(rnd() * 14);
      m.staked = Math.max(1e6, m.staked * (1 + (rnd() - 0.49) * 0.002));
      S.emit('sim', m);
      return m;
    },
    /* Prices keep moving even with every network call blocked. */
    driftPrices: function () {
      Object.keys(D.market).forEach(function (k) {
        var m = D.market[k];
        if (m.live) return;
        m.prev = m.price;
        m.price = Math.max(0.0001, m.price * (1 + (rnd() - 0.5) * 0.0035));
        m.change24 += (rnd() - 0.5) * 0.06;
        S.emit('tick', m);
      });
    }
  };

  /* ---------------- activity feed generator ---------------- */
  var AGENTS = ['Atlas-7', 'Vega-Prime', 'Nyx-04', 'Orion-Δ', 'Kestrel', 'Meridian', 'Halcyon-2', 'Corvus', 'Sable-9', 'Lyra-X'];
  var ACTIONS = [
    { t: 'intent', text: 'Intent received', detail: 'swap {amt} USDC → {sym}' },
    { t: 'policy', text: 'Policy check passed', detail: 'under daily cap · {amt} USDC' },
    { t: 'sim', text: 'Simulation clean', detail: 'no revert · slippage 0.0{n}%' },
    { t: 'exec', text: 'Executed onchain', detail: 'settled in {ms}ms' },
    { t: 'nft', text: 'NFT bid placed', detail: 'Seaport order · {amt} WETH' },
    { t: 'rwa', text: 'Tokenized equity fill', detail: '{n} shares · {sym}d' },
    { t: 'block', text: 'Action blocked', detail: 'exceeds per-tx limit', kind: 'warn' },
    { t: 'human', text: 'Awaiting approval', detail: 'human-in-the-loop', kind: 'warn' },
    { t: 'settle', text: 'Fee routed', detail: 'treasury · stakers · burn' }
  ];
  D.randomEvent = function () {
    var a = ACTIONS[Math.floor(rnd() * ACTIONS.length)];
    var sym = D.assets[Math.floor(rnd() * D.assets.length)].sym;
    var amt = (rnd() * 9000 + 100).toFixed(0);
    return {
      id: Math.random().toString(36).slice(2, 9),
      agent: AGENTS[Math.floor(rnd() * AGENTS.length)],
      kind: a.kind || 'ok',
      type: a.t,
      text: a.text,
      detail: a.detail.replace('{sym}', sym).replace('{amt}', amt)
        .replace('{ms}', String(Math.round(D.sim.metrics.execMs)))
        .replace('{n}', String(Math.floor(rnd() * 9) + 1)),
      hash: '0x' + Array.from({ length: 8 }, function () { return '0123456789abcdef'[Math.floor(rnd() * 16)]; }).join('') + '…',
      ts: Date.now()
    };
  };

  /* ============================================================
     START — one call wires everything up
     ============================================================ */
  var timers = [];
  D.start = function (opts) {
    opts = opts || {};
    D.fetchTickers();
    D.fetchChain();
    if (opts.gecko !== false) D.fetchGecko();
    if (opts.llama !== false) D.fetchTVL();
    if (opts.fng !== false) D.fetchSentiment();
    if (opts.stream !== false) D.openStream();

    timers.push(setInterval(D.fetchTickers, 45000));
    timers.push(setInterval(D.fetchChain, 12000));
    if (opts.gecko !== false) timers.push(setInterval(D.fetchGecko, 120000));
    if (opts.llama !== false) timers.push(setInterval(D.fetchTVL, 300000));
    timers.push(setInterval(D.sim.step, 1000));
    timers.push(setInterval(D.sim.driftPrices, 2500));

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) D.closeStream();
      else if (opts.stream !== false) D.openStream();
    });
    return D;
  };
  D.stop = function () { timers.forEach(clearInterval); timers = []; D.closeStream(); };

})(window);
