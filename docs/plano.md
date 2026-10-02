# Bronze Engenharia — live energy observatory website

## Context

`bronze-web/conteudo.md` describes a brochure site (hero, 3 service blocks, project cards, About). Jeferson wants something else: a **state-of-the-art page that shows mastery of both energy and programming** — less about him, more about the craft. The site should pull live public data (grids, oil, prediction markets) and render it with hand-made, editorial-quality visualisations, while still carrying the Bronze Engenharia identity (CREA, Curitiba · Montréal) quietly in the footer. After this plan he will take the brief into **Claude Design** to pick a visual direction, so the plan ends with a design handoff, not pixels.

Reuse: the stack and hardening of `~/Documents/Projects/Data-Joule/data-joule-web` (Next 16 App Router, TS, CSS modules, `next/font`, strict CSP, `proxy.ts` allow-list). Grid fetch logic exists in Python in `Data-Joule/data-joule/vps/{hq,ons,nyiso}_bridge.py` and will be ported to TS.

## Concept — "Observatório de Energia" (working title)

One long bilingual page (PT at `/`, EN at `/en`) that reads like a data-journalism feature: a sequence of **live instruments**, each one a small essay answering a concrete question, each number stamped with source + timestamp. Nothing fake: every live tile degrades to "last reading · há N min" when a source is down. A **colophon** at the end explains how it is built — that section *is* the portfolio.

### Sections (top → bottom)

| # | Section | Question it answers | Data | Visual |
|---|---|---|---|---|
| 1 | **Pulso** (hero) | What are two grids doing *right now*? | ONS carga SIN (4 subsistemas) + Hydro-Québec demand (15-min) | Two live area curves on one time axis (Brasília vs Montréal local time), big current MW figures, tiny HQ peak-event badge. Headline: "Engenharia de energia, com dados." |
| 2 | **Petróleo e probabilidade** | What does the market *think* oil will do? | FRED WTI/Brent/Henry Hub (daily); Polymarket WTI "hit $X" event; Kalshi `KXWTI` strike ladder | Spot line + **implied probability distribution** derived from both venues (isotonic-fitted CDF → density), median + 80 % band, Polymarket vs Kalshi overlaid. Disclaimer footnote. |
| 3 | **Mix na rede** | How green is the grid this hour? | CAISO fuel-source CSV (5-min), NYISO rtfuelmix | Stacked band chart + renewables-share dial; CAISO/NYISO switch |
| 4 | **O preço da energia no Brasil** (centrepiece, 3 panels) | What does a MWh cost today, from the wholesale market to three different bills? | ONS CMO semi-horário (live, daily), PLD floor/ceiling (CCEE, static per year), bandeira vigente (ANEEL, monthly), tarifas homologadas por distribuidora (ANEEL, build-time snapshot), URPX models | See "Section 4 detail" below |
| 5 | **Na bomba** (for gas-station owners) | What do gasolina, etanol and diesel cost, where does the price come from, and does ethanol pay off in my state? | ANP monthly station-level survey (build-time snapshot, ~75k rows/month: pump price, product, brand, município), Petrobras refinery price (build-time scrape), tax constants per year (ICMS monofásico R$/L per state, PIS/COFINS R$/L), anhydrous-ethanol blend share, BCB PTAX (live) | See "Section 5 detail" below |
| 6 | **Demanda ociosa no Paraná** | How much contracted demand sits idle? | Precomputed aggregates from BDGD/Copel 2025 (11 780 A4 units, from `auditoria-fatura/bdgd_analise.md`) — static JSON | Canvas beeswarm by sector, R$ 122 M/ano headline, sector filter |
| 7 | **Laboratório OpenADR** | Can compute shed load on a grid signal? | Recorded event trace from the Montréal lab (W vs t, tiers T1–T3) — static JSON | Scrubbable replay of one real event (10–14 W → 0 W, 55 s recovery) |
| 8 | **Colofão** | How is this built? | — | Stack, caching per source, perf budget, source list with live "última leitura", link to public repo, licence. Footer: Bronze Engenharia de Energia · CNPJ · CREA-PR 194835/D · Curitiba · Montréal · WhatsApp · e-mail |

### Section 4 detail — "O preço da energia no Brasil"

One MWh, followed from the dispatch model to the bill. Three panels, same R$/MWh axis, so the reader sees the price multiply as it moves downstream.

**4a · Atacado, hoje** — CMO semi-horário for the current day, four subsystems (SE/CO, S, NE, N) as four thin lines over 48 half-hours, with the PLD floor/ceiling band drawn behind (CMO clamped to the band = "PLD estimado"; labelled as an estimate, since the official PLD is CCEE's). Current half-hour highlighted; per-subsystem "agora" figures. Hover shows the spread between subsystems (why energy in the North costs 2× the South tonight).

**4b · A bandeira do mês** — the flag as a typographic object (Verde / Amarela / Vermelha 1 / Vermelha 2) with its R$/100 kWh surcharge and the 24-month history as a colour strip. Source: ANEEL monthly announcement; value kept in `data/bandeiras.json` and refreshed by the build script (ANEEL page scrape with committed fallback).

**4c · Três faturas, um MWh** — the showpiece. The visitor picks a distribuidora (default Copel) and a monthly consumption; three bills are computed side by side from URPX models:
- **B1 residencial** (energy + TUSD + bandeira + ICMS/PIS/COFINS "por dentro"),
- **A4 Verde** (energy ponta/fora-ponta + single demand charge),
- **A4 Azul** (energy + two demand charges).
Each bill is a vertical stack (energia · fio · encargos · bandeira · tributos) on the same R$/MWh scale as 4a, so the wholesale price from panel 4a appears as the small bottom slice of each stack. A toggle "mostrar tarifa de outras distribuidoras" turns 4c into a ranked bar chart of the B1 tariff across all ~50 distribuidoras (ANEEL tarifas homologadas snapshot), Copel highlighted. The URPX JSON for the selected tariff is shown in a collapsible code pane — that is the "open standard" proof.

Data notes: Copel B1 already exists in `Data-Joule/urpx` (reproduces a real bill within R$ 0,04). A4 Verde/Azul are the next URPX models (planned anyway, see memory `urpx-prototype`); tariff values for them come from the ANEEL snapshot, and `auditoria-fatura/sim_verde_azul.py` has the computation logic to port. PLD floor/ceiling per year is a two-number constant from CCEE. ANEEL CKAN (`dadosabertos.aneel.gov.br`) timed out during tonight's probes — treat it as build-time only, never a runtime dependency.

### Section 5 detail — "Na bomba" (added 2026-10-01 at Jeferson's request: something for gas-station owners)

Three panels, R$/litro.

**5a · Etanol compensa?** — the classic 70 % rule, computed per state from the ANP monthly survey: median etanol ÷ median gasolina. A 27-state ranked bar (ratio), with the 0,70 line; states below it are where ethanol wins. August 2026: MT 0,55 · SP 0,56 · MS 0,59 · GO/PR 0,61 … RS 0,75 · AP 0,88 — ethanol pays off in 11 states. Selector for the visitor's state; default PR.

**5b · O preço na sua cidade** — município selector (default Curitiba): median pump price for gasolina, gasolina aditivada, etanol, diesel S10, GNV; distribution as a strip plot of all stations surveyed in the município, coloured by bandeira (branca / Vibra / Ipiranga / Raízen / regional). Curitiba Aug 2026: gasolina 6,89 · etanol 4,69 · diesel S10 6,99; white-flag stations ≈ R$ 0,15 cheaper than the majors. 12-month line per product (ethanol's harvest seasonality shows).

**5c · Anatomia do litro** — the gasolina C price as a vertical stack (same device as the electricity bill in 4c): Petrobras refinery price (gasolina A) · anhydrous ethanol blend share · PIS/COFINS (fixed R$/L) · ICMS monofásico (fixed R$/L, per state) · distribution + resale margin (= pump median − everything above). Diesel S10 as a second stack (biodiesel blend instead of ethanol). Side note: Brent in BRL (FRED × BCB PTAX, live) vs the Petrobras price — the import-parity gap that drives station owners' expectations of the next adjustment.

Data notes: ANP open data lives at `gov.br/anp/.../arquivos/shpc/dsan/{YYYY}/{MM}-dados-abertos-precos-{gasolina-etanol|diesel-gnv|glp}.csv` (`;`-separated, Latin characters, ~9 MB + 4 MB per month, published with ~1-month lag; file names are not perfectly consistent — `scripts/build-data.mjs` must list the index page and match by regex). The `Valor de Compra` column is empty in 2026 files, so dealer margin is derived (5c), never read. Petrobras prices: `precos.petrobras.com.br` (scrape at build time, committed fallback). Tax constants: `data/fuel-taxes-{YYYY}.json`, hand-maintained from the CONFAZ/Receita acts, each with its citation. BCB PTAX: `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='MM-DD-YYYY'&$format=json` (verified key-free, live).

Dropped from `conteudo.md`: About with bio/photo, service blocks, project cards. Kept as one footer line + colophon. Joule Credits / Chainlink still excluded.

## Data sources (all verified key-free on 2026-10-01)

| Source | Endpoint | Cadence | Cache (server) |
|---|---|---|---|
| ONS carga verificada | `https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio&dat_fim&cod_areacarga={S,SECO,NE,N}` (JSON; needs a User-Agent; ~30-min lag) | 30 min | 10 min |
| Hydro-Québec demand | `https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/demande-electricite-quebec/records?order_by=date desc&where=valeurs_demandetotal is not null` ; peak events `…/evenements-pointe/records` | 15 min | 5 min |
| NYISO load / fuel mix | `https://mis.nyiso.com/public/csv/pal/{YYYYMMDD}pal.csv`, `…/rtfuelmix/{YYYYMMDD}rtfuelmix.csv` (fallback to yesterday on 404) | 5 min | 5 min |
| CAISO fuel source | `https://www.caiso.com/outlook/current/fuelsource.csv` | 5 min | 5 min |
| FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO` / `DCOILBRENTEU` / `DHHNGSP` | daily | 6 h |
| Polymarket Gamma | `https://gamma-api.polymarket.com/events?tag_slug=oil&active=true&closed=false` → pick the "What will WTI hit in <month>" event; `markets[].outcomePrices` | live | 2 min |
| Kalshi | `https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=KXWTI&status=open` (`floor_strike`, `yes_bid/ask_dollars`, `close_time`) | live | 2 min |
| ONS CMO semi-horário | `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_tm/CMO_SEMIHORARIO_{YYYY}.csv` (`;`-separated: subsistema;nome;datetime;R$/MWh; ~1.8 MB; published daily ~22:00 UTC for D+1) | daily | 1 h, parse only the last 2 days |
| ANEEL tarifas homologadas + bandeiras | `dadosabertos.aneel.gov.br` CKAN CSV / gov.br bandeiras page — **build-time only** (`scripts/build-data.mjs`), committed fallback in `data/` | monthly | static |
| ANP preços de combustíveis (mensal, por posto) | `https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/dsan/{YYYY}/{MM}-dados-abertos-precos-*.csv` — **build-time only**, aggregated to `data/fuel-{YYYY-MM}.json` (medians per município/UF/product/bandeira + 12-month series) | monthly | static |
| Petrobras preços de refinaria | `https://precos.petrobras.com.br` — build-time scrape, committed fallback | on change | static |
| BCB PTAX (USD/BRL) | `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='MM-DD-YYYY'&$format=json` | daily | 6 h |
| Open-Meteo (optional, section 1 annotation) | `https://api.open-meteo.com/v1/forecast?latitude&longitude&current=temperature_2m` for Curitiba + Montréal | hourly | 30 min |

All fetches are **server-side only**, so the CSP keeps `connect-src 'self'`. Not available without key (skip): Electricity Maps, ENTSO-E, EIA, gridstatus.io, CCEE PLD.

## Architecture

- **Repo**: `~/Documents/Projects/BronzeEngenharia/bronze-web` → GitHub `JefBronze/bronze-web`, public, MIT (the repo is part of the showcase). Separate Vercel project; domain `bronze-engenharia.com.br`, `.com` 308-redirects to it.
- **Stack**: Next 16 (App Router, RSC, `"use cache"` + `cacheLife` per source), React 19, TypeScript strict, CSS modules + design tokens (no Tailwind), `next/font` (Source Serif 4 / Source Sans 3 / Fragment Mono — same family as Data Joule, different accent), Vercel Analytics + Speed Insights. Copy `next.config.ts` security headers and `proxy.ts` from data-joule-web; `ALLOWED` = `/`, `/en`, `/privacidade`, `/en/privacy`, icons, `/opengraph-image`.
- **Layout of code**
  - `lib/sources/<name>.ts` — one module per source: `fetch<Name>(): Promise<Reading>` + pure `parse<Name>(raw)`; every reading carries `{ asOf, source: { name, url, licence } }`.
  - `lib/markets/implied.ts` — ladder → isotonic CDF → density/median/band (pure, unit-tested).
  - `lib/urpx/` — TS port of the Copel B1 URPX model; must reproduce the reference bill within R$ 0,04 (test).
  - `app/[lang]/page.tsx` — server component composing sections; `lang ∈ {pt, en}`, dictionaries in `content/{pt,en}.ts`. Sections under `components/sections/*`.
  - `components/charts/*` — hand-written SVG (d3-scale + d3-shape only, no chart library); Canvas for the 11 780-point beeswarm; `prefers-reduced-motion` respected; light/dark via `prefers-color-scheme`.
  - `data/*.json` — static datasets (BDGD aggregates, OpenADR trace), generated by `scripts/build-data.mjs` from the source repos; never hand-edited.
  - `app/opengraph-image.tsx` — OG card rendered from the latest cached readings.
- **Resilience**: each section wrapped in `<Suspense>` + error boundary; on fetch failure render the last cached reading with "sem sinal · última leitura às HH:MM"; never a blank tile.
- **Craft budget** (stated in the colophon and enforced in CI): Lighthouse ≥ 95 all four; ≤ 90 KB client JS gzipped; zero client JS for sections 1–3 (server-rendered SVG, lightweight client "tick" only for the clock/refresh); no third-party scripts besides Vercel Analytics.
- **Tests**: Vitest on parsers (fixtures recorded from the live endpoints at build time), `implied.ts`, URPX port; Playwright smoke (page renders both languages, every section visible). CI = lint + test + build (copy the `.github` workflow from data-joule-web).

## Design handoff (for Claude Design)

Deliver before opening Claude Design:
1. `bronze-web/design-brief.md` — the section table above, tone ("instrument panel meets print feature; sober, numerate, no stock imagery"), constraints (bilingual, light+dark, 360 px → 1440 px, tabular numerals, each tile has source+timestamp footer), the type family, and **3 accent options** for him to choose from in Claude Design: petrol `#1F5F6B`, bronze `#8A6A2B`, slate `#3A5A8C` (Data Joule's terracotta `#B5561A` reserved for the Data Joule link only).
2. `bronze-web/design-data.json` — one real snapshot of every source (taken with the probes above) so the mock-ups show real numbers, not lorem.
3. New Claude Design project "Bronze Engenharia" (separate from "Data Joule"); ask for 2–3 directions for sections 1, 2 and 7 first — they carry the identity; the rest follows the chosen system. Once chosen, port from the `.dc.html` file exactly as data-joule-web did.

## Phases

0. **Brief + snapshot** — write `design-brief.md`, `design-data.json`; move `conteudo.md` → `docs/conteudo-v1.md` (reference). → Claude Design round (Jeferson).
1. **Scaffold** — `create-next-app`, copy hardening from data-joule-web, i18n routing, CI, Vercel preview. Commit on `feat/scaffold`.
2. **Data layer** — `lib/sources/*` (port the three Python bridges + FRED, CAISO, Polymarket, Kalshi), fixtures + tests, `implied.ts`, URPX port.
3. **Sections** — implement from the chosen design, in order 1 → 2 → 7 → 3 → 4 → 5 → 6.
4. **Polish** — OG image, SEO/metadata PT+EN, privacy page, perf budget check, a11y pass (keyboard on slider/scrubber, chart `<desc>` text).
5. **Launch** — Jeferson points `.com.br` nameservers to Vercel and adds the redirect for `.com`; e-mail stays `contato@data-joule.com` until ImprovMX is set up (never publish `@bronze-engenharia`).

Workflow (from memory): worktree + feature branch → PR → Vercel preview → merge only on his "merge".

## Verification

- `npm run lint && npm test && npm run build` green; CI the same.
- `npm run dev`, open `/` and `/en`: every tile shows a reading with a timestamp < its cadence; kill network → tiles show "sem sinal · última leitura" instead of breaking.
- `implied.ts` test: synthetic ladder → recovers known median; Polymarket and Kalshi curves monotone.
- URPX test: reference Copel bill reproduced within R$ 0,04.
- Lighthouse on the Vercel preview ≥ 95 ×4; bundle report ≤ 90 KB.
- Response headers on preview carry the CSP; `/qualquer-coisa` → 404.

## Assumptions (say so if wrong)

- **Português brasileiro is the canonical copy** (`/`); English (`/en`) is translated from it, never the other way round. All source names, units and legal terms (ponta/fora-ponta, bandeira, ICMS "por dentro") stay in PT with an EN gloss. No CMS; public repo under `JefBronze`.
- "Less about me" = one footer line + colophon, no bio/photo.
- Prediction-market section is informational; a short "não é recomendação de investimento" note is enough.
