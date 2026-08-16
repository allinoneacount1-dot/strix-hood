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
    github: 'https://github.com/allinoneacount1-dot/strix-hood',
    opensea: 'https://opensea.io/',
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

  function here() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return p.replace(/\.html$/, '') || 'index';
  }

  /* ---------------- social row ---------------- */
  function socialHTML(size) {
    var cls = 'sx-social' + (size === 'sm' ? ' sx-social--sm' : '');
    function live(label, href, glyph) {
      return '<a class="' + cls + '" href="' + href + '" target="_blank" rel="noopener noreferrer" aria-label="' + label +
        '"><span class="sx-glyph sx-glyph--' + glyph + '"></span><span>' + label + '</span></a>';
    }
    function soon(label, glyph) {
      return '<span class="' + cls + ' is-soon" role="link" aria-disabled="true" tabindex="0" title="' + label +
        ' launches soon"><span class="sx-glyph sx-glyph--' + glyph + '"></span><span>' + label +
        '</span><em>soon</em></span>';
    }
    return live('X', SITE.x, 'diamond') +
      soon('Discord', 'ring') +
      live('GitHub', SITE.github, 'sq') +
      live('OpenSea', SITE.opensea, 'arc') +
      soon('Mirror', 'dash');
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
