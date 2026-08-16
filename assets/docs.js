/* ============================================================
   STRIX HOOD — Documentation runtime
   Zero dependencies beyond Strix core. No CDN, no highlighter
   library, no build step. Everything below is driven by the
   real DOM of the page it runs on.

     1. tokenizer / highlighter   (json, ts, js, py, rust, bash, http)
     2. code blocks + copy buttons
     3. language tabs (persisted)
     4. sidebar rail built from actual headings
     5. "On this page" outline + IntersectionObserver spy
     6. cross-page search (Cmd/Ctrl+K)
     7. inline copy affordances, mobile drawer, deep links
   ============================================================ */
(function (global) {
  'use strict';

  var S = global.Strix;
  if (!S) { console.error('[strix-docs] strix.js must load first'); return; }

  var D = {};
  S.docs = D;

  var NAV = 68, BAR = 52, LAND = NAV + BAR + 18;
  var esc = S.esc;
  var $ = S.$, $$ = S.$$;
  var page = (location.pathname.split('/').pop() || 'index.html').replace(/^$/, 'index.html');
  D.page = page;

  /* ============================================================
     1. TOKENIZER
     Sticky-regex scanner. Anything a rule does not claim is
     emitted verbatim (escaped), so code can never be mangled or
     reordered — worst case a token is simply left uncoloured.
     ============================================================ */
  var W = '(?![\\w$])';

  var RULES = {
    json: [
      { k: 'com', re: /\/\/[^\n]*/y },
      { k: 'key', re: /"(?:[^"\\]|\\.)*"(?=\s*:)/y },
      { k: 'str', re: /"(?:[^"\\]|\\.)*"/y },
      { k: 'lit', re: /(?:true|false|null)(?![\w$])/y },
      { k: 'num', re: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y },
      { k: 'pun', re: /[{}\[\],:]/y },
      { k: 0, re: /\s+/y },
      { k: 0, re: /[A-Za-z_]\w*/y }
    ],

    ts: [
      { k: 'com', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
      { k: 'str', re: /`(?:[^`\\]|\\[\s\S])*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/y },
      { k: 'kw', re: new RegExp('(?:import|export|from|default|const|let|var|function|async|await|return|if|else|for|of|in|while|do|try|catch|finally|throw|new|class|extends|implements|interface|type|enum|typeof|instanceof|as|satisfies|keyof|readonly|private|public|protected|static|declare|namespace|abstract|void|delete|switch|case|break|continue|yield|this|super|null|undefined|true|false)' + W, 'y') },
      { k: 'type', re: new RegExp('(?:string|number|boolean|bigint|symbol|object|unknown|never|any|Promise|Array|Record|Partial|Pick|Omit|Map|Set|Date|Error|JSON|Math|console|process|Buffer|AbortController|[A-Z][A-Za-z0-9_]*)' + W, 'y') },
      { k: 'fn', re: /[A-Za-z_$][\w$]*(?=\s*\(|<[A-Za-z{[])/y },
      { k: 'num', re: /0[xX][0-9a-fA-F_]+n?(?![\w$])|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?n?(?![\w$])/y },
      { k: 'op', re: /=>|\?\?|\?\.|\.{3}|[+\-*/%=<>!&|^~?]+/y },
      { k: 'pun', re: /[{}()\[\];,.:@]/y },
      { k: 0, re: /\s+/y },
      { k: 0, re: /[A-Za-z_$][\w$]*/y }
    ],

    py: [
      { k: 'com', re: /#[^\n]*/y },
      { k: 'str', re: /[rbfuRBFU]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/y },
      { k: 'var', re: /@[A-Za-z_][\w.]*/y },
      { k: 'kw', re: new RegExp('(?:def|class|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|import|from|as|with|try|except|finally|raise|lambda|yield|async|await|pass|break|continue|global|nonlocal|assert|del|match|case)' + W, 'y') },
      { k: 'type', re: new RegExp('(?:int|str|float|bool|list|dict|tuple|set|bytes|self|cls|Optional|List|Dict|Any|Iterator|AsyncIterator|Decimal|[A-Z][A-Za-z0-9_]*)' + W, 'y') },
      { k: 'fn', re: /[A-Za-z_]\w*(?=\s*\()/y },
      { k: 'num', re: /\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w$])/y },
      { k: 'op', re: /->|[+\-*/%=<>!&|^~]+/y },
      { k: 'pun', re: /[{}()\[\];,.:]/y },
      { k: 0, re: /\s+/y },
      { k: 0, re: /[A-Za-z_]\w*/y }
    ],

    rust: [
      { k: 'com', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
      { k: 'var', re: /#!?\[[^\]]*\]/y },
      { k: 'str', re: /r?#*"(?:[^"\\]|\\[\s\S])*"#*|b?'(?:[^'\\]|\\.)'/y },
      { k: 'type', re: /'[a-z_]\w*(?![\w'])/y },
      { k: 'fn', re: /[a-z_]\w*!(?=\s*[({\[])/y },
      { k: 'kw', re: new RegExp('(?:as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while)' + W, 'y') },
      { k: 'type', re: new RegExp('(?:u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize|f32|f64|bool|char|str|String|Vec|Option|Result|Box|Arc|Rc|HashMap|BTreeMap|Duration|[A-Z][A-Za-z0-9_]*)' + W, 'y') },
      { k: 'fn', re: /[a-z_]\w*(?=\s*\()/y },
      { k: 'num', re: /\d[\d_]*(?:\.\d+)?(?:_?(?:u|i|f)(?:8|16|32|64|128|size))?(?![\w$])/y },
      { k: 'op', re: /->|=>|::|[+\-*/%=<>!&|^~?]+/y },
      { k: 'pun', re: /[{}()\[\];,.:@]/y },
      { k: 0, re: /\s+/y },
      { k: 0, re: /[A-Za-z_]\w*/y }
    ],

    bash: [
      { k: 'com', re: /#[^\n]*/y },
      { k: 'str', re: /"(?:[^"\\]|\\[\s\S])*"|'[^']*'/y },
      { k: 'var', re: /\$\{[^}]*\}|\$[A-Za-z_]\w*/y },
      { k: 'kw', re: new RegExp('(?:npm|pnpm|yarn|bun|pip|pip3|cargo|curl|wget|export|echo|cd|mkdir|git|node|npx|python|python3|bash|sh|sudo|set|source|jq|openssl|wscat|docker)' + W, 'y') },
      { k: 'fn', re: /--?[A-Za-z][\w-]*/y },
      { k: 'num', re: /\d+(?![\w$])/y },
      { k: 'op', re: /\|\||&&|[|&><;]/y },
      { k: 0, re: /\s+/y },
      { k: 0, re: /[A-Za-z_][\w.]*/y }
    ],

    http: [
      { k: 'com', re: /#[^\n]*/y },
      { k: 'kw', re: new RegExp('(?:GET|POST|PATCH|PUT|DELETE|HTTP\\/1\\.1|HTTP\\/2)' + W, 'y') },
      { k: 'key', re: /^[A-Z][A-Za-z-]*(?=:)/my },
      { k: 'str', re: /"(?:[^"\\]|\\.)*"/y },
      { k: 'num', re: /\b\d[\d.]*\b/y },
      { k: 'pun', re: /[{}\[\],:;]/y },
      { k: 0, re: /\s+/y },
      { k: 0, re: /[A-Za-z_][\w.-]*/y }
    ]
  };
  RULES.js = RULES.ts;
  RULES.jsonc = RULES.json;
  RULES.python = RULES.py;
  RULES.shell = RULES.bash;
  RULES.sh = RULES.bash;
  RULES.toml = RULES.bash;

  D.highlight = function (src, lang) {
    var rules = RULES[lang];
    if (!rules) return esc(src);
    var out = '', i = 0, n = src.length, guard = 0;
    while (i < n && guard++ < 400000) {
      var hit = null;
      for (var r = 0; r < rules.length; r++) {
        var rule = rules[r];
        rule.re.lastIndex = i;
        var m = rule.re.exec(src);
        if (m && m.index === i && m[0].length) { hit = { k: rule.k, s: m[0] }; break; }
      }
      if (!hit) { out += esc(src.charAt(i)); i += 1; continue; }
      out += hit.k ? '<span class="t-' + hit.k + '">' + esc(hit.s) + '</span>' : esc(hit.s);
      i += hit.s.length;
    }
    if (i < n) out += esc(src.slice(i));
    return out;
  };

  /* ============================================================
     2. CODE BLOCKS
     ============================================================ */
  var LANG_LABEL = {
    ts: 'TypeScript', js: 'JavaScript', json: 'JSON', jsonc: 'JSON',
    py: 'Python', python: 'Python', rust: 'Rust', bash: 'Bash',
    shell: 'Shell', sh: 'Shell', http: 'HTTP', text: 'Text', toml: 'TOML'
  };

  function copyBtn(getText, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dx-copy';
    b.setAttribute('aria-label', label || 'Copy code to clipboard');
    b.innerHTML = '<i aria-hidden="true"></i><span>Copy</span>';
    b.addEventListener('click', function () {
      S.copy(getText(), label || 'Copied to clipboard');
      b.classList.add('is-done');
      b.querySelector('span').textContent = 'Copied';
      clearTimeout(b.__t);
      b.__t = setTimeout(function () {
        b.classList.remove('is-done');
        b.querySelector('span').textContent = 'Copy';
      }, 1800);
    });
    return b;
  }

  D.enhanceCode = function (root) {
    $$('.dx-code', root || document).forEach(function (box) {
      if (box.__dx) return;
      box.__dx = 1;
      var code = $('code', box);
      if (!code) return;
      var lang = (box.getAttribute('data-lang') || 'text').toLowerCase();
      var raw = code.textContent.replace(/^\n+|\s+$/g, '');
      code.innerHTML = D.highlight(raw, lang);

      var head = document.createElement('div');
      head.className = 'dx-code__head';
      head.innerHTML = '<span class="dx-code__lang">' + esc(LANG_LABEL[lang] || lang) + '</span>' +
        (box.getAttribute('data-title')
          ? '<span class="dx-code__title">' + esc(box.getAttribute('data-title')) + '</span>' : '');
      head.appendChild(copyBtn(function () { return raw; },
        'Copied ' + (LANG_LABEL[lang] || lang) + ' snippet'));
      box.insertBefore(head, box.firstChild);
    });
  };

  /* ============================================================
     3. LANGUAGE TABS
     ============================================================ */
  D.initTabs = function () {
    var groups = $$('[data-tabs]');
    if (!groups.length) return;
    var stored = S.store.get('docs:lang', 'ts');

    function apply(lang) {
      groups.forEach(function (g) {
        var panes = $$('.dx-pane', g);
        var bar = $('.dx-langbar', g);
        if (!panes.length || !bar) return;
        var has = panes.some(function (p) { return p.getAttribute('data-lang') === lang; });
        var use = has ? lang : panes[0].getAttribute('data-lang');
        panes.forEach(function (p) {
          var on = p.getAttribute('data-lang') === use;
          p.hidden = !on;
          p.setAttribute('aria-hidden', String(!on));
        });
        $$('button', bar).forEach(function (b) {
          var on = b.getAttribute('data-lang') === use;
          b.setAttribute('aria-selected', String(on));
          b.setAttribute('tabindex', on ? '0' : '-1');
        });
      });
    }

    groups.forEach(function (g, gi) {
      var panes = $$('.dx-pane', g);
      var bar = document.createElement('div');
      bar.className = 'dx-langbar';
      bar.setAttribute('role', 'tablist');
      bar.setAttribute('aria-label', 'Code language');
      panes.forEach(function (p, i) {
        var lang = p.getAttribute('data-lang');
        var id = 'dxpane-' + gi + '-' + i;
        p.id = id;
        p.setAttribute('role', 'tabpanel');
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('data-lang', lang);
        b.setAttribute('aria-controls', id);
        b.textContent = p.getAttribute('data-label') || LANG_LABEL[lang] || lang;
        b.addEventListener('click', function () { S.store.set('docs:lang', lang); apply(lang); });
        b.addEventListener('keydown', function (e) {
          var list = $$('button', bar), idx = list.indexOf(b);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            var nx = list[(idx + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
            nx.focus(); nx.click();
          }
        });
        bar.appendChild(b);
      });
      g.insertBefore(bar, g.firstChild);
    });

    apply(stored);
  };

  /* ============================================================
     4. SIDEBAR RAIL — built from the page's real headings
     ============================================================ */
  var BOOKS = [
    { href: 'docs.html', label: 'Documentation', tag: 'Guide', glyph: 'ring' },
    { href: 'api.html', label: 'API Reference', tag: 'REST/WS', glyph: 'diamond' },
    { href: 'sdk.html', label: 'SDK Reference', tag: 'TS/PY/RS', glyph: 'sq' }
  ];

  function outline() {
    var secs = $$('.dx-body .dx-sec');
    return secs.map(function (sec) {
      var h2 = $('h2[id]', sec);
      if (!h2) return null;
      return {
        el: h2,
        id: h2.id,
        group: sec.getAttribute('data-group') || 'Reference',
        label: h2.getAttribute('data-nav') || h2.textContent.replace(/#$/, '').trim(),
        kids: $$('h3[id]', sec).map(function (h3) {
          return {
            el: h3,
            id: h3.id,
            label: h3.getAttribute('data-nav') || h3.textContent.replace(/#$/, '').trim(),
            method: h3.getAttribute('data-m') || ''
          };
        })
      };
    }).filter(Boolean);
  }

  function methodClass(m) {
    m = (m || '').toUpperCase();
    if (m === 'GET') return 'get';
    if (m === 'POST') return 'post';
    if (m === 'PATCH' || m === 'PUT') return 'patch';
    if (m === 'DELETE' || m === 'DEL') return 'del';
    return 'ws';
  }

  D.buildRail = function (tree) {
    var rail = $('#dx-rail');
    if (!rail) return;
    var groups = [];
    tree.forEach(function (s) {
      var g = groups.filter(function (x) { return x.name === s.group; })[0];
      if (!g) { g = { name: s.group, items: [] }; groups.push(g); }
      g.items.push(s);
    });

    var html = '<div class="dx-rail__head"><b>Developer docs</b><span>v1.4</span></div>' +
      '<nav class="dx-books" aria-label="Documentation sets">' +
      BOOKS.map(function (b) {
        var cur = b.href === page;
        return '<a class="dx-book" href="' + b.href + '"' + (cur ? ' aria-current="page"' : '') + '>' +
          '<span class="sx-glyph sx-glyph--' + b.glyph + '"></span>' + esc(b.label) +
          '<em>' + esc(b.tag) + '</em></a>';
      }).join('') + '</nav>' +
      '<nav aria-label="Sections on this page">' +
      groups.map(function (g, gi) {
        var open = S.store.get('docs:grp:' + page + ':' + gi, true);
        return '<div class="dx-group" data-open="' + (open ? 'true' : 'false') + '" data-grp="' + gi + '">' +
          '<button class="dx-group__btn" type="button" aria-expanded="' + (open ? 'true' : 'false') + '">' +
          esc(g.name) + '<i aria-hidden="true"></i></button>' +
          '<div class="dx-group__body">' +
          g.items.map(function (s) {
            return '<a class="dx-link" href="#' + s.id + '" data-offset="' + LAND + '" data-sec="' + s.id + '">' +
              esc(s.label) + '</a>' +
              (s.kids.length
                ? '<div class="dx-sub" data-kids="' + s.id + '" hidden>' +
                s.kids.map(function (k) {
                  return '<a class="dx-link" href="#' + k.id + '" data-offset="' + LAND + '" data-sub="' + k.id + '">' +
                    (k.method ? '<span class="dx-link__m dx-m--' + methodClass(k.method) + '">' + esc(k.method) + '</span>' : '') +
                    esc(k.label) + '</a>';
                }).join('') + '</div>'
                : '');
          }).join('') +
          '</div></div>';
      }).join('') + '</nav>' +
      '<div class="dx-rail__foot">' +
      '<a href="api.html">API reference</a>' +
      '<a href="status.html">Protocol status</a>' +
      '<a href="app.html">Open the console</a>' +
      '</div>';

    rail.innerHTML = html;

    $$('.dx-group__btn', rail).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var g = btn.parentNode;
        var open = g.getAttribute('data-open') !== 'true';
        g.setAttribute('data-open', String(open));
        btn.setAttribute('aria-expanded', String(open));
        S.store.set('docs:grp:' + page + ':' + g.getAttribute('data-grp'), open);
      });
    });

    rail.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (a) closeRail();
    });
  };

  /* ============================================================
     5. OUTLINE ("On this page") + SCROLL SPY
     ============================================================ */
  D.buildTOC = function (tree) {
    var toc = $('#dx-toc');
    if (!toc) return;
    toc.innerHTML = '<h2 id="dx-toc-h">On this page</h2>' +
      '<ol aria-labelledby="dx-toc-h">' +
      tree.map(function (s) {
        return '<li data-sec="' + s.id + '">' +
          '<a href="#' + s.id + '" data-offset="' + LAND + '" data-t="' + s.id + '">' + esc(s.label) + '</a>' +
          (s.kids.length
            ? '<div class="dx-toc__kids"><ol>' + s.kids.map(function (k) {
              return '<li><a href="#' + k.id + '" data-offset="' + LAND + '" data-t="' + k.id + '">' +
                esc(k.label) + '</a></li>';
            }).join('') + '</ol></div>'
            : '') +
          '</li>';
      }).join('') +
      '</ol>' +
      '<button class="dx-toc__top" type="button">↑ Back to top</button>';

    var top = $('.dx-toc__top', toc);
    if (top) top.addEventListener('click', function () {
      global.scrollTo({ top: 0, behavior: S.reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', location.pathname);
    });
  };

  D.spy = function (tree) {
    var heads = [];
    tree.forEach(function (s) {
      heads.push({ id: s.id, el: s.el, sec: s.id, label: s.label, top: 0 });
      s.kids.forEach(function (k) { heads.push({ id: k.id, el: k.el, sec: s.id, label: k.label, top: 0 }); });
    });
    if (!heads.length) return;

    var crumb = $('#dx-crumb-sec');
    var lastId = null;

    function measure() {
      var y = global.scrollY || global.pageYOffset || 0;
      heads.forEach(function (h) { h.top = h.el.getBoundingClientRect().top + y; });
    }

    function paint(id) {
      if (id === lastId) return;
      lastId = id;
      var h = heads.filter(function (x) { return x.id === id; })[0];
      var sec = h ? h.sec : id;

      $$('#dx-rail .dx-link').forEach(function (a) {
        var on = a.getAttribute('data-sec') === sec || a.getAttribute('data-sub') === id;
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      $$('#dx-rail .dx-sub').forEach(function (d) { d.hidden = d.getAttribute('data-kids') !== sec; });

      $$('#dx-toc a[data-t]').forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('data-t') === id);
      });
      $$('#dx-toc li[data-sec]').forEach(function (li) {
        li.classList.toggle('is-open', li.getAttribute('data-sec') === sec);
      });

      if (crumb) {
        var s = tree.filter(function (x) { return x.id === sec; })[0];
        crumb.textContent = s ? s.label : '';
      }
    }

    function pick() {
      var y = (global.scrollY || global.pageYOffset || 0) + LAND + 6;
      var id = heads[0].id;
      for (var i = 0; i < heads.length; i++) if (heads[i].top <= y) id = heads[i].id;
      // pinned to the last heading once the page bottom is reached
      if (global.innerHeight + y - LAND - 6 >= document.documentElement.scrollHeight - 4) {
        id = heads[heads.length - 1].id;
      }
      paint(id);
    }

    measure();

    // IntersectionObserver drives the recompute — it fires exactly when a
    // heading crosses the reading band, so there is no polling on idle.
    if (global.IntersectionObserver) {
      var io = new IntersectionObserver(function () { pick(); }, {
        rootMargin: '-' + LAND + 'px 0px -62% 0px',
        threshold: [0, 1]
      });
      heads.forEach(function (h) { io.observe(h.el); });
    }
    // Scroll listener covers long sections where no boundary is crossed.
    var raf = 0;
    global.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; pick(); });
    }, { passive: true });
    global.addEventListener('resize', function () { measure(); pick(); });
    global.addEventListener('load', function () { measure(); pick(); });
    pick();
    D.remeasure = function () { measure(); lastId = null; pick(); };
  };

  /* ============================================================
     6. SEARCH — client side, spans all three documentation pages
     ============================================================ */
  /* --- INDEX:START --- */
  /* Manifest of every heading across docs.html, api.html and sdk.html.
     t = title, k = parent section, s = display snippet, w = keyword blob
     (field names, enums, error codes lifted out of the tables so they are
     searchable). Snippets for the page currently open are refreshed from the
     live DOM at boot — see refreshLocalIndex — so that half is never stale. */
  var INDEX = [
    {p:"docs.html",h:"introduction",l:2,k:"Start here",t:"Introduction",s:"Large models can already decide what to buy. They cannot be trusted with a private key. Strix Hood exists to close that gap: it accepts a declarative intent from an agent, checks it against a signed spending policy, simulates it against live chain state, aucti",w:"auctions execution competing solvers settles writes attestation audited later start"},
    {p:"docs.html",h:"the-problem",l:3,k:"Introduction",t:"The problem",s:"Every practical approach to agent-driven commerce today fails in one of three ways. All three collapse the same distinction: capability (the agent can produce a transaction) versus authority (the transaction is permitted). Strix Hood separates them. The agent ",w:"agent-driven failure mode consequence give hot wallet unbounded prompt injection drains balance recovery recourse human signs latency attention defeats autonomy 20-second second approval loop loses fill custodial api broker counterparty risk proof trust operator ledger nothing verifiable onchain produces intents lives policy cannot edit committed hash enforced account validator module signing time"},
    {p:"docs.html",h:"the-core-promise",l:3,k:"Introduction",t:"The core promise",s:"An agent holding a Strix Hood session key can spend only what the policy allows, only on the actions the policy names, only on the chains the policy lists, and only if the simulated asset diff matches what the intent claimed. Everything else reverts before it ",w:"reaches mempool 0.25 protocol fee settled notional 0.9 p50 inclusion base independent enforcement layers settlement networks start"},
    {p:"docs.html",h:"who-it-is-for",l:3,k:"Introduction",t:"Who it is for",s:"Agent developers shipping an autonomous trader, treasury manager, procurement bot or research agent that needs to move value without a human in the loop for every action. Applications that want to offer \"let the assistant do it\" without becoming a custodian or",w:"building policy engine simulator router themselves solvers market makers competing order flow through routing auction earning share 0.25 fee risk compliance owners need signed replayable record automated transaction permitted start"},
    {p:"docs.html",h:"what-it-is-not",l:3,k:"Introduction",t:"What it is not",s:"Strix Hood is not a wallet, not an LLM, and not a custodian. It never holds user funds outside of the atomic settlement window, it does not generate the agent's reasoning, and it does not decide whether a trade is a good idea. It decides whether a trade is per",w:"permitted executes well read security model explicit list risks remove next quickstart register bind policy submit first intent about ten minutes reference rest websocket api every endpoint parameter error code streaming channel clients sdks typescript python rust identical method surfaces running start"},
    {p:"docs.html",h:"quickstart",l:2,k:"Start here",t:"Quickstart",s:"This walkthrough gets a policy-governed agent from zero to a settled swap on Base Sepolia. It uses test keys throughout; nothing here touches mainnet value.",w:"policy-governed start"},
    {p:"docs.html",h:"qs-install",l:3,k:"Quickstart",t:"1. Install a client",s:"The SDKs are thin, typed wrappers over the REST API. Every method in them maps to exactly one endpoint, so you can drop to raw HTTP at any point without losing behaviour.",w:"npm strixhood sdk pnpm add bun pip requires python 3.10 cargo strix-hood strix hood features rustls stream start"},
    {p:"docs.html",h:"qs-keys",l:3,k:"Quickstart",t:"2. Create an API key",s:"Keys are created in the console under Settings → API keys . Two prefixes exist and they are not interchangeable. Never ship a secret key into an agent runtime An agent that can read its own sk_ key can create a new policy for itself. Keep secret keys on a serv",w:"prefix environment may scopes strx_sk_test_ test testnets server side strx_sk_live_ live mainnets granted strx_pk_live_ browser mobile quotes prices sk_ model cannot reach give pk_ plus scoped session see five enforcement layers export strix_api_key strix strx_sk_test_9f2c41bd7a084e6cb35d 9f2c41bd7a084e6cb35d 0e17 strix_env env testnet start"},
    {p:"docs.html",h:"qs-policy",l:3,k:"Quickstart",t:"3. Write the policy first",s:"Policies are created before agents, not after. An agent without a bound policy can be registered but cannot be issued a session key, so it can never sign anything.",w:"name dca-conservative dca conservative limits per_tx_usd usd 250 daily_usd daily 1000 monthly_usd monthly 20000 max_open_intents max open intents allow chains eip155 8453 42161 actions swap transfer tokens usdc weth cbbtc venues uniswap_v4 uniswap aerodrome curve deny categories leverage gambling unverified_contract unverified contract simulation require_success require success max_price_impact_bps price impact bps 120 min_liquidity_usd min liquidity"},
    {p:"docs.html",h:"qs-agent",l:3,k:"Quickstart",t:"4. Register the agent",s:"Registration mints an Agent NFT Passport and locks a 2,500 $STRX bond. On testnets the bond is waived and the passport is minted on Base Sepolia.",w:"import strix strixhood sdk const apikey process.env.strix_api_key process env api key await strix.agents.create agents create name dca-eth dca eth kind trader policyid pol_01jq8zk3m2x7yb4n6pa0rtvc pol 01jq8zk3m2x7yb4n6pa0rtvc chains eip155 8453 sessionkey ttlseconds 86_400 400 rotate console.log console log agent.id agent.smartaccount smartaccount agent.passport.tokenid tokenid agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh 0x1f3c 9ae2 4182 api_key os.environ environ strix_api_key policy_id policy"},
    {p:"docs.html",h:"qs-intent",l:3,k:"Quickstart",t:"5. Submit the first intent",s:"An intent is a statement of outcome, not a calldata blob. You never encode a router call, choose a pool or set a gas price — the solver auction does that, bounded by your constraints.",w:"curl https api.strixhood.xyz api strixhood xyz intents authorization bearer strix_api_key strix key content-type content type application json idempotency-key idempotency dca-2026-08-16-0900 dca 2026 0900 agent_id agent agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh action swap chain eip155 8453 params sell_token sell token usdc buy_token buy weth sell_amount amount 150.00 150 max_slippage_bps max slippage bps route_preference route preference"},
    {p:"docs.html",h:"qs-watch",l:3,k:"Quickstart",t:"6. Follow it to settlement",s:"Poll GET /v1/intents/{id} if you must, but the stream is authoritative and costs no rate-limit budget. Both surfaces emit the same status values. What just happened The intent was normalised, checked against policy version 1, simulated on a fork of the pending",w:"watch rate-limit const strix.stream.executions strix executions agentid agent.id agent await evt console.log console log evt.status evt.txhash txhash settled filled evt.fills fills buyamount weth attestation evt.attestation.uid uid break base block auctioned solvers signed session key whose validator contains hash included attested full sequence documented architecture vocabulary start"},
    {p:"docs.html",h:"concepts",l:2,k:"Protocol",t:"Core concepts",s:"Seven objects carry the whole protocol. Everything else in this documentation is a detail of how they interact.",w:""},
    {p:"docs.html",h:"intents-concept",l:3,k:"Core concepts",t:"Intents",s:"An intent is a signed, expiring statement of a desired outcome — \"end up holding at least 0.041 WETH, spending at most 150 USDC, on Base, within 90 seconds\" . It contains no calldata, no route and no gas parameters. That deliberate omission is what makes inten",w:"concept 0.041 safe hand language model worst adversarial prompt produce request policy engine rejects immutable once accepted changing terms means cancelling submitting every carries idempotency_key idempotency key replaying inside hours original rather creating second protocol"},
    {p:"docs.html",h:"agents-concept",l:3,k:"Core concepts",t:"Agents",s:"An agent is the protocol-side identity of an autonomous actor. It owns an ERC-4337 smart account, one bound policy, zero or more session keys, a reputation score, and a $STRX bond that can be slashed. An agent is not a wallet: the smart account is controlled b",w:"concept protocol-side erc-4337 owner root key ever holds scoped expiry kind typical actions default trader swap transfer equity_order equity order 500 collector nft_bid nft bid nft_buy buy treasury subscribe 000 service agent_hire hire verified plus marketplace listing"},
    {p:"docs.html",h:"agent-passport",l:3,k:"Core concepts",t:"The Agent NFT Passport",s:"Registration mints an ERC-721 passport to the agent's owner. The passport is the portable record of what an agent is allowed to be, and it is the only object in the protocol that survives a full redeploy of the agent runtime. Identity — tokenId is the canonica",w:"erc-721 canonical reference onchain agent_id offchain mirror dynamic metadata level lifetime settled notional success rate capability traits re-rendered rendered every 000 settlements demand permission records modules equipped execution data payment intelligence security equipping module raises specific policy ceilings never lowers floor revenue rights service agents marketplace fees settle holder selling transfers income"},
    {p:"docs.html",h:"policy-concept",l:3,k:"Core concepts",t:"The policy engine",s:"A policy is a versioned document of limits, allow lists, deny lists, simulation thresholds and human-in-the-loop rules. It is evaluated offchain for speed and committed onchain as a bytes32 hash for enforcement. The two must agree: the session key validator re",w:"concept human-in-the-loop recomputes nothing refuses validate user operation whose attached policyregistry currently holds agent full schema protocol"},
    {p:"docs.html",h:"solvers-concept",l:3,k:"Core concepts",t:"Solvers and routing",s:"Solvers are independent parties that compete to fill intents. When an intent clears policy and simulation, the router broadcasts a sealed request for quotes; solvers respond with a committed execution path and an output guarantee. The best quote by the intent'",w:"concept route_preference route preference wins winner bound under-delivering delivering slashes solver bond refunds difference agent objective typical best_price price maximise after fees gas default rebalancing dca fastest minimise time inclusion liquidations nft snipes lowest_gas lowest paid batched maintenance work private orderflow public mempool size would sandwiched protocol"},
    {p:"docs.html",h:"settlement-concept",l:3,k:"Core concepts",t:"Settlement",s:"Settlement is atomic per intent. The winning solver's path is executed through SettlementVault , which enforces the output guarantee in the same transaction: if the agent would receive less than the quoted minimum, the whole call reverts. Protocol fees are tak",w:"concept taken leg 0.25 split cross-chain cross chain intents settle locally legs bonded relayer never optimistic promise"},
    {p:"docs.html",h:"reputation-concept",l:3,k:"Core concepts",t:"Reputation and slashing",s:"Every settled intent updates two scores. Agent reputation is a decayed ratio of settled to submitted intents weighted by notional, and gates marketplace visibility. Solver reliability is the ratio of honoured to won quotes, and gates auction participation. Bot",w:"concept recomputed onchain epoch 200 blocks ethereum daily elsewhere conditions amounts listed runs protocol"},
    {p:"docs.html",h:"architecture",l:2,k:"Protocol",t:"Architecture",s:"One intent travels through eight stages. Four of them can terminate it. The diagram below is the authoritative flow; the table under it names the component that owns each stage and what it is allowed to do. Human approval gate status: awaiting_approval 01 Rece",w:"awaiting_approval received rest sdk parsed normalise resolve policy check hash-bound hash bound rules simulation fork asset diff rejected 422 reason recorded routing sealed solver auction execution session key erc-4337 erc 4337 settlement atomic fee split attestation eas receipt webhook happy path terminal rejection escalation p50 0.9 base websocket symbols above policy.hitl.threshold_usd hitl threshold usd"},
    {p:"docs.html",h:"stage-reference",l:3,k:"Architecture",t:"Stage reference",s:"Latencies are p50 measured over the last 30 days on Base and exclude block time. The end-to-end budget from received to a broadcast user operation is 440 ms; anything slower than 1,200 ms trips an internal alert and the intent is re-quoted rather than executed",w:"owner does terminate api gateway authenticates key enforces rate limits deduplicates idempotency-key idempotency assigns ulid parsed compiler resolves token symbols canonical addresses chain normalises decimals expands defaults validates schema yes invalid_request_error invalid request error policy check engine loads bound committed hash evaluates lists rolling windows escalates human gate above hitl.threshold_usd hitl threshold usd"},
    {p:"docs.html",h:"failure-modes",l:3,k:"Architecture",t:"Failure modes",s:"Solver wins then under-delivers Adverse move between quote and inclusion Settlement reverts. Solver forfeits 25% of bond, agent is refunded gas, intent is re-quoted once. No solver responds Illiquid pair or all solvers rate-limited Falls back to the direct can",w:"symptom cause protocol behaviour under-delivers re-quoted rate-limited canonical route inside slippage bound marked route_fallback fallback simulation execution disagree state changed fork onchain minimum-output minimum output check whole call moves failed funds never leave human gate times approval timeout_sec timeout sec on_timeout decides reject default hold until explicit action chain reorg after deeper"},
    {p:"docs.html",h:"intents",l:2,k:"Protocol",t:"Intent specification",s:"The intent object is the single input surface of the protocol. It is stable across REST, WebSocket and all three SDKs; the SDKs only change the casing convention.",w:"intents"},
    {p:"docs.html",h:"intent-object",l:3,k:"Intent specification",t:"The intent object",s:"id string read only ULID with an int_ prefix. Monotonic, so it doubles as a pagination cursor. object string read only Always \"intent\" . agent_id string required The agent that will execute. Must be active and hold a live session key for chain . action enum re",w:"top-level top level fields field type description int_ agent_id seven values types determines shape params caip-2 caip identifier example eip155 8453 solana 5eykt4us appear policy.allow.chains policy allow chains action-specific specific payload unknown keys rejected rather ignored constraints optional execution bounds defaults come never market policy_id overrides bound override stricter every axis request"},
    {p:"docs.html",h:"action-types",l:3,k:"Intent specification",t:"Action types",s:"swap sell_token, buy_token, sell_amount | buy_amount recipient, pools Exactly one of sell_amount / buy_amount . The other becomes the guaranteed side. transfer token, amount, to memo to must clear allow.contracts or be an EOA on the agent's address book. nft_b",w:"required params optional notes sell_token buy_token sell_amount buy_amount allow.contracts nft_bid bid collection max_price max price currency token_id traits marketplaces expiry trait bids matched continuously until expires_at expires fill unless partial_fill partial nft_buy immediate purchase below aggregated across listed equity_order equity order symbol quantity notional order_type type limit_price limit time_in_force time force venue"},
    {p:"docs.html",h:"intent-examples",l:3,k:"Intent specification",t:"Examples",s:"Swap A market swap with a hard 40 bps slippage bound and private routing. The sell_amount is exact; buy_amount is guaranteed at a minimum by the settlement contract. NFT trait bid A standing bid across two marketplaces for any token in the collection matching ",w:"sell_amount buy_amount agent_id agent agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh action chain eip155 8453 params sell_token 0x833589fcd6edb6e08f4c7c32d4 f71b54bda02913 buy_token 0x42000000000000000000000000 00000000000006 1500.000000 1500 000000 constraints max_slippage_bps max max_fee_usd fee usd 6.00 route_preference route preference mev_protection mev protection idempotency_key idempotency key rebalance-2026-08-16t09 rebalance 2026 16t09 00z metadata strategy weekly-rebalance weekly leg traits live seven days denominated"},
    {p:"docs.html",h:"intent-status",l:3,k:"Intent specification",t:"Status values",s:"received No Accepted by the gateway, not yet compiled. policy_check No Being evaluated against the bound policy. awaiting_approval No Escalated to a human. Clock is hitl.timeout_sec . simulating No Fork execution and asset-diff analysis in progress. routing No",w:"terminal meaning policy_check awaiting_approval hitl.timeout_sec asset-diff solver auction open waiting valid_after valid after venue session submitted user operation broadcast tx_hash hash populated settled yes included attested fills final rejected failed rejection.rule rejection rule names exact clause reverted onchain defaulted value moved expired passed expires_at expires without fill cancelled owner before authority protocol"},
    {p:"docs.html",h:"policy",l:2,k:"Protocol",t:"Policy engine",s:"A policy is the only thing standing between an agent and your balance. It is written by a human, versioned, hashed, committed onchain, and enforced twice — once offchain for a fast rejection, once onchain because offchain checks can be bypassed.",w:"protocol"},
    {p:"docs.html",h:"policy-object",l:3,k:"Policy engine",t:"The policy object",s:"id string read only ULID with a pol_ prefix. name string required 1–64 chars, unique per account. Used in approval prompts, so make it readable by a human at 3 a.m. version integer read only Increments on every update. Old versions stay readable for audit. has",w:"field type description pol_ a.m hash bytes32 keccak256 canonicalised document see limits spending ceilings least per_tx_usd usd must allow positive lists empty list means nothing never everything deny optional negative evaluated after always wins simulation thresholds applied simulated asset diff hitl human-in-the-loop loop escalation absent escalate expires_at expires timestamp recommended intent rejected"},
    {p:"docs.html",h:"policy-limits",l:3,k:"Policy engine",t:"Spending limits",s:"All limits are denominated in USD and evaluated against the notional of the intent at the price observed during simulation, not at submission. Rolling windows are true sliding windows, computed over settled and in-flight intents so two concurrent requests cann",w:"in-flight cannot slip cap field type window description per_tx_usd number maximum single required daily_usd daily sum plus weekly_usd weekly applied after monthly_usd monthly max_open_intents max open integer instant concurrency ceiling prevents runaway loop queueing thousand orders max_position_pct position pct asset percentage agent portfolio trade gas_budget_daily_usd gas budget separate stops gas-griefing griefing loops"},
    {p:"docs.html",h:"policy-lists",l:3,k:"Policy engine",t:"Allow and deny lists",s:"Evaluation is strict: an intent must match every relevant allow dimension and no deny entry. Omitting a dimension from allow denies it entirely. There is no wildcard for contracts .",w:"chains eip155 8453 42161 actions swap transfer equity_order equity order tokens usdc weth cbbtc aaplx collections 0x2626664c2603336e57b271c5c0 b26f421741e481 venues uniswap_v4 uniswap aerodrome backed_rwa backed rwa categories spot rwa_equity _leveraged leveraged _3l _3s 0x00000000000000000000000000 00000000000000 gambling leverage unverified_contract unverified contract sanctioned built-in built category matches target verified source canonical explorer proxy implementation changed"},
    {p:"docs.html",h:"policy-hitl",l:3,k:"Policy engine",t:"Human-in-the-loop",s:"The human gate is a policy outcome, not a separate product. Above the threshold the intent moves to awaiting_approval , an approval.requested webhook fires with the full simulated asset diff, and the clock starts. threshold_usd — escalate any intent whose noti",w:"hitl awaiting_approval approval.requested threshold_usd 500 actions transfer nft_buy nft buy always_for_new_counterparty always counterparty channels push timeout_sec timeout sec 300 on_timeout reject approvers usr_01jq8zs2m4n6p8r0t2v4x6z8 usr 01jq8zs2m4n6p8r0t2v4x6z8 quorum notional exceeds union rule first interaction address agent never settled before regardless size fails safe default hold keeps pending until explicit decision cost stale price number"},
    {p:"docs.html",h:"policy-hash",l:3,k:"Policy engine",t:"Policy hash and onchain commitment",s:"The hash is what makes the policy enforceable rather than advisory. It is computed as follows, and the algorithm is fixed for the lifetime of an API version. Drop every server-assigned field: id , version , hash , commitment , created_at , updated_at . Canonic",w:"server-assigned created_at updated_at canonicalise remainder rfc 8785 json canonicalisation scheme keys sorted utf-16 utf code unit insignificant whitespace numbers shortest round-trip round trip form prefix domain separator strixhood.policy.v1 strixhood utf-8 bytes take keccak256 concatenation 32-byte byte digest policy.hash call policyregistry.commit policyregistry commit agentid policyhash registry stores live agent emits policycommitted import canonicalize"},
    {p:"docs.html",h:"policy-order",l:3,k:"Policy engine",t:"Evaluation order",s:"Order matters because the first failure short-circuits and is reported as rejection.rule . Knowing the order tells you which rule to loosen. 07 — Trust",w:"short-circuits rejection.rule check code live expired hash matches registry policy_stale stale chain allow.chains allow chains chain_not_allowed allowed action allow.actions actions action_not_allowed every token collection contract venue params allow-listed listed asset_not_allowed asset nothing deny denied per_tx_usd usd limit_exceeded limit exceeded sliding windows daily weekly monthly max_open_intents max open intents max_position_pct position pct gas"},
    {p:"docs.html",h:"security",l:2,k:"Protocol",t:"Security model",s:"This section is written to be argued with. It states what the protocol enforces, what it assumes, and what it cannot do. If a claim here is not testable against the contracts, it should not be here.",w:""},
    {p:"docs.html",h:"security-layers",l:3,k:"Security model",t:"The five layers",s:"Each layer is independent. Removing any one of them still leaves the others enforcing; none of them depends on another being honest.",w:"mechanism stops enforced account abstraction erc-4337 erc 4337 v0.7 smart session keys carry permission blob selector allowlist value ceiling chain expiry policy hash key exfiltration turning unlimited spend escaped expires cannot call unlisted selectors onchain validator module spending versioned document keccak256-committed keccak256 committed policyregistry evaluated offchain bound scope creep agent widen authority"},
    {p:"docs.html",h:"threat-model",l:3,k:"Security model",t:"Threat model",s:"Assumed adversaries, and what the protocol does about each. Prompt injection into the agent Full control of the intents the agent emits Intents carry no calldata; policy bounds every dimension; simulation checks the diff. Attacker can burn the agent's allowed ",w:"adversary capability mitigation residual risk budget permitted actions example swapping usdc weth repeatedly within limits compromised host reads session key memory scoped expiring policy-bound bound rotation automatic owner revoke transaction value remaining window until revocation lands malicious counterparty contract arbitrary code target address layer asset-diff asset must match intent unverified fresh contracts"},
    {p:"docs.html",h:"not-protected",l:3,k:"Security model",t:"What this does not protect against",s:"Read this list before you fund an agent Strix Hood bounds the blast radius of an autonomous actor. It does not make that actor correct, and it removes none of the following risks. Your root key. If the owner key controlling the smart account is compromised, th",w:"protected attacker rewrites policy every layer above void bad strategy policy-compliant compliant trade still lose money protocol opinion whether permitted action good market liquidity risk slippage guarantee execution price fair thin markets stay third-party third party failure allowlist lending exploited funds sent gone allowlisting explicit trust decision oracle price-feed feed notional limits"},
    {p:"docs.html",h:"disclosure",l:3,k:"Security model",t:"Audits and disclosure",s:"No audit has been completed. No firm is engaged, no report exists, and every contract currently running on a testnet is unaudited. The table below is the scope we intend to put in front of an external firm.",w:"component scope status core contracts router vault registry settlement path minimum-output enforcement fee split scheduled session-key validator module erc-4337 capability selector expiry revocation solver auction bonding sealed-bid slashing challenge window not started rwa token allow-list permissioned transfer hooks indexer api unaudited no funded bug bounty security@strixhood.xyz well-known security.txt on-fix disclosure 90 days protocol"},
    {p:"docs.html",h:"tokenomics",l:2,k:"Economics & networks",t:"Tokenomics",s:"$STRX exists to make agent identity expensive to fake and dishonest execution expensive to attempt. It is a work token and a bond, not a payment rail — commerce settles in USDC, WETH and the assets being traded.",w:"economics networks not deployed no tge no market no sale designed parameters testnet faucet token scam"},
    {p:"docs.html",h:"supply",l:3,k:"Tokenomics",t:"Supply and distribution",s:"$STRX does not exist yet — no token is deployed, there has been no TGE, there is no market and there is no sale. 1,000,000,000 Total supply, fixed · Base Canonical chain · 18 Decimals · TGE unscheduled",w:"allocation unlock schedule share strx controlled 400 48-month month linear emission stakers solvers grant recipients emissions contract 200 12-month cliff 36-month vesting escrow 150 unlocked governance-gated governance gated spend requires passed proposal 48-hour hour timelock initial depth remainder released against targets months multisig 100 6-month 24-month community ecosystem team advisors treasury liquidity early contributors economics networks"},
    {p:"docs.html",h:"protocol-fee",l:3,k:"Tokenomics",t:"Protocol fee",s:"Every settled intent pays 0.25% of settled notional , taken from the output leg inside the settlement transaction. There is no fee on rejected, failed or expired intents, and no fee on simulate_only calls. Subscription tiers in Rate limits & pricing are separa",w:"0.25 simulate_only separate buy throughput lower fees destination share mechanism treasury accrues asset swept usdc weekly spend governance-gated governance gated stakers streamed pro-rata pro rata staked strx claimable continuously epoch lock buyback burn executed twap hours keeper burned dead onchain receipt 500.00 500 3.75 weth 1.50 1.125 125 emitted solver quoted 0.90"},
    {p:"docs.html",h:"staking-bonds",l:3,k:"Tokenomics",t:"Staking and registration bonds",s:"Two distinct locks use the same token and must not be confused. Solvers post a separate bond sized to their maximum in-flight quote exposure, with a floor of 50,000 $STRX. A solver whose bond falls below its exposure is excluded from the auction until it tops ",w:"fee stake purpose sybil resistance slashable collateral agent claim protocol fees minimum 500 locked against passport tokenid staker address yes see unbonding days after retired yield none share streamed in-flight economics networks"},
    {p:"docs.html",h:"slashing",l:3,k:"Tokenomics",t:"Slashing conditions",s:"Slashing is executed by the StakingBond contract. Everything except the deterministic onchain cases passes through a 7-day challenge window in which the accused can post evidence; an unchallenged claim executes automatically, a challenged one goes to governanc",w:"condition penalty detection destination slashed bond forged policy commitment submitting user operation whose hash does match registry 100 treasury reputation fraud wash volume self-dealing self dealing between agents owner inflate score graph analysis period days challenger burned solver default winning quote settling below guaranteed output settlement revert refund affected agent remainder stakers"},
    {p:"docs.html",h:"networks",l:2,k:"Economics & networks",t:"Networks & contracts",s:"Nothing is deployed to mainnet. Registry and settlement contracts run on three EVM testnets; four more networks are queued behind them. Solana runs a separate program set.",w:"economics create2 testnet queued deployment status"},
    {p:"docs.html",h:"supported-chains",l:3,k:"Networks & contracts",t:"Deployment status",s:"The target set is seven networks. Where a contract exists today it exists on a testnet, and it is redeployed without notice. Treat every row as the current state, not a roadmap.",w:"network target chain caip-2 caip finality status explorer ethereum sepolia base 8453 arbitrum 42161 op mainnet polygon amoy 137 bnb testnet solana devnet testnet queued strx_sk_test_ strx_sk_live_ rejected economics"},
    {p:"docs.html",h:"contract-addresses",l:3,k:"Networks & contracts",t:"Contract addresses",s:"There are none to publish. No Strix Hood contract is deployed to any mainnet, there is no $STRX token contract, and the testnet deployments are not stable enough to pin.",w:"deployments.json evm create2 not deployed testnet only intentrouter accepts routed intents opens solver auction forwards winner policyregistry live policy hash agent source truth validator module agentpassport erc-721 erc 721 identity dynamic metadata capability traits revenue rights settlementvault enforces minimum output takes splits solverregistry stakingbond strx token solana program set scam"},
    {p:"docs.html",h:"limits",l:2,k:"Economics & networks",t:"Rate limits & pricing",s:"Subscription tiers buy throughput and support. They do not change the 0.25% protocol fee, and they do not change what a policy allows. Nothing is billable today — testnet runs on the Sandbox tier and it is free.",w:"0.25 economics networks free tba"},
    {p:"docs.html",h:"tiers",l:3,k:"Rate limits & pricing",t:"Tiers",s:"The limits are real and enforced now; the prices are not set. Paid tiers are priced at mainnet, and no card is taken before then.",w:"tier price tba min concurrent connections webhooks networks support sandbox free 000 testnets community builder 600 email business days growth 200 500 99.9 sla scale 100 priority solver lane shared channel 99.95 enterprise negotiated unmetered private pool named engineer 99.99 overage economics"},
    {p:"docs.html",h:"limit-headers",l:3,k:"Rate limits & pricing",t:"Rate-limit headers",s:"Every response carries the current window state. Read them; do not guess.",w:"http 1.1 200 x-ratelimit-limit ratelimit 600 x-ratelimit-remaining remaining 574 x-ratelimit-reset reset 1786953600 x-request-id request req_01jq8zt6p0q2s4u6w8y0a2c4 req 01jq8zt6p0q2s4u6w8y0a2c4 strix-api-version strix api version 2026-07-01 2026 header meaning requests permitted 60-second second left treat stop try harder unix seconds resets retry-after retry after 429 wait authoritative ignore backoff shorter include support resolves full trace economics"},
    {p:"docs.html",h:"backoff",l:3,k:"Rate limits & pricing",t:"Bursts and backoff",s:"The limiter is a token bucket refilled continuously at limit / 60 per second with a burst capacity of limit / 4 . Short spikes pass; sustained overload does not. On 429 , back off with full jitter and honour Retry-After . Streams are free WebSocket frames do n",w:"retry-after async function withretry promise tries let attempt try await catch err unknown const status number retryafter retryable e.status 500 throw ceiling e.retryafter 1000 math.min math min 250 8_000 000 settimeout math.random random consume request budget polling intents loop replace channel stops being problem questions economics networks"},
    {p:"docs.html",h:"faq",l:2,k:"Support",t:"FAQ",s:"Does Strix Hood ever hold my funds? No, outside the settlement transaction itself. Assets live in your ERC-4337 smart account, which you control with your root key. SettlementVault touches them only inside the atomic call that fills your intent; if that call d",w:"erc-4337 satisfy minimum output reverts nothing moved happens lose session catastrophic scoped expiring policy-bound policy bound revoke delete agents session-keys keys keyid submits onchain revocation until lands still spend remaining window limits argument short ttls agent change gave runtime policies write intended split server holds secret writes publishable plus intents stuck routing"},
    {p:"docs.html",h:"glossary",l:2,k:"Support",t:"Glossary",s:"Agent Protocol-side identity of an autonomous actor: a smart account, one bound policy, session keys, a reputation score and a slashable bond. Asset diff The signed before/after balance delta produced by simulation. The intent is only signed if the diff matche",w:"protocol-side matches claimed attestation eas record binding hash digest solver receipt audit artefact strx locked against passport exposure conditions slashing caip-2 caip chain-agnostic chain agnostic identifier standard e.g eip155 8453 everywhere named execution object created enters routing holds quotes fills transaction hashes fill settled portion without partial_fill partial exactly hitl human loop"},
    {p:"api.html",h:"overview",l:2,k:"Getting started",t:"Overview",s:"Every endpoint is served over TLS 1.3 from https://api.strixhood.xyz . HTTP is refused, not redirected. Request and response bodies are UTF-8 application/json unless an endpoint says otherwise.",w:"1.3 api.strixhood.xyz utf-8 getting started"},
    {p:"api.html",h:"versioning",l:3,k:"Overview",t:"Versioning",s:"The path carries the major version ( /v1 ); the Strix-Api-Version header carries the dated minor version. Omitting the header pins you to the version that was current when your API key was created, so existing integrations do not move under you.",w:"strix-api-version curl https api.strixhood.xyz strixhood xyz agents authorization bearer strix_api_key 2026-07-01 2026 released breaking changes intent.estimated intent estimated replaces intent.preview preview equity_order equity order requires venue 2026-03-14 cursor pagination offset every list endpoint 2025-11-20 2025 initial public getting started"},
    {p:"api.html",h:"environments",l:3,k:"Overview",t:"Environments",s:"A test key against a live chain returns 403 environment_mismatch , and the reverse is also true. There is no flag that lets one key straddle both. Access",w:"prefix chains notes strx_sk_test_ base sepolia arbitrum solana devnet strx bond faucet available schemas strx_sk_live_ seven production networks real value bonds fees apply environment_mismatch getting started"},
    {p:"api.html",h:"authentication",l:2,k:"Getting started",t:"Authentication",s:"Bearer tokens on every request. There are no cookies, no sessions and no request signing for REST — signing happens onchain with session keys, not at the API boundary.",w:"getting started"},
    {p:"api.html",h:"auth-header",l:3,k:"Authentication",t:"Bearer authentication",s:"A missing or malformed header returns 401 authentication_error . A well-formed key that lacks the required scope returns 403 permission_error and names the scope it wanted.",w:"auth authorization strx_sk_live_9f2c41bd7a084e6cb35d live 9f2c41bd7a084e6cb35d 0e17 content-type content type application json strix-api-version strix api version 2026-07-01 2026 idempotency-key idempotency 6f1c0d9a-8b52-4a1e-9f77-2c3d 6f1c0d9a 8b52 4a1e 9f77 2c3d 4e5f6a7b authentication_error well-formed permission_error getting started"},
    {p:"api.html",h:"auth-scopes",l:3,k:"Authentication",t:"Scopes",s:"Scopes are assigned at key creation and cannot be widened afterwards — create a new key instead. Every endpoint on this page states the scope it requires. Scope your keys per process, not per team The blast radius of a leaked key is exactly its scope set. One ",w:"auth grants safe agent runtime agents read session-key session metadata reputation yes write update retire issue revoke intents executions submit cancel approve tightly scoped policy policies commitments never authority portfolio balances history transactions webhooks manage webhook endpoints quotes prices pk_ everything compromise away rewritten getting started"},
    {p:"api.html",h:"auth-rotation",l:3,k:"Authentication",t:"Rotation and revocation",s:"Keys support overlapping rotation: create the replacement, deploy it, then revoke the old key. Revocation is immediate and global — there is no propagation window. Keys unused for 90 consecutive days are automatically disabled and must be re-enabled from the c",w:"auth re-enabled console curl delete https api.strixhood.xyz api strixhood xyz api-keys key_01jq8zv9r2t4w6y8a0c2e4g6 01jq8zv9r2t4w6y8a0c2e4g6 authorization bearer strix_admin_key strix admin getting started"},
    {p:"api.html",h:"auth-ip",l:3,k:"Authentication",t:"IP allowlists",s:"Secret keys accept an optional CIDR allowlist. Requests from outside it return 403 ip_not_allowed and are logged with the source address. Publishable pk_ keys cannot be IP-restricted, because they are meant to be public. Shape",w:"auth ip_not_allowed pk_ ip-restricted getting started"},
    {p:"api.html",h:"conventions",l:2,k:"Conventions",t:"Conventions",s:"These rules hold for every endpoint. They are stated once here and not repeated per resource.",w:""},
    {p:"api.html",h:"conv-idempotency",l:3,k:"Conventions",t:"Idempotency",s:"Every POST accepts an Idempotency-Key header. Replaying a key inside 24 hours returns the original response — same status, same body, plus Idempotency-Replayed: true . Replaying a key with a different body returns 409 idempotency_conflict ; the protocol will n",w:"conv idempotency-key idempotency-replayed idempotency_conflict guess meant situation result 200 202 object request still flight idempotency_in_progress progress retry after retry-after older treated"},
    {p:"api.html",h:"conv-pagination",l:3,k:"Conventions",t:"Pagination",s:"All list endpoints are cursor-paginated. Because object IDs are ULIDs they sort by creation time, so the cursor is just an ID. total_estimated is exactly that — an estimate from the index, cheap to compute and never used for correctness. Loop on has_more , not",w:"conv cursor-paginated parameter type default description limit integer 100 starting_after starting after string objects created forward ending_before ending before backward order enum desc asc created_at data int_01jq8zp1v6c3md8r0yf2wkgs int 01jq8zp1v6c3md8r0yf2wkgs intent has_more next_cursor next total_estimated 1284 count"},
    {p:"api.html",h:"conv-types",l:3,k:"Conventions",t:"Timestamps, amounts and identifiers",s:"Timestamps are RFC 3339 UTC strings with millisecond precision: 2026-08-16T09:00:00.412Z . Never Unix epochs, never local time. Token amounts are decimal strings in human units, not integers in base units: \"1500.000000\" USDC, not 1500000000 . This avoids float",w:"conv types 2026-08-16t09 00.412z 1500.000000 truncation javascript ambiguity about decimals usd values json numbers places always estimates unless field name ends _settled settled basis points means 0.50 prefix_ulid prefix ulid agt_ agt int_ int exe_ exe pol_ pol qte_ qte whk_ whk evt_ evt key_ key 26-character character crockford base32 lexicographically sortable"},
    {p:"api.html",h:"conv-expand",l:3,k:"Conventions",t:"Expanding objects",s:"Related objects are returned as IDs by default. Request them inline with expand[] , up to three levels deep and four expansions per request.",w:"conv curl https api.strixhood.xyz api strixhood xyz intents int_01jq8zp1v6c3md8r0yf2wkgs int 01jq8zp1v6c3md8r0yf2wkgs authorization bearer strix_api_key strix key data-urlencode data urlencode execution execution.attestation attestation agent.policy agent policy"},
    {p:"api.html",h:"conv-requestid",l:3,k:"Conventions",t:"Request IDs",s:"Every response carries X-Request-Id . It is the only thing support needs to find the full trace, including the policy evaluation and the simulation transcript. Log it. Failure",w:"conv requestid x-request-id"},
    {p:"api.html",h:"errors",l:2,k:"Conventions",t:"Errors",s:"One envelope, always. If a response has a status of 400 or above, this is its shape — there are no special cases.",w:"conventions"},
    {p:"api.html",h:"error-envelope",l:3,k:"Errors",t:"The error envelope",s:"type enum Coarse family. Branch on this. code string Specific, stable machine code. Never reworded within a version. message string Human sentence with concrete numbers. Safe to log, not safe to parse. param string | null Dotted path to the offending request f",w:"policy_error policy limit_exceeded limit exceeded intent notional 780.00 780 usd exceeds per_tx_usd 250.00 250 params.sell_amount params sell amount rule limits.per_tx_usd limits stage policy_check check doc_url doc url https strixhood.xyz strixhood xyz docs.html docs html policy-limits request_id req_01jq8zw4t6v8x0z2b4d6f8h0 req 01jq8zw4t6v8x0z2b4d6f8h0 field description clause refused lifecycle produced failure mirrors x-request-id conventions"},
    {p:"api.html",h:"error-status",l:3,k:"Errors",t:"HTTP status codes",s:"200 OK. — 201 Created. Location points at the object. — 202 Accepted. The intent is queued; watch the stream. — 204 No content. Successful delete. — 400 Malformed JSON or unknown field. No — fix the request 401 Missing, malformed or revoked key. No 403 Key val",w:"error meaning retry valid action permitted 404 visible 409 idempotency conflict state 422 well-formed well formed refused policy simulation business rule 429 rate limited honour retry-after after yes backoff 500 unhandled side already alerting 503 dependency degraded chain bundler relay conventions"},
    {p:"api.html",h:"error-codes",l:3,k:"Errors",t:"Error codes",s:"authentication_error invalid_api_key 401 Key unknown, revoked or from the other environment. authentication_error environment_mismatch 403 Test key against a live chain, or the reverse. permission_error missing_scope 403 message names the scope. Mint a new key",w:"type code http cause fix authentication_error invalid_api_key environment_mismatch permission_error missing_scope scopes immutable ip_not_allowed allowed source address outside cidr allowlist invalid_request_error request unknown_parameter parameter 400 keys rejected never ignored check spelling version missing_parameter param field unresolvable_token unresolvable token symbol canonical pass policy_error policy policy_stale stale 422 committed hash differs stored re-commit commit before"},
    {p:"api.html",h:"agents",l:2,k:"Resources",t:"Agents",s:"An agent bundles a smart account, a bound policy, session keys and a reputation record. Creating one mints a passport NFT and locks a bond on live networks.",w:"resources"},
    {p:"api.html",h:"agents-create",l:3,k:"Agents",t:"Create an agent",s:"POST /v1/agents scope agents:write Deploys an ERC-4337 smart account with the session-key validator module, mints the passport, and binds the policy. Idempotent on Idempotency-Key . Body parameters Request Response Errors",w:"erc-4337 session-key idempotency-key parameter type required description name string chars unique appears approval prompts marketplace kind enum trader collector treasury service verified policy_id existing bind hash embedded every issued chains caip-2 caip list must subset allow.chains allow session_key object optional ttl_seconds ttl seconds rotate issues first immediately 300 604800 owner address root"},
    {p:"api.html",h:"agents-list",l:3,k:"Agents",t:"List agents",s:"GET /v1/agents scope agents:read Cursor-paginated, newest first. Query parameters",w:"cursor-paginated parameter type description status enum active paused retired slashed kind filter agent chain string caip-2 caip enabled policy_id policy bound specific limit starting_after starting after ending_before ending before order see pagination curl https api.strixhood.xyz api strixhood xyz authorization bearer strix_api_key strix key eip155 8453 object data agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh name dca-eth dca eth"},
    {p:"api.html",h:"agents-get",l:3,k:"Agents",t:"Retrieve an agent",s:"GET /v1/agents/ {agent_id} scope agents:read Returns the full agent object. Supports expand[]=policy and expand[]=passport.traits .",w:"agent_id passport.traits curl https api.strixhood.xyz api strixhood xyz agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh authorization bearer strix_api_key strix key data-urlencode data urlencode resources"},
    {p:"api.html",h:"agents-update",l:3,k:"Agents",t:"Update an agent",s:"PATCH /v1/agents/ {agent_id} scope agents:write Only name , status , policy_id , chains and metadata are mutable. Rebinding policy_id revokes every live session key in the same call, because the keys carry the old policy hash. Body parameters",w:"agent_id policy_id parameter type description enum active paused pausing rejects intents instantly in-flight flight ones finish string rebind triggers session-key revocation commitment must remain subset bound curl https api.strixhood.xyz api strixhood xyz agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh authorization bearer strix_api_key strix content-type content application json resources"},
    {p:"api.html",h:"agents-delete",l:3,k:"Agents",t:"Retire an agent",s:"DELETE /v1/agents/ {agent_id} scope agents:write Retirement is a state, not a deletion: history, attestations and the passport survive. All session keys are revoked onchain and the bond enters a 14-day unbonding period. Returns 409 has_open_intents if anything",w:"agent_id 14-day has_open_intents still flight agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh object status retired session_keys_revoked amount 2500 token strx claimable_at claimable 2026-08-30t09 2026 30t09 11z resources"},
    {p:"api.html",h:"agents-sessionkey",l:3,k:"Agents",t:"Issue a session key",s:"POST /v1/agents/ {agent_id} /session-keys scope agents:write Generates a keypair inside the enclave, registers its permission blob on the agent's validator module, and returns the public address. The private key is never returned and never leaves the enclave —",w:"sessionkey agent_id session-keys api signs behalf intent clears body parameters parameter type required description ttl_seconds ttl seconds integer 300 604800 shorter better rotation free chains string optional defaults cannot exceed rotate boolean auto-issue auto replacement default max_value_usd max value usd number additional per-key ceiling applied top policy higher per_tx_usd key_01jq8znb5c7e9g1j3l5n7q9s 01jq8znb5c7e9g1j3l5n7q9s object"},
    {p:"api.html",h:"agents-revokekey",l:3,k:"Agents",t:"Revoke a session key",s:"DELETE /v1/agents/ {agent_id} /session-keys/ {key_id} scope agents:write Submits an onchain revocation and refuses the key immediately at the API boundary. Returns 202 with the revocation transaction; the key is unusable via the API before that transaction is ",w:"revokekey agent_id session-keys key_id mined key_01jq8znb5c7e9g1j3l5n7q9s 01jq8znb5c7e9g1j3l5n7q9s object session_key status revoked revocation_tx 0x91cb47e2a05d8f3617b24ce09a 7d51f38c60e24b95af7013dc80b6 a41ed2f7c9 revoked_at 2026-08-16t11 2026 16t11 04.881z 881z resource resources"},
    {p:"api.html",h:"intents",l:2,k:"Resources",t:"Intents",s:"The intent object is documented field by field in the protocol reference . This section covers the endpoints that create and manage them.",w:"resources"},
    {p:"api.html",h:"intents-create",l:3,k:"Intents",t:"Submit an intent",s:"POST /v1/intents scope intents:write Accepts the intent, runs stages 01–03 synchronously and returns 202 as soon as the policy check passes. Everything after that is asynchronous — watch the executions channel . Body parameters Request Response Errors",w:"create parameter type required description agent_id agent string must active live session key chain action enum swap transfer nft_bid nft bid nft_buy buy equity_order equity order subscribe agent_hire hire caip-2 caip params object action-specific specific see types constraints optional slippage fee ceilings route preference mev protection simulate_only simulate boolean quote asset diff"},
    {p:"api.html",h:"intents-get",l:3,k:"Intents",t:"Retrieve an intent",s:"GET /v1/intents/ {intent_id} scope intents:read Returns the current state. Use expand[]=execution to include quotes, fills and the attestation in one call instead of two.",w:"intent_id int_01jq8zp1v6c3md8r0yf2wkgs int 01jq8zp1v6c3md8r0yf2wkgs object status settled execution_id exe_01jq8zq7y9b1d3f5h7k9m1p3 exe 01jq8zq7y9b1d3f5h7k9m1p3 buy_amount buy amount 0.041274 041274 price 3634.02 3634 fee_usd_settled fee usd 0.375 375 gas_usd_settled gas 0.019 019 rejection created_at created 2026-08-16t09 2026 16t09 00.412z 412z settled_at 01.338z 338z resources"},
    {p:"api.html",h:"intents-list",l:3,k:"Intents",t:"List intents",s:"GET /v1/intents scope intents:read Query parameters agent_id string Restrict to one agent. status enum | enum[] Repeatable: status=routing&status=submitted . action enum Filter by action. chain string CAIP-2. created_after timestamp Inclusive lower bound. crea",w:"parameter type description agent_id caip-2 created_after created_before before exclusive upper metadata key exact match e.g strategy weekly-rebalance weekly rebalance curl https api.strixhood.xyz api strixhood xyz authorization bearer strix_api_key strix agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh settled limit data-urlencode data urlencode resources"},
    {p:"api.html",h:"intents-cancel",l:3,k:"Intents",t:"Cancel an intent",s:"POST /v1/intents/ {intent_id} /cancel scope intents:write Cancellable up to and including routing . Once the user operation is broadcast the intent is submitted and cancellation returns 409 not_cancellable — there is no way to unsend a transaction, and the API",w:"intent_id not_cancellable pretend otherwise int_01jq8zp1v6c3md8r0yf2wkgs int 01jq8zp1v6c3md8r0yf2wkgs object status cancelled cancelled_at 2026-08-16t09 2026 16t09 00.902z 902z budget_released_usd budget released usd 150.00 150 resources"},
    {p:"api.html",h:"intents-approve",l:3,k:"Intents",t:"Resolve a human gate",s:"POST /v1/intents/ {intent_id} /approval scope intents:write Resolves an intent sitting at awaiting_approval . The decision is recorded with the approver's identity and is included in the attestation, so approvals are auditable after the fact. Body parameters R",w:"approve intent_id awaiting_approval parameter type required description enum reject approver_id string must appear policy.hitl.approvers policy hitl approvers signature recommended eip-191 eip 191 nonce quorum note optional 280 chars stored curl https api.strixhood.xyz api strixhood xyz int_01jq8zp1v6c3md8r0yf2wkgs int 01jq8zp1v6c3md8r0yf2wkgs authorization bearer strix_api_key strix key content-type content application json usr_01jq8zs2m4n6p8r0t2v4x6z8 usr 01jq8zs2m4n6p8r0t2v4x6z8 rebalance leg"},
    {p:"api.html",h:"policies",l:2,k:"Resources",t:"Policies",s:"Policies are the authority layer. Writing one requires policies:write , which should live on exactly one server process and nowhere near an agent runtime.",w:"resources"},
    {p:"api.html",h:"policies-create",l:3,k:"Policies",t:"Create a policy",s:"POST /v1/policies scope policies:write Validates the document, canonicalises it, computes the hash and commits it onchain. Returns once the commitment transaction is broadcast; commitment.block is null until it is mined. Full field reference in the policy sche",w:"commitment.block schema body parameters parameter type required description name string chars unique account limits object must include per_tx_usd usd allow non-empty empty chains actions deny optional wins simulation thresholds simulated asset diff hitl escalation rules absent means never escalate expires_at expires timestamp recommended standing grant end commit_chain commit chain defaults eip155 8453"},
    {p:"api.html",h:"policies-get",l:3,k:"Policies",t:"Retrieve a policy",s:"GET /v1/policies/ {policy_id} scope policies:read Add ?version=N to read a historical version. Historical versions are immutable and retained for seven years, because they are the evidence for why a past transaction was allowed.",w:"policy_id curl https api.strixhood.xyz api strixhood xyz pol_01jq8zk3m2x7yb4n6pa0rtvc pol 01jq8zk3m2x7yb4n6pa0rtvc authorization bearer strix_api_key strix key resources"},
    {p:"api.html",h:"policies-list",l:3,k:"Policies",t:"List policies",s:"GET /v1/policies scope policies:read Filters: status ( live , expired , superseded ), agent_id , plus the standard pagination parameters.",w:"agent_id resources"},
    {p:"api.html",h:"policies-update",l:3,k:"Policies",t:"Update a policy",s:"PATCH /v1/policies/ {policy_id} scope policies:write Updates create a new version and a new commitment. Every session key issued under the previous hash stops validating the moment the new commitment is mined, so bound agents must be re-keyed — pass reissue_se",w:"policy_id re-keyed reissue_session_keys keys api call gap should plan between landing registering agent cannot sign typically block intents submitted window held policy_check check rather rejected expires_at expires curl https api.strixhood.xyz strixhood xyz pol_01jq8zk3m2x7yb4n6pa0rtvc pol 01jq8zk3m2x7yb4n6pa0rtvc authorization bearer strix_api_key strix content-type content type application json limits per_tx_usd usd 250 daily_usd daily 2500 monthly_usd monthly"},
    {p:"api.html",h:"policies-simulate",l:3,k:"Policies",t:"Simulate a policy",s:"POST /v1/policies/ {policy_id} /simulate scope policies:read Evaluates a hypothetical intent against a policy without creating anything. Use it in CI: assert that the intents your agent is capable of producing are the intents your policy permits. Body paramete",w:"policy_id parameters parameter type required description object full minus agent_id as_of timestamp optional evaluate rolling windows time defaults now include_market include market boolean run simulation thresholds live prices default policy_simulation allowed pol_01jq8zk3m2x7yb4n6pa0rtvc pol 01jq8zk3m2x7yb4n6pa0rtvc version notional_usd notional usd 780.00 780 checks rule allow.chains allow chains result pass allow.actions actions allow.tokens tokens deny.categories deny categories"},
    {p:"api.html",h:"quotes",l:2,k:"Resources",t:"Quotes & routing",s:"A quote is a priced, expiring, non-binding preview. Submitting an intent runs its own auction; a quote is for showing a number to a human or a model before committing.",w:"non-binding resources"},
    {p:"api.html",h:"quotes-create",l:3,k:"Quotes & routing",t:"Request a quote",s:"POST /v1/quotes scope quotes:read The only endpoint that accepts a publishable pk_ key, so a browser or agent runtime can price something without holding a secret. Body parameters Quotes expire in 12 seconds That is roughly one Base block plus margin. A quote ",w:"create pk_ parameter type required description action enum intents chain string caip-2 caip params object action-specific specific agent_id optional prices against policy policy_ok route_preference route preference default best_price best qte_01jq8zt2k4m6p8r0t2v4x6z8 qte 01jq8zt2k4m6p8r0t2v4x6z8 eip155 8453 sell token usdc amount 150.00 150 buy weth 0.041293 041293 minimum 0.041128 041128 3632.10 3632 price_impact_bps impact bps"},
    {p:"api.html",h:"quotes-get",l:3,k:"Quotes & routing",t:"Retrieve a quote",s:"GET /v1/quotes/ {quote_id} scope quotes:read Returns the quote as issued, including expired ones, for audit. It does not reprice.",w:"quote_id resources"},
    {p:"api.html",h:"routes-list",l:3,k:"Quotes & routing",t:"List venues",s:"GET /v1/routes scope quotes:read Enumerates the venues reachable on a chain, their liquidity class and their session hours. Use it to build a policy's allow.venues from something real instead of guessing. Resource",w:"allow.venues object data venue uniswap_v4 uniswap eip155 8453 kind amm tvl_usd tvl usd 412000000 status live backed_rwa backed rwa 42161 rwa_equity equity 88000000 opens_at opens 2026-08-17t13 2026 17t13 00z closes_at closes 2026-08-17t20 17t20 timezone utc continuous_secondary continuous secondary has_more resources"},
    {p:"api.html",h:"executions",l:2,k:"Resources",t:"Executions",s:"An execution is created when an intent enters routing and carries everything that happened afterwards: the auction, the fills, the receipts and the attestation.",w:"resources"},
    {p:"api.html",h:"executions-get",l:3,k:"Executions",t:"Retrieve an execution",s:"GET /v1/executions/ {execution_id} scope intents:read { \"id\": \"exe_01JQ8ZQ7Y9B1D3F5H7K9M1P3R5\", \"object\": \"execution\", \"intent_id\": \"int_01JQ8ZP1V6C3MD8R0YF2WKGSTA\", \"status\": \"settled\", \"chain\": \"eip155:8453\", \"solver\": { \"id\": \"slv_kestrel\", \"reliability\": 0",w:"execution_id exe_01jq8zq7y9b1d3f5h7k9m1p3 01jq8zq7y9b1d3f5h7k9m1p3 intent_id int_01jq8zp1v6c3md8r0yf2wkgs 01jq8zp1v6c3md8r0yf2wkgs slv_kestrel 0.9987 9987 bond_strx bond strx 180000 quote qte_01jq8zt2k4m6p8r0t2v4x6z8 qte 01jq8zt2k4m6p8r0t2v4x6z8 guaranteed_out guaranteed 0.041128 041128 bids_received bids received auction_ms auction 176 simulation digest 0x93af 21c7 price_impact_bps price impact bps asset_diff asset diff token usdc delta 150.000000 150 000000 weth 0.041274 041274 warnings fills buy_amount buy amount"},
    {p:"api.html",h:"executions-list",l:3,k:"Executions",t:"List executions",s:"GET /v1/executions scope intents:read Filters: agent_id , status , chain , solver , settled_after , settled_before , plus standard pagination. Set format=csv to stream a CSV for accounting instead of JSON.",w:"agent_id settled_after settled_before curl https api.strixhood.xyz api strixhood xyz authorization bearer strix_api_key strix key 2026-07-01t00 2026 01t00 00z 2026-08-01t00 july-executions.csv july resources"},
    {p:"api.html",h:"executions-attestation",l:3,k:"Executions",t:"Retrieve an attestation",s:"GET /v1/executions/ {execution_id} /attestation scope intents:read Returns the decoded attestation plus the raw ABI-encoded payload, so you can verify it against the EAS contract yourself rather than trusting this API. Resource",w:"execution_id abi-encoded uid 0x5ea1c73b0428f96d15a0c8e471 2bd936084fa5c2e1739bd60c48af 2107e59d40 object schema strixhood.settlement.v1 strixhood settlement attester recipient 0x1f3c7a9b04e2d586cf01b7e34a 9d2c6058ba9ae2 revocable data intent_hash intent hash 0xc41d 8a02 policy_hash policy 0x7d41a9c0b83e5f2d16c4a87b90 ef3524ca1d6b8f0472e93a5c18df 6027ab4e91 policy_version version simulation_digest simulation digest 0x93af 21c7 solver slv_kestrel slv kestrel settled_out settled 41274000000000000 approvals 0x00000000000000000000000000 0000000000000000000000000000 0000000020 verify_url url https base.easscan.org base easscan org"},
    {p:"api.html",h:"portfolio",l:2,k:"Resources",t:"Portfolio",s:"Read-only views over an agent's smart account: balances, valuation, history and the transaction ledger. Prices come from the same oracle set the policy engine uses, so a portfolio number and a limit calculation never disagree.",w:"read-only resources"},
    {p:"api.html",h:"portfolio-get",l:3,k:"Portfolio",t:"Retrieve portfolio",s:"GET /v1/portfolio scope portfolio:read Query parameters agent_id string required Which agent's account to value. chains string[] optional Defaults to all of the agent's chains. include enum[] optional tokens , nfts , equities , positions . Default all. min_val",w:"parameter type description agent_id min_value_usd usd number hide dust 1.00 object agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh total_value_usd total 48213.77 48213 change_24h_pct change 24h pct 1.84 as_of 2026-08-16t09 2026 16t09 00.000z 000z symbol weth chain eip155 8453 balance 9.418200 418200 price_usd price 3634.02 3634 value_usd 34226.31 34226 allocation_pct allocation 71.0 usdc 9412.400000 9412 400000 1.0"},
    {p:"api.html",h:"portfolio-history",l:3,k:"Portfolio",t:"Portfolio history",s:"GET /v1/portfolio/history scope portfolio:read Time series of total value. interval accepts 5m , 1h , 1d ; range accepts 24h , 7d , 30d , 1y , max . Points are snapshots at interval close, not interpolations.",w:"object portfolio_history agent_id agent agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh 2026-08-15t10 2026 15t10 00z value_usd usd 47338.10 47338 2026-08-15t11 15t11 47510.62 47510 2026-08-16t09 16t09 48213.77 48213 resources"},
    {p:"api.html",h:"portfolio-transactions",l:3,k:"Portfolio",t:"List transactions",s:"GET /v1/portfolio/transactions scope portfolio:read Every value movement in or out of the account, including ones not originated by an intent — deposits, airdrops, third-party transfers. Cursor-paginated, format=csv supported. Push",w:"third-party cursor-paginated object data txn_01jq8zv1c3e5g7j9l1n3q5s7 txn 01jq8zv1c3e5g7j9l1n3q5s7 direction kind settlement token weth amount 0.041274 041274 value_usd usd 150.00 150 intent_id int_01jq8zp1v6c3md8r0yf2wkgs int 01jq8zp1v6c3md8r0yf2wkgs tx_hash hash 0x7c02e91a4f5b8d3607a2c14be9 350df82461ac09b7de52318ca06f 4b19e7d3a2 2026-08-16t09 2026 16t09 01.338z 338z txn_01jq8zu9a1c3e5g7j9l1n3q5 01jq8zu9a1c3e5g7j9l1n3q5 external_deposit external deposit usdc 5000.000000 5000 000000 5000.00 2026-08-14t17 14t17 40.000z 000z has_more next_cursor next resources"},
    {p:"api.html",h:"webhooks",l:2,k:"Realtime",t:"Webhooks",s:"Webhooks are the durable channel: signed, retried and replayable. The WebSocket is the fast channel. Production systems use both — the socket to react, the webhook to be certain.",w:"realtime"},
    {p:"api.html",h:"webhooks-create",l:3,k:"Webhooks",t:"Create an endpoint",s:"POST /v1/webhooks scope webhooks:write Body parameters The signing secret is shown once It is not retrievable afterwards. Store it in your secret manager immediately, or roll the endpoint and get a new one.",w:"parameter type required description url string https must answer probe 2xx inside before activates events event types unknown rejected agent_ids agent ids optional restrict specific agents default 120 chars console whk_01jq8zw7e9g1j3l5n7q9s1u3 whk 01jq8zw7e9g1j3l5n7q9s1u3 object webhook_endpoint webhook ops.example.com ops example com hooks strix intent.rejected intent approval.requested approval requested execution.settled execution settled execution.failed failed"},
    {p:"api.html",h:"webhooks-list",l:3,k:"Webhooks",t:"List endpoints",s:"GET /v1/webhooks scope webhooks:write Returns endpoints with delivery health: success_rate_24h , last_delivery_at , consecutive_failures . An endpoint that fails 20 consecutive deliveries is disabled and an webhook.disabled event is emitted to the remaining he",w:"success_rate_24h last_delivery_at consecutive_failures webhook.disabled healthy realtime"},
    {p:"api.html",h:"webhooks-delete",l:3,k:"Webhooks",t:"Delete an endpoint",s:"DELETE /v1/webhooks/ {webhook_id} scope webhooks:write Returns 204 . Deliveries already queued are dropped; nothing is redelivered afterwards.",w:"webhook_id realtime"},
    {p:"api.html",h:"webhook-events",l:3,k:"Webhooks",t:"Event types",s:"intent.created An intent is accepted at stage 01. intent intent.rejected Any of stages 02–04 refuses it. intent with rejection intent.expired expires_at passes without a fill. intent intent.cancelled Cancelled by the owner. intent approval.requested The human ",w:"webhook events fires payload data intent.created intent.rejected intent.expired expires_at intent.cancelled approval.requested gate opens carries full asset diff simulation approval.resolved resolved approved timed decision execution.submitted execution submitted user operation broadcast execution.settled settled included fee split attestation written execution.failed failed reverted onchain solver defaulted failure execution.reverted undone deep reorg policy.updated policy updated version committed"},
    {p:"api.html",h:"webhook-signature",l:3,k:"Webhooks",t:"Signature verification",s:"Every delivery carries Strix-Signature : a timestamp and one or more HMAC-SHA256 signatures over timestamp + \".\" + raw_body , keyed with the endpoint's signing secret. Multiple v1= values appear during a secret roll — accept the request if any of them verifies",w:"webhook strix-signature hmac-sha256 raw_body post hooks http 1.1 content-type content type application json 1786953601 6a1f0c4b8d29e7350a1c8f6b2e94 d075c3a8b1f60e29d47a5c30b8e1 f27a94d6 strix-event-id event evt_01jq8zx3g5j7l9n1q3s5u7w9 evt 01jq8zx3g5j7l9n1q3s5u7w9 strix-delivery-attempt attempt import createhmac timingsafeequal node crypto const tolerance_seconds tolerance seconds 300 export function verify rawbody string header boolean parts object.fromentries object fromentries header.split split map kv.split number parts.t number.isfinite isfinite"},
    {p:"api.html",h:"webhook-delivery",l:3,k:"Webhooks",t:"Delivery, retries and ordering",s:"Timeout — 5 seconds to respond. Return 2xx immediately and do the work asynchronously. Retries — 8 attempts over 24 hours with exponential backoff: 10 s, 30 s, 2 m, 10 m, 30 m, 2 h, 6 h, 12 h. Ordering is not guaranteed. Use created_at and the intent status ma",w:"webhook created_at machine order events yourself retried execution.submitted execution submitted arrive after execution.settled settled at-least-once least once deduplicate strix-event-id strix event twice replay post time range re-sends sends past backfill stream realtime"},
    {p:"api.html",h:"websocket",l:2,k:"Realtime",t:"WebSocket API",s:"One connection, many channels. Frames do not consume the REST rate-limit budget, which makes the socket the correct way to follow intents rather than polling.",w:"rate-limit realtime"},
    {p:"api.html",h:"ws-connect",l:3,k:"WebSocket API",t:"Connect and authenticate",s:"WSS wss://stream.strixhood.xyz/v1 scope intents:read Authenticate with the first frame within 5 seconds of the handshake, or the socket closes with code 4001 . Query-string keys are not accepted — they end up in proxy logs.",w:"stream.strixhood.xyz query-string auth token strx_sk_live_9f2c41bd7a084e6cb35d live 9f2c41bd7a084e6cb35d 0e17 auth.ok account acct_01jq8z acct 01jq8z livemode heartbeat_sec heartbeat sec channels executions prices wscat strix_api_key strix key realtime"},
    {p:"api.html",h:"ws-frames",l:3,k:"WebSocket API",t:"Frame format",s:"Every frame is a JSON object with an op . Client frames may carry an id , which is echoed on the matching acknowledgement so you can correlate.",w:"direction meaning auth server authenticate connection subscribe join channel optional filters unsubscribe leave ping application-level application level keepalive auth.ok subscribed unsubscribed pong acknowledgements echoing event payload error envelope rest plus offending channels once name executions agent_ids agent ids agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh prices symbols eth aaplx chain eip155 8453 acknowledges realtime"},
    {p:"api.html",h:"ws-intents",l:3,k:"WebSocket API",t:"Channel: intents",s:"Status transitions for every intent visible to the key. Filters: agent_ids , statuses , chains . One frame per transition, never a full re-send.",w:"agent_ids re-send event seq 88214 2026-08-16t09 2026 16t09 00.598z 598z data int_01jq8zp1v6c3md8r0yf2wkgs int 01jq8zp1v6c3md8r0yf2wkgs object routing previous_status previous simulating agent_id agt_01jq8zm7t4b0kc2n9xe5rvdh agt 01jq8zm7t4b0kc2n9xe5rvdh execution_id execution exe_01jq8zq7y9b1d3f5h7k9m1p3 exe 01jq8zq7y9b1d3f5h7k9m1p3 realtime"},
    {p:"api.html",h:"ws-executions",l:3,k:"WebSocket API",t:"Channel: executions",s:"Auction results, fills and settlement. Filters: agent_ids , chains , solvers . This is the channel to drive a UI from.",w:"agent_ids event seq 88217 2026-08-16t09 2026 16t09 01.338z 338z data exe_01jq8zq7y9b1d3f5h7k9m1p3 exe 01jq8zq7y9b1d3f5h7k9m1p3 object execution intent_id intent int_01jq8zp1v6c3md8r0yf2wkgs int 01jq8zp1v6c3md8r0yf2wkgs status settled solver slv_kestrel slv kestrel buy_amount buy amount 0.041274 041274 price 3634.02 3634 tx_hash hash 0x7c02e91a4f5b8d3607a2c14be9 350df82461ac09b7de52318ca06f 4b19e7d3a2 attestation uid 0x5ea1 9d40 realtime"},
    {p:"api.html",h:"ws-prices",l:3,k:"WebSocket API",t:"Channel: prices",s:"The same oracle prices the policy engine uses for notional calculation, so a client-side limit preview matches the server's decision. Throttled to 4 updates per second per symbol; subscribe to at most 50 symbols per connection. staleness_ms is not decoration I",w:"client-side event seq 88219 2026-08-16t09 2026 16t09 01.500z 500z data eth chain eip155 8453 price_usd price usd 3634.02 3634 change_24h_pct change 24h pct 1.84 sources staleness_ms 380 exceeds 000 degraded widens tolerance size order stale realtime"},
    {p:"api.html",h:"ws-lifecycle",l:3,k:"WebSocket API",t:"Heartbeats and reconnect",s:"The server sends ping every heartbeat_sec . Miss two and the socket closes. Every event carries a monotonic seq per channel; reconnect with resume_from to replay the gap from a 15-minute buffer.",w:"lifecycle heartbeat_sec resume_from 15-minute subscribe channels name executions 88217 close code meaning 1000 normal closure nothing 4001 authentication timeout failure fix key loop 4003 scope missing requested mint 4008 connections tier multiplex onto 4009 missed 4029 subscription flood ops back 1012 restarting deploy after jittered function connect url string token onevent unknown"},
    {p:"sdk.html",h:"sdk-overview",l:2,k:"Getting started",t:"Overview",s:"Pick the SDK that matches where your agent runs. TypeScript is the primary client and ships first; Python and Rust track it within one minor version and are generated from the same OpenAPI document, so the shapes cannot drift.",w:"getting started"},
    {p:"sdk.html",h:"sdk-parity",l:3,k:"Overview",t:"Parity",s:"Full resource coverage Yes Yes Yes Sync calls Promise sync + asyncio async (tokio) Streaming Async iterator + handlers Async generator Stream impl Automatic retries Yes Yes Yes Webhook signature helper Yes Yes Yes Policy-hash verification Yes Yes Yes Auto-pagi",w:"sdk capability typescript python rust policy-hash auto-pagination pagination await try_next try next typed error classes enum strixerror bundled deployment addresses getting started"},
    {p:"sdk.html",h:"sdk-naming",l:3,k:"Overview",t:"Naming conventions",s:"The wire format is snake_case . Each SDK converts to whatever its ecosystem expects and converts back on the way out; you never hand-write the wire shape. Amounts stay decimal, never float TypeScript keeps them as strings, Python as Decimal , Rust as rust_deci",w:"snake_case hand-write max_slippage_bps max slippage bps maxslippagebps agent_id agent agentid 150.00 150 string str 2026-08-16t09 2026 16t09 00.412z 412z date datetime tz-aware aware utc rust_decimal passing javascript number amount expected type error rounding surprise getting started"},
    {p:"sdk.html",h:"sdk-runtimes",l:3,k:"Overview",t:"Supported runtimes",s:"TypeScript Node 20, TS 5.4 Node 20/22/24, Bun 1.2, Deno 2, modern browsers ESM and CJS. Browser builds refuse sk_ keys at runtime. Python 3.10 3.10–3.13, CPython and PyPy httpx transport; sync and async clients share one core. Rust 1.78, edition 2021 stable, b",w:"sdk minimum tested notes 5.4 1.2 sk_ 3.10 3.13 1.78 beta rustls default native-tls native tls behind feature setup getting started"},
    {p:"sdk.html",h:"install",l:2,k:"Getting started",t:"Installation",s:"No native dependencies, no build step, no post-install scripts in any of the three packages.",w:"post-install getting started"},
    {p:"sdk.html",h:"install-cmd",l:3,k:"Installation",t:"Install",s:"npm install @strixhood/sdk pnpm add @strixhood/sdk bun add @strixhood/sdk deno add npm:@strixhood/sdk pip install strixhood # streaming + webhook helpers pip install \"strixhood[stream,webhooks]\" cargo add strix-hood --features rustls,stream # Cargo.toml # stri",w:"cmd strix-hood cargo.toml version 1.4 getting started"},
    {p:"sdk.html",h:"install-verify",l:3,k:"Installation",t:"Verify the install",s:"Every client exposes ping() , which hits GET /v1/health and returns the resolved API version. If this works, your key, network path and version pin are all correct. Client",w:"import strix strixhood sdk const apikey process.env.strix_api_key process env console.log console log await strix.ping apiversion 2026-07-01 2026 livemode latencyms api_key os.environ environ strix_api_key print api_version latency_ms latency strix_hood hood tokio main async anyhow result let from_env println getting started"},
    {p:"sdk.html",h:"init",l:2,k:"Getting started",t:"Initialisation",s:"One client per API key, constructed once and reused. The clients are connection-pooled and safe to share across concurrent tasks; constructing one per request throws away keep-alive and doubles your latency.",w:"init connection-pooled keep-alive getting started"},
    {p:"sdk.html",h:"init-construct",l:3,k:"Initialisation",t:"Constructing a client",s:"import { Strix } from \"@strixhood/sdk\"; export const strix = new Strix({ apiKey: process.env.STRIX_API_KEY!, // required apiVersion: \"2026-07-01\", // pin explicitly in production baseUrl: \"https://api.strixhood.xyz/v1\", // override for a private deployment tim",w:"init construct process.env.strix_api_key 2026-07-01 api.strixhood.xyz timeoutms 20_000 000 maxretries telemetry asyncstrix api_key os.environ environ strix_api_key api_version version base_url base url timeout 20.0 max_retries max retries identical surface awaitable astrix std time duration strix_hood hood strixconfig pub anyhow result var parse from_secs secs getting started"},
    {p:"sdk.html",h:"init-options",l:3,k:"Initialisation",t:"Configuration options",s:"apiKey string env STRIX_API_KEY Required. Prefix decides the environment. apiVersion string key default Pin it. Unpinned clients move when your key's default moves. baseUrl string public API For private deployments and record/replay proxies in tests. timeoutMs",w:"init option type description strix_api_key number 30000 attempt call retries take longer maxretries applies 429 5xx connection errors see idempotencykey uuid factory auto-generated auto generated keys override derive job ids fetch transport platform inject http layer tracing proxying onrequest onresponse hooks logging receive method path status requestid duration telemetry boolean anonymous sdk"},
    {p:"sdk.html",h:"init-keys",l:3,k:"Initialisation",t:"Keys and environments",s:"The key prefix chooses the environment; there is no testMode flag to forget to set. The browser build refuses to construct a client with an sk_ key and throws immediately, which is the failure you want at build time rather than the one you find in a bundle ana",w:"init sk_ analyser agent runtime publishable quotes read scope const preview strix apikey strx_pk_live_4c8e1d0b6a92f375 live 4c8e1d0b6a92f375 quote await preview.quotes.create create action swap chain eip155 8453 params selltoken usdc buytoken weth sellamount 150.00 150 secretkeyinbrowsererror before network call strx_sk_live_9f2c41bd7a084e6cb35d 9f2c41bd7a084e6cb35d 0e17 resource getting started"},
    {p:"sdk.html",h:"sdk-agents",l:2,k:"Resources",t:"Agents",s:"Mirrors the agents endpoints . Every method returns a fully typed object; nothing is any .",w:"sdk resources"},
    {p:"sdk.html",h:"agents-methods",l:3,k:"Agents",t:"Method surface",s:"agents.create(params) POST /v1/agents Agent agents.list(query?) GET /v1/agents Page<Agent> agents.get(id, opts?) GET /v1/agents/{id} Agent agents.update(id, patch) PATCH /v1/agents/{id} Agent agents.retire(id) DELETE /v1/agents/{id} Agent agents.sessionKeys.is",w:"methods endpoint agents.create agents.list agents.get agents.update agents.retire agents.sessionkeys.issue issue session-keys session keys sessionkey agents.sessionkeys.revoke revoke keyid resources"},
    {p:"sdk.html",h:"agents-create-sdk",l:3,k:"Agents",t:"Create and bind",s:"const agent = await strix.agents.create({ name: \"dca-eth\", kind: \"trader\", policyId: policy.id, chains: [\"eip155:8453\"], sessionKey: { ttlSeconds: 86_400, rotate: true }, }, { idempotencyKey: \"create-dca-eth-01\" }); agent.status; // \"active\" agent.smartAccount",w:"sdk strix.agents.create dca-eth policy.id 86_400 create-dca-eth-01 agent.status agent.smartaccount 0x1f3c7a9b04e2d586cf01b7e34a 9d2c6058ba9ae2 agent.passport.tokenid passport tokenid 4182 agent.policy.hash hash 0x7d41a9c0 agent.sessionkeys sessionkeys expiresat date policy_id session_key session key ttl_seconds ttl seconds idempotency_key idempotency agent.smart_account smart account 0x1f3c 9ae2 agent.passport.token_id token agent.session_keys keys expires_at expires datetime tz-aware aware strix_hood hood createagent let policy.id.clone clone vec default"},
    {p:"sdk.html",h:"agents-paginate",l:3,k:"Agents",t:"Listing and auto-pagination",s:"List methods return a page object. Iterating the client-side helper walks every page for you and stops when has_more is false — you never manage a cursor by hand.",w:"paginate client-side has_more const await strix.agents.list strix status active limit page.data.length data length page.hasmore hasmore page.nextcursor nextcursor lazily agent strix.agents.listall listall console.log console log agent.id agent.reputation.score reputation score len page.data page.has_more page.next_cursor next strix.agents.list_all print futures trystreamext let strix.agents mut stream while stream.try_next try println resources"},
    {p:"sdk.html",h:"agents-keys-sdk",l:3,k:"Agents",t:"Session keys",s:"Issue short and rotate often. The private key never leaves the enclave, so there is nothing to store, leak or back up on your side — only the key ID matters to you. Resource",w:"sdk const await strix.agents.sessionkeys.iss strix sessionkeys iss agent.id agent ttlseconds 3_600 600 maxvalueusd 250 incident kill now strix.agents.sessionkeys.rev rev oke key.id status revoked revocationtx 0x91cb f7c9 resources"},
    {p:"sdk.html",h:"sdk-intents",l:2,k:"Resources",t:"Intents",s:"Submitting an intent returns as soon as the policy check passes. Everything after that is asynchronous, so the SDK gives you two ways to follow it: a stream, or a single waitFor helper that resolves at a terminal status.",w:"resources"},
    {p:"sdk.html",h:"intents-methods",l:3,k:"Intents",t:"Method surface",s:"intents.create(params, opts?) POST /v1/intents Intent intents.get(id, opts?) GET /v1/intents/{id} Intent intents.list(query?) GET /v1/intents Page<Intent> intents.listAll(query?) GET /v1/intents AsyncIterable<Intent> intents.cancel(id) POST /v1/intents/{id}/ca",w:"methods endpoint intents.create intents.get intents.list intents.listall intents.cancel intents.approve approve approval intents.waitfor waitfor polling stream resources"},
    {p:"sdk.html",h:"intents-submit-sdk",l:3,k:"Intents",t:"Submit",s:"const intent = await strix.intents.create({ agentId: agent.id, action: \"swap\", chain: \"eip155:8453\", params: { sellToken: \"USDC\", buyToken: \"WETH\", sellAmount: \"150.00\" }, constraints: { maxSlippageBps: 40, routePreference: \"best_price\" }, }, { idempotencyKey:",w:"sdk strix.intents.create agent.id 150.00 best_price dca-2026-08-16-0900 dca 2026 0900 intent.status status simulating intent.estimated.buyamount estimated buyamount 0.04129 04129 intent.estimated.feeusd feeusd 0.375 375 decimal import agent_id sell_token sell token buy_token buy sell_amount amount max_slippage_bps max slippage bps route_preference route preference idempotency_key idempotency key intent.estimated.buy_amount rust_decimal_macros rust macros dec strix_hood hood createintent swapparams let agent.id.clone clone"},
    {p:"sdk.html",h:"intents-wait",l:3,k:"Intents",t:"Waiting for a terminal status",s:"waitFor opens a stream, falls back to polling if the socket is unavailable, and resolves on the first terminal status. It rejects on rejected and failed unless you ask it not to — silent failure is not a default worth having.",w:"wait import intentrejectederror strixhood sdk try const settled await strix.intents.waitfor strix intent.id intent timeoutms 90_000 000 console.log console log settled.settled.buyamount buyamount settled.settled.feeusdsettle feeusdsettle catch err instanceof console.error error err.rule rule err.message message limits.daily_usd limits daily usd exceeds else throw resolve never outcome throwonfailure strixhood.errors errors intentrejected strix.intents.wait_for timeout 90.0 print settled.settled.buy_amount buy amount"},
    {p:"sdk.html",h:"intents-dryrun",l:3,k:"Intents",t:"Dry runs",s:"simulateOnly runs stages 01–05 and returns the quote plus the signed asset diff without producing a user operation. It costs no fee and moves no value, which makes it the right call to put in front of a model before you let it commit.",w:"dryrun const preview await strix.intents.create strix create agentid agent.id agent action swap chain eip155 8453 params selltoken usdc buytoken weth sellamount 150.00 150 preview.status status simulated preview.simulation.assetdiff simulation assetdiff token delta 150.000000 000000 preview.simulation.priceimpa priceimpa ctbps preview.simulation.warnings warnings resources"},
    {p:"sdk.html",h:"intents-approvals",l:3,k:"Intents",t:"Resolving human gates",s:"for await (const evt of strix.stream.intents({ statuses: [\"awaiting_approval\"] })) { const diff = evt.simulation.assetDiff .map((d) => `${d.delta} ${d.token}`) .join(\", \"); const ok = await askAHuman(`${evt.agentId} wants: ${diff}`); await strix.intents.approv",w:"approvals strix.stream.intents awaiting_approval evt.simulation.assetdiff d.delta d.token evt.agentid strix.intents.approve approve evt.id decision reject approverid usr_01jq8zs2m4n6p8r0t2v4x6z8 usr 01jq8zs2m4n6p8r0t2v4x6z8 note reviewed against mandate outside resource resources"},
    {p:"sdk.html",h:"sdk-policies",l:2,k:"Resources",t:"Policies",s:"Policy writes require policies:write . Keep this client in a separate process from the one your agent talks to.",w:"sdk resources"},
    {p:"sdk.html",h:"policies-methods",l:3,k:"Policies",t:"Method surface",s:"policies.create(doc) POST /v1/policies Policy policies.get(id, {version}?) GET /v1/policies/{id} Policy policies.list(query?) GET /v1/policies Page<Policy> policies.update(id, patch) PATCH /v1/policies/{id} Policy policies.simulate(id, {intent}) POST /v1/polic",w:"methods endpoint policies.create policies.get policies.list policies.update policies.simulate policysimulation policies.hash hash local network hex32 resources"},
    {p:"sdk.html",h:"policies-write",l:3,k:"Policies",t:"Writing a policy",s:"const policy = await strix.policies.create({ name: \"dca-conservative\", limits: { perTxUsd: 250, dailyUsd: 1_000, monthlyUsd: 20_000, maxOpenIntents: 4 }, allow: { chains: [\"eip155:8453\"], actions: [\"swap\"], tokens: [\"USDC\", \"WETH\"], venues: [\"uniswap_v4\", \"aer",w:"write strix.policies.create dca-conservative 1_000 20_000 uniswap_v4 aerodrome deny categories leverage gambling unverified_contract unverified contract simulation requiresuccess maxpriceimpactbps 120 minliquidityusd 250_000 hitl thresholdusd 200 channels webhook timeoutsec 180 ontimeout reject expiresat date 2027-01-01t00 2027 01t00 00z datetime import timezone per_tx_usd usd daily_usd daily monthly_usd monthly max_open_intents max open intents require_success require success max_price_impact_bps price impact bps"},
    {p:"sdk.html",h:"policies-verify",l:3,k:"Policies",t:"Verifying the commitment yourself",s:"policies.hash() runs entirely locally: RFC 8785 canonicalisation, domain separator, keccak256. Compare it with what the registry holds before you trust an agent with value. If they disagree, something rewrote your policy.",w:"verify policies.hash import strix deployments strixhood sdk createpublicclient http viem base chains const doc await strix.policies.get policy.id local strix.policies.hash pure function network chain transport onchain chain.readcontract readcontract address deployments.base.policyregis policyregis try abi deployments.abi.policyregist policyregist functionname policyof args bigint agent.passport.tokenid passport tokenid strix.agents.update agents update agent.id status paused throw error drift resources"},
    {p:"sdk.html",h:"policies-ci",l:3,k:"Policies",t:"Policy tests in CI",s:"policies.simulate() is the assertion primitive. Enumerate the intents your agent could produce and assert on the outcome — this catches a widened policy in review, not in production. Resource",w:"policies.simulate import expect test vitest const cases label small swap passes amount 100.00 100 allowed per-tx cap 800.00 800 rule limits.per_tx_usd limits usd c.label async sim await strix.policies.simulate strix policy.id intent action chain eip155 8453 params selltoken usdc buytoken weth sellamount c.amount sim.allowed tobe c.allowed c.rule sim.firstfailure firstfailure resources"},
    {p:"sdk.html",h:"sdk-market",l:2,k:"Resources",t:"Quotes, executions, portfolio",s:"Read paths. All three are safe to call with a publishable key except executions , which needs intents:read .",w:"sdk market resources"},
    {p:"sdk.html",h:"sdk-quotes",l:3,k:"Quotes, executions, portfolio",t:"Quotes and routes",s:"const quote = await strix.quotes.create({ action: \"swap\", chain: \"eip155:8453\", params: { sellToken: \"USDC\", buyToken: \"WETH\", sellAmount: \"150.00\" }, agentId: agent.id, // also returns policyOk }); quote.buy.minimum; // \"0.041128\" — the guaranteed floor quote",w:"sdk strix.quotes.create 150.00 agent.id quote.buy.minimum 0.041128 quote.priceimpactbps priceimpactbps quote.policyok quote.expiresat expiresat date quote.routes.map map r.solver solver r.venue venue r.out venues strix.routes.list list 42161 kind rwa_equity rwa equity venues.data data session opensat closesat continuoussecondary sell_token sell token buy_token sell_amount amount agent_id decimal quote.price_impact_bps price impact bps quote.policy_ok policy let newquote swapparams dec default"},
    {p:"sdk.html",h:"sdk-executions",l:3,k:"Quotes, executions, portfolio",t:"Executions and attestations",s:"const exec = await strix.executions.get(intent.executionId!); exec.solver.id; // \"slv_kestrel\" exec.quote.bidsReceived; // 3 exec.quote.auctionMs; // 176 exec.fills[0].txHash; // \"0x7c02e9…d3a2\" exec.fees.split; // { treasuryUsd, stakersUsd, buybackUsd } // th",w:"sdk strix.executions.get intent.executionid exec.solver.id slv_kestrel exec.quote.bidsreceived exec.quote.auctionms exec.fills exec.fees.split audit artefact decoded plus raw independent verification att strix.executions.attestation attestation exec.id att.data.policyhash data policyhash agent.policy.hash agent policy hash att.verifyurl verifyurl easscan link monthly csv accounting strix.executions.export export settledafter date 2026-07-01 2026 settledbefore 2026-08-01 resources"},
    {p:"sdk.html",h:"sdk-portfolio",l:3,k:"Quotes, executions, portfolio",t:"Portfolio",s:"const pf = await strix.portfolio.get({ agentId: agent.id, minValueUsd: 1 }); pf.totalValueUsd; // 48213.77 pf.change24hPct; // 1.84 pf.tokens.find((t) => t.symbol === \"WETH\")?.allocationPct; // 71 const history = await strix.portfolio.history({ agentId: agent.",w:"sdk strix.portfolio.get agent.id pf.totalvalueusd 48213.77 pf.change24hpct 1.84 pf.tokens.find t.symbol strix.portfolio.history interval range 24h txn strix.portfolio.transactions transactions txn.intentid intentid console.log console log external movement txn.kind kind txn.valueusd valueusd agent_id min_value_usd min value usd pf.total_value_usd total decimal pf.change_24h_pct change pct _all txn.intent_id intent none print txn.value_usd let strix.portfolio dec println mut txns paginate while"},
    {p:"sdk.html",h:"sdk-streaming",l:2,k:"Realtime",t:"Streaming",s:"The SDK owns the socket: authentication, heartbeats, resume-from-sequence and jittered reconnect. You get an async iterator that does not end when the connection drops.",w:"resume-from-sequence realtime"},
    {p:"sdk.html",h:"stream-iterate",l:3,k:"Streaming",t:"Async iteration",s:"const stream = strix.stream.executions({ agentIds: [agent.id], chains: [\"eip155:8453\"], }); for await (const evt of stream) { switch (evt.status) { case \"submitted\": console.log(\"broadcast\", evt.fills[0]?.txHash); break; case \"settled\": console.log(\"filled\", e",w:"iterate strix.stream.executions agent.id evt.status console.log evt.fills buyamount att evt.attestation.uid attestation uid failed console.error error reverted evt.failure failure reason stop cleanly closes socket ends iterator stream.close close import asyncio strixhood asyncstrix def main none api_key api key os.environ environ strix_api_key agent_ids ids print buy_amount buy amount elif evt.failure.reason asyncio.run run futures streamext strix_hood hood"},
    {p:"sdk.html",h:"stream-handlers",l:3,k:"Streaming",t:"Event handlers",s:"If an iterator does not fit your architecture, subscribe with callbacks instead. Both forms share one underlying socket per client, so mixing them does not open a second connection or count twice against the tier limit.",w:"stream const sub strix.stream.subscribe strix channels name intents agentids agent.id agent prices symbols eth onintent metrics.observe metrics observe i.status status onprice p.stalenessms stalenessms 5_000 000 pausetrading onreconnect attempt gap log.warn log warn replayed resumed onerror err log.error error later sub.unsubscribe unsubscribe await sub.close close realtime"},
    {p:"sdk.html",h:"stream-resume",l:3,k:"Streaming",t:"Reconnection and gaps",s:"The client tracks the last seq per channel and resumes from it. The server buffers 15 minutes; if the gap is longer the SDK emits onGap with the range it could not replay so you can backfill over REST rather than silently losing events. Realtime",w:"stream resume strix.stream.subscribe strix subscribe channels name executions agentids agent.id agent onexecution handle async fromseq toseq since log.warn log warn buffer exceeded backfilling await const exec strix.executions.listall listall agentid settledafter behaviour default option reconnect backoff 500 full jitter reconnect.maxdelayms maxdelayms attempts unbounded reconnect.maxattempts maxattempts fatal close codes 4001 4003 never retried heartbeat"},
    {p:"sdk.html",h:"sdk-webhooks",l:2,k:"Realtime",t:"Webhooks",s:"Each SDK ships a constant-time verifier and adapters for the common server frameworks. The verifier needs the raw body — every adapter below is built around getting you that before anything parses it.",w:"constant-time realtime"},
    {p:"sdk.html",h:"webhooks-verify-sdk",l:3,k:"Webhooks",t:"Verify a delivery",s:"import express from \"express\"; import { Strix, WebhookSignatureError } from \"@strixhood/sdk\"; const app = express(); const strix = new Strix({ apiKey: process.env.STRIX_API_KEY! }); // raw body, not express.json() app.post(\"/hooks/strix\", express.raw({ type: \"",w:"process.env.strix_api_key express.json app.post express.raw application req res let event try strix.webhooks.verify payload req.body buffer signature req.header header strix-signature secret process.env.strix_webhook_se webhook cret toleranceseconds 300 catch err instanceof res.sendstatus sendstatus 400 throw 202 acknowledge first void queue.push queue push work fastapi request response backgroundtasks strixhood.errors errors api_key os.environ environ strix_api_key async def hook"},
    {p:"sdk.html",h:"webhooks-idempotent",l:3,k:"Webhooks",t:"Deduplicating deliveries",s:"Delivery is at-least-once and unordered. Two lines of defence cover both: dedupe on event.id , and treat the status machine as the source of truth rather than arrival order. Failure",w:"idempotent at-least-once event.id const rank received policy_check policy check awaiting_approval awaiting approval simulating routing submitted settled rejected failed expired cancelled async function handle strixevent await seen.has seen seen.add add ttlseconds 172_800 172 800 next event.data.object data object prev db.intents.get intents next.id out-of-order retry never move intent backwards next.status prev.status db.intents.upsert upsert realtime"},
    {p:"sdk.html",h:"sdk-errors",l:2,k:"Reliability",t:"Errors & retries",s:"Every SDK error carries the full API envelope — type , code , param , rule , requestId — and the classes map one-to-one onto the error-code table .",w:"one-to-one error-code reliability"},
    {p:"sdk.html",h:"errors-classes",l:3,k:"Errors & retries",t:"Error classes",s:"AuthenticationError AuthenticationError StrixError::Auth No PermissionError PermissionError StrixError::Permission No InvalidRequestError InvalidRequest StrixError::InvalidRequest No PolicyError PolicyError StrixError::Policy No SimulationError SimulationError",w:"typescript python rust variant retryable simulation routingerror routing sometimes quote_expired quote expired idempotencyerror idempotency ratelimiterror ratelimit yes apierror api connectionerror transport intentrejectederror intentrejected raised waitfor import strixhood sdk try await strix.intents.create strix intents create body catch err instanceof err.rule rule limits.daily_usd limits daily usd budget spent metrics.inc metrics inc policy_refusal refusal pauseuntilwindowresets"},
    {p:"sdk.html",h:"sdk-retries",l:3,k:"Errors & retries",t:"Retries",s:"Retries are automatic for 429 , 5xx and transport errors, with full-jitter exponential backoff that honours Retry-After . Everything else fails immediately, because retrying a policy refusal just refuses again. Retries and idempotency go together The SDK attac",w:"full-jitter retry-after const strix apikey process.env.strix_api_key process env api key maxretries basedelayms 250 maxdelayms 8_000 000 honourretryafter retryon err err.status status 500 call await strix.intents.create intents create body never strix.portfolio.get portfolio agentid read path harder attaches idempotency-key every post automatically reuses across retried submit second intent supply make unique logical operation reliability"},
    {p:"sdk.html",h:"sdk-timeouts",l:3,k:"Errors & retries",t:"Timeouts and cancellation",s:"Python uses timeout= plus asyncio.CancelledError ; Rust composes with tokio::select! and CancellationToken . In all three, cancelling a request that has already been accepted by the API does not cancel the intent — call intents.cancel() for that.",w:"sdk const abortcontroller settimeout ac.abort abort 5_000 000 await strix.quotes.create strix quotes create body signal ac.signal timeoutms 4_000 maxretries streams take aborting closes socket ends iterator evt strix.stream.executions stream executions asyncio.cancellederror intents.cancel reliability"},
    {p:"sdk.html",h:"sdk-logging",l:3,k:"Errors & retries",t:"Logging and tracing",s:"Log requestId on every response. It is the only identifier that resolves to the policy evaluation and simulation transcript on our side, and it is the first thing support asks for. End to end",w:"sdk const strix apikey process.env.strix_api_key process env api key onrequest method path attempt idempotencykey log.debug debug onresponse status durationms retrycount reliability"},
    {p:"sdk.html",h:"sdk-example",l:2,k:"Guides",t:"Worked example: DCA agent",s:"Build an agent that buys $150 of ETH every weekday at 09:00 UTC, never spends more than $250 in one intent or $1,000 in a day, escalates anything above $200 to a human, and stops itself if the policy it was issued under ever changes. Roughly 120 lines, no fram",w:"sdk framework guides"},
    {p:"sdk.html",h:"example-shape",l:3,k:"Worked example: DCA agent",t:"Shape of the program",s:"Splitting the write scopes matters. The DCA loop is the process most likely to be compromised — it is the one taking instructions from a schedule and a market — and it holds no authority to widen its own limits.",w:"key responsibility setup.ts setup run once sk_ policies agents creates policy registers binds dca.ts long-running long running intents read submits intent weekday follows settlement halts drift approve.ts approve watches human gate routes person guides"},
    {p:"sdk.html",h:"example-setup",l:3,k:"Worked example: DCA agent",t:"1. Policy and agent",s:"import { Strix } from \"@strixhood/sdk\"; const admin = new Strix({ apiKey: process.env.STRIX_ADMIN_KEY! }); // policies:write const policy = await admin.policies.create({ name: \"dca-eth-weekday\", limits: { perTxUsd: 250, dailyUsd: 1_000, monthlyUsd: 20_000, max",w:"setup process.env.strix_admin_key admin.policies.create dca-eth-weekday 1_000 20_000 maxopenintents gasbudgetdailyusd allow chains eip155 8453 actions swap tokens usdc weth venues uniswap_v4 uniswap aerodrome deny categories leverage gambling unverified_contract unverified contract low_liquidity low liquidity simulation requiresuccess maxpriceimpactbps minliquidityusd 500_000 500 hitl thresholdusd 200 channels webhook timeoutsec 600 ontimeout reject approvers process.env.approver_id approver quorum expiresat date"},
    {p:"sdk.html",h:"example-loop",l:3,k:"Worked example: DCA agent",t:"2. The loop",s:"Two things make this safe rather than merely automated. The idempotency key is derived from the calendar day, so a crash-restart at 09:00:03 cannot double-buy. And the policy hash is verified before every submission, so a policy rewritten out from under the ag",w:"crash-restart double-buy halts instead widening import strix policyerror intentrejectederror strixhood sdk const apikey process.env.strix_api_key process env api maxretries agent_id process.env.strix_agent_id pinned_policy_hash pinned process.env.strix_policy_has setup.ts setup daily_usd daily usd 150.00 150 refuse trade were reviewed against async function assertpolicyunchanged promise void await strix.agents.get agents expand agent.policy.hash strix.agents.update update status paused throw error drift"},
    {p:"sdk.html",h:"example-approval",l:3,k:"Worked example: DCA agent",t:"3. The human gate",s:"Anything over $200 pauses at awaiting_approval with a ten-minute clock and a fail-safe default. This worker turns that into a message a person can answer, and answers it back.",w:"awaiting_approval ten-minute fail-safe import strix strixhood sdk const apikey process.env.strix_approval_k process env await intent strix.stream.intents stream intents agentids process.env.strix_agent_id statuses diff intent.simulation.assetdiff simulation assetdiff map d.delta delta d.token token join decision ask title intent.agentid agentid intent.action action body notional intent.policy.notionalusd policy notionalusd usd impact intent.simulation.priceimpac priceimpac tbps bps expires intent.expiresat.toisostring expiresat toisostring"},
    {p:"sdk.html",h:"example-python",l:3,k:"Worked example: DCA agent",t:"The same loop in Python",s:"import asyncio, os from datetime import datetime, timezone from decimal import Decimal from strixhood import AsyncStrix from strixhood.errors import IntentRejected, PolicyError strix = AsyncStrix(api_key=os.environ[\"STRIX_API_KEY\"], max_retries=4) AGENT_ID = o",w:"strixhood.errors api_key os.environ strix_api_key max_retries agent_id strix_agent_id pinned_policy_hash pinned policy hash strix_policy_hash daily_usd daily usd 150.00 150 async def assert_policy_unchanged assert unchanged none await strix.agents.get agents expand agent.policy.hash strix.agents.update update status paused raise runtimeerror drift registry holds agent.status active buy_once buy once day str quote strix.quotes.create quotes create action swap chain eip155"},
    {p:"sdk.html",h:"example-checks",l:3,k:"Worked example: DCA agent",t:"What this buys you",s:"Test it before you fund it Run the whole thing against a strx_sk_test_ key on Base Sepolia first, then set simulateOnly: true on mainnet for a day and diff the quotes against what you expected. Only then remove the flag. Lookup",w:"checks failure happens scheduler fires twice second call replays idempotency intent buy process crashes mid-intent mid restart re-submits submits in-flight flight back resumes waiting someone widens policy hash mismatch next tick paused loop throws submitting model tricked larger reachable amount constant caps 250 regardless thin market moves quote check skips above bps"},
    {p:"sdk.html",h:"sdk-index",l:2,k:"Reference",t:"Method index",s:"Every method in the TypeScript client and the endpoint behind it. Python and Rust expose the same list under their own naming conventions.",w:"sdk scope ping health agents.create agents create post write agents.list listall read agents.get agents.update update patch agents.retire retire delete agents.sessionkeys.issue sessionkeys issue session-keys session keys agents.sessionkeys.revoke revoke keyid intents.create intents intents.get intents.list intents.cancel cancel intents.approve approve approval intents.waitfor waitfor stream poll policies.create policies policies.get policies.list policies.update policies.simulate simulate policies.hash hash local quotes.create quotes"}
  ];
  /* --- INDEX:END --- */
  D.index = INDEX;

  var PAGE_NAME = { 'docs.html': 'Documentation', 'api.html': 'API Reference', 'sdk.html': 'SDK Reference' };

  function refreshLocalIndex() {
    INDEX.forEach(function (e) {
      if (e.p !== page) return;
      var h = document.getElementById(e.h);
      if (!h) return;
      var txt = '', n = h.nextElementSibling, hop = 0;
      while (n && hop++ < 14 && !/^H[1-4]$/.test(n.tagName)) {
        if (n.classList && (n.classList.contains('dx-code') || n.classList.contains('dx-tw'))) { n = n.nextElementSibling; continue; }
        txt += ' ' + (n.textContent || '');
        if (txt.length > 340) break;
        n = n.nextElementSibling;
      }
      txt = txt.replace(/\s+/g, ' ').trim();
      if (txt.length > 30) e.s = txt.slice(0, 260);
      e.t = (h.getAttribute('data-nav') || h.textContent).replace(/#$/, '').trim();
      e.__lc = null;
    });
  }

  /* 0 = absent, 1 = matches mid-word ("rust" inside "trusted"),
     2 = matches at a word start. Mid-word hits still count, they just rank low. */
  function where(hay, q) {
    var i = hay.indexOf(q);
    if (i < 0) return 0;
    return i === 0 || !/[a-z0-9]/.test(hay.charAt(i - 1)) ? 2 : 1;
  }

  function score(entry, terms) {
    if (!entry.__lc) {
      entry.__lc = {
        t: entry.t.toLowerCase(),
        s: (entry.s || '').toLowerCase(),
        k: (entry.k || '').toLowerCase(),
        w: (entry.w || '').toLowerCase(),
        h: entry.h.replace(/-/g, ' ')
      };
    }
    var lc = entry.__lc, total = 0;
    for (var i = 0; i < terms.length; i++) {
      var q = terms[i], hit = 0;
      var ti = lc.t.indexOf(q);
      if (ti === 0) hit += 60; else if (ti > 0) hit += 34;
      hit += where(lc.h, q) * 6;          /* the anchor slug itself */
      hit += where(lc.k, q) * 7;          /* parent section title */
      hit += where(lc.s, q) * 5;          /* prose snippet */
      hit += where(lc.w, q) * 3;          /* table cells, enums, error codes */
      if (!hit) return 0;                 /* every term must land somewhere */
      total += hit;
    }
    if (entry.l === 2) total += 4;
    if (entry.p === page) total += 2;
    return total;
  }

  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (q) {
      if (q.length < 2) return;
      var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  function snippet(entry, terms) {
    var s = entry.s || '';
    if (!s) return '';
    var low = s.toLowerCase(), at = -1;
    for (var i = 0; i < terms.length && at < 0; i++) at = low.indexOf(terms[i]);
    if (at > 90) s = '…' + s.slice(at - 60);
    return s.slice(0, 180);
  }

  var so, sInput, sList, sResults = [], sSel = 0;

  function buildSearch() {
    if (so) return;
    so = document.createElement('div');
    so.className = 'dx-so';
    so.setAttribute('role', 'dialog');
    so.setAttribute('aria-modal', 'true');
    so.setAttribute('aria-label', 'Search the documentation');
    so.innerHTML =
      '<div class="dx-sp">' +
      '<div class="dx-sp__top">' +
      '<span class="sx-glyph sx-glyph--ring" aria-hidden="true"></span>' +
      '<input class="dx-sp__in" type="search" placeholder="Search intents, endpoints, policy fields…" ' +
      'aria-label="Search query" autocomplete="off" spellcheck="false">' +
      '<button class="dx-sp__esc" type="button">ESC</button>' +
      '</div>' +
      '<div class="dx-sp__list" role="listbox" aria-label="Search results"></div>' +
      '<div class="dx-sp__foot"><span><kbd>↑↓</kbd>navigate</span><span><kbd>↵</kbd>open</span>' +
      '<span><kbd>esc</kbd>close</span><span style="margin-left:auto">' + INDEX.length + ' indexed sections</span></div>' +
      '</div>';
    document.body.appendChild(so);
    sInput = $('.dx-sp__in', so);
    sList = $('.dx-sp__list', so);

    so.addEventListener('mousedown', function (e) { if (e.target === so) D.closeSearch(); });
    $('.dx-sp__esc', so).addEventListener('click', function () { D.closeSearch(); });
    sInput.addEventListener('input', function () { run(sInput.value); });
    sInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(sResults[sSel]); }
      else if (e.key === 'Escape') { e.preventDefault(); D.closeSearch(); }
    });
    sList.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('.dx-sr') : null;
      if (!a) return;
      e.preventDefault();
      go(sResults[+a.getAttribute('data-i')]);
    });
  }

  function move(d) {
    if (!sResults.length) return;
    sSel = (sSel + d + sResults.length) % sResults.length;
    $$('.dx-sr', sList).forEach(function (n, i) {
      var on = i === sSel;
      n.classList.toggle('is-sel', on);
      n.setAttribute('aria-selected', String(on));
      if (on) n.scrollIntoView({ block: 'nearest' });
    });
  }

  function go(entry) {
    if (!entry) return;
    D.closeSearch();
    if (entry.p === page) {
      var t = document.getElementById(entry.h);
      if (t) {
        history.pushState(null, '', '#' + entry.h);
        S.scrollTo(t, LAND);
        return;
      }
    }
    location.href = entry.p + '#' + entry.h;
  }

  function run(q) {
    q = (q || '').trim().toLowerCase();
    var terms = q.split(/\s+/).filter(function (x) { return x.length > 0; });
    if (!terms.length) {
      sResults = INDEX.filter(function (e) { return e.l === 2; }).slice(0, 14);
      render(terms, 'Start typing — or jump to a top-level section');
      return;
    }
    sResults = INDEX
      .map(function (e) { return { e: e, v: score(e, terms) }; })
      .filter(function (x) { return x.v > 0; })
      .sort(function (a, b) { return b.v - a.v; })
      .slice(0, 26)
      .map(function (x) { return x.e; });
    render(terms);
  }

  function render(terms, heading) {
    sSel = 0;
    if (!sResults.length) {
      sList.innerHTML = '<p class="dx-sp__empty">No section matches that. Try <code>policy</code>, ' +
        '<code>webhook</code>, <code>slippage</code> or <code>slashing</code>.</p>';
      return;
    }
    // Regroup by page while keeping the strongest page first and the
    // ranking intact inside each group, so headers never repeat.
    var order = [], buckets = {};
    sResults.forEach(function (e) {
      if (!buckets[e.p]) { buckets[e.p] = []; order.push(e.p); }
      buckets[e.p].push(e);
    });
    var flat = [];
    order.forEach(function (p) { buckets[p].forEach(function (e) { flat.push(e); }); });
    sResults = flat;

    var html = '', lastPage = null;
    sResults.forEach(function (e, i) {
      if (e.p !== lastPage) {
        lastPage = e.p;
        html += '<div class="dx-sp__grp">' + esc(PAGE_NAME[e.p] || e.p) + '</div>';
      }
      html += '<a class="dx-sr' + (i === 0 ? ' is-sel' : '') + '" role="option" aria-selected="' + (i === 0) +
        '" data-i="' + i + '" href="' + e.p + '#' + e.h + '">' +
        '<b>' + mark(e.t, terms) + '</b>' +
        (e.s ? '<p>' + mark(snippet(e, terms), terms) + '</p>' : '') +
        '<u>' + esc(e.k || '') + (e.k ? ' · ' : '') + esc(PAGE_NAME[e.p] || e.p) + '</u>' +
        '</a>';
    });
    sList.innerHTML = (heading ? '<div class="dx-sp__grp">' + esc(heading) + '</div>' : '') + html;
  }

  D.openSearch = function (seed) {
    buildSearch();
    so.classList.add('is-on');
    document.body.classList.add('sx-lock');
    sInput.value = seed || '';
    run(sInput.value);
    setTimeout(function () { sInput.focus(); sInput.select(); }, 30);
  };
  D.closeSearch = function () {
    if (!so) return;
    so.classList.remove('is-on');
    document.body.classList.remove('sx-lock');
  };

  /* ============================================================
     7. CHROME — mobile drawer, inline copy, deep links
     ============================================================ */
  var scrim;
  function closeRail() {
    var rail = $('#dx-rail');
    if (rail) rail.classList.remove('is-open');
    if (scrim) scrim.classList.remove('is-on');
    var b = $('#dx-menubtn');
    if (b) b.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sx-lock');
  }

  function initChrome() {
    var btn = $('#dx-menubtn'), rail = $('#dx-rail');
    if (btn && rail) {
      scrim = document.createElement('div');
      scrim.className = 'dx-scrim';
      document.body.appendChild(scrim);
      scrim.addEventListener('click', closeRail);
      btn.addEventListener('click', function () {
        var open = !rail.classList.contains('is-open');
        rail.classList.toggle('is-open', open);
        scrim.classList.toggle('is-on', open);
        btn.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('sx-lock', open);
      });
    }

    $$('.dx-searchbtn').forEach(function (b) {
      b.addEventListener('click', function () { D.openSearch(); });
    });

    // In-page anchors, captured before Strix.initNav sees them. The shell uses
    // history.replaceState for hash links, which is right for a landing page and
    // wrong for a long reference: Back should return you to the section you came
    // from, not to the previous document. pushState here, restore on hashchange.
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a || !a.closest('#dx-rail,#dx-toc,.dx-body')) return;
      var id = a.getAttribute('href').slice(1);
      if (!id) return;
      var t = document.getElementById(id);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
      S.scrollTo(t, LAND);
      closeRail();
    }, true);

    global.addEventListener('hashchange', function () {
      var id = location.hash.slice(1);
      if (!id) return;
      var t = document.getElementById(id);
      if (t) S.scrollTo(t, LAND);
    });
    global.addEventListener('popstate', function () {
      if (!location.hash) global.scrollTo({ top: 0, behavior: S.reduced ? 'auto' : 'smooth' });
    });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); D.openSearch();
      } else if (e.key === 'Escape') {
        closeRail();
        if (so && so.classList.contains('is-on')) D.closeSearch();
      } else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) && !e.target.isContentEditable) {
        e.preventDefault(); D.openSearch();
      }
    });

    // inline copy chips (contract addresses, keys)
    $$('[data-dxcopy]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.copy(b.getAttribute('data-dxcopy'), b.getAttribute('data-dxlabel') || 'Copied');
        b.classList.add('is-done');
        clearTimeout(b.__t);
        b.__t = setTimeout(function () { b.classList.remove('is-done'); }, 1600);
      });
    });
  }

  function anchors() {
    $$('.dx-body h2[id],.dx-body h3[id],.dx-body h4[id]').forEach(function (h) {
      if ($('.dx-anchor', h)) return;
      var a = document.createElement('a');
      a.className = 'dx-anchor';
      a.href = '#' + h.id;
      a.setAttribute('data-offset', String(LAND));
      a.setAttribute('aria-label', 'Link to “' + h.textContent.trim() + '”');
      a.textContent = '#';
      h.appendChild(a);
    });
  }

  function landOnHash() {
    if (!location.hash || location.hash.length < 2) return;
    var t;
    try { t = document.querySelector(location.hash); } catch (e) { return; }
    if (!t) return;

    // Late layout (web fonts resolving, a stylesheet arriving) can shift a deep
    // anchor after the first jump. Keep correcting until the heading sits at the
    // reading line, then stop — and stop immediately if the reader takes over.
    var deadline = Date.now() + 900, touched = false;
    var release = function () { touched = true; done(); };
    function done() {
      global.removeEventListener('wheel', release);
      global.removeEventListener('touchstart', release);
      global.removeEventListener('keydown', release);
    }
    global.addEventListener('wheel', release, { passive: true });
    global.addEventListener('touchstart', release, { passive: true });
    global.addEventListener('keydown', release);

    (function correct() {
      if (touched) return;
      var delta = t.getBoundingClientRect().top - LAND;
      if (Math.abs(delta) > 1) {
        global.scrollTo({ top: Math.max(0, (global.scrollY || 0) + delta), behavior: 'auto' });
        if (D.remeasure) D.remeasure();
      }
      if (Date.now() < deadline) setTimeout(correct, 60); else done();
    })();
  }

  /* ============================================================
     8. BOOT — runs at parse time; <main> is already in the DOM
     ============================================================ */
  var booted = false;
  D.init = function () {
    if (booted || !$('.dx-body')) return;
    booted = true;
    var tree = outline();
    D.tree = tree;
    D.enhanceCode();
    D.initTabs();
    D.buildRail(tree);
    D.buildTOC(tree);
    anchors();
    refreshLocalIndex();
    initChrome();
    D.spy(tree);
    landOnHash();
  };

  // This script sits at the end of <body>, so the content is already parsed:
  // initialising now means the rail/outline anchors exist before Strix.page()
  // runs and wires in-page links. The listener is only a safety net for the
  // case where the script is moved into <head>.
  D.init();
  if (!booted) document.addEventListener('DOMContentLoaded', D.init);

})(window);
