/* ============================================================
   STRIX HOOD — Shared shell
   One source of truth for navigation + footer across every page.
   Any link that exists here resolves to a real page. Nothing is
   decorative; "soon" items are explicitly disabled, never dead.
   ============================================================ */
(function (global) {
  'use strict';

  var S = global.Strix;
  if (!S) { console.error('[strix-shell] strix.js must load first'); return; }

  /* ---------------- sitemap ---------------- */
  var SITE = {
    x: 'https://x.com/strixhood',
    opensea: 'https://opensea.io/',   // no collection deployed
    discord: null,   // not live yet
    mirror: null,    // not live yet
    product: [
      { label: 'Agents', href: 'agents.html', desc: 'Autonomous executors with onchain identity' },
      { label: 'Marketplace', href: 'marketplace.html', desc: 'Hire, deploy and rate agents' },
      { label: 'NFT Passport', href: 'nft.html', desc: 'Portable reputation and equipment modules' },
      { label: 'Tokenized Stocks', href: 'stocks.html', desc: 'RWA equities settled onchain' },
      { label: 'Security', href: 'security.html', desc: 'Five-layer policy and simulation stack' }
    ],
    developers: [
      { label: 'Docs', href: 'docs.html', desc: 'Concepts, guides and protocol reference' },
      { label: 'API Reference', href: 'api.html', desc: 'REST and WebSocket endpoints' },
      { label: 'SDK', href: 'sdk.html', desc: 'TypeScript, Python and Rust clients' },
      { label: 'Status', href: 'status.html', desc: 'Live uptime and incident history' }
    ],
    company: [
      { label: 'About', href: 'about.html' },
      { label: 'Careers', href: 'careers.html' },
      { label: 'Blog', href: 'blog.html' },
      { label: 'Brand Kit', href: 'brand.html' }
    ],
    app: [
      { label: 'Launch App', href: 'app.html' },
      { label: 'Protocol Admin', href: 'admin.html' }
    ]
  };
  S.site = SITE;

  var MARK_SEQ = 0;
  function MARKUP(){ var id='sxlg'+(++MARK_SEQ); return MARK.replace(/sxlg0/g,id); }
  var MARK = '<svg viewBox="0 0 200 200" class="sx-logo__mark" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="sxlg0" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#E4FF4D"/><stop offset="0.45" stop-color="#CCFF00"/><stop offset="1" stop-color="#00E5A0"/></linearGradient><linearGradient id="sxlg0b" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#E4FF4D"/><stop offset="1" stop-color="#00E5A0"/></linearGradient></defs>' +
    '<path d="M100 5 L169 55 C177 101 162 137 137 158 L152 186 L119 155 L100 161 L81 155 L48 186 L63 158 C38 137 23 101 31 55 Z" fill="#0A0A0F" stroke="url(#sxlg0)" stroke-width="11" stroke-linejoin="round"/><path d="M56 62 L93 85 L84 94 L52 75 Z" fill="#CCFF00"/><path d="M144 62 L107 85 L116 94 L148 75 Z" fill="#CCFF00"/><path d="M60 83 C72 74 87 79 93 91 C80 98 66 95 60 83 Z" fill="#E4FF4D"/><path d="M140 83 C128 74 113 79 107 91 C120 98 134 95 140 83 Z" fill="#E4FF4D"/><path d="M100 94 L115 111 L100 140 L85 111 Z" fill="url(#sxlg0b)"/>';
  S.mark = MARK;

  /* Brand marks. Official glyphs, drawn as paths so nothing is fetched
     and each inherits currentColor. */
  var BRAND = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="sx-social__i">' +
      '<path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932zM17.61 20.644h2.039L6.486 3.24H4.298z"/></svg>',
    opensea: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="sx-social__i">' +
      '<path fill="currentColor" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zM5.92 12.4l.053-.079 3.085-4.825c.045-.07.15-.63.185.013.515 1.155.96 2.591.752 3.486-.089.368-.333.867-.607 1.327a4.5 4.5 0 0 1-.116.197.19.19 0 0 1-.157.083H6.011a.09.09 0 0 1-.09-.202zm13.909.925a.11.11 0 0 1-.066.101c-.24.103-1.062.478-1.404.953-.872 1.213-1.537 2.948-3.025 2.948H9.122a3.983 3.983 0 0 1-3.983-3.996v-.072a.107.107 0 0 1 .106-.106h3.445c.068 0 .119.064.112.131a1.176 1.176 0 0 0 .123.666c.204.414.627.673 1.084.673h1.705v-1.331H10.03a.09.09 0 0 1-.073-.142l.062-.09c.162-.23.392-.586.621-.991.156-.272.308-.563.429-.855a3.6 3.6 0 0 0 .092-.245c.033-.93.067-.179.091-.266.025-.73.044-.15.064-.222a2.99 2.99 0 0 0 .082-.756c0-.107-.005-.219-.015-.325a4.06 4.06 0 0 0-.036-.35 3.05 3.05 0 0 0-.05-.291 5.9 5.9 0 0 0-.118-.443l-.014-.059a5.75 5.75 0 0 0-.169-.502 8.7 8.7 0 0 0-.15-.351 6.9 6.9 0 0 0-.211-.484 3.6 3.6 0 0 0-.102-.203c-.033-.072-.067-.144-.101-.212a2.9 2.9 0 0 0-.057-.109l-.209-.386a.09.09 0 0 1 .102-.13l1.302.353h.008l.171.048.19.053.069.019V4.797a.674.674 0 0 1 1.148-.479.67.67 0 0 1 .197.479v1.151l.139.039c.11.004.22.009.033.021.34.025.83.064.145.111.049.039.102.087.165.136.125.101.274.231.438.38.044.038.086.077.125.116.211.197.448.427.673.682.064.072.126.146.188.223.062.078.129.155.186.232.076.101.158.205.229.314.033.05.072.103.104.154.091.137.171.28.248.423.032.065.066.137.095.207.087.193.157.39.201.586.013.043.023.089.028.131v.01c.15.058.2.121.25.184.02.203.01.406-.034.61-.18.087-.42.168-.71.255-.3.084-.59.171-.97.254a4.3 4.3 0 0 1-.335.494c-.33.06-.73.123-.112.183-.43.063-.87.122-.126.181-.54.073-.111.15-.169.219-.53.072-.107.144-.165.208-.82.095-.16.185-.242.272-.49.056-.101.114-.156.166-.53.061-.108.115-.158.164-.84.084-.154.149-.212.203l-.137.125a.11.11 0 0 1-.72.028h-1.004v1.363h1.263c.283 0 .551-.1.769-.284.074-.65.399-.347.784-.771a.11.11 0 0 1 .047-.03l3.766-1.089a.107.107 0 0 1 .137.102v.773z"/></svg>',
    discord: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="sx-social__i">' +
      '<path fill="currentColor" d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.94.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.41.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .84.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.955 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z"/></svg>',
    mirror: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="sx-social__i">' +
      '<path fill="currentColor" d="M3.5 10.5a8.5 8.5 0 0 1 17 0V21a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V10.5z"/></svg>'
  };

  function here() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return p.replace(/\.html$/, '') || 'index';
  }

  /* ---------------- social row ---------------- */
  function socialHTML(size) {
    var cls = 'sx-social' + (size === 'sm' ? ' sx-social--sm' : '');
    function live(label, href, key, aria) {
      return '<a class="' + cls + '" href="' + href + '" target="_blank" rel="noopener noreferrer" aria-label="' +
        (aria || label) + '">' + BRAND[key] + '<span>' + label + '</span></a>';
    }
    function soon(label, key) {
      return '<span class="' + cls + ' is-soon" role="link" aria-disabled="true" tabindex="0" title="' + label +
        ' launches soon">' + BRAND[key] + '<span>' + label + '</span><em>soon</em></span>';
    }
    return live('@strixhood', SITE.x, 'x', 'Strix Hood on X') +
      live('OpenSea', SITE.opensea, 'opensea') +
      soon('Discord', 'discord') +
      soon('Mirror', 'mirror');
  }

  /* ---------------- nav ---------------- */
  function menuHTML(title, items) {
    return '<div class="sx-menu">' +
      '<button class="sx-nav__link sx-menu__trigger" type="button" aria-expanded="false" aria-haspopup="true">' + title +
      '<span class="sx-menu__caret" aria-hidden="true"></span></button>' +
      '<div class="sx-menu__panel" role="menu">' +
      items.map(function (i) {
        return '<a role="menuitem" href="' + i.href + '"><span class="sx-glyphbox"><span class="sx-glyph sx-glyph--' +
          (i.href.indexOf('doc') === 0 ? 'ring' : 'diamond') + '"></span></span><span><b>' + i.label + '</b>' +
          (i.desc ? '<em>' + i.desc + '</em>' : '') + '</span></a>';
      }).join('') +
      '</div></div>';
  }

  S.renderNav = function (host) {
    host = host || S.$('#sx-nav-host');
    if (!host) return;
    var cur = here();
    host.innerHTML =
      '<a class="sx-skip" href="#main">Skip to content</a>' +
      '<header class="sx-nav" id="sx-nav">' +
      '<div class="sx-shell sx-nav__in">' +
      '<a class="sx-logo" href="index.html" aria-label="Strix Hood — home">' + MARKUP() +
      '<span>STRIX<span class="sx-logo__thin">HOOD</span></span></a>' +
      '<nav class="sx-nav__links" aria-label="Primary">' +
      menuHTML('Product', SITE.product) +
      menuHTML('Developers', SITE.developers) +
      '<a class="sx-nav__link' + (cur === 'marketplace' ? ' is-active' : '') + '" href="marketplace.html">Marketplace</a>' +
      '<a class="sx-nav__link' + (cur === 'docs' ? ' is-active' : '') + '" href="docs.html">Docs</a>' +
      '</nav>' +
      '<div class="sx-nav__cta">' +
      '<button class="sx-btn sx-btn--ghost sx-btn--sm" type="button" data-wallet data-wallet-idle="Connect Wallet">' +
      '<span class="sx-glyph sx-glyph--dot"></span><span data-wallet-label>Connect Wallet</span></button>' +
      '<a class="sx-btn sx-btn--primary sx-btn--sm" href="app.html">Launch App</a>' +
      '</div>' +
      '<button class="sx-btn sx-btn--ghost sx-btn--icon sx-burger" id="sx-burger" type="button" ' +
      'aria-expanded="false" aria-controls="sx-drawer" aria-label="Open menu">' +
      '<span class="sx-burger__bars"><i></i><i></i><i></i></span></button>' +
      '</div></header>' +

      '<div class="sx-drawer" id="sx-drawer">' +
      '<div class="sx-drawer__top"><a class="sx-logo" href="index.html">' + MARKUP() + '<span>STRIX<span class="sx-logo__thin">HOOD</span></span></a>' +
      '<button class="sx-btn sx-btn--ghost sx-btn--icon" type="button" id="sx-drawer-x" aria-label="Close menu">&times;</button></div>' +
      '<div class="sx-drawer__scroll">' +
      group('Product', SITE.product) + group('Developers', SITE.developers) +
      group('Company', SITE.company) + group('App', SITE.app) +
      '<div class="sx-drawer__social">' + socialHTML() + '</div>' +
      '</div>' +
      '<div class="sx-drawer__foot">' +
      '<button class="sx-btn sx-btn--ghost sx-btn--block" type="button" data-wallet data-wallet-idle="Connect Wallet">' +
      '<span data-wallet-label>Connect Wallet</span></button>' +
      '<a class="sx-btn sx-btn--primary sx-btn--block" href="app.html">Launch App</a>' +
      '</div></div>';

    function group(title, items) {
      return '<div class="sx-drawer__group"><h3>' + title + '</h3>' +
        items.map(function (i) {
          return '<a href="' + i.href + '">' + i.label + '<small>' + (i.desc ? '' : '') + '→</small></a>';
        }).join('') + '</div>';
    }

    // dropdown behaviour
    S.$$('.sx-menu', host).forEach(function (m) {
      var trigger = S.$('.sx-menu__trigger', m);
      var panel = S.$('.sx-menu__panel', m);
      var t;
      function open(v) {
        clearTimeout(t);
        m.classList.toggle('is-open', v);
        trigger.setAttribute('aria-expanded', String(v));
      }
      trigger.addEventListener('click', function (e) { e.stopPropagation(); open(!m.classList.contains('is-open')); });
      m.addEventListener('mouseenter', function () { if (!S.touch) open(true); });
      m.addEventListener('mouseleave', function () { if (!S.touch) { t = setTimeout(function () { open(false); }, 140); } });
      panel.addEventListener('click', function () { open(false); });
      document.addEventListener('click', function () { open(false); });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); open(true); var a = S.$('a', panel); if (a) a.focus(); }
        if (e.key === 'Escape') open(false);
      });
      panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { open(false); trigger.focus(); } });
    });

    var x = S.$('#sx-drawer-x', host);
    if (x) x.addEventListener('click', function () {
      S.$('#sx-drawer').classList.remove('is-open');
      S.$('#sx-burger').setAttribute('aria-expanded', 'false');
      document.body.classList.remove('sx-lock');
    });
  };

  /* ---------------- footer ---------------- */
  S.renderFooter = function (host) {
    host = host || S.$('#sx-footer-host');
    if (!host) return;
    function col(title, items) {
      return '<div><h3>' + title + '</h3><ul>' +
        items.map(function (i) { return '<li><a href="' + i.href + '">' + i.label + '</a></li>'; }).join('') +
        '</ul></div>';
    }
    host.innerHTML =
      '<footer class="sx-footer" id="footer">' +
      '<div class="sx-shell">' +
      '<div class="sx-footer__top">' +
      '<div class="sx-footer__brand">' +
      '<a class="sx-logo" href="index.html">' + MARKUP() + '<span>STRIX<span class="sx-logo__thin">HOOD</span></span></a>' +
      '<p class="sx-body">The commerce layer for autonomous agents. Intent in, settlement out — ' +
      'across crypto, NFTs and tokenized equities, always inside a policy you wrote.</p>' +
      '<div class="sx-footer__social">' + socialHTML() + '</div>' +
      '</div>' +
      '<div class="sx-footer__cols">' +
      col('Product', SITE.product) +
      col('Developers', SITE.developers) +
      col('Company', SITE.company) +
      col('App', SITE.app) +
      '</div></div>' +
      '<div class="sx-footer__bar">' +
      '<span class="sx-mono">© ' + new Date().getFullYear() + ' Strix Hood Labs</span>' +
      '<span class="sx-mono sx-footer__net"><i></i> <span id="sx-foot-block">syncing…</span></span>' +
      '<span class="sx-mono sx-dim">Testnet software. Nothing here is financial advice.</span>' +
      '</div></div></footer>';

    S.on('chain', function (c) {
      var n = S.$('#sx-foot-block');
      if (n && c.block) n.textContent = 'ETH block ' + S.fmt.n(c.block, 0);
    });
  };

  /* ---------------- page chrome (grain, frame, cursor, progress) ---------------- */
  S.renderChrome = function (opts) {
    opts = opts || {};
    var frag = document.createDocumentFragment();
    function add(html) { var d = document.createElement('div'); d.innerHTML = html; while (d.firstChild) frag.appendChild(d.firstChild); }
    add('<div id="sx-progress" aria-hidden="true"></div>');
    add('<div class="sx-grain" aria-hidden="true"></div>');
    if (opts.frame !== false) {
      add('<div class="sx-frame" aria-hidden="true"></div>');
      add('<span class="sx-corner" style="top:8px;left:8px;border-top:1px solid var(--neon);border-left:1px solid var(--neon)"></span>' +
        '<span class="sx-corner" style="top:8px;right:8px;border-top:1px solid var(--neon);border-right:1px solid var(--neon)"></span>' +
        '<span class="sx-corner" style="bottom:8px;left:8px;border-bottom:1px solid var(--neon);border-left:1px solid var(--neon)"></span>' +
        '<span class="sx-corner" style="bottom:8px;right:8px;border-bottom:1px solid var(--neon);border-right:1px solid var(--neon)"></span>');
    }
    add('<div id="sx-cursor" aria-hidden="true"></div>');
    add('<button id="sx-top" type="button" aria-label="Back to top"><span class="sx-glyph sx-glyph--diamond"></span></button>');
    add('<div id="sx-toasts" aria-live="polite"></div>');
    document.body.appendChild(frag);
  };

  /* ---------------- one-call page bootstrap ---------------- */
  S.page = function (opts) {
    opts = opts || {};
    S.renderChrome(opts);
    S.renderNav();
    S.renderFooter();
    S.init({ smooth: opts.smooth });
    if (S.wallet) S.wallet.init();
    if (S.data && opts.data !== false) S.data.start(opts.dataOpts || {});
    if (S.chatbot && opts.chatbot !== false) S.chatbot.mount();
    S.reveal();
  };

})(window);
