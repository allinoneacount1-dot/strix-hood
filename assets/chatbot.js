/* ============================================================
   STRIX HOOD — Chat widget
   A terminal that talks. No LLM, no backend, no API key.

   Intelligence = a deterministic intent router over the live
   data layer (Strix.data), the real wallet (Strix.wallet) and a
   hand-written protocol knowledge base. Every number rendered
   here comes from a source that is either live or explicitly
   labelled as a fallback / simulation — never invented.

   Public API:  Strix.chatbot.mount(opts) | open() | close()
                | toggle() | ask(text) | clear() | classify(text)
   Markup hook: any element with [data-chat="<prompt>"] opens the
                panel and asks that question.
   ============================================================ */
(function (global) {
  'use strict';

  var S = global.Strix;
  if (!S) { console.error('[strix-chat] strix.js must load first'); return; }

  var el = S.el, fmt = S.fmt;
  var C = {};
  S.chatbot = C;
  C.version = '1.0.0';

  /* ============================================================
     0. CONSTANTS + SAFE ACCESSORS
     ============================================================ */
  var KEY = 'chat:v1';
  var MAX_MSG = 30;

  var STABLE = { USDC: 1, USDT: 1, DAI: 1, USD: 1, FRAX: 1, PYUSD: 1, USDE: 1 };

  /* shell.js owns the sitemap; the widget must still work without it. */
  var FALLBACK_SITE = {
    x: 'https://x.com/strixhood',
    opensea: null,
    product: [
      { label: 'Agents', href: 'agents.html' },
      { label: 'Marketplace', href: 'marketplace.html' },
      { label: 'NFT Passport', href: 'nft.html' },
      { label: 'Tokenized Stocks', href: 'stocks.html' },
      { label: 'Security', href: 'security.html' }
    ],
    developers: [
      { label: 'Docs', href: 'docs.html' },
      { label: 'API Reference', href: 'api.html' },
      { label: 'SDK', href: 'sdk.html' },
      { label: 'Status', href: 'status.html' }
    ],
    company: [
      { label: 'About', href: 'about.html' }, { label: 'Careers', href: 'careers.html' },
      { label: 'Blog', href: 'blog.html' }, { label: 'Brand Kit', href: 'brand.html' }
    ],
    app: [{ label: 'Launch App', href: 'app.html' }, { label: 'Protocol Admin', href: 'admin.html' }]
  };
  function SITE() { return S.site || FALLBACK_SITE; }

  var LABEL = {
    agents: 'Agents', marketplace: 'Marketplace', nft: 'NFT Passport', stocks: 'Tokenized Stocks',
    security: 'Security', docs: 'Docs', api: 'API Reference', sdk: 'SDK', status: 'Status',
    about: 'About', careers: 'Careers', blog: 'Blog', brand: 'Brand Kit',
    app: 'Launch App', admin: 'Protocol Admin'
  };
  var PAGE = {
    agents: 'agents.html', marketplace: 'marketplace.html', nft: 'nft.html', stocks: 'stocks.html',
    security: 'security.html', docs: 'docs.html', api: 'api.html', sdk: 'sdk.html', status: 'status.html',
    about: 'about.html', careers: 'careers.html', blog: 'blog.html', brand: 'brand.html',
    app: 'app.html', admin: 'admin.html'
  };
  /* Resolve a page through Strix.site so the sitemap stays the single source of truth. */
  function P(key) {
    var s = SITE(), want = LABEL[key], out = null;
    ['product', 'developers', 'company', 'app'].forEach(function (g) {
      (s[g] || []).forEach(function (i) { if (!out && i.label === want) out = i.href; });
    });
    return out || PAGE[key];
  }

  function D() { return S.data || null; }
  function W() { return S.wallet || null; }
  function mkt(sym) { var d = D(); return (d && d.market && d.market[sym]) || null; }
  function status(k) { var d = D(); return (d && d.status && d.status[k]) || 'idle'; }
  function metrics() { var d = D(); return (d && d.sim && d.sim.metrics) || null; }

  /* Bounded promise — the data layer allows 9s timeouts; a chat reply cannot. */
  function cap(p, ms, fb) {
    return new Promise(function (res) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; res(fb); } }, ms);
      Promise.resolve(p).then(
        function (v) { if (!done) { done = true; clearTimeout(t); res(v); } },
        function () { if (!done) { done = true; clearTimeout(t); res(fb); } }
      );
    });
  }

  /* Stable pseudo-random from a string — the same intent simulates identically. */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function jitter(seed, lo, hi) { return lo + ((seed % 1000) / 1000) * (hi - lo); }

  /* ============================================================
     1. ENTITY EXTRACTION
     ============================================================ */
  var SYM = {
    eth: 'ETH', ether: 'ETH', ethereum: 'ETH', weth: 'ETH',
    btc: 'BTC', bitcoin: 'BTC', xbt: 'BTC', wbtc: 'BTC',
    sol: 'SOL', solana: 'SOL',
    arb: 'ARB', arbitrum: 'ARB',
    link: 'LINK', chainlink: 'LINK'
  };
  function tokens(q) { return q.replace(/[^a-z0-9$.\s-]/g, ' ').split(/\s+/).filter(Boolean); }
  function findSyms(q) {
    var out = [];
    tokens(q).forEach(function (w) {
      var s = SYM[w.replace(/^\$/, '')];
      if (s && out.indexOf(s) < 0) out.push(s);
    });
    return out;
  }
  function findSym(q) { return findSyms(q)[0] || null; }

  var CHAINS = [
    { id: '0x2105', name: 'Base', re: /\bbase\b/ },
    { id: '0xa4b1', name: 'Arbitrum One', re: /\barb(itrum)?\b/ },
    { id: '0xa', name: 'OP Mainnet', re: /\b(optimism|op mainnet|op)\b/ },
    { id: '0x89', name: 'Polygon', re: /\b(polygon|matic|pol)\b/ },
    { id: '0x38', name: 'BNB Chain', re: /\b(bnb|bsc)\b/ },
    { id: '0xaa36a7', name: 'Sepolia', re: /\bsepolia\b/ },
    { id: '0x1', name: 'Ethereum', re: /\b(ethereum|mainnet|l1)\b/ }
  ];
  function findChain(q) {
    for (var i = 0; i < CHAINS.length; i++) if (CHAINS[i].re.test(q)) return CHAINS[i];
    return null;
  }

  function toNum(raw) {
    if (!raw) return null;
    var s = String(raw).toLowerCase().replace(/[$,]/g, '');
    var mul = 1;
    if (/k$/.test(s)) { mul = 1e3; s = s.slice(0, -1); }
    else if (/m$/.test(s)) { mul = 1e6; s = s.slice(0, -1); }
    var n = parseFloat(s);
    return isFinite(n) ? n * mul : null;
  }
  var NUMRE = '(\\$?\\d[\\d,]*(?:\\.\\d+)?\\s*[km]?)';

  /* 2 → "2", 1.50 → "1.5", 40000 → "40,000" */
  function amt(n) {
    if (!isFinite(n)) return '0';
    var d = n < 1 ? 6 : n < 100 ? 4 : 0;
    return fmt.n(n, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  /* Queries are lowercased before routing; put the user's own casing back. */
  function recase(sub, raw) {
    if (!sub || !raw) return sub;
    var i = String(raw).toLowerCase().indexOf(sub);
    if (i >= 0) return String(raw).substr(i, sub.length);
    return sub.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  function ticker(w) {
    if (!w) return null;
    var t = w.replace(/^\$/, '').toUpperCase();
    return /^[A-Z]{2,6}$/.test(t) ? (SYM[t.toLowerCase()] || t) : null;
  }
  function priceOf(sym) {
    if (!sym) return null;
    if (STABLE[sym]) return 1;
    var m = mkt(sym);
    return m ? m.price : null;
  }

  /* ============================================================
     2. RESPONSE BLOCKS
     Every answer is plain JSON data, never DOM. That is what makes
     the transcript serialisable and survive page navigation.
     ============================================================ */
  function p(text) { return { t: 'p', text: text }; }
  function stats(rows) { return { t: 'stats', rows: rows }; }
  function st(k, v, tone, d) { return { k: k, v: v, tone: tone || null, d: d || null }; }
  function note(text, tone) { return { t: 'note', text: text, tone: tone || null }; }
  function actions(items) { return { t: 'actions', items: items }; }
  function table(head, rows, align) { return { t: 'table', head: head, rows: rows, align: align || [] }; }
  function pills(items) { return { t: 'pills', items: items }; }
  function list(items) { return { t: 'list', items: items }; }
  function rowlist(items) { return { t: 'rows', items: items }; }
  function code(text) { return { t: 'code', text: text }; }
  function spark(sym, data, change, simulated, range) {
    return { t: 'spark', sym: sym, data: data, change: change, sim: !!simulated, range: range || '7d' };
  }
  function trace(title, steps, total) { return { t: 'trace', title: title, steps: steps, total: total }; }

  function tone24(v) { return v >= 0 ? 'up' : 'down'; }

  /* Honesty helper: describe where a market number actually came from. */
  function sourceNote(m) {
    if (!m) return note('No data layer loaded — strix-data.js is missing on this page.', 'warn');
    if (m.live) {
      var src = m.source === 'binance-ws' ? 'Binance websocket' : m.source === 'binance' ? 'Binance REST' : 'CoinGecko';
      return note('Live · ' + src + ' · ' + fmt.clock(), null);
    }
    return note('Fallback. Upstream price feeds are unreachable from this browser, so this is a seeded simulation — do not trade on it.', 'warn');
  }

  /* ============================================================
     3. KNOWLEDGE BASE — protocol answers
     ============================================================ */
  var TOKEN = { supply: 1000000000, fee: 0.25, treasury: 40, stakers: 30, burn: 30 };

  var LAYERS = [
    { n: '01', title: 'Account Abstraction (ERC-4337)', detail: 'Session keys, no per-transaction signing, revocable in one call.' },
    { n: '02', title: 'Dynamic Spending Policy', detail: 'Per-tx caps, rolling daily limits, category and contract blocklists.' },
    { n: '03', title: 'Transaction Simulation', detail: 'Sandboxed execution, slippage bounds, drainer and honeypot detection.' },
    { n: '04', title: 'Automated Contract Audit', detail: 'Source verification, deployer reputation, deployment history.' },
    { n: '05', title: 'Human-in-the-Loop Override', detail: 'Biometric gate, manual approval queue, emergency pause.' }
  ];

  function kbWhat() {
    var m = metrics();
    return {
      blocks: [
        p('Strix Hood is a commerce layer for autonomous agents. You state an intent in plain language; an agent compiles it into onchain calls, a policy engine you wrote decides whether those calls are allowed, and the router settles them across crypto, NFTs and tokenized equities.'),
        p('The agent never takes custody. It operates a session key inside limits you set, and every action it takes is attributable to its onchain passport — so reputation is collateral, not marketing.'),
        m ? stats([
          st('Registered agents', fmt.n(m.agents, 0)),
          st('Live now', fmt.n(m.agentsLive, 0), 'up'),
          st('Intents / 24h', fmt.n(m.intents24, 0)),
          st('Success rate', m.success.toFixed(2) + '%', 'up')
        ]) : null,
        m ? note('Protocol metrics are simulated — testnet software, no public metrics endpoint yet.', 'warn') : null,
        actions([
          { label: 'Read the docs', href: P('docs') },
          { label: 'Browse agents', href: P('agents'), variant: 'quiet' }
        ])
      ],
      chips: ['What is an intent', 'How does the policy engine work', 'Tokenomics', 'Show me the marketplace'],
      topic: 'protocol'
    };
  }

  function kbIntent() {
    return {
      blocks: [
        p('An intent is a declarative goal, not a transaction: "swap 500 USDC to ETH under 0.3% slippage" instead of hand-built calldata.'),
        p('The agent brain resolves the goal into a concrete route, the policy engine checks it against your caps and blocklists, simulation proves the outcome, and only then does the router execute. You approve outcomes; the protocol handles the plumbing.'),
        pills([
          { label: 'Intent' }, { label: 'Agent brain' }, { label: 'Policy check' },
          { label: 'Simulation' }, { label: 'Execution' }
        ]),
        code('{\n  "action": "swap",\n  "sell": { "asset": "USDC", "amount": 500 },\n  "buy":  { "asset": "ETH" },\n  "constraints": {\n    "maxSlippageBps": 30,\n    "deadline": "10m"\n  }\n}'),
        actions([
          { label: 'Simulate an intent', act: 'ask', arg: 'swap 500 USDC to ETH' },
          { label: 'Intent reference', href: P('docs'), variant: 'quiet' }
        ])
      ],
      chips: ['How does the policy engine work', 'Swap 500 USDC to ETH', 'What are the five security layers'],
      topic: 'protocol'
    };
  }

  function kbPolicy() {
    return {
      blocks: [
        p('The policy engine is the gate between what an agent wants to do and what the chain sees. Every candidate action is evaluated against per-transaction caps, rolling daily limits, allow/deny lists for contracts and categories, and time windows.'),
        p('Anything outside that envelope is refused outright, or escalated to human-in-the-loop approval when you have flagged the category. Because the policy travels with the ERC-4337 session key, revoking an agent is a transaction — not a support ticket.'),
        table(['Rule', 'Example', 'On breach'], [
          ['Per-tx cap', '5,000 USDC', 'Escalate'],
          ['Daily limit', '25,000 USDC / 24h', 'Block'],
          ['Category', 'no leverage, no bridges', 'Block'],
          ['Contract list', 'verified + audited only', 'Block'],
          ['Time window', '08:00–22:00 UTC', 'Escalate']
        ]),
        actions([
          { label: 'Security stack', href: P('security') },
          { label: 'Trip the policy engine', act: 'ask', arg: 'swap 40000 USDC to ETH', variant: 'quiet' }
        ])
      ],
      chips: ['What are the five security layers', 'Swap 40000 USDC to ETH', 'What is an Agent NFT passport'],
      topic: 'protocol'
    };
  }

  function kbPassport() {
    return {
      blocks: [
        p('Every agent mints an ERC-721 passport that carries its identity, reputation score, permission set and revenue rights.'),
        p('The metadata is dynamic: completed intents, level and slashing history are written back to the token, so reputation is portable and verifiable instead of a number in our database. Permissions are encoded as traits and revocable at any time.'),
        p('It is a standard NFT, so once deployed it will transfer through Seaport like any other — and agent earnings follow whoever holds it. Nothing is deployed yet: there is no passport contract on any network and no collection listed anywhere.'),
        list([
          { n: '01', title: 'Dynamic metadata', detail: 'Evolves with activity, level and slashing record.' },
          { n: '02', title: 'Permission sets', detail: 'Encoded as traits, revocable at any time.' },
          { n: '03', title: 'Revenue rights', detail: 'Agent earnings flow to the passport holder.' }
        ]),
        actions([
          { label: 'NFT Passport', href: P('nft') },
          { label: 'Deployment status', href: P('docs') + '#networks', variant: 'quiet' }
        ])
      ],
      chips: ['How are agents registered', 'Tokenomics', 'Show me the marketplace'],
      topic: 'protocol'
    };
  }

  function kbTokenomics() {
    var m = metrics();
    return {
      blocks: [
        p('$STRX is the work token, and it does not exist yet. There is no deployed contract, no TGE, no market and no sale — the numbers below are the designed parameters, not a description of anything you can hold. Anyone selling you $STRX today is selling you nothing.'),
        p('As designed: fixed supply of 1,000,000,000 — agents stake it to register, which is what makes sybil attacks expensive rather than merely discouraged.'),
        p('The protocol takes 0.25% of commerce volume routed through it. That fee splits three ways: 40% treasury, 30% to stakers, 30% to buyback-and-burn, so usage retires supply.'),
        stats([
          st('Total supply', fmt.compact(TOKEN.supply) + ' STRX'),
          st('Protocol fee', TOKEN.fee + '%'),
          st('Treasury', TOKEN.treasury + '%'),
          st('Stakers', TOKEN.stakers + '%', 'up'),
          st('Buyback & burn', TOKEN.burn + '%', 'up'),
          m ? st('Staked', fmt.compact(m.staked) + ' STRX') : st('Staked', '—')
        ]),
        m ? stats([
          st('Volume 24h', fmt.usdC(m.volume24)),
          st('Fees 24h', fmt.usdC(m.fees24)),
          st('→ burn 24h', fmt.usdC(m.fees24 * 0.3), 'up')
        ]) : null,
        m ? note('Volume, fees and staked supply are simulated protocol metrics, not a live contract read — there is no contract to read.', 'warn') : null,
        actions([
          { label: 'Contract status', act: 'ask', arg: 'contract address' },
          { label: 'How agents are slashed', act: 'ask', arg: 'how are agents registered and slashed', variant: 'quiet' }
        ])
      ],
      chips: ['Contract address', 'How are agents registered', 'Protocol metrics'],
      topic: 'protocol'
    };
  }

  function kbAgents() {
    return {
      blocks: [
        p('Registering an agent means staking STRX behind it and minting its passport. The stake is the collateral its reputation is priced against — cheap identities are the whole attack surface, so identities are not cheap.'),
        p('Every execution is attributable to that passport, which makes failed policy checks, self-dealing routes and fraudulent fills provable rather than alleged. A successful slash burns part of the bond and writes the event into the passport metadata.'),
        p('Redeploying does not clear the record, because the stake and the history are the identity. Operators who stay honest earn from the 30% staker share of protocol fees.'),
        list([
          { n: '01', title: 'Stake', detail: 'Bond STRX; size sets the agent\'s maximum mandate.' },
          { n: '02', title: 'Mint', detail: 'ERC-721 passport issued with permissions as traits.' },
          { n: '03', title: 'Operate', detail: 'Every intent signed by a session key under policy.' },
          { n: '04', title: 'Slash', detail: 'Provable breach burns bond and marks the passport.' }
        ]),
        actions([
          { label: 'Agents', href: P('agents') },
          { label: 'Marketplace', href: P('marketplace'), variant: 'quiet' }
        ])
      ],
      chips: ['Tokenomics', 'What is an Agent NFT passport', 'How does the policy engine work'],
      topic: 'protocol'
    };
  }

  function kbSecurity() {
    return {
      blocks: [
        p('Five layers, each one able to stop a transaction on its own. An agent action has to survive all of them.'),
        list(LAYERS),
        p('Layers 1–2 constrain what can ever be attempted, 3–4 inspect the specific call, and 5 is your override. The default posture is refusal: anything the policy cannot positively evaluate does not execute.'),
        actions([
          { label: 'Security stack', href: P('security') },
          { label: 'Watch a policy block', act: 'ask', arg: 'swap 40000 USDC to ETH', variant: 'quiet' }
        ])
      ],
      chips: ['How does the policy engine work', 'What is an intent', 'Buy 2 ETH'],
      topic: 'protocol'
    };
  }

  /* Contracts, deployments and audit state. Nothing is deployed and nothing is
     audited, so this answer exists specifically to refuse to invent either. */
  function kbContracts() {
    return {
      blocks: [
        p('There is no contract address to give you. Strix Hood is not deployed to any mainnet, there is no $STRX token contract, and the testnet deployments are redeployed without notice so they are not worth pinning.'),
        table(['Chain', 'Target', 'Status'], [
          ['Ethereum', 'Sepolia', 'testnet'],
          ['Base', 'Base Sepolia', 'testnet'],
          ['Arbitrum', 'Arbitrum Sepolia', 'testnet'],
          ['OP Mainnet', 'OP Sepolia', 'queued'],
          ['Polygon', 'Amoy', 'queued'],
          ['BNB Chain', 'BNB Testnet', 'queued'],
          ['Solana', 'Devnet', 'queued']
        ]),
        note('Anyone offering you a Strix Hood contract address or a $STRX token today is not us, because there is nothing to offer. Mainnet addresses will be published in the docs, in the SDK deployment manifest and from @strixhood at the same time.', 'warn'),
        actions([
          { label: 'Deployment status', href: P('docs') + '#networks' },
          { label: 'Audit status', act: 'ask', arg: 'has it been audited', variant: 'quiet' }
        ])
      ],
      chips: ['Has it been audited', 'Tokenomics', 'What is Strix Hood'],
      topic: 'protocol'
    };
  }

  function kbAudit() {
    return {
      blocks: [
        p('No. No audit has been completed, no firm is engaged, and every contract currently running on a testnet is unaudited. Treating anything here as reviewed would be wrong.'),
        p('The scope is published in the order it will be handed over — settlement and registry first, then the account and session-key validator, then the bond vault, the RWA allow-list and finally the indexer and API. Reports get published in full when they exist, including findings we dispute.'),
        p('There is no funded bug bounty either. The severity ladder and the response clock are in force now; the reward amounts are set when the programme is funded at mainnet. Report findings anyway — they are credited and paid retroactively.'),
        actions([
          { label: 'Audit scope', href: P('security') + '#audits' },
          { label: 'Report a finding', href: 'mailto:security@strix-hood.xyz?subject=Security%20report', variant: 'quiet' }
        ])
      ],
      chips: ['Contract address', 'What are the five security layers', 'What does it not protect against'],
      topic: 'protocol'
    };
  }

  function kbMetrics() {
    var m = metrics();
    if (!m) return { blocks: [note('The data layer is not loaded on this page, so there are no protocol metrics to read.', 'warn')], chips: defaultChips() };
    return {
      blocks: [
        p('Protocol snapshot — simulated, because Strix Hood is testnet software with no public metrics endpoint yet.'),
        stats([
          st('Agents', fmt.n(m.agents, 0)),
          st('Live', fmt.n(m.agentsLive, 0), 'up'),
          st('Intents 24h', fmt.n(m.intents24, 0)),
          st('Volume 24h', fmt.usdC(m.volume24)),
          st('Fees 24h', fmt.usdC(m.fees24)),
          st('Median exec', Math.round(m.execMs) + 'ms'),
          st('Success', m.success.toFixed(2) + '%', 'up'),
          st('Staked', fmt.compact(m.staked) + ' STRX')
        ]),
        note('Simulated metrics. Live market, gas and TVL numbers elsewhere in this chat come from real public APIs.', 'warn'),
        actions([{ label: 'Feed status', act: 'ask', arg: 'data status', variant: 'quiet' }])
      ],
      chips: ['Tokenomics', 'Data status', 'What is Strix Hood'],
      topic: 'protocol'
    };
  }

  /* ============================================================
     4. INTENT HANDLERS — market data
     ============================================================ */
  function sparkFor(m) {
    var d = D();
    if (!m || !d) return Promise.resolve(null);
    if (m.spark && m.spark.length > 4) {
      return Promise.resolve({ data: trim(m.spark), sim: false, range: '7d' });
    }
    if (status('binance') === 'fail' || !d.fetchCandles) {
      return Promise.resolve(d.sim ? { data: trim(d.sim.candles(m.price || 1, 48).map(cc)), sim: true, range: '48h' } : null);
    }
    return cap(d.fetchCandles(m.pair, '1h', 48), 2600, null).then(function (rows) {
      if (!rows || rows.length < 5) {
        return d.sim ? { data: trim(d.sim.candles(m.price || 1, 48).map(cc)), sim: true, range: '48h' } : null;
      }
      return { data: trim(rows.map(cc)), sim: status('binance') === 'fail', range: '48h' };
    });
    function cc(r) { return r.c; }
    function trim(a) {
      var step = Math.max(1, Math.floor(a.length / 56));
      return a.filter(function (_, i) { return i % step === 0; }).map(function (v) { return +Number(v).toPrecision(6); });
    }
  }

  function iPrice(q, hit) {
    var sym = hit.sym;
    var m = mkt(sym);
    if (!D()) {
      return {
        blocks: [note('strix-data.js is not loaded on this page, so I have no market feed to read. I will not print a number I cannot source.', 'warn')],
        chips: ['What is Strix Hood', 'What is an intent', 'Open docs']
      };
    }
    if (!m) {
      return {
        blocks: [
          p('I only carry live quotes for ETH, BTC, SOL, ARB and LINK. For anything else I can search onchain pairs.'),
          actions([{ label: 'Search ' + sym + ' onchain', act: 'ask', arg: 'find ' + sym }])
        ],
        chips: ['ETH price', 'BTC price', 'Find PEPE']
      };
    }
    var pos = m.high24 > m.low24 ? ((m.price - m.low24) / (m.high24 - m.low24)) * 100 : 50;
    var dir = m.change24 >= 0 ? 'up' : 'down';
    var lead = m.name + ' is ' + fmt.price(m.price) + ', ' + dir + ' ' + fmt.pct(m.change24) +
      ' on the day and sitting ' + Math.round(pos) + '% of the way up its 24h range.';

    return sparkFor(m).then(function (sp) {
      return {
        blocks: [
          p(lead),
          stats([
            st('Price', fmt.price(m.price)),
            st('24h', fmt.pct(m.change24), tone24(m.change24)),
            st('24h high', fmt.price(m.high24)),
            st('24h low', fmt.price(m.low24)),
            st('Volume 24h', m.vol24 ? fmt.usdC(m.vol24) : '—'),
            st('Market cap', m.mcap ? fmt.usdC(m.mcap) : '—')
          ]),
          sp ? spark(sym, sp.data, m.change24, sp.sim, sp.range) : null,
          sourceNote(m),
          sp && sp.sim ? note('Chart shape is a local simulation — the candle endpoint did not respond.', 'warn') : null,
          actions([
            { label: 'Simulate buying ' + sym, act: 'ask', arg: 'buy 1 ' + sym },
            { label: 'Open dashboard', href: P('app'), variant: 'quiet' }
          ])
        ],
        chips: chipsForSym(sym),
        sym: sym, topic: 'price'
      };
    });
  }

  function chipsForSym(sym) {
    var other = sym === 'ETH' ? 'BTC' : 'ETH';
    return ['And ' + other + '?', sym + ' vs ' + other, 'Gas now', 'Buy 1 ' + sym];
  }

  function iCompare(q, hit) {
    var a = mkt(hit.syms[0]), b = mkt(hit.syms[1]);
    if (!a || !b) return iPrice(q, { sym: hit.syms[0] });
    var win = a.change24 >= b.change24 ? a : b, lose = win === a ? b : a;
    return {
      blocks: [
        p(win.sym + ' is outperforming ' + lose.sym + ' over 24h — ' + fmt.pct(win.change24) + ' against ' +
          fmt.pct(lose.change24) + ', a spread of ' + Math.abs(win.change24 - lose.change24).toFixed(2) + ' points.'),
        table(['Asset', 'Price', '24h', 'Range 24h'], [
          [a.sym, fmt.price(a.price), fmt.pct(a.change24), fmt.price(a.low24) + ' – ' + fmt.price(a.high24)],
          [b.sym, fmt.price(b.price), fmt.pct(b.change24), fmt.price(b.low24) + ' – ' + fmt.price(b.high24)]
        ], ['', 'num', 'num', 'num']),
        stats([
          st(a.sym + ' / ' + b.sym, (a.price / b.price).toFixed(a.price / b.price < 1 ? 6 : 4)),
          st('24h spread', (win.change24 - lose.change24).toFixed(2) + ' pts', 'up')
        ]),
        sourceNote(a)
      ],
      chips: [a.sym + ' price', b.sym + ' price', 'Market overview', 'Fear and greed'],
      sym: win.sym, topic: 'compare'
    };
  }

  function iMarket() {
    var d = D();
    if (!d) return { blocks: [note('No data layer on this page.', 'warn')], chips: defaultChips() };
    var rows = [], live = 0, syms = Object.keys(d.market);
    syms.forEach(function (k) {
      var m = d.market[k];
      if (m.live) live++;
      rows.push([m.sym, fmt.price(m.price), fmt.pct(m.change24), m.vol24 ? fmt.usdC(m.vol24) : '—']);
    });
    var ups = syms.filter(function (k) { return d.market[k].change24 >= 0; }).length;
    return {
      blocks: [
        p(ups + ' of ' + syms.length + ' majors are green. ' +
          (ups > syms.length / 2 ? 'Breadth is positive.' : 'Breadth is negative — the tape is risk-off.')),
        table(['Asset', 'Price', '24h', 'Vol 24h'], rows, ['', 'num', 'num', 'num']),
        live ? note('Live · ' + live + '/' + syms.length + ' pairs streaming · ' + fmt.clock(), null)
          : note('All price feeds are unreachable from this browser. Everything above is a seeded simulation.', 'warn')
      ],
      chips: ['ETH price', 'Fear and greed', 'Gas now', 'Ethereum TVL'],
      topic: 'market'
    };
  }

  function iGas() {
    var d = D();
    var c = d ? d.chain : null;
    if (!c || !c.gasGwei) {
      return {
        blocks: [
          p('The Ethereum RPC is not answering from this browser, so I have no gas price. I will not guess one.'),
          note('Source: PublicNode / Cloudflare JSON-RPC · status ' + status('rpc'), 'warn'),
          actions([{ label: 'Feed status', act: 'ask', arg: 'data status' }])
        ],
        chips: ['Data status', 'ETH price', 'Ethereum TVL'],
        topic: 'gas'
      };
    }
    var g = c.gasGwei;
    var verdict = g < 6 ? 'Cheap — this is a good window for non-urgent batching.'
      : g < 15 ? 'Normal. Nothing unusual in the fee market.'
        : g < 40 ? 'Elevated. Expect to overpay on anything non-essential.'
          : 'Expensive. Something is competing for blockspace — defer what can wait.';
    var eth = mkt('ETH');
    var xfer = eth ? (21000 * g * 1e-9) * eth.price : null;
    var swap = eth ? (160000 * g * 1e-9) * eth.price : null;
    var usd2 = function (v) { return fmt.usd(v, 2); };
    return {
      blocks: [
        p('Gas is ' + g.toFixed(2) + ' gwei at block ' + fmt.n(c.block, 0) + '. ' + verdict),
        stats([
          st('Base gas', g.toFixed(2) + ' gwei', g < 15 ? 'up' : g < 40 ? null : 'down'),
          st('Block', fmt.n(c.block, 0)),
          st('Transfer', xfer !== null ? usd2(xfer) : '—'),
          st('Swap (~160k)', swap !== null ? usd2(swap) : '—')
        ]),
        c.live ? note('Live · Ethereum JSON-RPC · ' + fmt.clock(), null)
          : note('Fallback values — the RPC did not respond.', 'warn'),
        note('Cost estimates assume ' + (eth ? fmt.price(eth.price) : '—') + ' ETH and a simple transfer / swap gas budget.')
      ],
      chips: ['Block height', 'ETH price', 'Ethereum TVL', 'Swap 500 USDC to ETH'],
      topic: 'gas'
    };
  }

  function iBlock() {
    var d = D(), c = d ? d.chain : null;
    if (!c || !c.block) {
      return {
        blocks: [p('No block height — the Ethereum RPC is unreachable from this browser.'),
        note('status.rpc = ' + status('rpc'), 'warn')],
        chips: ['Data status', 'Gas now'], topic: 'chain'
      };
    }
    return {
      blocks: [
        p('Ethereum is at block ' + fmt.n(c.block, 0) + '. At 12-second slots that is roughly ' +
          fmt.n(c.block * 12 / 86400, 0) + ' days of chain history.'),
        stats([
          st('Block', fmt.n(c.block, 0)),
          st('Gas', c.gasGwei ? c.gasGwei.toFixed(2) + ' gwei' : '—'),
          st('Slot time', '12s')
        ]),
        c.live ? note('Live · JSON-RPC · ' + fmt.clock()) : note('Fallback — RPC unreachable.', 'warn')
      ],
      chips: ['Gas now', 'Ethereum TVL', 'ETH price'], topic: 'chain'
    };
  }

  function iTVL() {
    var d = D(), c = d ? d.chain : null;
    if (!c || !c.tvl) {
      return {
        blocks: [p('DeFiLlama is not reachable from this browser, so I have no TVL figure. I would rather say nothing than print a stale one.'),
        note('status.llama = ' + status('llama'), 'warn')],
        chips: ['Gas now', 'ETH price', 'Data status'], topic: 'tvl'
      };
    }
    var eth = mkt('ETH');
    return {
      blocks: [
        p('Ethereum has ' + fmt.usdC(c.tvl) + ' of value locked in DeFi protocols right now.'),
        stats([
          st('Ethereum TVL', fmt.usdC(c.tvl)),
          eth && eth.mcap ? st('vs ETH mcap', (c.tvl / eth.mcap * 100).toFixed(1) + '%') : st('vs ETH mcap', '—'),
          eth ? st('In ETH', fmt.compact(c.tvl / eth.price) + ' ETH') : st('In ETH', '—')
        ]),
        note('Live · DeFiLlama /v2/chains · ' + fmt.clock())
      ],
      chips: ['ETH price', 'Fear and greed', 'Gas now'], topic: 'tvl'
    };
  }

  function iSentiment() {
    var d = D(), s = d ? d.sentiment : null;
    if (!s) return { blocks: [note('No data layer on this page.', 'warn')], chips: defaultChips() };
    var v = s.value;
    var read = v <= 24 ? 'Historically where capitulation prints, but it is a contrarian signal, not a timing one.'
      : v <= 44 ? 'Positioning is defensive and liquidity thins out.'
        : v <= 55 ? 'The index is not telling you anything actionable here.'
          : v <= 74 ? 'Leverage builds at these levels and squeezes get violent in both directions.'
            : 'Crowded longs, thin bids underneath.';
    return {
      blocks: [
        p('Fear & Greed is ' + v + ' — ' + s.label + '. ' + read),
        stats([
          st('Index', String(v), v >= 55 ? 'up' : v <= 44 ? 'down' : null),
          st('Classification', s.label),
          st('Scale', '0 fear – 100 greed')
        ]),
        { t: 'meter', value: v, tone: v >= 55 ? 'up' : v <= 44 ? 'down' : 'mid' },
        s.live ? note('Live · alternative.me Fear & Greed · daily') :
          note('Fallback: the index endpoint is unreachable, so this is the neutral default of 50 rather than a real reading.', 'warn')
      ],
      chips: ['Market overview', 'ETH price', 'Ethereum TVL'], topic: 'sentiment'
    };
  }

  function iToken(q, hit) {
    var term = hit.term;
    var d = D();
    if (!d || !d.dexSearch) return { blocks: [note('No data layer on this page.', 'warn')], chips: defaultChips() };
    return cap(d.dexSearch(term), 6500, null).then(function (rows) {
      if (!rows || !rows.length) {
        return {
          blocks: [
            p('No onchain pairs came back for "' + term + '". Either DexScreener is unreachable from this browser or the ticker has no indexed liquidity.'),
            note('status.dex = ' + status('dex'), 'warn'),
            actions([{ label: 'Try ETH instead', act: 'ask', arg: 'eth price', variant: 'quiet' }])
          ],
          chips: ['Find PEPE', 'ETH price', 'Data status'], topic: 'token'
        };
      }
      var top = rows.slice(0, 5);
      var best = top[0];
      return {
        blocks: [
          p('Top pairs for "' + term + '" by DexScreener relevance. Deepest of these is ' + best.base + '/' + best.quote +
            ' on ' + best.chain + ' via ' + best.dex + ', ' + fmt.usdC(best.liq) + ' liquidity.'),
          rowlist(top.map(function (r) {
            return {
              a: r.base + '/' + r.quote,
              b: r.chain + ' · ' + r.dex + ' · ' + fmt.price(r.price),
              c: fmt.usdC(r.liq),
              d: fmt.pct(r.change24 || 0),
              tone: (r.change24 || 0) >= 0 ? 'up' : 'down'
            };
          })),
          note('Live · DexScreener search. Thin liquidity means the printed price is not a price you can get.', best.liq < 50000 ? 'warn' : null),
          actions([{ label: 'Open ' + best.base + '/' + best.quote + ' on DexScreener', href: best.url, ext: true }])
        ],
        chips: ['Find WETH', 'ETH price', 'What is an intent'], topic: 'token'
      };
    });
  }

  function iForecast(q, hit) {
    var sym = hit.sym || MEM.sym || 'ETH';
    var m = mkt(sym);
    var blocks = [
      p('I do not forecast prices. Nothing in this widget has predictive power, and a confident number here would be a lie dressed as data.'),
      p('What I can give you is the current state and let you draw the conclusion.')
    ];
    if (m) {
      var pos = m.high24 > m.low24 ? ((m.price - m.low24) / (m.high24 - m.low24)) * 100 : 50;
      blocks.push(stats([
        st(sym + ' now', fmt.price(m.price)),
        st('24h', fmt.pct(m.change24), tone24(m.change24)),
        st('Range position', Math.round(pos) + '%'),
        st('24h range', fmt.price(m.low24) + ' – ' + fmt.price(m.high24))
      ]));
      var d = D();
      if (d && d.sentiment) blocks.push(note('Fear & Greed is at ' + d.sentiment.value + ' (' + d.sentiment.label + ').'));
      blocks.push(sourceNote(m));
    }
    blocks.push(actions([{ label: 'Set a policy instead', href: P('security') }, { label: 'DCA is an intent', act: 'ask', arg: 'buy 0.1 ETH', variant: 'quiet' }]));
    return { blocks: blocks, chips: [sym + ' price', 'Fear and greed', 'Market overview'], sym: sym, topic: 'forecast' };
  }

  /* ============================================================
     5. INTENT HANDLERS — wallet (drives Strix.wallet for real)
     ============================================================ */
  function nativeSym() {
    var w = W(); if (!w || !w.state.connected) return 'ETH';
    if (w.state.kind === 'solana') return 'SOL';
    var c = w.chains[w.state.chainId];
    return (c && c.native) || 'ETH';
  }

  function iConnect() {
    var w = W();
    if (!w) return { blocks: [note('wallet.js is not loaded on this page.', 'warn')], chips: defaultChips() };
    if (w.state.connected) return iWalletInfo();
    var d = w.detect();
    var found = d.evm.map(function (x) { return x.name; }).concat(d.solana ? [d.solana.name] : []);
    setTimeout(function () { w.openDialog(); }, 420);
    return {
      blocks: [
        p(found.length
          ? 'Opening the connect dialog. Detected in this browser: ' + found.join(', ') + '. Connecting only shares your public address — no seed phrase, no custody, no signature until you approve one.'
          : 'No wallet extension is injected into this browser, so there is nothing for me to connect to. The dialog will show install links.'),
        found.length ? pills(found.map(function (n) { return { label: n, tone: 'up' }; })) : null,
        actions([{ label: 'Open connect dialog', act: 'connect' }])
      ],
      chips: ['My balance', 'My address', 'Switch to Base'], topic: 'wallet'
    };
  }

  function iWalletInfo() {
    var w = W();
    if (!w || !w.state.connected) {
      return {
        blocks: [p('No wallet connected. Connect one and I can read your address, native balance and network directly from the provider.'),
        actions([{ label: 'Connect wallet', act: 'connect' }])],
        chips: ['Connect wallet', 'ETH price', 'What is Strix Hood'], topic: 'wallet'
      };
    }
    var s = w.state;
    return {
      blocks: [
        p('Connected with ' + s.walletName + ' on ' + (s.kind === 'evm' ? w.chainName(s.chainId) : 'Solana mainnet-beta') + '.'),
        stats([
          st('Address', fmt.addr(s.address, 8, 6)),
          st('Network', s.kind === 'evm' ? w.chainName(s.chainId) : 'Solana'),
          st('Balance', s.balance === null ? 'reading…' : fmt.n(s.balance, 4) + ' ' + nativeSym())
        ]),
        code(s.address),
        actions([
          { label: 'Copy address', act: 'copy', arg: s.address },
          { label: 'Explorer', href: s.kind === 'evm' ? w.explorer(s.chainId) + '/address/' + s.address : 'https://solscan.io/account/' + s.address, ext: true, variant: 'quiet' },
          { label: 'Disconnect', act: 'disconnect', variant: 'quiet' }
        ])
      ],
      chips: ['My balance', 'Switch to Base', 'Sign a message', 'Disconnect'], topic: 'wallet'
    };
  }

  function iBalance() {
    var w = W();
    if (!w || !w.state.connected) return iWalletInfo();
    var s = w.state;

    function render(bal, src) {
      var sym = nativeSym();
      var m = mkt(sym === 'BNB' || sym === 'POL' ? 'ETH' : sym);
      var usd = (m && (sym === 'ETH' || sym === 'SOL')) ? bal * m.price : null;
      return {
        blocks: [
          p(bal === null
            ? 'Your provider did not return a balance for ' + fmt.addr(s.address, 6, 4) + '.'
            : fmt.n(bal, 5) + ' ' + sym + ' on ' + (s.kind === 'evm' ? w.chainName(s.chainId) : 'Solana') +
            (usd !== null ? ', worth about ' + fmt.usd(usd) + ' at spot.' : '.')),
          stats([
            st('Balance', bal === null ? '—' : fmt.n(bal, 5) + ' ' + sym),
            st('Value', usd !== null ? fmt.usd(usd) : '—'),
            st('Address', fmt.addr(s.address, 6, 4))
          ]),
          note(src),
          actions([
            { label: 'Refresh', act: 'ask', arg: 'my balance', variant: 'quiet' },
            { label: 'Simulate a swap', act: 'ask', arg: 'swap 100 USDC to ETH' }
          ])
        ],
        chips: ['My address', 'Switch to Base', 'Swap 100 USDC to ETH'], topic: 'wallet'
      };
    }

    if (s.balance !== null && s.balance !== undefined) {
      if (w.refreshBalance) try { w.refreshBalance(); } catch (e) { }
      return render(s.balance, 'Read from your wallet provider · ' + fmt.clock());
    }
    if (s.kind === 'evm' && D() && D().balanceOf) {
      return cap(D().balanceOf(s.address), 5000, null).then(function (b) {
        if (b === null) return render(null, 'Provider and public RPC both declined the balance read.');
        return render(b, 'Read from the public Ethereum RPC (mainnet) · ' + fmt.clock());
      });
    }
    return render(null, 'Balance not exposed by this provider yet.');
  }

  function iSwitch(q, hit) {
    var w = W();
    if (!w) return { blocks: [note('wallet.js is not loaded on this page.', 'warn')], chips: defaultChips() };
    var ch = hit.chain;
    if (!w.state.connected) {
      return {
        blocks: [p('Connect a wallet first — I can only ask a provider to switch networks, I cannot conjure one.'),
        actions([{ label: 'Connect wallet', act: 'connect' }])],
        chips: ['Connect wallet', 'Gas now'], topic: 'wallet'
      };
    }
    if (w.state.kind !== 'evm') {
      return { blocks: [p('You are connected with a Solana wallet. Network switching is EVM-only.')], chips: ['My balance', 'Disconnect'], topic: 'wallet' };
    }
    if (w.state.chainId === ch.id) {
      return { blocks: [p('Already on ' + ch.name + '.'), actions([{ label: 'My balance', act: 'ask', arg: 'my balance' }])], chips: ['My balance', 'Gas now'], topic: 'wallet' };
    }
    setTimeout(function () { w.switchChain(ch.id).catch(function () { }); }, 380);
    return {
      blocks: [
        p('Requesting a switch to ' + ch.name + '. Approve it in your wallet — the site cannot change your network on its own.'),
        stats([st('From', w.chainName(w.state.chainId)), st('To', ch.name), st('Chain ID', ch.id)]),
        actions([{ label: 'Switch to ' + ch.name, act: 'switch', arg: ch.id }])
      ],
      chips: ['My balance', 'Gas now', 'My address'], topic: 'wallet'
    };
  }

  function iDisconnect() {
    var w = W();
    if (!w || !w.state.connected) return { blocks: [p('No wallet is connected.')], chips: ['Connect wallet', 'ETH price'], topic: 'wallet' };
    var name = w.state.walletName;
    setTimeout(function () { w.disconnect(); }, 260);
    return {
      blocks: [p('Disconnecting ' + name + '. The session key is dropped locally; revoke onchain permissions from the dashboard if you granted any.'),
      actions([{ label: 'Open dashboard', href: P('app'), variant: 'quiet' }])],
      chips: ['Connect wallet', 'ETH price', 'What is Strix Hood'], topic: 'wallet'
    };
  }

  function iSign() {
    var w = W();
    if (!w || !w.state.connected) return iWalletInfo();
    return {
      blocks: [
        p('A personal_sign proves you control the address without spending anything. Nothing is broadcast and no allowance is granted.'),
        actions([{ label: 'Sign test message', act: 'sign' }])
      ],
      chips: ['My balance', 'My address', 'Disconnect'], topic: 'wallet'
    };
  }

  /* ============================================================
     6. INTENT HANDLERS — simulated execution
     ============================================================ */
  var VENUE = {
    swap: 'Strix Router → Uniswap v3',
    bid: 'Strix Router → Seaport (OpenSea)',
    buy: 'Strix Router → 1inch aggregation',
    sell: 'Strix Router → 1inch aggregation'
  };
  var CAP_TX = 5000;
  var CAP_DAY = 25000;

  function iExec(q, hit) {
    var m = metrics();
    var execMs = m ? m.execMs : 340;
    var seed = hash(q);
    var slip = jitter(seed, 0.02, 0.31);
    var used = Math.round(jitter(seed >> 3, 1800, 14200));

    var kind = hit.kind;              // swap | buy | sell | bid
    var sellSym = hit.sell, buySym = hit.buy;
    var notional = hit.notional;      // USD
    var outAmt = hit.out;             // units of buySym

    var label = hit.label;
    var overCap = notional !== null && notional > CAP_TX;
    var overDay = notional !== null && (notional + used) > CAP_DAY;

    /* Timing split of the simulated execution budget. */
    var parts = [0.05, 0.12, 0.34, 0.27, 0.22];
    var ms = parts.map(function (f) { return Math.max(3, Math.round(execMs * f)); });

    var steps = [
      { label: 'Intent parsed', detail: label, ms: ms[0] },
      {
        label: 'Policy check',
        detail: overCap
          ? 'exceeds per-tx cap ' + fmt.usd(CAP_TX, 0) + ' → escalate'
          : overDay
            ? 'daily limit ' + fmt.usd(CAP_DAY, 0) + ' would break → escalate'
            : 'per-tx ' + (notional !== null ? fmt.usd(notional, 0) : 'n/a') + ' / ' + fmt.usd(CAP_TX, 0) +
            ' · daily ' + fmt.usd(used, 0) + ' / ' + fmt.usd(CAP_DAY, 0),
        ms: ms[1],
        tone: (overCap || overDay) ? 'warn' : 'ok'
      }
    ];

    if (overCap || overDay) {
      steps.push({ label: 'Human-in-the-loop', detail: 'held for approval · agent halted', ms: ms[2], tone: 'warn' });
    } else {
      steps.push({ label: 'Simulation', detail: 'no revert · slippage ' + slip.toFixed(2) + '% · drainer scan clean', ms: ms[2] });
      steps.push({ label: 'Route solved', detail: (VENUE[kind] || VENUE.swap) + ' · fee ' + TOKEN.fee + '%', ms: ms[3] });
      steps.push({
        label: 'Settled (simulated)',
        detail: (outAmt !== null ? fmt.n(outAmt, outAmt < 1 ? 6 : 4) + ' ' + buySym : label) + ' · 0x' + (seed.toString(16) + 'a41f').slice(0, 8) + '…',
        ms: ms[4]
      });
    }
    var total = steps.reduce(function (a, s) { return a + s.ms; }, 0);

    var blocks = [
      p(overCap || overDay
        ? 'Parsed. The policy engine stopped it before simulation — this is exactly the case layer 2 exists for.'
        : 'Parsed. Running it through the pipeline as a simulation.'),
      trace(label, steps, total)
    ];

    var econ = [];
    if (notional !== null) econ.push(st('Notional', fmt.usd(notional, 0)));
    /* nothing is "received" on a blocked intent — do not imply a fill */
    if (outAmt !== null && !overCap && !overDay) econ.push(st('You receive', fmt.n(outAmt, outAmt < 1 ? 6 : 4) + ' ' + buySym));
    if (notional !== null) econ.push(st('Protocol fee', fmt.usd(notional * TOKEN.fee / 100)));
    if (!overCap && !overDay) econ.push(st('Slippage', slip.toFixed(2) + '%', 'up'));
    if (overCap || overDay) econ.push(st('Verdict', 'HELD', 'down'));
    econ.push(st('Latency', Math.round(total) + 'ms'));
    if (econ.length) blocks.push(stats(econ));

    if (overCap || overDay) {
      blocks.push(p('Raise the per-transaction cap in your policy, or approve this one action manually. The agent cannot widen its own mandate — that is the point of putting the policy on the session key.'));
      blocks.push(actions([
        { label: 'How policies work', act: 'ask', arg: 'how does the policy engine work' },
        { label: 'Security stack', href: P('security'), variant: 'quiet' }
      ]));
    } else {
      blocks.push(actions([
        { label: 'Execute in the app', href: P('app') },
        { label: 'Simulate another', act: 'ask', arg: 'buy 2 ETH', variant: 'quiet' }
      ]));
    }
    blocks.push(note('Simulation only. No transaction was built, signed or broadcast, and no wallet approval was requested. Prices are ' +
      (mkt(buySym) && mkt(buySym).live ? 'live' : 'seeded fallbacks') + '.', 'warn'));

    return {
      blocks: blocks,
      chips: ['Swap 40000 USDC to ETH', 'Bid 1.5 ETH on Strix Agents', 'How does the policy engine work', buySym + ' price'],
      sym: mkt(buySym) ? buySym : (mkt(sellSym) ? sellSym : null),
      topic: 'exec'
    };
  }

  /* ============================================================
     7. INTENT HANDLERS — navigation, meta, fallback
     ============================================================ */
  var NAV = [
    { re: /\bmarket ?place\b|\bhire (an )?agents?\b/, key: 'marketplace', line: 'The marketplace is where you hire, deploy and rate agents — filter by category, inspect reputation, then deploy against your own policy.' },
    { re: /\bagents?\b/, key: 'agents', line: 'Agents are the autonomous executors: each one has an onchain identity, a mandate and a stake behind it.' },
    { re: /\b(nft|passport)\b/, key: 'nft', line: 'The passport page covers the ERC-721 agent identity — traits, reputation and revenue rights.' },
    { re: /\b(stocks?|equit|rwa|tokenized (stock|share))/, key: 'stocks', line: 'Tokenized stocks are RWA equities settled onchain, routed the same way as any other intent.' },
    { re: /\bsecurit|\bpolicy engine\b|\bprotection\b/, key: 'security', line: 'The security page walks through all five layers and the live policy panel.' },
    { re: /\bapi\b|\bendpoint|\bapi keys?\b|\brest\b|\bwebsocket\b/, key: 'api', line: 'API keys are issued from the dashboard once a wallet is connected; the REST and WebSocket surface is documented in the API reference.' },
    { re: /\bsdk\b|\btypescript\b|\bpython\b|\brust\b/, key: 'sdk', line: 'The SDK ships TypeScript, Python and Rust clients over the same intent API.' },
    { re: /\bdocs?\b|\bdocumentation\b|\bguides?\b|\breference\b/, key: 'docs', line: 'Docs cover concepts, guides and the protocol reference.' },
    { re: /\bstatus\b|\buptime\b|\bincident/, key: 'status', line: 'Status has live uptime and incident history.' },
    { re: /\b(dashboard|app|launch|console|terminal)\b/, key: 'app', line: 'The app is the live dashboard — portfolio, agents, intent console and policy controls.' },
    { re: /\badmin\b|\bgovernance\b/, key: 'admin', line: 'Protocol admin is the governance and parameter surface.' },
    { re: /\bcareers?\b|\bjobs?\b|\bhiring\b/, key: 'careers', line: 'Open roles are listed on the careers page.' },
    { re: /\bblog\b|\bwriting\b|\bposts?\b/, key: 'blog', line: 'The blog carries protocol write-ups and release notes.' },
    { re: /\bbrand\b|\blogo\b|\bpress kit\b/, key: 'brand', line: 'The brand kit has the mark, palette and type rules.' },
    { re: /\babout\b|\bteam\b|\bwho (built|made)\b/, key: 'about', line: 'About covers the thesis and the team.' }
  ];

  function iNav(q, hit) {
    var n = hit.nav;
    var extra = [];
    if (n.key === 'api') extra.push({ label: 'Open dashboard', href: P('app'), variant: 'quiet' });
    if (n.key === 'nft') extra.push({ label: 'Deployment status', href: P('docs') + '#networks', variant: 'quiet' });
    return {
      blocks: [
        p(n.line),
        actions([{ label: 'Open ' + LABEL[n.key], href: P(n.key) }].concat(extra))
      ],
      chips: ['What is Strix Hood', 'Open docs', 'Show me the marketplace', 'Launch the app'],
      topic: 'nav'
    };
  }

  function iStatus() {
    var d = D();
    if (!d) return { blocks: [note('The data layer is not loaded on this page.', 'warn')], chips: defaultChips() };
    var s = d.status;
    var rows = [
      ['Binance REST', 'price · 24h stats', s.binance],
      ['Binance WS', 'realtime ticks', s.ws],
      ['CoinGecko', 'mcap · sparkline', s.gecko],
      ['DeFiLlama', 'chain TVL', s.llama],
      ['alternative.me', 'fear & greed', s.fng],
      ['Ethereum RPC', 'block · gas · balances', s.rpc],
      ['DexScreener', 'onchain pairs', s.dex]
    ];
    var ok = rows.filter(function (r) { return r[2] === 'ok'; }).length;
    var fail = rows.filter(function (r) { return r[2] === 'fail'; }).length;
    return {
      blocks: [
        p(ok + ' of ' + rows.length + ' feeds answering, ' + fail + ' failing. ' +
          (fail ? 'Anything sourced from a failing feed is labelled as a fallback when I answer — I do not print stale numbers as live.' : 'Everything you see is a live read.')),
        table(['Feed', 'Provides', 'State'], rows.map(function (r) { return [r[0], r[1], r[2]]; }), ['', '', 'state']),
        note('Protocol metrics (agents, volume, fees) are always simulated and are never sourced from these feeds.')
      ],
      chips: ['ETH price', 'Gas now', 'Protocol metrics'], topic: 'status'
    };
  }

  function iHelp() {
    return {
      blocks: [
        p('I am an intent router over live onchain data — no language model behind me, so I am narrow, fast and I do not hallucinate numbers.'),
        list([
          { n: '01', title: 'Markets', detail: 'Price, 24h range, volume and sparklines for ETH, BTC, SOL, ARB, LINK. Gas, block height, Ethereum TVL, Fear & Greed.' },
          { n: '02', title: 'Tokens', detail: 'Onchain pair lookup through DexScreener — liquidity, venue, 24h.' },
          { n: '03', title: 'Wallet', detail: 'Connect, read balance and address, switch network, sign, disconnect. Real provider calls.' },
          { n: '04', title: 'Protocol', detail: 'Intents, the policy engine, the agent passport, tokenomics, slashing, the five security layers.' },
          { n: '05', title: 'Simulation', detail: 'Type an order — "swap 500 USDC to ETH" — and I run the full pipeline as a labelled simulation.' }
        ]),
        note('I never broadcast a transaction and I never give financial advice.')
      ],
      chips: ['ETH price', 'Gas now', 'Swap 500 USDC to ETH', 'What is an intent']
    };
  }

  function iGreet() {
    var d = D(), eth = mkt('ETH'), btc = mkt('BTC');
    var rows = [];
    if (eth) rows.push(st('ETH', fmt.price(eth.price), tone24(eth.change24), fmt.pct(eth.change24)));
    if (btc) rows.push(st('BTC', fmt.price(btc.price), tone24(btc.change24), fmt.pct(btc.change24)));
    if (d && d.chain && d.chain.gasGwei) rows.push(st('Gas', d.chain.gasGwei.toFixed(1) + ' gwei'));
    if (d && d.sentiment) rows.push(st('Fear & Greed', d.sentiment.value + ' · ' + d.sentiment.label));
    var anyLive = !!(eth && eth.live) || !!(d && d.chain && d.chain.live);
    return {
      blocks: [
        p('Strix terminal. An intent router wired to live onchain data — no model, no guessing.'),
        rows.length ? stats(rows) : null,
        rows.length ? (anyLive ? note('Live · ' + fmt.clock()) :
          note('Every upstream feed is unreachable from this browser. These are seeded fallbacks, not live prices.', 'warn')) : null,
        p('Ask for a price, the gas market, how the protocol works, or type an order and I will simulate it end to end.')
      ],
      chips: defaultChips()
    };
  }

  function iThanks() {
    return { blocks: [p('Noted. Next.')], chips: defaultChips() };
  }

  function iFallback(q) {
    var sym = findSym(q);
    var blocks = [
      p('That one is outside my router. I match intents against live data rather than guessing — here is the surface I actually cover:'),
      list([
        { n: '01', title: 'Markets', detail: '"eth price" · "sol vs eth" · "market overview" · "is gas cheap" · "ethereum tvl" · "fear and greed"' },
        { n: '02', title: 'Tokens', detail: '"find PEPE" · "search token WETH"' },
        { n: '03', title: 'Wallet', detail: '"connect wallet" · "my balance" · "switch to base" · "disconnect"' },
        { n: '04', title: 'Protocol', detail: '"what is an intent" · "how does the policy engine work" · "tokenomics" · "five security layers"' },
        { n: '05', title: 'Simulate', detail: '"swap 500 usdc to eth" · "buy 2 eth" · "bid 1.5 eth on Strix Agents"' }
      ])
    ];
    if (sym) blocks.push(actions([{ label: 'I saw ' + sym + ' — get the price?', act: 'ask', arg: sym + ' price' }]));
    return { blocks: blocks, chips: defaultChips() };
  }

  function defaultChips() {
    return ['ETH price', 'Is gas cheap', 'What is an intent', 'Swap 500 USDC to ETH'];
  }

  /* ============================================================
     8. THE ROUTER
     Order matters: execution and wallet verbs are tested before
     the market matchers, because "buy 2 eth" contains a symbol.
     ============================================================ */
  function normalize(s) {
    return String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  }

  function matchExec(q, raw) {
    if (/^(how|what|why|where|when|who|can i|should i|is it|do i|does)\b/.test(q)) return null;
    if (!/\b(swap|convert|trade|buy|sell|bid|offer|mint|dca|purchase)\b/.test(q)) return null;

    var m, sell = null, buy = null, amount = null, kind = null, subject = null;

    /* swap 500 USDC to ETH  |  convert 1 eth into usdc */
    m = q.match(new RegExp('\\b(?:swap|convert|trade)\\s+' + NUMRE + '?\\s*([a-z$]{2,6})?\\s*(?:to|for|into|->|→)\\s*([a-z$]{2,6})'));
    if (m) { kind = 'swap'; amount = toNum(m[1]); sell = ticker(m[2]) || 'USDC'; buy = ticker(m[3]); }

    /* bid 1.5 eth on <collection> */
    if (!kind) {
      m = q.match(new RegExp('\\b(?:bid|offer)\\s+' + NUMRE + '\\s*([a-z$]{2,6})?\\s*(?:on|for)\\s+(.{2,60})'));
      if (m) { kind = 'bid'; amount = toNum(m[1]); sell = ticker(m[2]) || 'ETH'; buy = sell; subject = recase(m[3].trim(), raw); }
    }

    /* buy 2 eth | buy $500 of eth | sell 0.5 eth */
    if (!kind) {
      m = q.match(new RegExp('\\b(buy|sell|purchase|dca|mint)\\s+(?:the\\s+)?' + NUMRE + '?\\s*(?:of\\s+|worth of\\s+|in\\s+)?([a-z$]{2,6})?'));
      if (m) {
        kind = m[1] === 'sell' ? 'sell' : 'buy';
        amount = toNum(m[2]);
        var t = ticker(m[3]);
        var usdDenominated = /\$/.test(m[2] || '') || /\b(?:of|worth of)\b/.test(q);
        if (kind === 'sell') { sell = t; buy = 'USDC'; }
        else { buy = t; sell = usdDenominated ? 'USDC' : 'USDC'; }
        if (usdDenominated) { kind = 'buy'; }
        m.usd = usdDenominated;
      }
    }
    if (!kind) return null;
    if ((kind === 'buy' || kind === 'sell') && !ticker(m && m[3])) {
      /* no asset named — borrow the one under discussion, or decline the intent */
      if (!MEM.sym) return null;
      if (kind === 'buy') buy = MEM.sym; else sell = MEM.sym;
    }
    if (!buy && !sell) return null;
    if (amount === null || !isFinite(amount) || amount <= 0) amount = 1;

    /* Economics from live prices where we have them. */
    var pSell = priceOf(sell), pBuy = priceOf(buy);
    var notional = null, out = null, label;

    if (kind === 'swap') {
      notional = pSell !== null ? amount * pSell : null;
      out = (notional !== null && pBuy) ? (notional * (1 - TOKEN.fee / 100)) / pBuy : null;
      label = 'swap ' + amt(amount) + ' ' + sell + ' → ' + buy;
    } else if (kind === 'bid') {
      notional = pSell !== null ? amount * pSell : null;
      out = null;
      label = 'bid ' + amt(amount) + ' ' + sell + ' on ' + subject;
    } else if (kind === 'sell') {
      notional = pSell !== null ? amount * pSell : null;
      out = notional !== null ? notional * (1 - TOKEN.fee / 100) : null;
      buy = 'USDC';
      label = 'sell ' + amt(amount) + ' ' + sell + ' → USDC';
    } else {
      /* buy */
      var usdMode = /\$/.test(q) || /\b(?:of|worth of)\b/.test(q);
      if (usdMode && pBuy) { notional = amount; out = (amount * (1 - TOKEN.fee / 100)) / pBuy; label = 'buy ' + fmt.usd(amount, 0) + ' of ' + buy; }
      else { out = amount; notional = pBuy !== null ? amount * pBuy : null; label = 'buy ' + amt(amount) + ' ' + buy; }
      sell = 'USDC';
    }
    return { kind: kind, sell: sell, buy: buy || sell, amount: amount, notional: notional, out: out, label: label, subject: subject };
  }

  var INTENTS = [
    /* meta */
    { id: 'clear', m: /^(clear|reset|wipe|new chat|start over)\b/, run: function () { return null; } },
    { id: 'help', m: /(what can you (do|help)|^help\b|^\?$|your capabilit|what are you|who are you|how do you work)/, run: iHelp },
    { id: 'greet', m: /^(hi|hey|hello|yo|gm|sup|good (morning|afternoon|evening))\b/, run: iGreet },
    { id: 'thanks', m: /^(thanks|thank you|ty|nice|cool|great|ok|okay|got it)\b[\s!.]*$/, run: iThanks },

    /* execution — before markets, these sentences contain symbols */
    { id: 'exec', match: function (q, raw) { return matchExec(q, raw); }, run: iExec },

    /* wallet */
    {
      id: 'wallet.switch',
      match: function (q) {
        if (!/\b(switch|change|move|hop|jump)\b/.test(q)) return null;
        var c = findChain(q);
        return c ? { chain: c } : null;
      }, run: iSwitch
    },
    { id: 'wallet.disconnect', m: /\b(disconnect|log ?out|sign ?out|unlink)\b/, run: iDisconnect },
    { id: 'wallet.connect', m: /\b(connect|link)\b.*\b(wallet|metamask|phantom|rabby|coinbase)\b|^connect\b|\bconnect my wallet\b/, run: iConnect },
    { id: 'wallet.sign', m: /\bsign\b.*\b(message|in|test)\b|\bpersonal_sign\b/, run: iSign },
    { id: 'wallet.balance', m: /\b(my|wallet)\b[^?]*\bbalance\b|^balance\b|\bhow much (eth |sol )?do i (have|own|hold)\b|\bwhat do i hold\b/, run: iBalance },
    { id: 'wallet.address', m: /\bmy (address|wallet|account)\b|\bwho am i\b|\bwhat('s| is) my address\b|\bam i connected\b/, run: iWalletInfo },

    /* diagnostics */
    { id: 'status', m: /\b(data|feed|source|api)s? ?status\b|\bare you (live|real)\b|\bis this (live|real|fake)\b|\bwhere does (this|the) data come from\b|^status$/, run: iStatus },

    /* chain + market */
    { id: 'gas', m: /\bgas\b|\bgwei\b|\bfees? (right )?now\b|\bhow expensive is it to (send|swap)\b/, run: iGas },
    { id: 'block', m: /\bblock (height|number)\b|\b(latest|current) block\b|\bchain head\b/, run: iBlock },
    { id: 'tvl', m: /\btvl\b|\btotal value locked\b|\bhow much is locked\b|\blocked in defi\b/, run: iTVL },
    { id: 'sentiment', m: /\bfear\b.*\bgreed\b|\bgreed\b.*\bfear\b|\bsentiment\b|\bmarket (mood|feel)/, run: iSentiment },

    {
      id: 'token',
      match: function (q) {
        var m = q.match(/\b(?:find|search|look ?up|scan|dex)\s+(?:for\s+)?(?:the\s+)?(?:token\s+|coin\s+|pair\s+)?([a-z0-9$.\-]{2,20})/);
        if (!m) return null;
        var term = m[1].replace(/[^a-z0-9$.\-]/g, '');
        if (!term || /^(the|a|an|me|it|out|up)$/.test(term)) return null;
        return { term: term.toUpperCase() };
      }, run: iToken
    },

    {
      id: 'compare',
      match: function (q) {
        if (!/\bvs\.?\b|\bversus\b|\bcompare\b|\bagainst\b|\bbetter than\b/.test(q)) return null;
        var s = findSyms(q);
        return s.length >= 2 ? { syms: s } : null;
      }, run: iCompare
    },
    { id: 'market', m: /\b(market overview|how('s| is) the market|all prices|whole market|markets?\b(?!place)|breadth|majors)\b/, run: iMarket },

    {
      id: 'forecast',
      match: function (q) {
        if (!/\b(predict|forecast|next (week|month|year)|price target|when (moon|lambo)|should i (buy|sell)|will .*(go|hit|reach|pump|dump)|where (is|will) .* (go|be)|what about (tomorrow|next)|tomorrow'?s? price|price tomorrow)\b/.test(q) &&
          !(/\btomorrow\b/.test(q) && (findSym(q) || MEM.sym) && /\b(price|worth|do|will|about)\b/.test(q))) return null;
        return { sym: findSym(q) || MEM.sym };
      }, run: iForecast
    },

    {
      id: 'price',
      match: function (q) {
        var sym = findSym(q);
        var wants = /\bprice\b|\bhow much is\b|\bhow much does\b|\bworth\b|\bquote\b|\btrading at\b|\bcost\b|\bvalue of\b|\b(up|down) today\b|\bpumping\b|\bdumping\b|\bchart\b|\bwhat('s| is) \w+ at\b|\b(doing|looking|holding up)\b|\bhappening (with|to)\b|\bhow('s| is| are)\b/.test(q);
        /* bare symbol, or "and btc?" — resolves against conversation memory */
        var bare = /^(and |what about |how about |ok |now )?\$?[a-z]{2,9}\??$/.test(q) && !!sym;
        if (sym && (wants || bare)) return { sym: sym };
        if (!sym && wants && MEM.sym) return { sym: MEM.sym };
        var t = q.match(/^(?:price|chart) (?:of |for )?([a-z]{2,6})$/);
        if (t) return { sym: ticker(t[1]) };
        return null;
      }, run: iPrice
    },

    /* protocol knowledge */
    { id: 'kb.what', m: /\bwhat is strix\b|\bwhat('s| is) strix hood\b|\bexplain strix\b|\bwhat does strix (hood )?do\b|\btell me about strix\b/, run: kbWhat },
    { id: 'kb.intent', m: /\bwhat is an? intent\b|\bintent[- ]based\b|\bhow do intents? work\b|\bexplain intents?\b|\bwhat are intents\b/, run: kbIntent },
    { id: 'kb.policy', m: /\bpolicy engine\b|\bspending polic|\bhow do polic|\bwhat is a polic|\bpolicy work\b|\bspending limits?\b/, run: kbPolicy },
    { id: 'kb.passport', m: /\bpassport\b|\bagent nft\b|\berc.?721\b|\bagent identity\b/, run: kbPassport },
    { id: 'kb.audit', m: /\baudit(ed|s|or)?\b|\bbug bounty\b|\bbounty\b|\bpen ?test|\bsecurity review\b/, run: kbAudit },
    { id: 'kb.contracts', m: /\bcontract address(es)?\b|\bcontract\b.*\baddress\b|\baddress\b.*\bcontract\b|\bdeploy(ed|ment)s?\b|\bwhat chains?\b|\bwhich chains?\b|\bwhere (is|are) (it|the contracts?) deployed\b|\bis (it|strx) (live|on mainnet)\b|\bmainnet\b|\bca\b|\btoken address\b|\bwhen (tge|token|launch)\b/, run: kbContracts },
    { id: 'kb.token', m: /\btokenomic|\bstrx\b|\bthe token\b|\bfee split\b|\bburn\b|\bsupply\b|\bstaking rewards?\b/, run: kbTokenomics },
    { id: 'kb.agents', m: /\bslash|\bregister(ed|ing)? (an )?agent|\bhow do agents? (get )?(work|register|join)|\bagent bond\b|\breputation bond\b/, run: kbAgents },
    { id: 'kb.security', m: /\bsecurity layers?\b|\bfive layers?\b|\b5 layers?\b|\bhow (is it|are you) secure\b|\bsecurity (stack|model)\b|\bis it safe\b|\baccount abstraction\b|\berc.?4337\b|\bhuman.in.the.loop\b/, run: kbSecurity },
    { id: 'kb.metrics', m: /\bprotocol (metrics|stats)\b|\bhow many agents\b|\bhow much volume\b|\bstats\b/, run: kbMetrics },

    /* navigation */
    {
      id: 'nav',
      match: function (q) {
        var verby = /\b(show|open|take me|go to|navigate|where (is|are|can)|link|find the|visit|launch|read)\b/.test(q);
        for (var i = 0; i < NAV.length; i++) {
          if (NAV[i].re.test(q)) {
            /* a bare page name is navigation too, e.g. "marketplace" */
            if (verby || q.split(' ').length <= 3) return { nav: NAV[i] };
          }
        }
        return null;
      }, run: iNav
    }
  ];

  C.intents = INTENTS.map(function (i) { return i.id; }).concat(['fallback']);

  function pick(q, raw) {
    for (var i = 0; i < INTENTS.length; i++) {
      var it = INTENTS[i], hit = null;
      if (it.match) hit = it.match(q, raw || q);
      else if (it.m && it.m.test(q)) hit = {};
      if (hit) return { intent: it, hit: hit };
    }
    return null;
  }
  C.classify = function (text) {
    var r = pick(normalize(text), text);
    return r ? r.intent.id : 'fallback';
  };

  /* ============================================================
     9. MEMORY
     ============================================================ */
  var MEM = { sym: null, topic: null };
  var LOGMSGS = [];
  var HIST = [];

  function persist() {
    try {
      S.store.set(KEY, {
        v: 1, ts: Date.now(), mem: MEM, open: !!state.open && !isSheet(),
        msgs: LOGMSGS.slice(-MAX_MSG), hist: HIST.slice(-20)
      });
    } catch (e) { }
  }
  function restore() {
    var raw = S.store.get(KEY, null);
    if (!raw || raw.v !== 1) return null;
    if (Date.now() - (raw.ts || 0) > 1000 * 60 * 60 * 12) return null;   /* stale market talk is worse than none */
    MEM = raw.mem || MEM;
    LOGMSGS = raw.msgs || [];
    HIST = raw.hist || [];
    return raw;
  }

  /* ============================================================
     10. DOM
     ============================================================ */
  var state = { open: false, mounted: false, busy: false, token: 0, lastFocus: null };
  var root, launcher, panel, logEl, chipsEl, input, form, liveEl;

  var MARK = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="sxcg" x1="0.15" y1="0" x2="0.9" y2="1">' +
    '<stop offset="0" stop-color="#E4FF4D"/><stop offset="0.5" stop-color="#CCFF00"/><stop offset="1" stop-color="#7FE86B"/>' +
    '</linearGradient></defs>' +
    '<path d="M32 7 L51.5 18.5 C54 33 48.5 50 32 57 C15.5 50 10 33 12.5 18.5 Z" fill="url(#sxcg)"/>' +
    '<circle cx="24.8" cy="29.5" r="5.9" fill="#0A0A0F"/><circle cx="39.2" cy="29.5" r="5.9" fill="#0A0A0F"/>' +
    '<circle cx="24.8" cy="29.5" r="2.3" fill="#CCFF00"/><circle cx="39.2" cy="29.5" r="2.3" fill="#CCFF00"/>' +
    '<path d="M32 34.5 L35.6 41.5 L28.4 41.5 Z" fill="#0A0A0F"/></svg>';

  function isSheet() { return global.matchMedia ? global.matchMedia('(max-width: 640px)').matches : global.innerWidth < 641; }

  function build() {
    root = el('div', { class: 'sxc', id: 'sxc-root' });

    launcher = el('button', {
      class: 'sxc-launcher', id: 'sxc-launcher', type: 'button',
      'aria-haspopup': 'dialog', 'aria-controls': 'sxc-panel', 'aria-expanded': 'false',
      'aria-label': 'Open the Strix assistant'
    }, [
      el('span', { class: 'sxc-launcher__mark', html: MARK, 'aria-hidden': 'true' }),
      el('span', { class: 'sxc-launcher__label' }, [
        el('b', { text: 'Ask Strix' }),
        el('em', { text: 'intents · markets · policy' })
      ]),
      el('span', { class: 'sxc-launcher__ping', 'aria-hidden': 'true' })
    ]);
    launcher.addEventListener('click', function () { C.toggle(); });

    liveEl = el('span', { class: 'sx-status sx-status--idle sxc-live', id: 'sxc-live' }, [
      el('i', {}), el('span', { text: 'BOOT' })
    ]);

    logEl = el('div', {
      class: 'sxc-log', id: 'sxc-log', role: 'log',
      'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Conversation transcript', tabindex: '0'
    });

    chipsEl = el('div', { class: 'sxc-chips', id: 'sxc-chips', role: 'group', 'aria-label': 'Suggested questions' });

    input = el('input', {
      class: 'sxc-input', id: 'sxc-input', type: 'text', autocomplete: 'off',
      spellcheck: 'false', placeholder: 'price, gas, policy, or an order to simulate'
    });
    input.addEventListener('keydown', onInputKey);

    form = el('form', { class: 'sxc-form', autocomplete: 'off' }, [
      el('label', { class: 'sx-sr', for: 'sxc-input', text: 'Ask the Strix assistant about prices, gas, the protocol, or an intent to simulate' }),
      el('span', { class: 'sxc-caret', 'aria-hidden': 'true', text: '›' }),
      input,
      el('button', { class: 'sxc-send', type: 'submit', 'aria-label': 'Send message' }, [
        el('span', { class: 'sxc-send__i', 'aria-hidden': 'true' })
      ])
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      input.value = '';
      C.ask(v);
    });

    panel = el('section', {
      class: 'sxc-panel', id: 'sxc-panel', role: 'dialog',
      'aria-labelledby': 'sxc-title', 'aria-describedby': 'sxc-sub', hidden: true
    }, [
      el('header', { class: 'sxc-head' }, [
        el('span', { class: 'sxc-head__mark', html: MARK, 'aria-hidden': 'true' }),
        el('div', { class: 'sxc-head__txt' }, [
          el('h2', { class: 'sxc-head__title', id: 'sxc-title', text: 'Strix Terminal' }),
          el('p', { class: 'sxc-head__sub', id: 'sxc-sub' }, [liveEl, el('span', { text: 'intent router' })])
        ]),
        el('button', {
          class: 'sxc-icon', type: 'button', 'aria-label': 'Clear conversation', title: 'Clear conversation',
          onclick: function () { C.clear(); }
        }, [el('span', { class: 'sxc-icon__wipe', 'aria-hidden': 'true' })]),
        el('button', {
          class: 'sxc-icon sxc-icon--x', type: 'button', 'aria-label': 'Close chat', title: 'Close',
          onclick: function () { C.close(); }
        }, [el('span', { 'aria-hidden': 'true', text: '×' })])
      ]),
      logEl,
      el('div', { class: 'sxc-foot' }, [chipsEl, form])
    ]);
    panel.addEventListener('keydown', onPanelKey);

    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);
  }

  /* ---------- keyboard ---------- */
  function onInputKey(e) {
    if (e.key === 'ArrowUp' && HIST.length) {
      e.preventDefault();
      input.__h = input.__h === undefined ? HIST.length - 1 : Math.max(0, input.__h - 1);
      input.value = HIST[input.__h] || '';
      return;
    }
    if (e.key === 'ArrowDown' && HIST.length) {
      e.preventDefault();
      if (input.__h === undefined) return;
      input.__h = Math.min(HIST.length, input.__h + 1);
      input.value = HIST[input.__h] || '';
      if (input.__h >= HIST.length) input.__h = undefined;
    }
  }

  function focusables() {
    return S.$$('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])', panel)
      .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
  }
  function onPanelKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); C.close(); return; }
    if (e.key !== 'Tab' || !isSheet()) return;      /* trap only while the mobile sheet covers the page */
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- live status pill ---------- */
  function syncLive() {
    if (!liveEl) return;
    var d = D();
    var cls = 'sx-status sxc-live ', label = 'OFFLINE', tone = 'sx-status--warn';
    if (!d) { label = 'NO FEED'; }
    else {
      var vals = Object.keys(d.status).map(function (k) { return d.status[k]; });
      var ok = vals.filter(function (v) { return v === 'ok'; }).length;
      var fail = vals.filter(function (v) { return v === 'fail'; }).length;
      if (ok && !fail) { label = 'LIVE'; tone = 'sx-status--live'; }
      else if (ok) { label = 'PARTIAL'; tone = 'sx-status--warn'; }
      else if (fail) { label = 'FALLBACK'; tone = 'sx-status--err'; }
      else { label = 'BOOT'; tone = 'sx-status--idle'; }
    }
    liveEl.className = cls + tone;
    var t = liveEl.lastChild;
    if (t) t.textContent = label;
    liveEl.setAttribute('title', label === 'LIVE' ? 'All data feeds responding'
      : label === 'PARTIAL' ? 'Some feeds are failing — affected answers are labelled'
        : label === 'FALLBACK' ? 'No feed is reachable — numbers are labelled as simulations'
          : 'Waiting for the first response');
  }

  /* ============================================================
     11. BLOCK RENDERING
     ============================================================ */
  function makeBlock(b) {
    switch (b.t) {
      case 'note': return el('p', { class: 'sxc-note' + (b.tone ? ' is-' + b.tone : '') }, [
        el('span', { class: 'sxc-note__g', 'aria-hidden': 'true' }), el('span', { text: b.text })
      ]);

      case 'stats': {
        var g = el('div', { class: 'sxc-stats' });
        (b.rows || []).forEach(function (r) {
          /* a delta is tinted on its own so the headline number stays neutral */
          var val = r.d
            ? el('span', { class: 'sx-stat__v sxc-stat__v' }, [
                document.createTextNode(r.v),
                el('em', { class: 'sxc-stat__d' + (r.tone ? ' sx-' + r.tone : ''), text: r.d })
              ])
            : el('span', { class: 'sx-stat__v sxc-stat__v' + (r.tone ? ' sx-' + r.tone : ''), text: r.v });
          g.appendChild(el('div', { class: 'sx-stat sxc-stat' }, [
            el('span', { class: 'sx-stat__k', text: r.k }), val
          ]));
        });
        return g;
      }

      case 'table': {
        var wrap = el('div', { class: 'sxc-tablewrap' });
        var t = el('table', { class: 'sxc-table' });
        var thead = el('thead'), tr = el('tr');
        (b.head || []).forEach(function (h, i) {
          tr.appendChild(el('th', { text: h, class: b.align[i] === 'num' ? 'num' : '' }));
        });
        thead.appendChild(tr); t.appendChild(thead);
        var tb = el('tbody');
        (b.rows || []).forEach(function (row) {
          var r = el('tr');
          row.forEach(function (c, i) {
            var a = b.align[i];
            if (a === 'state') {
              r.appendChild(el('td', {}, [el('span', {
                class: 'sxc-dot is-' + (c === 'ok' ? 'ok' : c === 'fail' ? 'err' : 'idle'), 'aria-hidden': 'true'
              }), el('span', { class: 'sxc-mono', text: String(c) })]));
            } else {
              var cls = a === 'num' ? 'num' : '';
              var txt = String(c);
              if (/^[+-]\d/.test(txt) && txt.indexOf('%') > -1) cls += txt[0] === '-' ? ' sx-down' : ' sx-up';
              r.appendChild(el('td', { class: cls, text: txt }));
            }
          });
          tb.appendChild(r);
        });
        t.appendChild(tb); wrap.appendChild(t);
        return wrap;
      }

      case 'pills': {
        var pw = el('div', { class: 'sxc-pillrow' });
        (b.items || []).forEach(function (i, ix) {
          pw.appendChild(el('span', { class: 'sx-pill sx-pill--static sxc-tag' + (i.tone ? ' is-on' : ''), text: i.label }));
          if (ix < b.items.length - 1) pw.appendChild(el('span', { class: 'sxc-arrow', 'aria-hidden': 'true', text: '→' }));
        });
        return pw;
      }

      case 'list': {
        var ol = el('ol', { class: 'sxc-list' });
        (b.items || []).forEach(function (i) {
          ol.appendChild(el('li', {}, [
            el('span', { class: 'sxc-list__n sxc-mono', text: i.n }),
            el('span', {}, [
              el('b', { text: i.title }),
              i.detail ? el('em', { text: i.detail }) : null
            ])
          ]));
        });
        return ol;
      }

      case 'rows': {
        var rw = el('div', { class: 'sxc-rows' });
        (b.items || []).forEach(function (i) {
          rw.appendChild(el('div', { class: 'sxc-row' }, [
            el('span', { class: 'sxc-row__l' }, [
              el('b', { text: i.a }),
              i.b ? el('em', { class: 'sxc-mono', text: i.b }) : null
            ]),
            el('span', { class: 'sxc-row__r sxc-mono' }, [
              i.c ? el('b', { text: i.c }) : null,
              i.d ? el('em', { class: i.tone ? 'sx-' + i.tone : '', text: i.d }) : null
            ])
          ]));
        });
        return rw;
      }

      case 'code': return el('pre', { class: 'sxc-code' }, [el('code', { text: b.text })]);

      case 'meter': {
        var mw = el('div', { class: 'sxc-meterwrap' }, [
          el('div', { class: 'sx-meter sxc-meter' + (b.tone === 'down' ? ' sx-meter--danger' : b.tone === 'mid' ? ' sx-meter--warn' : '') }, [
            el('i', { style: { width: Math.max(2, Math.min(100, b.value)) + '%' } })
          ]),
          el('div', { class: 'sxc-meter__scale' }, [
            el('span', { text: 'Extreme fear' }), el('span', { text: 'Extreme greed' })
          ])
        ]);
        return mw;
      }

      case 'spark': {
        var m = mkt(b.sym);
        var up = b.change >= 0;
        var host = el('div', { class: 'sxc-spark' + (up ? '' : ' is-down') }, [
          el('div', { class: 'sxc-spark__head' }, [
            el('span', { class: 'sxc-spark__sym sxc-mono', text: b.sym + ' · ' + (b.range || '7d') + ' shape' }),
            b.sim ? el('span', { class: 'sxc-spark__tag sxc-mono', text: 'SIMULATED' }) : null,
            el('span', { class: 'sxc-spark__d sxc-mono' + (up ? ' sx-up' : ' sx-down'), text: fmt.pct(b.change) })
          ]),
          el('canvas', { class: 'sxc-spark__c', height: '52', 'aria-hidden': 'true' })
        ]);
        host.__spark = b;
        return host;
      }

      case 'trace': {
        var box = el('div', { class: 'sxc-trace' }, [
          el('div', { class: 'sxc-trace__head' }, [
            el('span', { class: 'sxc-trace__tag sxc-mono', text: 'SIMULATION' }),
            el('span', { class: 'sxc-trace__title sxc-mono', text: b.title })
          ])
        ]);
        var body = el('div', { class: 'sxc-trace__body' });
        (b.steps || []).forEach(function (s) {
          body.appendChild(el('div', { class: 'sxc-step' }, [
            el('span', { class: 'sxc-step__dot', 'aria-hidden': 'true' }),
            el('span', { class: 'sxc-step__txt' }, [
              el('b', { text: s.label }),
              el('em', { class: 'sxc-mono', text: s.detail })
            ]),
            el('span', { class: 'sxc-step__ms sxc-mono', text: '' })
          ]));
        });
        box.appendChild(body);
        box.appendChild(el('div', { class: 'sxc-trace__foot sxc-mono' }, [
          el('span', { text: 'total' }),
          el('b', { class: 'sxc-trace__total', text: b.total + 'ms' })
        ]));
        box.__trace = b;
        return box;
      }

      case 'actions': {
        var row = el('div', { class: 'sxc-actions' });
        (b.items || []).forEach(function (a) {
          var cls = 'sx-btn sx-btn--sm ' + (a.variant === 'quiet' ? 'sx-btn--quiet' : 'sx-btn--ghost');
          if (a.href) {
            row.appendChild(el('a', {
              class: cls, href: a.href, text: a.label,
              target: a.ext ? '_blank' : null, rel: a.ext ? 'noopener noreferrer' : null
            }));
          } else {
            row.appendChild(el('button', {
              class: cls, type: 'button', text: a.label,
              onclick: function () { doAction(a.act, a.arg); }
            }));
          }
        });
        return row;
      }
    }
    return null;
  }

  function afterMount(b, node, live, next) {
    if (b.t === 'spark') {
      var draw = function () {
        var c = node.querySelector('canvas');
        if (c && b.data && b.data.length > 2) {
          S.sparkline(c, b.data, {
            w: c.clientWidth || 320, h: 52,
            color: b.change >= 0 ? '#CCFF00' : '#FF5000'
          });
        }
        next();
      };
      requestAnimationFrame(draw);
      return;
    }
    if (b.t === 'trace') { animTrace(b, node, live, next); return; }
    if (live && !S.reduced) { setTimeout(next, 110); return; }
    next();
  }

  function animTrace(b, node, live, next) {
    var rows = S.$$('.sxc-step', node);
    var msNodes = rows.map(function (r) { return r.querySelector('.sxc-step__ms'); });
    if (!live || S.reduced) {
      rows.forEach(function (r, i) {
        r.classList.add(b.steps[i].tone === 'warn' ? 'is-warn' : 'is-ok');
        msNodes[i].textContent = b.steps[i].ms + 'ms';
      });
      next(); return;
    }
    var i = 0, tk = state.token;
    (function step() {
      if (tk !== state.token) return;
      if (i >= rows.length) { next(); return; }
      var r = rows[i], s = b.steps[i];
      r.classList.add('is-run');
      scrollBottom();
      var wall = Math.min(520, Math.max(170, s.ms * 0.9 + 120));
      setTimeout(function () {
        if (tk !== state.token) return;
        r.classList.remove('is-run');
        r.classList.add(s.tone === 'warn' ? 'is-warn' : 'is-ok');
        msNodes[i].textContent = s.ms + 'ms';
        i++;
        scrollBottom();
        step();
      }, wall);
    })();
  }

  /* ---------- typing ---------- */
  function typeInto(node, text, live, done) {
    if (!live || S.reduced) { node.textContent = text; done(); return; }
    var i = 0, tk = state.token;
    var chunk = Math.max(1, Math.ceil(text.length / 62));
    (function step() {
      if (tk !== state.token) return;
      i = Math.min(text.length, i + chunk);
      node.textContent = text.slice(0, i);
      scrollBottom();
      if (i < text.length) setTimeout(step, 18);
      else done();
    })();
  }

  function scrollBottom() {
    if (!logEl) return;
    logEl.scrollTop = logEl.scrollHeight;
  }

  /* ---------- messages ---------- */
  function addUser(text) {
    var row = el('div', { class: 'sxc-msg sxc-msg--me' }, [
      el('div', { class: 'sxc-bubble', text: text })
    ]);
    logEl.appendChild(row);
    scrollBottom();
  }

  function addBot(blocks, live, chips, onDone) {
    var body = el('div', { class: 'sxc-body' });
    var row = el('div', { class: 'sxc-msg sxc-msg--bot' }, [
      el('span', { class: 'sxc-av', html: MARK, 'aria-hidden': 'true' }),
      body
    ]);
    /* Screen readers get the whole answer once, as text, instead of
       every keystroke of the typewriter. */
    var srText = blocks.filter(function (b) { return b && b.t === 'p'; }).map(function (b) { return b.text; }).join(' ');
    if (srText) body.appendChild(el('span', { class: 'sx-sr', text: srText }));
    logEl.appendChild(row);
    scrollBottom();

    var visible = el('div', { class: 'sxc-vis', 'aria-hidden': 'true' });
    body.appendChild(visible);

    var clean = blocks.filter(Boolean);
    var i = 0, tk = state.token;
    (function next() {
      if (tk !== state.token) return;
      if (i >= clean.length) {
        if (chips) setChips(chips);
        if (onDone) onDone();
        return;
      }
      var b = clean[i++];
      if (b.t === 'p') {
        var pn = el('p', { class: 'sxc-p' });
        visible.appendChild(pn);
        typeInto(pn, b.text, live, next);
      } else {
        var node = makeBlock(b);
        if (!node) { next(); return; }
        if (live && !S.reduced) node.classList.add('sxc-in');
        visible.appendChild(node);
        scrollBottom();
        afterMount(b, node, live, next);
      }
    })();
    return row;
  }

  function typingRow() {
    var row = el('div', { class: 'sxc-msg sxc-msg--bot sxc-typing' }, [
      el('span', { class: 'sxc-av', html: MARK, 'aria-hidden': 'true' }),
      el('div', { class: 'sxc-body' }, [
        el('span', { class: 'sxc-dots', 'aria-label': 'Working' }, [el('i'), el('i'), el('i')])
      ])
    ]);
    logEl.appendChild(row);
    scrollBottom();
    return row;
  }

  function setChips(items) {
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    (items || []).slice(0, 5).forEach(function (c) {
      chipsEl.appendChild(el('button', {
        class: 'sx-pill sxc-chip', type: 'button', text: c,
        onclick: function () { C.ask(c); }
      }));
    });
  }

  /* ---------- action registry (serialisable) ---------- */
  function doAction(act, arg) {
    var w = W();
    switch (act) {
      case 'ask': C.ask(arg); break;
      case 'connect': if (w) w.openDialog(); break;
      case 'disconnect': if (w) w.disconnect(); break;
      case 'switch': if (w) w.switchChain(arg).catch(function () { }); break;
      case 'copy': S.copy(arg, 'Address copied'); break;
      case 'sign':
        if (!w || !w.state.connected) { if (w) w.openDialog(); break; }
        w.signMessage('Strix Hood — proving control of ' + w.state.address + '\nNonce: ' + Date.now())
          .then(function (sig) { S.toast({ title: 'Signature verified', body: fmt.addr(sig, 12, 8) }); })
          .catch(function () { S.toast({ title: 'Signing cancelled', type: 'warn' }); });
        break;
      case 'open': global.open(arg, '_blank', 'noopener'); break;
    }
  }

  /* ============================================================
     12. CONVERSATION FLOW
     ============================================================ */
  function pushMsg(rec) {
    LOGMSGS.push(rec);
    if (LOGMSGS.length > MAX_MSG) LOGMSGS = LOGMSGS.slice(-MAX_MSG);
    persist();
  }

  C.ask = function (text) {
    text = String(text || '').trim();
    if (!text) return;
    if (!state.mounted) C.mount();
    if (!state.open) C.open({ focus: false });

    var q = normalize(text);
    addUser(text);
    pushMsg({ r: 'u', text: text });
    HIST.push(text);
    if (HIST.length > 20) HIST = HIST.slice(-20);
    input.__h = undefined;

    var found = pick(q, text);
    if (found && found.intent.id === 'clear') { C.clear(); return; }

    state.busy = true;
    var typing = typingRow();
    var delay = S.reduced ? 0 : 220 + Math.random() * 220;

    var work = new Promise(function (res) {
      setTimeout(function () {
        try {
          res(found ? found.intent.run(q, found.hit) : iFallback(q));
        } catch (e) {
          console.warn('[strix-chat] handler error', e);
          res({
            blocks: [p('That request hit an error inside the router rather than returning an answer. The failure is mine, not yours — try a simpler phrasing.'),
            note(String(e && e.message || e), 'warn')],
            chips: defaultChips()
          });
        }
      }, delay);
    });

    Promise.resolve(work).then(function (resp) {
      if (typing.parentNode) typing.remove();
      if (!resp) { state.busy = false; return; }
      if (resp.sym) MEM.sym = resp.sym;
      if (resp.topic) MEM.topic = resp.topic;
      var blocks = resp.blocks.filter(Boolean);
      pushMsg({ r: 'b', blocks: blocks, chips: resp.chips || null });
      addBot(blocks, true, resp.chips || defaultChips(), function () { state.busy = false; persist(); });
    }).catch(function (e) {
      if (typing.parentNode) typing.remove();
      console.warn('[strix-chat]', e);
      addBot([p('That answer failed while it was being assembled — either the data source never returned or the router itself broke. Nothing was invented to cover the gap.'),
      note(String(e && e.message || e), 'warn')], true, defaultChips(), function () { state.busy = false; });
    });
  };

  C.clear = function () {
    state.token++;
    LOGMSGS = [];
    MEM = { sym: null, topic: null };
    if (logEl) logEl.innerHTML = '';
    persist();
    greet();
  };

  function greet() {
    var g = iGreet();
    var blocks = g.blocks.filter(Boolean);
    pushMsg({ r: 'b', blocks: blocks, chips: g.chips });
    addBot(blocks, !S.reduced, g.chips);
  }

  function replay() {
    logEl.innerHTML = '';
    LOGMSGS.forEach(function (m) {
      if (m.r === 'u') addUser(m.text);
      else addBot(m.blocks || [], false, null);
    });
    /* numbers in a replayed transcript were true when they were printed */
    logEl.appendChild(el('div', { class: 'sxc-divider', text: 'restored session · figures above are historical' }));
    var last = null;
    for (var i = LOGMSGS.length - 1; i >= 0; i--) { if (LOGMSGS[i].r === 'b' && LOGMSGS[i].chips) { last = LOGMSGS[i].chips; break; } }
    setChips(last || defaultChips());
    /* blocks that need a layout pass (canvases) land a frame later */
    scrollBottom();
    requestAnimationFrame(scrollBottom);
    setTimeout(scrollBottom, 120);
    setTimeout(scrollBottom, 420);
  }

  /* ============================================================
     13. OPEN / CLOSE
     ============================================================ */
  C.open = function (opts) {
    opts = opts || {};
    if (!state.mounted) C.mount();
    if (state.open) return;
    state.open = true;
    state.lastFocus = document.activeElement;
    panel.hidden = false;
    /* force a frame so the transition actually runs */
    requestAnimationFrame(function () {
      panel.classList.add('is-open');
      root.classList.add('is-open');
    });
    launcher.setAttribute('aria-expanded', 'true');
    launcher.classList.add('is-open');
    if (isSheet()) document.body.classList.add('sx-lock');
    syncLive();
    /* redraw sparkline canvases now that the panel has width */
    setTimeout(redrawSparks, 60);
    if (opts.focus !== false) setTimeout(function () { try { input.focus(); } catch (e) { } }, isSheet() ? 240 : 120);
    persist();
    S.emit('chat:open', true);
  };

  C.close = function () {
    if (!state.open) return;
    state.open = false;
    panel.classList.remove('is-open');
    root.classList.remove('is-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.classList.remove('is-open');
    document.body.classList.remove('sx-lock');
    var t = S.reduced ? 0 : 300;
    setTimeout(function () { if (!state.open) panel.hidden = true; }, t);
    /* focus returns to whatever opened the panel, and to the launcher when
       that element is gone or was never a real control */
    var back = state.lastFocus;
    if (!back || back === document.body || !back.focus || !document.contains(back)) back = launcher;
    try { back.focus(); } catch (e) { try { launcher.focus(); } catch (e2) { } }
    persist();
    S.emit('chat:open', false);
  };

  C.toggle = function () { state.open ? C.close() : C.open(); };

  function redrawSparks() {
    S.$$('.sxc-spark', logEl).forEach(function (n) {
      var b = n.__spark;
      var c = n.querySelector('canvas');
      if (!b || !c || !b.data) return;
      S.sparkline(c, b.data, { w: c.clientWidth || 320, h: 52, color: b.change >= 0 ? '#CCFF00' : '#FF5000' });
    });
  }

  /* ============================================================
     14. MOUNT
     ============================================================ */
  C.mount = function (opts) {
    opts = opts || {};
    if (state.mounted) { syncLive(); return C; }
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () { C.mount(opts); });
      return C;
    }
    state.mounted = true;
    build();

    /* keep clear of the app shell's bottom navigation when a page has one */
    if (document.querySelector('.sx-bottomnav')) document.documentElement.classList.add('sxc-bottomnav');

    var saved = restore();
    if (LOGMSGS.length) replay(); else greet();

    /* delegated openers: <button data-chat="eth price"> */
    if (!document.__sxcDelegated) {
      document.__sxcDelegated = true;
      document.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('[data-chat]') : null;
        if (!t) return;
        e.preventDefault();
        var prompt = t.getAttribute('data-chat');
        C.open({ focus: false });
        if (prompt) setTimeout(function () { C.ask(prompt); }, 60);
      });
      document.addEventListener('keydown', function (e) {
        /* ⌘/Ctrl+K focuses the terminal, matching the rest of the app */
        if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          state.open ? (input && input.focus()) : C.open();
          return;
        }
        /* Escape closes from anywhere. S.modal traps Escape in the capture
           phase, so an open dialog still wins. */
        if (e.key === 'Escape' && state.open && !document.querySelector('.sx-overlay')) C.close();
      });
    }

    S.on('data:status', syncLive);
    S.on('wallet', function () { /* keeps the pill honest if a session appears */ syncLive(); });
    global.addEventListener('resize', function () {
      if (state.open) redrawSparks();
      if (!isSheet()) document.body.classList.remove('sx-lock');
    });
    syncLive();

    if (opts.open || (saved && saved.open && !isSheet())) C.open({ focus: false });
    return C;
  };

  /* Expose the response builders for tests / other widgets. */
  C.blocks = { p: p, stats: stats, note: note, actions: actions, table: table, list: list, spark: spark, trace: trace };
  C.state = state;
  C.memory = function () { return MEM; };

})(window);
