# STRIX HOOD — Prompt (Disesuaikan untuk Build)

Basis: `uploads/strix_hood_web_design_prompt_robinhood_green.md`. Semua identitas visual, palet hijau, type scale, struktur section 0–11, dan Anti-AI-Slop Manifesto **dipertahankan**. Di bawah ini hanya delta penyesuaian agar prompt bisa dieksekusi sebagai satu halaman interaktif yang ringan.

## Penyesuaian Teknis
- **Stack**: Next.js/Tailwind/GSAP → satu file HTML interaktif (React runtime, inline styles). Zero build step, zero dependency eksternal selain Google Fonts.
- **Hero 3D (Three.js/Spline)** → "Agent Core" berbasis CSS (orbit rings, glowing core, fragmen diamond) + **particle network Canvas 2D** dengan mouse-repel. Visual sama hidupnya, jauh lebih ringan (<3s load tetap tercapai).
- **Icons** → sistem *geometric glyph* (lingkaran, diamond, ring, dashed-circle) yang konsisten — bukan SVG ilustratif hand-drawn, bukan icon pack default. Sesuai manifesto #7.
- **Preloader** dipersingkat ke ±1.8 detik, click-to-skip, auto-skip saat `prefers-reduced-motion`.
- **Partner logos** → wordmark tipografis grayscale (hover reveal hijau). Tidak menggambar ulang logo pihak ketiga.
- **Count-up numbers** dihilangkan; angka monospace tabular statis (lebih tenang, tetap anti-slop).
- **Pipeline packets**: dot Emerald bergerak di connector antar stage (CSS keyframe), bukan SVG path kompleks.
- **Donut tokenomics**: SVG stroke-dasharray murni (5 segmen), bukan library chart.

## Yang Tetap Sesuai Prompt Asli
- Palet: Void Black `#0A0A0F`, Robinhood Green `#00C805`, Emerald Pulse `#2EDA12`, Teal Surge `#00E5A0`, Plasma White `#F5F5F7`, Deep Forest, Neural Gray, Crimson Alert, Amber Signal, Glass Border.
- Typografi: Space Grotesk (display/UI) + JetBrains Mono (data). Type scale & aturan anti-slop (no center body text, tabular-nums, balance headings).
- Semua 12 section: preloader boot sequence, nav fixed blur, hero asimetris 55/45 + floating intent cards, ticker RWA, intent pipeline 5 stage, bento capabilities, Agent NFT passport + equipment modules, security stack 5 layer + policy panel, tokenomics + revenue flow, marketplace dengan filter kategori live, testimonial + live metrics feed, CTA besar, footer 4 kolom.
- Interaksi: custom cursor (blend-difference, membesar di elemen interaktif), reveal-on-scroll, hover lift + border glow, 3D tilt NFT card, holographic sheen, shimmer CTA, live feed berganti tiap 3 detik, grain overlay 3%, `prefers-reduced-motion` dihormati.

## Kontrol (Tweaks)
- `preloader` — on/off boot sequence
- `customCursor` — on/off cursor custom
- `particles` — on/off particle network
