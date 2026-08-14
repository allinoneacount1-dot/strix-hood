# Strix Hood App + Admin Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two dc-runtime single-file dashboards (`app.dc.html`, `admin.dc.html`) for Strix Hood — user agent-control console and protocol admin monitor — sharing the existing `support.js`, with hybrid data (CoinGecko free API + live simulation).

**Architecture:** Each dashboard is a self-contained `.dc.html` file following the exact pattern of `index.html`: an `<x-dc>` template block (sc-if/sc-else, inline styles) + a `<script type="text/x-dc" data-dc-script data-props="...">` block defining `class Component extends DCLogic` with `state`, methods, and a `render()` method returning a props object. `support.js` bootstraps automatically. No build step; deploy static to Vercel.

**Tech Stack:** dc-runtime (React inline, `support.js`), Space Grotesk + JetBrains Mono (Google Fonts), CoinGecko free API (`api.coingecko.com/api/v3`), custom SVG/canvas charts, vanilla JS simulation engine.

## Global Constraints

- Palet: Void Black `#0A0A0F`, Robinhood Green `#00C805`, Emerald Pulse `#2EDA12`, Teal Surge `#00E5A0`, Plasma White `#F5F5F7`, Neural Gray `#8A8B9E`, Crimson Alert `#FF5000`, Amber Signal `#FF9900`, Deep Forest `#0D1F0D`, Glass Border `rgba(0,200,5,0.15)`.
- Fonts: Space Grotesk (display/UI) + JetBrains Mono (data, `font-variant-numeric: tabular-nums`). Load via Google Fonts `<link>` persis seperti `index.html:14-16`.
- Zero build step, zero dependency eksternal selain Google Fonts. No icon packs — custom geometric glyphs (circle/diamond/ring/dashed-circle) via inline SVG.
- No centered body text. No `transition: all`. No pure `#000`/`#fff`. No random spacing — use `clamp()`.
- `prefers-reduced-motion` dihormati: semua animasi degrade ke simple fade.
- Custom cursor (blend-difference, membesar di elemen interaktif) — pola dari `index.html` `initCursor()`.
- Grain overlay 3%, ambient green glow, glass cards (`rgba(13,31,13,0.4)` + `backdrop-filter: blur(20px)` + border `rgba(0,200,5,0.2)`).
- Sidebar kiri (desktop) → bottom nav (mobile). Konten pakai `.shell`-style padding `clamp(20px,4vw,56px)`.
- Semua angka monospace tabular. Status pill: Live (hijau), Warning (amber), Error (crimson).
- CoinGecko: cache harga 60s, rate limit dihormati, fallback ke nilai terakhir saat fetch gagal.
- File pattern wajib: `<script src="./support.js"></script>` di `<head>` (lihat `index.html:6`), `<x-dc>` template, lalu `<script type="text/x-dc" data-dc-script data-props="...">` dengan `class Component extends DCLogic` dan `render()` di akhir.
- Commit message style: `feat: ...` / `chore: ...` (lihat git log).

---

### Task 1: App Dashboard — Shell + Design System + Data Layer

**Files:**
- Create: `D:\0pencode\strix-hood\app.dc.html`

**Interfaces:**
- Consumes: `support.js` (existing, unchanged), Google Fonts (Space Grotesk + JetBrains Mono).
- Produces: `app.dc.html` dengan `class Component extends DCLogic` yang punya: `state.view` (string: "overview"|"agents"|"portfolio"|"transactions"|"policy"|"settings"), `state.prices` (object `{btc,eth,sol,strx}`), `state.holdings`, `state.agents`, `state.txFeed`, `state.policy`, method `fetchPrices()`, method `simTick()`, method `render()`.

- [ ] **Step 1: Scaffold file + head + shell**

Buat `app.dc.html` dengan struktur persis `index.html`:
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Strix Hood — App</title>
<script src="./support.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  /* base reset, body bg #0A0A0F, color #F5F5F7, font Space Grotesk */
  /* .shell { width:100%; max-width:1280px; margin-inline:auto; padding-inline:clamp(20px,4vw,56px); } */
  /* grain overlay ::after fixed, opacity .03 */
  /* custom cursor #cur fixed 8px dot #00C805, blend-difference */
  /* sidebar: fixed left 240px, border-right 1px solid rgba(0,200,5,.1), backdrop blur */
  /* bottom nav: hidden desktop, fixed bottom mobile */
  /* glass card, pill button, status pill, table, slider, toggle styles */
  /* @media (max-width:900px) sidebar->bottom nav */
</style>
</head>
<body>
<div id="cur"></div>
<x-dc>
  <!-- template: sidebar + main content, sc-if per view -->
</x-dc>
<script type="text/x-dc" data-dc-script data-props="{&quot;preloader&quot;:{&quot;editor&quot;:&quot;boolean&quot;,&quot;default&quot;:true,&quot;tsType&quot;:&quot;boolean&quot;,&quot;section&quot;:&quot;Experience&quot;},&quot;customCursor&quot;:{&quot;editor&quot;:&quot;boolean&quot;,&quot;default&quot;:true,&quot;tsType&quot;:&quot;boolean&quot;,&quot;section&quot;:&quot;Experience&quot;}}">
class Component extends DCLogic {
  state = { view: "overview", prices: { btc: 0, eth: 0, sol: 0, strx: 0 }, ... };
  // methods...
  render() { return { ... }; }
}
</script>
</body>
</html>
```

- [ ] **Step 2: Data layer — CoinGecko fetch + sim engine**

```js
async fetchPrices() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true");
    const j = await r.json();
    this.setState(s => ({ prices: { ...s.prices, btc: j.bitcoin.usd, eth: j.ethereum.usd, sol: j.solana.usd, btcChg: j.bitcoin.usd_24h_change, ethChg: j.ethereum.usd_24h_change, solChg: j.solana.usd_24h_change } }));
  } catch { /* keep last values */ }
}
simTick() {
  // random-walk ter-constrain: volume, agent aktif, feed — update tiap 1s via setInterval
  // push ke state.txFeed (max 8 item), rotasi activity feed
}
```
- Panggil `this.fetchPrices()` di `componentDidMount`-equivalent (lihat pola `index.html` lifecycle — `init()`/`componentDidMount`), ulangi tiap 60s. `simTick()` tiap 1000ms. Bersihkan interval di unmount.

- [ ] **Step 3: Sidebar + view switching**

Sidebar: logo STRIX HOOD (diamond di "i", gradient hijau), nav items Overview/Agents/Portfolio/Transactions/Policy/Settings dengan geometric glyph, active state hijau + border-left. Klik → `setState({view})`. Mobile: bottom nav 6 item. Template pakai `sc-if value="{{ view === 'overview' }}"` dst.

- [ ] **Step 4: Verify render + commit**

Run: buka `app.dc.html` via `npx serve` atau langsung file:// — pastikan sidebar render, view switch jalan, tidak ada console error.
Commit:
```bash
git add app.dc.html
git commit -m "feat: app dashboard shell + data layer"
```

---

### Task 2: App Dashboard — Overview + Agents Views

**Files:**
- Modify: `D:\0pencode\strix-hood\app.dc.html`

**Interfaces:**
- Consumes: Task 1 shell (`state.view`, `state.prices`, `state.agents`, `state.txFeed`, `simTick()`).
- Produces: Overview view (portfolio value live, agent ringkasan, activity feed, quick stats) + Agents view (kartu agent, detail panel).

- [ ] **Step 1: Overview view**

- Portfolio value = Σ(holdings × harga live CoinGecko), P&L 24h hijau/merah (pakai `*Chg`).
- Quick stats row: avg execution 0.3s, success rate 99.7%, monthly spend (sim live).
- Agent ringkasan: 2-3 kartu kecil (status Live pulse dot, revenue).
- Activity feed live: rotasi tiap 3s (intent diterima → policy check → eksekusi), mono font, feed dari `state.txFeed`.

- [ ] **Step 2: Agents view**

- Grid kartu agent (dari `state.agents`, 4-6 agent): nama, type, status pill, reputasi, revenue, transactions, geometric avatar (SVG abstract per category).
- Hover: lift -4px + border glow. Klik: panel detail (capabilities, spending, recent tx) — modal glassmorphic.

- [ ] **Step 3: Verify + commit**

Run: buka di browser, cek Overview & Agents render, feed berputar, harga live muncul (atau fallback).
Commit:
```bash
git add app.dc.html
git commit -m "feat: app overview + agents views"
```

---

### Task 3: App Dashboard — Portfolio + Transactions Views

**Files:**
- Modify: `D:\0pencode\strix-hood\app.dc.html`

**Interfaces:**
- Consumes: Task 1-2 (`state.prices`, `state.holdings`, `state.txFeed`).
- Produces: Portfolio view (donut allocation, holdings list, sparkline) + Transactions view (tabel live).

- [ ] **Step 1: Portfolio view**

- Allocation donut: SVG stroke-dasharray 5 segmen (BTC/ETH/SOL/STRX/Cash) warna palet hijau/teal/amber/white. Hover segmen: scale 1.05 + tooltip %.
- Holdings list: asset, qty, harga live, value, P&L — mono tabular.
- Sparkline 7d: fetch `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7` (cache 60s), gambar canvas kecil custom (Emerald Pulse).

- [ ] **Step 2: Transactions view**

- Tabel: status pill (Live/Warning/Error), hash mono (`0x...`), arah (in/out), jumlah, waktu.
- Live feed: baris baru muncul tiap 3-5s dari `simTick()`, max 10 baris, fade-in.

- [ ] **Step 3: Verify + commit**

Run: cek donut render, sparkline muncul, tabel feed bertambah.
Commit:
```bash
git add app.dc.html
git commit -m "feat: app portfolio + transactions views"
```

---

### Task 4: App Dashboard — Policy + Settings Views

**Files:**
- Modify: `D:\0pencode\strix-hood\app.dc.html`

**Interfaces:**
- Consumes: Task 1-3 shell + state.
- Produces: Policy view (slider/toggle fungsional) + Settings view (wallet connect optional, UI prefs).

- [ ] **Step 1: Policy view**

- Daily limit slider (0-500, step 10) + per-tx slider — fungsional, `setState` update, progress bar gradient hijau.
- Toggle kategori allowed/blocked (SaaS/Cloud/API/Digital Goods vs Gambling/Leverage/Unknown) — snap animation, Emerald Pulse saat on.
- Ringkasan policy card: total allowed, blocked count.

- [ ] **Step 2: Settings view — Connect Wallet REAL**

Wallet connect harus benar-benar berfungsi (bukan input manual). Dua jalur:

```js
async connectWallet() {
  // EVM: MetaMask / Rabby / Coinbase Wallet
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      const r = await fetch("https://cloudflare-eth.com", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [addr, "latest"] })
      });
      const j = await r.json();
      const bal = parseInt(j.result, 16) / 1e18;
      this.setState(s => ({ wallet: { type: "evm", addr, bal, chain: "Ethereum" } }));
    } catch (e) { this.setState({ walletErr: "Connection rejected" }); }
    return;
  }
  // Solana: Phantom / injected
  const sol = window.solana || window.phantom?.solana;
  if (sol) {
    try {
      await sol.connect();
      const addr = sol.publicKey.toString();
      const r = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [addr] })
      });
      const j = await r.json();
      const bal = j.result.value / 1e9;
      this.setState(s => ({ wallet: { type: "solana", addr, bal, chain: "Solana" } }));
    } catch (e) { this.setState({ walletErr: "Connection rejected" }); }
    return;
  }
  this.setState({ walletErr: "No wallet detected. Install MetaMask or Phantom." });
}
disconnectWallet() {
  const sol = window.solana || window.phantom?.solana;
  if (sol?.disconnect) sol.disconnect().catch(() => {});
  this.setState({ wallet: null });
}
```
- Di `componentDidMount`-equivalent: listen `window.ethereum.on("accountsChanged", ...)` dan `sol.on("disconnect", ...)` → update/clear `state.wallet`.
- UI: tombol "Connect Wallet" → setelah connect tampilkan address terpotong (`0x71...A2`, mono), chain badge, balance (ETH/SOL, 4 desimal), tombol Disconnect. State `walletErr` → hint install wallet (link MetaMask/Phantom).

- [ ] **Step 3: Verify + commit**

Run: slider & toggle berfungsi, wallet connect flow jalan.
Commit:
```bash
git add app.dc.html
git commit -m "feat: app policy + settings views"
```

---

### Task 5: Admin Dashboard — Shell + Overview + Registry

**Files:**
- Create: `D:\0pencode\strix-hood\admin.dc.html`

**Interfaces:**
- Consumes: `support.js`, Google Fonts, pola Task 1 (shell/sidebar/data layer).
- Produces: `admin.dc.html` dengan `state.view` ("overview"|"registry"|"treasury"|"security"|"tokenomics"), `state.network` (volume, agents, exec, success), `state.registry`, `state.feed`, `fetchPrices()`, `simTick()`, `render()`.

- [ ] **Step 1: Scaffold + shell + data layer**

Salin pola Task 1 (head, support.js, fonts, styles, sidebar). Sidebar: Overview/Registry/Treasury/Security/Tokenomics. Data layer: `fetchPrices()` (sama, untuk $STRX proxy + BTC/ETH/SOL) + `simTick()` (network metrics random-walk: total volume, agent aktif, avg execution, success rate, global feed).

- [ ] **Step 2: Overview view**

- Network metrics live: total volume, agent aktif, avg execution, success rate — angka mono besar, delta hijau/merah.
- Sparkline volume (canvas custom), global execution feed live (rotasi 3s).

- [ ] **Step 3: Registry view**

- Tabel semua agent: name, type, reputasi, status, volume, slashing flag (Crimson badge).
- Filter pills kategori (All/Research/Trading/Design/Data/Marketing) — fungsional.

- [ ] **Step 4: Verify + commit**

Run: cek render, filter jalan, metrik bergerak.
Commit:
```bash
git add admin.dc.html
git commit -m "feat: admin dashboard shell + overview + registry"
```

---

### Task 6: Admin Dashboard — Treasury + Security + Tokenomics

**Files:**
- Modify: `D:\0pencode\strix-hood\admin.dc.html`

**Interfaces:**
- Consumes: Task 5 shell + `state.network` + `fetchPrices()`.
- Produces: Treasury view (revenue flow), Security view (5 layer), Tokenomics view (supply, donut, $STRX price).

- [ ] **Step 1: Treasury view**

- Revenue flow: Commerce Volume → 0.25% fee → Treasury 40% / Stakers 30% / Buyback-Burn 30% — node glassmorphic pills, angka live, animated connector (dot Emerald bergerak via CSS keyframe).

- [ ] **Step 2: Security view**

- 5 layer vertical stack (AA ERC-4337, Spending Policy, Simulation, Contract Audit, Human-in-the-loop): left border warna per level (green→emerald→teal→amber→crimson), expand on hover (80px→160px), pulse node, status "Active" dot.

- [ ] **Step 3: Tokenomics view**

- Total supply 1,000,000,000 $STRX, distribution donut SVG (40/20/15/15/10), hover tooltip % + vesting.
- $STRX live price proxy: CoinGecko (pakai token proxy, mis. `the-open-network` atau token lain — label "STRX (proxy)").

- [ ] **Step 4: Verify + commit**

Run: cek semua view render, flow animasi jalan.
Commit:
```bash
git add admin.dc.html
git commit -m "feat: admin treasury + security + tokenomics"
```

---

### Task 7: Deploy + Smoke Test + Quality Gate

**Files:**
- Modify: `D:\0pencode\strix-hood\vercel.json` (jika perlu)

**Interfaces:**
- Consumes: `app.dc.html`, `admin.dc.html`, `index.html`, `support.js`.

- [ ] **Step 1: Local smoke test**

Run: `npx serve` di `D:\0pencode\strix-hood`, buka `/app.dc.html` dan `/admin.dc.html` di browser (playwright-core chromium, pola yang sudah dipakai): cek title, body render, console errors = none, view switch jalan, harga live/fallback muncul.

- [ ] **Step 2: Deploy ke Vercel**

Run: `npx vercel --yes --prod --name strix-hood --scope mrmacro-s-projects` (vercel.json sudah `buildCommand: ""`).
Expected: `https://strix-hood.vercel.app/app.dc.html` dan `/admin.dc.html` 200.

- [ ] **Step 3: Quality gate**

Score: Originality/Emotion/Clarity/Cinematic/Technical/A11y/Performance/Responsive ≥ 9. Cek: mobile (sidebar→bottom nav), reduced-motion, contrast WCAG AA, load < 3s 4G. Iterate jika < 9.

- [ ] **Step 4: Commit + push**

```bash
git add -A
git commit -m "feat: ship app + admin dashboards"
git push origin main
```

- [ ] **Step 5: Update README**

Tambah section link: landing `/`, app `/app.dc.html`, admin `/admin.dc.html`.
Commit: `chore: document dashboard routes`.