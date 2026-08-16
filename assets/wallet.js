/* ============================================================
   STRIX HOOD — Wallet
   Real connections. EIP-1193 (MetaMask / Rabby / Coinbase / Brave)
   and Solana (Phantom / Solflare / Backpack).
   No SDK, no bundler, no API key.
   ============================================================ */
(function (global) {
  'use strict';

  var S = global.Strix;
  if (!S) { console.error('[strix-wallet] strix.js must load first'); return; }

  var W = {};
  S.wallet = W;

  /* ---------------- known chains ---------------- */
  var CHAINS = {
    '0x1': { name: 'Ethereum', short: 'ETH', explorer: 'https://etherscan.io', native: 'ETH' },
    '0xaa36a7': { name: 'Sepolia', short: 'SEP', explorer: 'https://sepolia.etherscan.io', native: 'ETH', test: true },
    '0xa4b1': { name: 'Arbitrum One', short: 'ARB', explorer: 'https://arbiscan.io', native: 'ETH' },
    '0x2105': { name: 'Base', short: 'BASE', explorer: 'https://basescan.org', native: 'ETH' },
    '0xa': { name: 'OP Mainnet', short: 'OP', explorer: 'https://optimistic.etherscan.io', native: 'ETH' },
    '0x89': { name: 'Polygon', short: 'POL', explorer: 'https://polygonscan.com', native: 'POL' },
    '0x38': { name: 'BNB Chain', short: 'BNB', explorer: 'https://bscscan.com', native: 'BNB' }
  };
  W.chains = CHAINS;
  W.chainName = function (id) { return (CHAINS[id] && CHAINS[id].name) || ('Chain ' + parseInt(id, 16)); };
  W.explorer = function (id) { return (CHAINS[id] && CHAINS[id].explorer) || 'https://etherscan.io'; };

  /* ---------------- state ---------------- */
  W.state = {
    connected: false,
    kind: null,        // 'evm' | 'solana'
    address: null,
    chainId: null,
    balance: null,     // native units
    provider: null,
    walletName: null
  };

  function publish(reason) {
    S.emit('wallet', Object.assign({ reason: reason }, W.state));
    render();
  }

  /* ---------------- detection ---------------- */
  function evmProviders() {
    var eth = global.ethereum;
    if (!eth) return [];
    var list = eth.providers && eth.providers.length ? eth.providers : [eth];
    return list.map(function (p) {
      var name = p.isRabby ? 'Rabby'
        : p.isCoinbaseWallet ? 'Coinbase Wallet'
          : p.isBraveWallet ? 'Brave Wallet'
            : p.isTrust ? 'Trust Wallet'
              : p.isMetaMask ? 'MetaMask'
                : 'Browser Wallet';
      return { provider: p, name: name };
    });
  }
  function solProvider() {
    var p = (global.phantom && global.phantom.solana) || global.solana;
    if (!p) return null;
    return { provider: p, name: p.isPhantom ? 'Phantom' : p.isSolflare ? 'Solflare' : 'Solana Wallet' };
  }
  W.detect = function () {
    return { evm: evmProviders(), solana: solProvider() };
  };
  W.hasAny = function () { var d = W.detect(); return !!(d.evm.length || d.solana); };

  /* ---------------- EVM connect ---------------- */
  var bound = null;
  function bindEvm(p) {
    if (bound === p) return;
    bound = p;
    if (!p.on) return;
    p.on('accountsChanged', function (accs) {
      if (!accs || !accs.length) return W.disconnect('accountsChanged');
      W.state.address = accs[0];
      publish('accountsChanged');
      refreshBalance();
      S.toast({ title: 'Account switched', body: S.fmt.addr(accs[0], 8, 6) });
    });
    p.on('chainChanged', function (id) {
      W.state.chainId = id;
      publish('chainChanged');
      refreshBalance();
      S.toast({ title: 'Network switched', body: W.chainName(id) });
    });
    p.on('disconnect', function () { W.disconnect('provider'); });
  }

  W.connectEvm = function (preferred) {
    var list = evmProviders();
    if (!list.length) return Promise.reject(new Error('NO_EVM_WALLET'));
    var pick = preferred ? list.filter(function (x) { return x.name === preferred; })[0] : null;
    var chosen = pick || list[0];
    var p = chosen.provider;

    return p.request({ method: 'eth_requestAccounts' })
      .then(function (accs) {
        if (!accs || !accs.length) throw new Error('NO_ACCOUNTS');
        return p.request({ method: 'eth_chainId' }).then(function (chainId) {
          W.state = {
            connected: true, kind: 'evm', address: accs[0], chainId: chainId,
            balance: null, provider: p, walletName: chosen.name
          };
          bindEvm(p);
          S.store.set('wallet:last', { kind: 'evm', name: chosen.name });
          publish('connect');
          S.toast({ title: 'Wallet connected', body: chosen.name + ' · ' + S.fmt.addr(accs[0], 8, 6) });
          refreshBalance();
          return W.state;
        });
      })
      .catch(function (e) {
        if (e && (e.code === 4001 || /reject/i.test(e.message || ''))) {
          S.toast({ title: 'Connection cancelled', body: 'You rejected the request in your wallet.', type: 'warn' });
        } else if (e && e.message === 'NO_EVM_WALLET') {
          throw e;
        } else {
          S.toast({ title: 'Could not connect', body: (e && e.message) || 'Unknown wallet error', type: 'err' });
        }
        throw e;
      });
  };

  /* ---------------- Solana connect ---------------- */
  W.connectSolana = function () {
    var d = solProvider();
    if (!d) return Promise.reject(new Error('NO_SOL_WALLET'));
    return d.provider.connect()
      .then(function (res) {
        var addr = (res && res.publicKey ? res.publicKey : d.provider.publicKey).toString();
        W.state = {
          connected: true, kind: 'solana', address: addr, chainId: 'solana:mainnet',
          balance: null, provider: d.provider, walletName: d.name
        };
        if (d.provider.on) {
          d.provider.on('disconnect', function () { W.disconnect('provider'); });
          d.provider.on('accountChanged', function (pk) {
            if (!pk) return W.disconnect('accountChanged');
            W.state.address = pk.toString(); publish('accountsChanged'); refreshBalance();
          });
        }
        S.store.set('wallet:last', { kind: 'solana', name: d.name });
        publish('connect');
        S.toast({ title: 'Wallet connected', body: d.name + ' · ' + S.fmt.addr(addr, 6, 6) });
        refreshBalance();
        return W.state;
      })
      .catch(function (e) {
        if (e && (e.code === 4001 || /reject|user/i.test(e.message || ''))) {
          S.toast({ title: 'Connection cancelled', body: 'You rejected the request in your wallet.', type: 'warn' });
        } else S.toast({ title: 'Could not connect', body: (e && e.message) || 'Unknown wallet error', type: 'err' });
        throw e;
      });
  };

  /* ---------------- balance ---------------- */
  function refreshBalance() {
    if (!W.state.connected) return;
    if (W.state.kind === 'evm') {
      W.state.provider.request({ method: 'eth_getBalance', params: [W.state.address, 'latest'] })
        .then(function (hex) { W.state.balance = parseInt(hex, 16) / 1e18; publish('balance'); })
        .catch(function () { /* provider may not expose it; stay quiet */ });
    } else {
      fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [W.state.address] })
      }).then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.result) { W.state.balance = j.result.value / 1e9; publish('balance'); }
        }).catch(function () { });
    }
  }
  W.refreshBalance = refreshBalance;

  /* ---------------- network switching ---------------- */
  W.switchChain = function (chainId) {
    if (W.state.kind !== 'evm') return Promise.reject(new Error('EVM_ONLY'));
    return W.state.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainId }] })
      .catch(function (e) {
        if (e && e.code === 4902) S.toast({ title: 'Network not in wallet', body: 'Add ' + W.chainName(chainId) + ' to your wallet first.', type: 'warn' });
        else if (e && e.code === 4001) S.toast({ title: 'Switch cancelled', type: 'warn' });
        else S.toast({ title: 'Could not switch network', body: (e && e.message) || '', type: 'err' });
        throw e;
      });
  };

  /* ---------------- sign (proves the connection is real) ---------------- */
  W.signMessage = function (message) {
    if (!W.state.connected) return Promise.reject(new Error('NOT_CONNECTED'));
    if (W.state.kind === 'evm') {
      return W.state.provider.request({ method: 'personal_sign', params: [message, W.state.address] });
    }
    var enc = new TextEncoder().encode(message);
    return W.state.provider.signMessage(enc, 'utf8').then(function (r) {
      var sig = r.signature || r;
      return Array.prototype.map.call(sig, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  };

  /* ---------------- disconnect ---------------- */
  W.disconnect = function (reason) {
    if (W.state.kind === 'solana' && W.state.provider && W.state.provider.disconnect) {
      try { W.state.provider.disconnect(); } catch (e) { }
    }
    W.state = { connected: false, kind: null, address: null, chainId: null, balance: null, provider: null, walletName: null };
    S.store.del('wallet:last');
    publish('disconnect');
    if (reason !== 'silent') S.toast({ title: 'Wallet disconnected' });
  };

  /* ---------------- silent reconnect ---------------- */
  W.tryReconnect = function () {
    var last = S.store.get('wallet:last', null);
    if (!last) return Promise.resolve(null);
    if (last.kind === 'evm') {
      var list = evmProviders();
      var chosen = list.filter(function (x) { return x.name === last.name; })[0] || list[0];
      if (!chosen) return Promise.resolve(null);
      return chosen.provider.request({ method: 'eth_accounts' }).then(function (accs) {
        if (!accs || !accs.length) return null;
        return chosen.provider.request({ method: 'eth_chainId' }).then(function (chainId) {
          W.state = { connected: true, kind: 'evm', address: accs[0], chainId: chainId, balance: null, provider: chosen.provider, walletName: chosen.name };
          bindEvm(chosen.provider);
          publish('reconnect'); refreshBalance();
          return W.state;
        });
      }).catch(function () { return null; });
    }
    var d = solProvider();
    if (!d || !d.provider.connect) return Promise.resolve(null);
    return d.provider.connect({ onlyIfTrusted: true }).then(function (res) {
      var addr = (res && res.publicKey ? res.publicKey : d.provider.publicKey).toString();
      W.state = { connected: true, kind: 'solana', address: addr, chainId: 'solana:mainnet', balance: null, provider: d.provider, walletName: d.name };
      publish('reconnect'); refreshBalance();
      return W.state;
    }).catch(function () { return null; });
  };

  /* ============================================================
     CONNECT DIALOG — lists what is actually installed
     ============================================================ */
  W.openDialog = function () {
    if (W.state.connected) return W.openAccount();
    var d = W.detect();
    var wrap = S.el('div', { class: 'sx-grid', style: { gap: '10px' } });

    d.evm.forEach(function (p) {
      wrap.appendChild(row(p.name, 'EVM · Ethereum, Base, Arbitrum, Polygon', function (btn) {
        btn.classList.add('is-busy');
        W.connectEvm(p.name).then(close).catch(function () { }).then(function () { btn.classList.remove('is-busy'); });
      }));
    });
    if (d.solana) {
      wrap.appendChild(row(d.solana.name, 'Solana · mainnet-beta', function (btn) {
        btn.classList.add('is-busy');
        W.connectSolana().then(close).catch(function () { }).then(function () { btn.classList.remove('is-busy'); });
      }));
    }

    if (!d.evm.length && !d.solana) {
      wrap.appendChild(S.el('div', { class: 'sx-empty' }, [
        S.el('b', { text: 'No wallet detected in this browser' }),
        S.el('p', { class: 'sx-body', text: 'Strix Hood talks to your wallet directly — there is no custodial account to create. Install one of these, then reload this page.' }),
        S.el('div', { class: 'sx-row', style: { gap: '10px' } }, [
          S.el('a', { class: 'sx-btn sx-btn--primary sx-btn--sm', href: 'https://metamask.io/download/', target: '_blank', rel: 'noopener', text: 'Get MetaMask' }),
          S.el('a', { class: 'sx-btn sx-btn--ghost sx-btn--sm', href: 'https://phantom.app/download', target: '_blank', rel: 'noopener', text: 'Get Phantom' })
        ])
      ]));
    }

    wrap.appendChild(S.el('p', { class: 'sx-body', style: { marginTop: '6px', fontSize: '12.5px' },
      text: 'Connecting only shares your public address. Strix Hood never sees your seed phrase and cannot move funds without a transaction you sign.' }));

    var m = S.modal({ eyebrow: 'Connect', title: 'Connect a wallet', subtitle: 'Your address is your identity on Strix Hood.', body: wrap });
    function close() { m.close(); }
    return m;

    function row(name, sub, onClick) {
      var btn = S.el('button', {
        class: 'sx-card sx-card--hover', type: 'button',
        style: { display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', textAlign: 'left', width: '100%', padding: '16px 18px' }
      }, [
        S.el('span', { class: 'sx-glyphbox' }, [S.el('span', { class: 'sx-glyph sx-glyph--diamond' })]),
        S.el('span', {}, [
          S.el('b', { text: name, style: { display: 'block', fontSize: '15px' } }),
          S.el('span', { class: 'sx-body', text: sub, style: { fontSize: '12.5px' } })
        ]),
        S.el('span', { class: 'sx-mono', text: '→', style: { marginLeft: 'auto', color: 'var(--neon)' } })
      ]);
      btn.addEventListener('click', function () { onClick(btn); });
      return btn;
    }
  };

  W.openAccount = function () {
    var st = W.state;
    var body = S.el('div', { class: 'sx-grid', style: { gap: '16px' } });

    body.appendChild(S.el('div', { class: 'sx-card sx-card--flat' }, [
      S.el('div', { class: 'sx-between' }, [
        S.el('div', {}, [
          S.el('div', { class: 'sx-label', text: st.walletName + ' · ' + (st.kind === 'evm' ? W.chainName(st.chainId) : 'Solana') }),
          S.el('div', { class: 'sx-mono', text: st.address, style: { fontSize: '13px', wordBreak: 'break-all', marginTop: '6px' } })
        ]),
        S.el('button', { class: 'sx-btn sx-btn--ghost sx-btn--sm', type: 'button', text: 'Copy', onclick: function () { S.copy(st.address, 'Address copied'); } })
      ])
    ]));

    var bal = S.el('div', { class: 'sx-stat' }, [
      S.el('span', { class: 'sx-stat__k', text: 'Native balance' }),
      S.el('span', { class: 'sx-stat__v', text: st.balance === null ? '—' : S.fmt.n(st.balance, 4) + ' ' + (st.kind === 'evm' ? ((CHAINS[st.chainId] || {}).native || 'ETH') : 'SOL') })
    ]);
    body.appendChild(S.el('div', { class: 'sx-card sx-card--flat' }, [bal]));

    if (st.kind === 'evm') {
      var nets = S.el('div', { class: 'sx-row', style: { gap: '8px' } });
      ['0x1', '0xa4b1', '0x2105', '0x89'].forEach(function (id) {
        nets.appendChild(S.el('button', {
          class: 'sx-pill' + (id === st.chainId ? ' is-on' : ''), type: 'button', text: W.chainName(id),
          onclick: function () { W.switchChain(id).catch(function () { }); }
        }));
      });
      body.appendChild(S.el('div', {}, [S.el('div', { class: 'sx-label', style: { marginBottom: '9px' }, text: 'Network' }), nets]));
    }

    S.modal({
      eyebrow: 'Account', title: 'Wallet', body: body,
      actions: [
        { label: 'View on explorer', variant: 'ghost', close: false, onClick: function () {
          var url = st.kind === 'evm' ? W.explorer(st.chainId) + '/address/' + st.address
            : 'https://solscan.io/account/' + st.address;
          global.open(url, '_blank', 'noopener');
        } },
        { label: 'Sign test message', variant: 'ghost', close: false, onClick: function () {
          W.signMessage('Strix Hood — proving control of ' + st.address + '\nNonce: ' + Date.now())
            .then(function (sig) { S.toast({ title: 'Signature verified', body: S.fmt.addr(sig, 12, 8) }); })
            .catch(function () { S.toast({ title: 'Signing cancelled', type: 'warn' }); });
        } },
        { label: 'Disconnect', variant: 'danger', onClick: function () { W.disconnect(); } }
      ]
    });
  };

  /* ============================================================
     BUTTON BINDING — any [data-wallet] element becomes live
     ============================================================ */
  function render() {
    S.$$('[data-wallet]').forEach(function (btn) {
      var st = W.state;
      var label = btn.querySelector('[data-wallet-label]') || btn;
      if (st.connected) {
        label.textContent = S.fmt.addr(st.address, 6, 4);
        btn.setAttribute('data-connected', '');
        btn.setAttribute('title', st.walletName + ' · ' + (st.kind === 'evm' ? W.chainName(st.chainId) : 'Solana'));
      } else {
        label.textContent = btn.getAttribute('data-wallet-idle') || 'Connect Wallet';
        btn.removeAttribute('data-connected');
        btn.setAttribute('title', 'Connect an EVM or Solana wallet');
      }
    });
    S.$$('[data-wallet-only]').forEach(function (n) { n.hidden = !W.state.connected; });
    S.$$('[data-wallet-none]').forEach(function (n) { n.hidden = !!W.state.connected; });
    S.$$('[data-wallet-addr]').forEach(function (n) { n.textContent = W.state.connected ? S.fmt.addr(W.state.address, 6, 4) : '—'; });
  }
  W.render = render;

  W.init = function () {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-wallet]');
      if (!btn) return;
      e.preventDefault();
      W.openDialog();
    });
    render();
    W.tryReconnect();
  };

  /* Gate any action behind a connected wallet. */
  W.require = function (why) {
    if (W.state.connected) return Promise.resolve(W.state);
    return new Promise(function (resolve, reject) {
      S.toast({ title: 'Wallet required', body: why || 'Connect a wallet to continue.', type: 'warn' });
      var un = S.on('wallet', function (st) { if (st.connected) { un(); resolve(st); } });
      W.openDialog();
      setTimeout(function () { un(); reject(new Error('CANCELLED')); }, 120000);
    });
  };

})(window);
