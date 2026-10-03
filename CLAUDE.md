# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**data-joule.com** — Data Joule, a single-page "observatório de energia" by Bronze Engenharia de Energia (brand swap of Oct 2026: this site moved from bronze-engenharia.com.br to data-joule.com, and the Grupo A audit landing from the `data-joule-web` repo moved to bronze-engenharia.com.br; the "Para você" notes link there). Built as a single page (Next.js 16 App Router, TypeScript, React 19). Ten sections of live instruments built on public data, Brazil first (PT-BR is the canonical copy). Ported from the Claude Design project "Bronze Engenharia", file `Direção A v4 - Brasil primeiro.dc.html` (local copy in `design/`). When the design changes, re-port from that file instead of restyling ad hoc.

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
- `components/sections/*.tsx` — server components, one per section, in page order: Pulso, Preco, Pato ("A curva do pato": net load, the evening ramp, curtailment), Mercado, Petroleo, Bomba, Parana, Fora, Lab, Bastidores. Client components: `components/ThemeToggle.tsx` and `components/Ticker.tsx` (the "Hoje" strip; each reading opens a short explanation on hover, focus or first tap — the copy lives in `app/page.tsx`).
- `app/observatory.css` — tokens and every class, global (single page). Light/dark follows `prefers-color-scheme`; the toggle sets `html[data-theme]` and localStorage (applied before paint by the inline script in `app/layout.tsx`).

## Data rules

- Unverified constants carry a red `<Todo>` tag on the page ("a confirmar"). Remove the tag only when the value is checked against its primary source.
- Build-time datasets (ANP fuel, BDGD, CCEE/ABGD numbers, Copel tariffs, lab tiers) live in `data/snapshot.json`, produced by `scripts/build_design_data.py`. Edit the script, not the JSON.
- CMO and balanço: request only the tail of the yearly CSV (`Range: bytes=-40000`); the whole file passes Next's 2 MB fetch-cache limit late in the year.
- Energia Agora (`tr.ons.org.br`): load includes rooftop solar (MMGD) but the solar series does not, and there is no MMGD series — only the current value in `GetBalancoEnergetico`. Today's MMGD curve is estimated (plant-solar profile × the measured ratio) and the page says so. Without a fallback: if it fails, 3a shows only the full day.
- Curtailment (`restricao_coff_*`, 20–45 MB per month) and the duck history are build-time only: `scripts/intermitentes.py` writes `data/intermitentes.json` (closed months cached in `.cache/ons/`), merged into the snapshot. The balanço file only counts rooftop solar from May 2023, so the history starts there.
- CCEE's open-data portal and ANEEL's CKAN block or time out scripted access: build-time only, never a runtime dependency.
- Hydro-Québec peak events use the field `datedebut` (not `date_debut`).

## Routing and security

`proxy.ts` allows only `/`, `/privacidade`, the icon files and `/email/logo-*.png` (loaded by Jeferson's e-mail signature from data-joule.com — never remove them); everything else renders `app/not-found.tsx` with 404. Security headers and CSP in `next.config.ts` are deliberate (copied from data-joule-web): fonts are self-hosted through `next/font`, all data fetching is server-side, so `connect-src 'self'` holds. Adding a page, file, third-party script, font or image host means changing `proxy.ts` and/or the CSP.

## Domains

Canonical: `data-joule.com` (Vercel project `bronze-web`, Production; zone on Vercel DNS, which also carries the mail records for contato@data-joule.com). The bronze-engenharia.com.br / .com domains belong to the `data-joule-web` project after the swap.

## Workflow

Feature branch in a worktree → PR → Vercel preview → merge only when Jeferson says "merge". He sets DNS and environment variables in the dashboards himself. Contact e-mail on the site stays `contato@data-joule.com` until ImprovMX is set up; never publish an `@bronze-engenharia` address.
