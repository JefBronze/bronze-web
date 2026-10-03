# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

bronze-engenharia.com.br: a single-page "observatório de energia" (Next.js 16 App Router, TypeScript, React 19). Nine sections of live instruments built on public data, Brazil first (PT-BR is the canonical copy). Ported from the Claude Design project "Bronze Engenharia", file `Direção A v4 - Brasil primeiro.dc.html` (local copy in `design/`). When the design changes, re-port from that file instead of restyling ad hoc.

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

- `lib/sources/` — one module per source family (`ons.ts`: carga + CMO; `markets.ts`: FRED, PTAX, Kalshi, Polymarket; `abroad.ts`: Hydro-Québec, CAISO, Open-Meteo). Each exports a pure `parse*` (tested in `tests/parsers.test.ts`) and a `fetch*` that goes through `http.ts` (timeout, User-Agent, `next: { revalidate }`).
- `lib/observatory.ts` — `getObservatory()` runs all sources in parallel. A failed source falls back to `data/snapshot.json` and its `status[key].live` is false; the stamp then reads "sem sinal agora · última leitura …". Never render a blank instrument.
- `lib/derive.ts` — every number the page states in words (bills with taxes "por dentro", CMO extremes and spreads, Kalshi quantiles, Polymarket range). Sentences are generated from data; do not hard-code readings in copy.
- `lib/chart.ts` — SVG path helpers ported from `design/helpers.js`, plus `isotonicDecreasing` (the "ajuste isotônico" the Método text promises).
- `components/sections/*.tsx` — server components, one per section, in page order: Pulso, Preco, Mercado, Petroleo, Bomba, Parana, Fora, Lab, Bastidores. `components/ThemeToggle.tsx` is the only client component.
- `app/observatory.css` — tokens and every class, global (single page). Light/dark follows `prefers-color-scheme`; the toggle sets `html[data-theme]` and localStorage (applied before paint by the inline script in `app/layout.tsx`).

## Data rules

- Unverified constants carry a red `<Todo>` tag on the page ("a confirmar"). Remove the tag only when the value is checked against its primary source.
- Build-time datasets (ANP fuel, BDGD, CCEE/ABGD numbers, Copel tariffs, lab tiers) live in `data/snapshot.json`, produced by `scripts/build_design_data.py`. Edit the script, not the JSON.
- CMO: request only the tail of the yearly CSV (`Range: bytes=-40000`); the whole file passes Next's 2 MB fetch-cache limit late in the year.
- CCEE's open-data portal and ANEEL's CKAN block or time out scripted access: build-time only, never a runtime dependency.
- Hydro-Québec peak events use the field `datedebut` (not `date_debut`).

## Routing and security

`proxy.ts` allows only `/` and `/favicon.svg`; everything else renders `app/not-found.tsx` with 404. Security headers and CSP in `next.config.ts` are deliberate (copied from data-joule-web): fonts are self-hosted through `next/font`, all data fetching is server-side, so `connect-src 'self'` holds. Adding a page, file, third-party script, font or image host means changing `proxy.ts` and/or the CSP.

## Domains

Canonical: `www.bronze-engenharia.com.br` (Vercel project `bronze-web`, Production). `bronze-engenharia.com.br`, `bronze-engenharia.com` and `www.bronze-engenharia.com` 308-redirect to it. The .com.br DNS is at GoDaddy (A `@` and CNAME `www` as shown in Vercel → Domains); the .com zone is on Vercel's nameservers.

## Workflow

Feature branch in a worktree → PR → Vercel preview → merge only when Jeferson says "merge". He sets DNS and environment variables in the dashboards himself. Contact e-mail on the site stays `contato@data-joule.com` until ImprovMX is set up; never publish an `@bronze-engenharia` address.
