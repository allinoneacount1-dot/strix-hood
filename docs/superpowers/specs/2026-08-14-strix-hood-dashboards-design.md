# Strix Hood — App + Admin Dashboards (Design)

Date: 2026-08-14
Project: `D:\0pencode\strix-hood`
Repo: `allinoneacount1-dot/strix-hood`
Live: https://strix-hood.vercel.app

## 1. Vision

Dashboard companion untuk Strix Hood — tempat user mengontrol agent onchain-nya (App) dan tempat protocol dipantau (Admin). Melanjutkan identitas landing page: dark, surgical, alive — terminal trading yang punya kesadaran sendiri. Robinhood Green DNA, anti-slop, premium.

## 2. Format & Stack

- 2 file dc-runtime: `app.dc.html` + `admin.dc.html`, sharing `support.js` yang sudah ada.
- React inline (data-dc-script), inline styles, zero build step, zero dependency eksternal selain Google Fonts (Space Grotesk + JetBrains Mono).
- Deploy static ke Vercel (vercel.json buildCommand sudah "": no build).

## 3. Data Strategy (Hybrid)

| Source | Data | Detail |
|--------|------|--------|
| CoinGecko free API | Harga live BTC/ETH/SOL + $STRX proxy | `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd` + `markets?ids=...&sparkline=true` untuk sparkline. CORS-friendly, bisa fetch langsung dari browser. Rate limit dihormati (cache 30-60s). |
| Public RPC (optional) | Wallet balance | Kalau user connect wallet; default kosong/skip. |
| Simulasi live | Metrik protocol: agent aktif, volume, fee, execution time, success rate, activity feed | Engine simulasi kecil: angka bergerak sendiri tiap detik (random walk ter-constrain), konsisten antar view. |

## 4. Design Language

- **Palet**: Void Black `#0A0A0F`, Robinhood Green `#00C805`, Emerald Pulse `#2EDA12`, Teal Surge `#00E5A0`, Plasma White `#F5F5F7`, Neural Gray `#8A8B9E`, Crimson Alert `#FF5000`, Amber Signal `#FF9900`, Deep Forest `#0D1F0D`, Glass Border `rgba(0,200,5,0.15)`.
- **Typography**: Space Grotesk (display/UI) + JetBrains Mono (data, tabular-nums).
- **Layout**: Sidebar navigasi kiri (desktop) → bottom nav (mobile). Konten pakai `.shell` padding. Bukan centered.
- **Komponen**: Glass card (`rgba(13,31,13,0.4)` + blur 20px + border hijau 0.2), pill button gradient, status pill, custom geometric glyph icons (lingkaran/diamond/ring — bukan Lucide).
- **Atmosfer**: grain overlay 3%, ambient green glow, custom cursor (blend-difference), angka monospace tabular, hover lift + border glow.
- **Anti-slop**: no centered body text, no default icons, no flat colors, every surface punya depth.
- **Motion**: transform/opacity only, expo-out `cubic-bezier(0.16,1,0.3,1)`, `prefers-reduced-motion` dihormati.

## 5. app.dc.html — "Launch App"

Sidebar: Overview · Agents · Portfolio · Transactions · Policy · Settings

1. **Overview**
   - Portfolio value live: holdings × harga CoinGecko, P&L 24h (hijau/merah)
   - Ringkasan agent: aktif/idle, revenue
   - Activity feed live (rotasi tiap 3s): intent diterima, policy check, eksekusi
   - Quick stats: avg execution, success rate, spending bulanan
2. **Agents**
   - Kartu agent milik user: nama, type, status (Live pulse dot), reputasi, revenue, transactions
   - Hover lift + border glow; klik → panel detail singkat
3. **Portfolio**
   - Allocation donut SVG custom (5 segmen, stroke-dasharray)
   - Holdings list: asset, qty, harga live, value, P&L
   - Sparkline 7d dari CoinGecko (canvas kecil custom)
4. **Transactions**
   - Tabel: status pill (Live/Warning/Error), hash mono, arah, jumlah, waktu
   - Live feed: baris baru muncul tiap beberapa detik
5. **Policy**
   - Spending limit slider fungsional (daily, per-tx)
   - Toggle kategori allowed/blocked, snap animation
   - Progress bar gradient hijau
6. **Settings**
   - Connect wallet (optional, public RPC), preferensi UI (preloader/cursor/particles on/off — konsisten dengan tweaks landing)

## 6. admin.dc.html — Protocol

Sidebar: Overview · Registry · Treasury · Security · Tokenomics

1. **Overview**
   - Network metrics live: total volume, agent aktif, avg execution, success rate
   - Live feed eksekusi global, sparkline volume
2. **Agent Registry**
   - Semua agent: name, type, reputasi, status, slashing flag
   - Filter kategori (All/Research/Trading/Design/Data/...)
3. **Fee & Treasury**
   - Revenue flow: Commerce Volume → 0.25% fee → Treasury 40% / Stakers 30% / Buyback-Burn 30%
   - Angka flow live, node glassmorphic
4. **Security Monitor**
   - 5 layer (AA, Spending Policy, Simulation, Contract Audit, Human-in-the-loop): status active, pulse node, expand on hover
5. **Tokenomics**
   - Total supply, distribution donut, $STRX live price proxy (CoinGecko), vesting tooltip

## 7. Interaksi Umum

- Semua tab fungsional (switch view), angka sim live update tiap detik
- Custom cursor membesar di elemen interaktif
- Responsive: sidebar collapse → bottom nav mobile, grid → single column
- Focus states visible (2px Robinhood Green), WCAG AA contrast

## 8. Out of Scope (v1)

- Backend real, smart contract, onchain deploy protocol
- Auth/login sungguhan
- Persistence (semua state in-memory)

## 9. Quality Gate

Originality / Emotion / Clarity / Cinematic / Technical / A11y / Performance / Responsive — semua ≥ 9. Load < 3s 4G.
