# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**data-joule.com** — Data Joule, a single-page "observatório de energia" by Bronze Engenharia de Energia (brand swap of Oct 2026: this site moved from bronze-engenharia.com.br to data-joule.com, and the Grupo A audit landing from the `data-joule-web` repo moved to bronze-engenharia.com.br; the "Para você" notes link there). Built as a single page (Next.js 16 App Router, TypeScript, React 19). Twelve sections of live instruments built on public data, Brazil first (PT-BR is the canonical copy). Ported from the Claude Design project "Bronze Engenharia", file `Direção A v4 - Brasil primeiro.dc.html` (local copy in `design/`). When the design changes, re-port from that file instead of restyling ad hoc.

## Commands

```bash
npm run dev          # localhost:3000, no env vars required
npm test             # vitest: parsers and helpers (offline)
LIVE=1 npm test      # also hits every real endpoint and prints a status table
npm run lint
npm run build        # CI runs lint + test + build
npm run snapshot     # refresh design-data.json, design/data2.js and data/snapshot.json from the live sources (python3, stdlib only)
node scripts/shoot.mjs http://127.0.0.1:3000/ <out-dir> [light|dark] [width]   # per-section screenshots + layout boxes via Chrome DevTools protocol
```

## Layout of the code

- `lib/sources/` — one module per source family (`ons.ts`: carga, CMO, balanço de energia (hourly by source) and Energia Agora (today, minute by minute); `markets.ts`: FRED, PTAX, Kalshi, Polymarket; `abroad.ts`: Hydro-Québec, CAISO, Open-Meteo). Each exports a pure `parse*` (tested in `tests/parsers.test.ts`) and a `fetch*` that goes through `http.ts` (timeout, User-Agent, `next: { revalidate }`).
- `lib/observatory.ts` — `getObservatory()` runs all sources in parallel. A failed source falls back to `data/snapshot.json` and its `status[key].live` is false; the stamp then reads "sem sinal agora · última leitura …". Never render a blank instrument.
- `lib/derive.ts` — every number the page states in words (bills with taxes "por dentro", CMO extremes and spreads, Kalshi quantiles, Polymarket range). Sentences are generated from data; do not hard-code readings in copy.
- `lib/chart.ts` — SVG path helpers ported from `design/helpers.js`, plus `isotonicDecreasing` (the "ajuste isotônico" the Método text promises).
- `components/sections/*.tsx` — server components, one per section, in page order: Pulso, Preco, Pato ("A curva do pato": net load, the evening ramp, curtailment), Quem ("Quem gera": map of the largest plants, thermal dispatch by reason, the bandeira trigger), Mercado, Mini ("Minigeração sob controle": the oversupply-cut calendar and what a minigeração plant would lose if cut like utility solar), Petroleo, Bomba, Parana, Fora, Tendencias ("Para onde vai o setor": six trend cards; the first three follow the CCEE's 2026 challenges, numbers reused from other sections, unverified claims tagged), Bastidores. Client components: `components/ThemeToggle.tsx`, `components/MiniCalc.tsx` (section 6 calculator; per-kWp numbers come precomputed) and `components/Ticker.tsx` (the "Hoje" strip; each reading opens a short explanation on hover, focus or first tap — the copy lives in `app/page.tsx`).
- `app/observatory.css` — tokens and every class, global (single page). Light/dark follows `prefers-color-scheme`; the toggle sets `html[data-theme]` and localStorage (applied before paint by the inline script in `app/layout.tsx`).

## Data rules

- Unverified constants carry a red `<Todo>` tag on the page ("a confirmar"). Remove the tag only when the value is checked against its primary source.
- Build-time datasets (ANP fuel, BDGD, CCEE/ABGD numbers, Copel tariffs, lab tiers) live in `data/snapshot.json`, produced by `scripts/build_design_data.py`. Edit the script, not the JSON.
- CMO and balanço: request only the tail of the yearly CSV (`Range: bytes=-40000`); the whole file passes Next's 2 MB fetch-cache limit late in the year.
- Energia Agora (`tr.ons.org.br`): load includes rooftop solar (MMGD) but the solar series does not, and there is no MMGD series — only the current value in `GetBalancoEnergetico`. Today's MMGD curve is estimated (plant-solar profile × the measured ratio) and the page says so. Without a fallback: if it fails, 3a shows only the full day.
- Per-plant generation and thermal dispatch by reason (`lib/sources/geracao.ts`): monthly ONS files that grow ~2.3 MB and ~1.1 MB a day. `getTail` in `http.ts` reads the end of the file in chunks under Next's 2 MB cache limit; early in a month it falls back to last month's file. Plants are joined by CEG (Itaipu's two halves share one); the CVU joins by `cod_usinaplanejamento`. Thermal reasons that add up to verified generation: ordem de mérito acima da inflexibilidade, inflexibilidade, razão elétrica, garantia energética + GFOM, unit commitment, and the rest (do not add `val_verifordemmerito`, it already contains inflexibility).
- Map and plants are build-time (`scripts/usinas.py` → `data/usinas.json`): ONS capacity registry, Wikidata coordinates (aliases and site/municipality fallbacks in the script, with a check that each point falls in its state), IBGE state outlines projected to SVG paths. No map library, no tiles, no token.
- The bandeira trigger (4c) is hand-copied: CCEE blocks automated reads of the InfoBandeira PDFs. After each ANEEL announcement (last Friday of the month) add the new month to `data/infobandeira.json` and update `gatilho.proximo` in `scripts/build_design_data.py`.
- Curtailment (`restricao_coff_*`, 20–45 MB per month) and the duck history are build-time only: `scripts/intermitentes.py` writes `data/intermitentes.json` (closed months cached in `.cache/ons/`), merged into the snapshot. The balanço file only counts rooftop solar from May 2023, so the history starts there.
- Section 6 (minigeração) is build-time: `scripts/minigeracao.py` → `data/minigeracao.json` (merged into the snapshot as `mmgd`). ENE cuts per day and hour from the same `restricao_coff_*` files (cached in `.cache/ons/ene-v2-*`), Open-Meteo hourly irradiance for one city per subsystem (PR 0,80), and the hand-kept list `EMERGENCIAS` (ONS emergency plan activations for Tipo III, each with its source; add new ones there). The "cut like the plants" scenario applies, hour by hour, the share of utility solar cut for ENE. CP 33/2026 numbers come from the ANEEL vote (process 48500.002211/2026-10, § 69–70); CP 9/2026's official text was not found, so the page states no rule from it beyond "physical cuts admitted, undecided".
- CCEE's open-data portal and ANEEL's CKAN block or time out scripted access: build-time only, never a runtime dependency.
- Hydro-Québec peak events use the field `datedebut` (not `date_debut`).

## Routing and security

`proxy.ts` allows only `/`, `/privacidade`, the icon files and `/email/logo-*.png` (loaded by Jeferson's e-mail signature from data-joule.com — never remove them); everything else renders `app/not-found.tsx` with 404. Security headers and CSP in `next.config.ts` are deliberate (copied from data-joule-web): fonts are self-hosted through `next/font`, all data fetching is server-side, so `connect-src 'self'` holds. Adding a page, file, third-party script, font or image host means changing `proxy.ts` and/or the CSP.

## Domains

Canonical: `data-joule.com` (Vercel project `bronze-web`, Production; zone on Vercel DNS, which also carries the mail records for contato@data-joule.com). The bronze-engenharia.com.br / .com domains belong to the `data-joule-web` project after the swap.

## Workflow

Feature branch in a worktree → PR → Vercel preview → merge only when Jeferson says "merge". He sets DNS and environment variables in the dashboards himself. Contact e-mail on the site stays `contato@data-joule.com` until ImprovMX is set up; never publish an `@bronze-engenharia` address.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
