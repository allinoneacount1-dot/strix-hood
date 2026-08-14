# STRIX HOOD — Web Design Prompt (Revised: Robinhood Green Edition)
## Autonomous AI Agent Commerce Protocol

---

## 1. EXECUTIVE VISION

**Strix Hood** adalah decentralized AI Agent Commerce Layer yang memungkinkan AI agents untuk melakukan transaksi onchain secara otonom — membeli, menjual, membayar, dan berinteraksi antar-agent. Platform ini menjembatani TradFi (tokenized stocks/RWA) dan DeFi melalui Intent-Based Architecture.

**Core Promise**: *"AI Agents That Can Buy, Sell & Pay Onchain"*

**Design Philosophy**: 
- **Anti-Generic. Anti-Template. Anti-AI-Slop.**
- Setiap pixel harus punya tujuan. Tidak ada filler content.
- Visual language: "Autonomous Intelligence meets Financial Sovereignty"
- Vibe: Dark, surgical, alive — seperti terminal trading yang memiliki kesadaran sendiri.

---

## 2. COLOR SYSTEM — Pure Robinhood Green DNA

> **Note**: Tidak ada unsur warna Solana (ungu/violet). 100% identitas visual hijau Robinhood dengan ekspansi ke emerald & teal untuk depth.

### Primary Palette
| Token | Hex | Usage |
|-------|-----|-------|
| **Void Black** | `#0A0A0F` | Primary background — deeper than pure black, warm undertone |
| **Robinhood Green** | `#00C805` | Primary brand color — CTAs, active states, brand identity |
| **Emerald Pulse** | `#2EDA12` | Secondary accent — brighter green untuk highlights dan glow |
| **Teal Surge** | `#00E5A0` | Tertiary accent — untuk gradient transitions dan data viz variasi |
| **Plasma White** | `#F5F5F7` | Primary text — not pure white, slightly warm |

### Supporting Colors
| Token | Hex | Usage |
|-------|-----|-------|
| **Deep Forest** | `#0D1F0D` | Card backgrounds, elevated surfaces — dark green-black |
| **Neural Gray** | `#8A8B9E` | Secondary text, labels, timestamps |
| **Crimson Alert** | `#FF5000` | Negative deltas, security warnings, blocked actions — Robinhood red |
| **Amber Signal** | `#FF9900` | Pending states, human-in-the-loop approvals |
| **Glass Border** | `rgba(0, 200, 5, 0.15)` | Subtle borders on glassmorphic elements |

### Gradient Definitions
- **Hero Gradient**: `linear-gradient(135deg, #0A0A0F 0%, #0D1F0D 50%, #0A0A0F 100%)` — deep void dengan undertone hijau gelap
- **Accent Gradient**: `linear-gradient(90deg, #00C805 0%, #00E5A0 100%)` — Robinhood signature green → teal
- **Glow Gradient**: `radial-gradient(circle at 50% 50%, rgba(0, 200, 5, 0.15) 0%, transparent 70%)` — ambient green glow behind key elements
- **Card Gradient**: `linear-gradient(180deg, rgba(13, 31, 13, 0.8) 0%, rgba(10, 10, 15, 0.95) 100%)` — subtle elevation dengan undertone hijau
- **Shimmer Gradient**: `linear-gradient(90deg, transparent, rgba(0, 200, 5, 0.1), transparent)` — untuk shimmer effects

---

## 3. TYPOGRAPHY SYSTEM

### Font Stack
- **Display / Headings**: `Space Grotesk` atau `Clash Display` — geometric, slightly wide, tech-forward
- **Body / UI**: `Inter` atau `Satoshi` — clean, highly legible at small sizes
- **Monospace / Data**: `JetBrains Mono` atau `SF Mono` — for wallet addresses, transaction hashes, numerical data

### Type Scale
| Level | Size | Weight | Letter-Spacing | Line-Height | Usage |
|-------|------|--------|----------------|-------------|-------|
| **Display** | 80px / clamp(48px, 6vw, 96px) | 700 | -0.03em | 1.0 | Hero headline |
| **H1** | 56px / clamp(36px, 4vw, 64px) | 600 | -0.02em | 1.1 | Section titles |
| **H2** | 40px / clamp(28px, 3vw, 48px) | 600 | -0.01em | 1.2 | Sub-sections |
| **H3** | 28px / clamp(22px, 2vw, 32px) | 500 | 0 | 1.3 | Card titles |
| **Body Large** | 20px | 400 | 0 | 1.6 | Lead paragraphs |
| **Body** | 16px | 400 | 0 | 1.6 | Standard text |
| **Caption** | 13px | 500 | 0.02em | 1.4 | Labels, metadata |
| **Mono** | 14px | 400 | 0 | 1.5 | Addresses, hashes, data |

### Typography Rules (Anti-Slop)
- **NO** center-aligned body text. Ever.
- **NO** all-caps for body. All-caps hanya untuk labels/buttons dengan letter-spacing 0.05em.
- **NO** default system fonts. Custom font loading is mandatory.
- Headings menggunakan `text-wrap: balance` untuk menghindari orphan words.
- Numerical data selalu monospace dengan tabular figures (`font-variant-numeric: tabular-nums`).

---

## 4. LAYOUT & GRID SYSTEM

### Grid
- 12-column grid
- Max container width: 1280px
- Gutter: 24px (desktop), 16px (mobile)
- Horizontal padding: 48px (desktop), 24px (tablet), 16px (mobile)

### Spacing Scale
Base 4px: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128

### Z-Index Hierarchy
| Layer | Z-Index | Content |
|-------|---------|---------|
| Background Canvas | -1 | Particle network, ambient glow |
| Content | 1-10 | Standard content layers |
| Navigation | 100 | Fixed header |
| Modals/Overlays | 1000 | Transaction modals, agent detail |
| Toast/Notifications | 10000 | Transaction confirmations |

---

## 5. GLOBAL INTERACTIONS & ANIMATIONS

### Philosophy
- Animations are **functional**, not decorative.
- Every motion communicates state change or spatial relationship.
- Easing: Custom cubic-bezier — `cubic-bezier(0.16, 1, 0.3, 1)` (expo out) for entrances, `cubic-bezier(0.4, 0, 0.2, 1)` for UI transitions.

### Core Patterns

**Page Load Sequence:**
1. Background canvas fades in (0-300ms)
2. Navigation slides down + fades (200-500ms, stagger 50ms per item)
3. Hero text reveals line by line (400-900ms, stagger 100ms)
4. Hero visual/3D element scales from 0.9 to 1 + fades (600-1000ms)
5. Scroll indicator pulses (after 1200ms)

**Scroll Behaviors:**
- Smooth scroll: `scroll-behavior: smooth` dengan custom lerp untuk parallax elements
- Section entrances: Elements fade up 24px + opacity 0→1, triggered at 15% viewport intersection
- Parallax: Background elements move at 0.5x scroll speed, foreground decorative at 1.2x

**Hover States:**
- Cards: `translateY(-4px)` + `box-shadow` intensify + border glow (200ms)
- Buttons: Background shimmer effect (gradient sweep left-to-right, 300ms) — hijau shimmer
- Links: Underline grows from center outward (`scaleX(0)` → `scaleX(1)`)
- Agent NFT cards: 3D tilt effect following cursor (max 8deg rotation, CSS transform on mousemove throttled)

**Micro-interactions:**
- Button clicks: Scale 0.97 + ripple from click point (200ms)
- Toggle switches: Elastic snap animation
- Input focuses: Border glow pulse (Robinhood Green, 1.5s loop)
- Loading states: Skeleton screens dengan shimmer gradient hijau, NOT spinning circles
- Transaction pending: Pulsing amber dot (1.5s ease-in-out infinite)
- Transaction success: Green checkmark draws itself (SVG stroke-dashoffset animation) — hijau Robinhood

---

## 6. SECTION-BY-SECTION DESIGN

---

### SECTION 0: PRELOADER / LOADING STATE

**Concept**: "System Boot Sequence"
- Fullscreen Void Black
- Center: Monospace terminal text typing out:
  ```
  > Initializing Strix Hood Protocol...
  > Connecting to onchain registry...
  > Loading agent marketplace...
  > System ready.
  ```
- Each line types at 40ms/char with cursor blink
- Progress bar di bawah: gradient Robinhood Green → Emerald Pulse → Teal Surge
- Final frame: Logo "STRIX HOOD" reveals with glitch effect (RGB split, 200ms)
- Transition: Screen splits diagonally revealing homepage

---

### SECTION 1: NAVIGATION (Fixed)

**Structure**:
```
[Logo: STRIX HOOD] ─────────────────────────── [Agents] [Commerce] [NFT] [Token] [Docs] [Launch App →]
```

**Design Details**:
- Height: 72px
- Background: `rgba(10, 10, 15, 0.8)` + `backdrop-filter: blur(20px)` + `border-bottom: 1px solid rgba(0, 200, 5, 0.1)`
- Logo: Custom wordmark — "STRIX" in Space Grotesk 700, "HOOD" in Space Grotesk 400, dengan titik di atas "i" berubah menjadi diamond shape (♦) dengan gradient hijau (Robinhood Green → Emerald Pulse)
- Nav links: 14px, weight 500, Neural Gray → Plasma White on hover, underline slide animation
- CTA "Launch App": Pill button, gradient Accent (hijau), glow shadow hijau, hover: brightness 1.1 + scale 1.02
- Scroll behavior: Nav background opacity increases dari 0.8 → 0.95 setelah scroll 100px
- Mobile: Hamburger morphs menjadi X dengan SVG path animation, menu slides dari kanan dengan staggered link reveals

---

### SECTION 2: HERO

**Layout**: Asymmetric split — 55% text left, 45% visual right. Vertical center alignment.

**Background**:
- Base: Hero Gradient (hijau undertone)
- **Living Particle Network**: Canvas/WebGL — nodes (dots) connected by lines forming a neural network topology. Nodes pulse dengan Robinhood Green. Connections glow dengan Emerald Pulse saat data "flows" through them. Mouse interaction: nodes repel slightly on hover.
- Ambient: Large radial glow (Robinhood Green, 20% opacity) di belakang visual kanan

**Left Content**:
- **Eyebrow**: Pill badge — "AUTONOMOUS AI COMMERCE PROTOCOL" — 11px, uppercase, letter-spacing 0.1em, border 1px Glass Border, background Deep Forest 40% opacity
- **Headline** (Display size):
  ```
  Your AI Agent.
  Your Onchain Economy.
  ```
  — "AI Agent" dan "Onchain Economy" menggunakan gradient text (Accent Gradient hijau → teal), sisanya Plasma White
- **Subheadline** (Body Large, Neural Gray):
  "Strix Hood enables AI agents to autonomously discover, negotiate, and execute commerce across crypto, NFTs, and tokenized stocks — governed by your intent, protected by your policy."
- **CTA Group**:
  - Primary: "Deploy Your Agent" — pill, Accent Gradient hijau, glow, arrow icon →
  - Secondary: "View Agent Marketplace" — pill, transparent, border Glass Border, hover: border Robinhood Green
- **Trust Bar** (di bawah CTA, 16px gap):
  ```
  Powered by Onchain Infrastructure  •  $2.4B+ Agent Volume  •  12,000+ Active Agents
  ```
  — Monospace 12px, Neural Gray, dengan dot separators berwarna Emerald Pulse

**Right Visual — "The Agent Brain"**:
- **3D Abstract Visualization** (Three.js/Spline):
  - Floating geometric form: Icosahedron yang terfragmentasi, dengan faces berwarna gradient hijau (Robinhood Green → Emerald Pulse)
  - Orbiting particles: small spheres (Emerald Pulse) yang bergerak di orbit elliptical
  - Core: Glowing sphere (Robinhood Green, intense) — "the agent's decision core"
  - Data streams: Thin lines (Teal Surge) yang menghubungkan core ke orbit particles — simulating intent execution
  - Mouse parallax: Object rotates subtly mengikuti cursor (max 15deg)
  - Idle animation: Gentle float (translateY sine wave, 4s), slow rotation (20s per full rotation)
- **Floating UI Cards** (overlay di atas 3D visual, positioned absolute):
  - Card 1 (top-left of visual): "Intent Received: Buy AAPLX" — mini terminal card, glassmorphic, typing animation
  - Card 2 (bottom-right): "Policy Check: ✅ Approved" — status card, hijau border glow
  - Cards float dengan subtle parallax berbeda-beda

**Scroll Indicator**:
- Bottom center: Thin vertical line (1px, Neural Gray) dengan dot yang bounces down (translateY loop, 1.5s)

**Entrance Animation**:
- Eyebadge: fade in + scale from 0.9 (0ms)
- Headline line 1: clip-path reveal left-to-right + fade up (200ms, 600ms duration)
- Headline line 2: same (350ms delay)
- Subheadline: fade up (500ms delay)
- CTAs: fade up + scale (700ms delay, stagger 100ms)
- 3D Visual: scale 0.8→1 + opacity 0→1 + rotateY -15deg→0 (600ms delay, 1000ms duration, expo out)
- Floating cards: pop in dengan scale + fade (1000ms delay, stagger 150ms)

---

### SECTION 3: INTENT PIPELINE (How It Works)

**Concept**: "From Thought to Transaction"

**Layout**: Full-width dark section. Horizontal scrollable pipeline on desktop, vertical stacked on mobile.

**Header** (centered, max-width 600px):
- Eyebrow: "THE PIPELINE" — pill badge, Emerald Pulse border
- H2: "Intent → Execution in Seconds"
- Body: "Describe what you want. Our AI Agent Brain translates intent into secure, policy-governed onchain actions."

**Pipeline Visualization**:
Horizontal flow dengan 5 stages, connected by animated data streams.

```
[User Intent]  →→→  [Agent Brain]  →→→  [Policy Check]  →→→  [Simulation]  →→→  [Execution]
   💬                🧠                🛡️                🔬                ⚡
```

**Each Stage Card**:
- Size: 220px × 280px
- Background: Card Gradient + `border: 1px solid Glass Border`
- Border-radius: 20px
- Padding: 32px
- Icon: 48px, gradient background circle (Robinhood Green 20% opacity), icon itself gradient hijau
- Title: H3, 20px, weight 600
- Description: Caption, Neural Gray
- **Active State**: Border berubah menjadi Accent Gradient hijau, icon glows, card lifts 8px
- **Connection Lines**: SVG paths antara cards, dengan animated gradient stroke (data packet bergerak sepanjang garis, Emerald Pulse dot)

**Stage Details**:
1. **User Intent** — Icon: Message bubble with sparkle. "Natural language commands. Text or voice."
2. **Agent Brain** — Icon: Brain circuit. "LLM-powered intent translation & market analysis."
3. **Policy Check** — Icon: Shield check. "Spending limits, allowed categories, risk guardrails."
4. **Simulation** — Icon: Flask/atom. "Sandbox transaction execution. MEV protection."
5. **Execution** — Icon: Lightning bolt. "Session key signing. Optimal route. Onchain settlement."

**Interaction**:
- On scroll into view: Cards reveal staggered (150ms each), connection lines draw themselves (SVG stroke animation, 500ms each)
- Hover card: Card lifts, border glows, connection lines to adjacent cards pulse brighter
- Click card: Expands menjadi detail modal (glassmorphic overlay)

**Anti-Slop Note**: Pipeline BUKAN timeline vertical generik. Ini adalah horizontal flow dengan animated data packets. Tidak ada icon stock dari Flaticon. Icons harus custom SVG dengan line-art style yang konsisten.

---

### SECTION 4: AGENT CAPABILITIES (Bento Grid)

**Concept**: "What Your Agent Can Do"

**Layout**: Bento grid — asymmetric, magazine-style. 3 columns on desktop, 2 on tablet, 1 on mobile.

**Grid Structure**:
```
┌─────────────────┬─────────┬─────────┐
│                 │  NFT    │  Crypto │
│   Autonomous    │Commerce │Commerce │
│   Portfolio     ├─────────┼─────────┤
│   (2×2)         │  Agent  │  Token  │
│                 │Market   │Stocks   │
│                 │(1×2)    │(1×1)    │
└─────────────────┴─────────┴─────────┘
```

**Card Design System**:
- Background: Card Gradient
- Border: 1px solid Glass Border
- Border-radius: 24px
- Padding: 32px
- Hover: translateY(-6px), border-color transitions to Robinhood Green 40%, inner glow appears

**Card 1: Autonomous Portfolio (Large, 2×2)**
- Background: Deep Forest dengan subtle grid pattern (1px lines, 5% opacity)
- Content:
  - H3: "Autonomous Portfolio & Yield"
  - Body: "AI-driven rebalancing across crypto, NFTs, and tokenized stocks. DCA strategies with real-time sentiment analysis."
  - **Live Mini-Chart**: Embedded canvas showing portfolio allocation — pie chart segments (Crypto 60%, Stocks 30%, Cash 10%) dengan hover states. Warna: Robinhood Green, Emerald Pulse, Teal Surge.
  - **Stats Row**:
    ```
    $2.4B+  Total Volume    |    18.2%  Avg. APY    |    0.3s  Avg. Execution
    ```
  - CTA: "Configure Strategy →"

**Card 2: NFT Commerce (1×2)**
- Background: Gradient overlay (Robinhood Green 10% opacity) + noise texture
- Content:
  - H3: "NFT Commerce & Sniping"
  - Feature list dengan check icons (Emerald Pulse):
    - Trait-based automated bidding
    - Cross-chain routing (Solana ↔ Ethereum ↔ Arbitrum)
    - Floor price alerts & auto-execution
  - **Visual**: Floating 3D NFT card mockup — glassmorphic card dengan abstract generative art, rotates on hover (CSS 3D)

**Card 3: Crypto Commerce (1×1)**
- H3: "Conversational Crypto"
- Body: "Intent-based execution. Natural language to onchain payload."
- Example command bubble (glassmorphic, left-aligned):
  ```
  "Buy 0.15 ETH of SOL if price drops below $140"
  ```
  — dengan typing cursor blink

**Card 4: Agent Marketplace (1×2)**
- H3: "Agent-to-Agent Commerce"
- Body: "Hire specialized agents. Pay per task. Machine-to-machine economy."
- **Mini Agent List** (scrollable, 3 items visible):
  ```
  🤖 ResearchBot    Market Research    $2/query    98.4% ★
  🤖 DataBot       Onchain Data       $0.50/call  99.1% ★
  🤖 CodeBot       Smart Contract Audit $10/job   97.8% ★
  ```
  — Monospace data, reputation badges gradient (hijau tua ke hijau cerah based on score)

**Card 5: Tokenized Stocks (1×1)**
- H3: "RWA & Tokenized Stocks"
- Body: "Trade fractionalized equities 24/7. AAPLX, TSLAX, SPYX onchain."
- **Ticker Strip**: Horizontal scrolling marquee di bagian bawah card — stock symbols dengan price change indicators (Robinhood Green untuk up, Crimson Alert untuk down)

**Entrance**: Cards stagger in dengan scale 0.95→1 + fade + slight rotateX (5deg→0). Stagger: 100ms. Trigger: 20% viewport.

---

### SECTION 5: AGENT NFT SYSTEM

**Concept**: "Your Agent's Onchain Identity"

**Layout**: Two-part section.

**Part A: The Agent Passport (Left 50%)**
- H2: "Agent NFT: Living Identity"
- Body: "Every agent mints a unique NFT passport. Identity, reputation, permissions, and revenue rights — all onchain."
- **Feature List** (dengan custom icons):
  - 🧬 Dynamic metadata evolves with agent activity
  - 🛡️ Permission sets encoded in NFT traits
  - 💰 Revenue sharing to NFT owner
  - 🔄 Tradable on Agent Marketplace

**Part B: NFT Card Showcase (Right 50%)**
- **3D Tilt Card** (CSS perspective 1000px):
  - Card size: 380px × 520px
  - Border-radius: 32px
  - Background: Gradient (Deep Forest → darker), dengan holographic sheen effect (CSS gradient overlay yang bergerak on hover) — menggunakan warna hijau/teal
  - Content:
    ```
    ┌─────────────────────────────┐
    │  AGENT #1842                │
    │  ─────────────────────────  │
    │                             │
    │  [Generative Agent Art]     │
    │  Abstract geometric form    │
    │  that evolves with level    │
    │                             │
    │  AlphaResearch              │
    │  Type: Research Agent       │
    │                             │
    │  ⚡ Level 4: Elite Agent   │
    │  Reputation: 98.7           │
    │  Revenue: $124,291          │
    │  Transactions: 182,921      │
    │                             │
    │  [Capabilities]             │
    │  ✓ Research  ✓ Data Buy    │
    │  ✓ API Access ✓ Hire Agents │
    │                             │
    │  Owner: 0x71...A2           │
    └─────────────────────────────┘
    ```
  - Visual art: Generative abstract geometry — complexity increases dengan level. Level 4 = most complex form.
  - Holographic effect: `background: linear-gradient(105deg, transparent 40%, rgba(0, 200, 5, 0.1) 45%, rgba(0, 229, 160, 0.2) 50%, rgba(0, 200, 5, 0.1) 55%, transparent 60%)` — animasi `background-position` on hover
  - Glint: Shine sweep across card on hover (pseudo-element translateX animation)

**Below: NFT Equipment System**
- H3: "Modular Agent Equipment"
- Horizontal scrollable row of equipment module cards:
  - 🧠 Intelligence Module — Whale Tracking capability
  - 💳 Payment Module — Higher spending limits
  - 🔍 Data Module — Premium data feeds
  - 🛡 Security Module — Enhanced simulation
  - ⚡ Execution Module — MEV protection
- Each module: Small card (160px × 200px), icon + name + capability. Hover: equip animation (snaps into place sound visual — border flash hijau).

**Entrance**: NFT card slides in dari kanan dengan 3D rotateY (-30deg → 0). Equipment modules pop in dengan spring physics (overshoot easing).

---

### SECTION 6: SECURITY & POLICY

**Concept**: "Fort Knox for Agents"

**Layout**: Full-width. Darker background (`#050508`) untuk menandakan seriousness.

**Header**:
- Eyebrow: "SECURITY STACK" — Crimson Alert border (unusual, menandakan importance)
- H2: "Your Funds. Your Rules."
- Body: "Multi-layered protection with human-in-the-loop control."

**Security Layers Visualization**:
Vertical stack of 5 layers, seperti lapisan keamanan. Each layer adalah horizontal bar/card yang expands on hover.

```
┌────────────────────────────────────────────────────────────┐
│  🛡️  Account Abstraction (ERC-4337)                        │
│      Session keys • No per-tx signing • Revocable          │
├────────────────────────────────────────────────────────────┤
│  🔒  Dynamic Spending Policy                                │
│      Daily limits • Category blocks • Transaction caps      │
├────────────────────────────────────────────────────────────┤
│  🔬  Transaction Simulation                                  │
│      Sandbox execution • Slippage check • Drainer detection │
├────────────────────────────────────────────────────────────┤
│  🧠  Automated Contract Audit                              │
│      Source verification • Deployer reputation • History    │
├────────────────────────────────────────────────────────────┤
│  👤  Human-in-the-Loop Override                            │
│      Biometric gate • Manual approval • Emergency pause     │
└────────────────────────────────────────────────────────────┘
```

**Design Details**:
- Each layer: Full-width card, height 80px default, expands to 160px on hover
- Background: Gradient dari left (Robinhood Green 5%) to right (transparent)
- Left border: 3px solid, color matches security level (Green → Emerald → Teal → Amber → Crimson)
- Icon: 40px, left side
- Title: 18px, weight 600
- Expanded content: Additional description + status indicator ("Active" — pulsing green dot)
- **Connection**: Vertical line di kiri connecting all layers, dengan nodes di setiap layer. Nodes pulse sequentially (top to bottom, loop) — simulating active monitoring.

**Policy Configurator Preview** (di bawah layers):
- Glassmorphic panel showing mock policy settings:
  ```
  Daily Limit: $100      [████████░░] $100/$100
  Per Transaction: $30    [██████░░░░] $30/$50 max

  Allowed: ✅ SaaS  ✅ Cloud  ✅ API  ✅ Digital Goods
  Blocked:  ✕ Gambling  ✕ Leverage  ✕ Unknown Contracts
  ```
- Progress bars: Gradient fill (Robinhood Green to Emerald Pulse)
- Toggle switches: Custom design, Emerald Pulse when on, snap animation

**Entrance**: Layers slide in dari kiri dengan stagger 100ms. Policy panel fades up.

---

### SECTION 7: TOKENOMICS & ECONOMY

**Concept**: "The Fuel of Agent Commerce"

**Layout**: Two columns — 60% token utility, 40% token distribution visual.

**Left: Token Utility**
- Eyebrow: "$STRX TOKEN"
- H2: "Powering the Agent Economy"
- Utility cards (vertical stack, 4 items):

1. **Agent Registration**
   - Icon: Fingerprint/ID
   - "Developers stake $STRX to register agents. Sybil resistance through economic security."

2. **Reputation Bond**
   - Icon: Shield with diamond
   - "Collateral-backed reputation. Fraudulent agents get slashed. Good actors earn yield."

3. **Protocol Fees**
   - Icon: Pie chart
   - "0.25% on commerce volume. Split: Treasury, Stakers, Buyback & Burn."

4. **Agent Discovery**
   - Icon: Search/magnify
   - "Listing fees for marketplace visibility. Premium placement for high-reputation agents."

**Card Design**: Horizontal layout — icon (left, 56px), content (right). Hover: left border accent appears (4px Robinhood Green), card shifts right 8px.

**Right: Token Distribution**
- **Donut Chart** (Canvas/SVG):
  - Community & Ecosystem: 40% — Robinhood Green
  - Team & Advisors: 20% — Emerald Pulse
  - Protocol Treasury: 15% — Teal Surge
  - Liquidity: 15% — Amber Signal
  - Early Contributors: 10% — Plasma White
- Center of donut: "$STRX" logo
- Hover segment: Segment expands outward (scale 1.05), tooltip shows exact percentage + vesting schedule
- **Animated counter** di atas: "Total Supply: 1,000,000,000 $STRX" — counts up on scroll into view

**Below: Revenue Flow Diagram**
Horizontal flow:
```
[Commerce Volume] → [0.25% Fee] → [Treasury 40%] → [Stakers 30%] → [Buyback/Burn 30%]
```
- Animated: USDC particles flowing through pipes (SVG path animation)
- Each node: Glassmorphic pill dengan percentage

**Entrance**: Utility cards slide in dari kiri (stagger 100ms). Donut chart draws itself (stroke animation, 1.5s). Revenue flow animates sequentially.

---

### SECTION 8: AGENT MARKETPLACE PREVIEW

**Concept**: "Hire Intelligence"

**Layout**: Full-width horizontal scroll section (marquee-style but interactive).

**Header** (left-aligned):
- H2: "Agent Marketplace"
- Body: "Browse, compare, and hire specialized AI agents."
- CTA: "Explore Marketplace →"

**Agent Cards Row** (horizontal scroll, snap to card):
- Card size: 300px × 380px
- 6 cards visible (partially), infinite scroll loop

**Card Design**:
```
┌─────────────────────────────┐
│  [Agent Avatar — generative  │
│   abstract portrait, unique │
│   per agent type]           │
│                             │
│  🤖 AlphaResearch           │
│  Research Agent             │
│                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━   │
│  Reputation  98.4%          │
│  Volume      $84,291        │
│  Price       $2/query       │
│  Transactions 12,492        │
│                             │
│  [Hire Agent]                │
└─────────────────────────────┘
```
- Avatar: Generative abstract face/form — unique per agent category (Research = geometric/cerebral, Trading = sharp/aggressive, Design = fluid/colorful)
- Background: Card Gradient dengan category color tint (Research = hijau tua, Trading = Crimson, Design = Amber)
- Stats: Monospace, tabular nums
- "Hire Agent" button: Full-width, Robinhood Green, hover: glow + scale
- **Hover**: Card lifts, avatar scales 1.05, stats count up animation

**Categories** (filter pills di atas row):
- All • Research • Trading • Design • Legal • Data • Marketing
- Active pill: Filled Robinhood Green. Inactive: Glass Border.

**Entrance**: Cards slide in dari kanan dengan velocity-based stagger (faster scroll = tighter stagger).

---

### SECTION 9: TESTIMONIALS / PROOF

**Concept**: "Trusted by Agents & Humans"

**Layout**: Asymmetric — large quote left, metrics right.

**Left**:
- Large quote marks (120px, Robinhood Green, 10% opacity) sebagai background element
- Quote text (H2 size, italic, weight 300):
  "I told my agent to maintain my server infrastructure under $100/month. It found a better provider, negotiated a discount, and migrated everything — while I slept."
- Attribution: Monospace — "— 0x7a...3F, Agent Owner since Block 1847291"

**Right — Live Metrics Dashboard**:
- Glassmorphic panel (400px × 320px) dengan real-time feel:
  ```
  ┌─────────────────────────────┐
  │  NETWORK STATUS              │
│  ● Live                      │
│                              │
│  Active Agents    12,847     │
│  24h Volume       $4.2M      │
│  Avg Execution    0.3s       │
│  Success Rate     99.7%      │
│                              │
│  [Sparkline charts]          │
│  ~~~~~∿∿∿∿~~~~~~           │
│  (Emerald Pulse, live feel)  │
│                              │
│  Latest: Agent #9912         │
│  executed swap → $1,240      │
│  0x...a3b2 → 0x...c4d1      │
│  2s ago                      │
│                              │
└─────────────────────────────┘
  ```
- Numbers: Monospace, tabular-nums
- Sparklines: Canvas, Emerald Pulse, animated draw-on-scroll
- "Latest" feed: Scrolls up setiap 3 detik dengan fade transition — simulated live feed
- Pulsing green dot di "Live" indicator

**Entrance**: Quote fades in + slight translateX dari kiri. Metrics panel slides up dengan glassmorphic fade.

---

### SECTION 10: CTA / FOOTER HERO

**Layout**: Centered, massive impact.

**Background**:
- Radial gradient burst dari center (Robinhood Green 20% opacity → transparent)
- Particle network lebih dense di section ini
- Subtle grid overlay (1px, Robinhood Green, 3% opacity)

**Content**:
- H1 (Display size): "Deploy Your Agent."
- Sub: "Join the machine-to-machine economy."
- **Dual CTA**:
  - "Launch App" — Large pill, Accent Gradient hijau, massive glow shadow, hover: scale 1.05 + brighter
  - "Read Documentation" — Large pill, transparent, Glass Border, hover: border Robinhood Green
- **Social Proof Bar** (di bawah CTA):
  ```
  Trusted by agents from: [Solana Logo] [Ethereum Logo] [Arbitrum Logo] [Jupiter Logo] [Magic Eden Logo]
  ```
  — Grayscale logos, 40% opacity, hover: full color + 100% opacity

**Entrance**: Text scales dari 0.9 + fade. CTAs pop in dengan spring. Logos fade in staggered.

---

### SECTION 11: FOOTER

**Layout**: 4-column grid + bottom bar.

**Columns**:
1. **Brand**: Logo + tagline "Autonomous AI Commerce Protocol" + social icons (Twitter/X, Discord, GitHub, Mirror) — custom icons, 20px, Neural Gray → Plasma White on hover
2. **Product**: Agents, Marketplace, NFT Passport, Tokenized Stocks, Security
3. **Developers**: Docs, API Reference, SDK, GitHub, Status
4. **Company**: About, Careers, Blog, Brand Kit

**Bottom Bar**:
- Left: "© 2026 Strix Hood Protocol. All rights reserved."
- Right: "Terms • Privacy • Cookies"
- Divider: 1px solid Glass Border
- Background: Slightly darker than main footer (`#07070A`)

**Hover**: Links have underline slide animation dari kiri. Color transition Neural Gray → Plasma White.

---

## 7. COMPONENT LIBRARY

### Buttons

**Primary (Gradient)**:
- Background: Accent Gradient (Robinhood Green → Teal Surge)
- Color: Void Black
- Padding: 14px 28px
- Border-radius: 100px (pill)
- Font: 14px, weight 600, uppercase, letter-spacing 0.05em
- Shadow: `0 0 20px rgba(0, 200, 5, 0.3)`
- Hover: `filter: brightness(1.15)`, `transform: scale(1.02)`, shadow intensifies
- Active: `transform: scale(0.98)`
- **Shimmer**: Pseudo-element gradient yang sweeps left-to-right setiap 3s (subtle hijau shimmer)

**Secondary (Outline)**:
- Background: transparent
- Border: 1px solid Glass Border
- Color: Plasma White
- Hover: Border → Robinhood Green, background → `rgba(0, 200, 5, 0.05)`

**Ghost**:
- Background: transparent
- Color: Neural Gray
- Hover: Color → Plasma White, underline appears

### Cards

**Standard Card**:
- Background: Card Gradient
- Border: 1px solid Glass Border
- Border-radius: 20px
- Padding: 32px
- Hover: translateY(-4px), border-color → `rgba(0, 200, 5, 0.3)`, `box-shadow: 0 20px 40px rgba(0,0,0,0.3)`

**Glass Card**:
- Background: `rgba(13, 31, 13, 0.4)`
- Backdrop-filter: blur(20px)
- Border: 1px solid `rgba(0, 200, 5, 0.2)`
- Border-radius: 24px

**NFT Card**:
- Border-radius: 32px
- Holographic sheen layer (hijau/teal)
- 3D tilt on hover (CSS perspective)
- Glint sweep on hover

### Inputs

**Text Input**:
- Background: `rgba(255,255,255,0.03)`
- Border: 1px solid `rgba(255,255,255,0.1)`
- Border-radius: 12px
- Padding: 14px 16px
- Font: 15px, Inter
- Focus: Border → Robinhood Green, glow `0 0 0 3px rgba(0, 200, 5, 0.15)`
- Placeholder: Neural Gray

### Badges/Pills

**Status Pill**:
- Padding: 6px 12px
- Border-radius: 100px
- Font: 11px, weight 600, uppercase
- Variants:
  - Live: Background `rgba(0, 200, 5, 0.15)`, color Robinhood Green, border `rgba(0, 200, 5, 0.3)`
  - Warning: Background `rgba(255, 153, 0, 0.15)`, color Amber
  - Error: Background `rgba(255, 80, 0, 0.15)`, color Crimson Alert

---

## 8. ANTI-AI-SLOP MANIFESTO

### What Makes This Design Non-Generic:

1. **NO Hero Illustrations from Undraw/Storyset** — Semua visual adalah generative/3D custom atau abstract data viz.
2. **NO Generic Gradient Backgrounds** — Backgrounds memiliki struktur: particle networks, grid overlays, noise textures.
3. **NO Bootstrap Card Shadows** — Shadows are colored (hijau tint), layered, dan context-aware.
4. **NO Default System Fonts** — Custom font stack dengan clear hierarchy.
5. **NO Center-Aligned Everything** — Asymmetric layouts, intentional misalignment untuk visual interest.
6. **NO Placeholder Content** — Setiap stat, setiap angka, setiap alamat wallet adalah realistic dan contextual.
7. **NO Static Icons** — Icons are animated, interactive, atau berubah state.
8. **NO "Trusted By" Logo Bar yang Membosankan** — Logos are grayscale dengan hover color reveal, bukan bar statis.
9. **NO Generic Timeline** — Pipeline section menggunakan animated data packets, bukan garis vertikal dengan dot.
10. **NO Default Form Styling** — Custom inputs dengan glow effects dan purposeful focus states.
11. **NO Flat Colors** — Setiap surface memiliki depth: gradients, noise, subtle patterns.
12. **NO "Features Grid 3×3"** — Bento grid dengan intentional size variation.
13. **NO Stock Photography** — Semua imagery adalah abstract/generated atau data visualization.
14. **NO Generic Testimonial Cards** — Large asymmetric quote dengan live metrics panel.
15. **NO Footer Link Dump** — Organized columns dengan hover animations dan social proof.

### Technical Anti-Slop:
- **Custom Cursor**: Small dot (8px, Robinhood Green) yang membesar (24px) dan invert color saat hover interactive elements. Blend mode: difference.
- **Grain Texture**: Subtle noise overlay (opacity 3%) di seluruh page untuk menghindari "digital flatness"
- **Scroll Velocity**: Elements respond to scroll speed (skew atau scale subtle based on velocity)
- **Reduced Motion**: Full respect untuk `prefers-reduced-motion` — semua animations degrade gracefully ke simple fades

---

## 9. RESPONSIVE BREAKPOINTS

| Breakpoint | Width | Key Changes |
|------------|-------|-------------|
| Desktop XL | 1440px+ | Full layout, max animations |
| Desktop | 1280px | Standard layout |
| Tablet | 768px-1279px | 2-column grids, reduced particle count, hamburger nav |
| Mobile | <768px | Single column, stacked sections, touch-optimized interactions, simplified 3D |

**Mobile-Specific**:
- Hero: Stack vertical, 3D visual becomes static image dengan subtle parallax
- Pipeline: Vertical stack dengan animated connections
- Bento Grid: Single column, cards full-width
- Agent Marketplace: Horizontal swipe dengan snap
- Navigation: Full-screen overlay dengan staggered link reveals

---

## 10. TECHNICAL NOTES

### Recommended Stack
- **Framework**: Next.js 14+ (App Router) atau Astro
- **Styling**: Tailwind CSS dengan custom design tokens
- **Animations**: Framer Motion (React) atau GSAP + ScrollTrigger
- **3D**: Three.js / React Three Fiber (Hero visual) atau Spline embed
- **Icons**: Custom SVG set — NO Lucide/Phosphor defaults tanpa modifikasi
- **Fonts**: Space Grotesk (Google Fonts), JetBrains Mono (Google Fonts)
- **Canvas**: HTML5 Canvas untuk particle network dan sparklines

### Performance
- Lazy load 3D visual dan heavy animations
- Particle count: Max 150 on desktop, 50 on mobile
- Use `will-change: transform` sparingly, hanya pada elements yang animate
- Images: WebP format, lazy loaded
- Font subsetting: Hanya load weights yang digunakan

### Accessibility
- Color contrast ratio minimum 4.5:1 untuk body text
- Focus states: Visible outline (2px Robinhood Green) pada semua interactive elements
- `prefers-reduced-motion`: Disable parallax, simplify entrance animations ke fade-only
- Semantic HTML: Proper heading hierarchy, landmark regions, alt text untuk decorative visuals

---

## 11. ASSET CHECKLIST

### Custom Graphics Needed
- [ ] Strix Hood Logo (SVG, wordmark + icon) — hijau Robinhood
- [ ] Agent Brain 3D Model (Three.js/Spline) — hijau/emerald
- [ ] Particle Network System (Canvas/WebGL) — hijau nodes
- [ ] Pipeline Icons (5 custom SVGs) — hijau line-art
- [ ] Security Layer Icons (5 custom SVGs) — hijau line-art
- [ ] Agent Category Avatars (6 generative abstract portraits)
- [ ] NFT Equipment Module Icons (5 custom SVGs)
- [ ] Token Distribution Donut Chart (SVG/Canvas) — hijau palette
- [ ] Partner/Integration Logos (SVG, grayscale + color versions)

### Generated Content
- [ ] Agent NFT Mockup (Level 1-4 variations) — hijau holographic
- [ ] Abstract Background Patterns (grid, noise)
- [ ] Holographic Sheen Texture (CSS gradient hijau)

---

## 12. FINAL CHECKLIST

Before shipping, verify:
- [ ] No placeholder text remains
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Mobile layout tested on actual devices
- [ ] Load time < 3s on 4G
- [ ] All interactive elements have hover/focus states
- [ ] Color contrast passes WCAG AA
- [ ] Custom cursor works across all browsers
- [ ] 3D visual degrades gracefully without JS
- [ ] Typography renders correctly dengan custom fonts
- [ ] No generic stock imagery used
- [ ] Every section has a "wow" moment

---

**End of Prompt**

*Strix Hood — Where AI Agents Become Economic Actors.*
