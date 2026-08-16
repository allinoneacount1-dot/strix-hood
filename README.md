# Strix Hood

Autonomous AI agent commerce protocol — marketing site, documentation and dashboards.

**Live:** https://strix-hood.vercel.app

## Stack

Static HTML, vanilla JS, zero build step. No framework, no bundler, no npm install.
Vercel serves the directory as-is (`vercel.json` sets `buildCommand: null`).

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Landing page — 3D hero, live markets, intent simulator, agent marketplace preview |
| `app.html` | User dashboard — overview, agents, portfolio, transactions, policy, settings |
| `admin.html` | Protocol dashboard — network, registry, treasury, security, tokenomics |
| `docs.html` `api.html` `sdk.html` | Documentation, REST/WS reference, SDK guides |
| `agents.html` `marketplace.html` `nft.html` `stocks.html` `security.html` | Product |
| `status.html` `about.html` `careers.html` `blog.html` `brand.html` | Company |

## Assets

| File | Role |
|---|---|
| `assets/strix.css` | Design system — tokens, components, motion |
| `assets/strix.js` | Core runtime — modal, toast, smooth scroll, charts, formatting |
| `assets/strix-data.js` | Live data layer (see below) |
| `assets/wallet.js` | Real wallet connect — EIP-1193 + Solana |
| `assets/shell.js` | Shared nav + footer, single source of truth for the sitemap |
| `assets/strix-3d.js` | WebGL scenes — hero core, wordmark, NFT passport, ambient background |
| `assets/chatbot.js` | Web3 assistant — intent router over the live data layer |
| `assets/home.js` `dash.js` `docs.js` `page.js` | Per-surface behaviour |

## Data sources

All free tier, no API key, CORS-enabled. Every call degrades to a labelled
simulation if it fails — the UI never shows stale data as live.

| Source | Used for |
|---|---|
| Binance REST + WebSocket | Spot prices, 24h stats, klines |
| CoinGecko | Market cap, 7d sparklines |
| DeFiLlama | Chain TVL |
| alternative.me | Crypto Fear & Greed index |
| PublicNode / Cloudflare ETH RPC | Block height, gas price, balances |
| DexScreener | On-chain pair lookup |
| TradingView embed widget | Dashboard charts (native canvas fallback included) |

## Brand

Robin Neon `#CCFF00` primary, Teal Surge `#00E5A0` secondary, Void Black `#0A0A0F`.
Space Grotesk (display/UI) + JetBrains Mono (data). Full kit at `/brand`.

## Development

```bash
python3 -m http.server 8000
```

Three.js loads from unpkg at runtime; set `window.STRIX3D_URL` before
`strix-3d.js` to pin a self-hosted copy. The site works with WebGL disabled.

## Status

Testnet software. Protocol metrics on the site are simulated and labelled as
such; market data is live.
