# data-joule-web

**Data Joule** — observatório de energia em **data-joule.com**, um projeto da Bronze Engenharia de Energia. (Até outubro de 2026 este site ficava em bronze-engenharia.com.br; os domínios foram trocados com o site de auditoria, repositório `data-joule-web`.)

Um observatório de energia: instrumentos alimentados por dados públicos do setor elétrico e de combustíveis no Brasil (ONS, CCEE, ANEEL, ANP, BCB), com o petróleo e duas redes estrangeiras como referência, desenhados à mão em SVG e renderizados no servidor. Português brasileiro primeiro.

## Rodar

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # parsers e helpers
LIVE=1 npm test      # também consulta todas as fontes reais
npm run build
```

Nenhuma variável de ambiente é obrigatória (veja `.env.example`).

## Como funciona

- `lib/sources/*` — uma função por fonte, com parser puro e testado. Tudo é buscado no servidor; o navegador só fala com o próprio site.
- `lib/observatory.ts` — junta as fontes em paralelo. Se uma cai, aquele instrumento usa o último snapshot (`data/snapshot.json`) e o carimbo diz "sem sinal agora · última leitura …".
- `lib/derive.ts` — números que a página afirma em texto (faturas com tributos "por dentro", extremos do CMO, quantis dos mercados).
- `components/sections/*` — as catorze seções; "A curva do pato" (seção 3), "Quem gera" (seção 4), "O motor por dentro" (seção 8) e "O motor elétrico por dentro" (seção 9), com modelos 3D em three.js, foram acrescentadas depois da Direção A v4.
- `npm run snapshot` — atualiza `design-data.json`, `design/data2.js` e `data/snapshot.json` a partir das fontes reais.

## Design

Portado de `design/Direção A v4 - Brasil primeiro.dc.html` (projeto "Bronze Engenharia" no Claude Design). Quando o design mudar, re-portar desse arquivo.

- `docs/plano.md` — plano aprovado (conceito, seções, fontes, arquitetura, fases).
- `docs/lapidacao-direcao-a.md` — regras de cada seção (pergunta → "Lido hoje" → instrumento → carimbo → Método → "Para você").
- `docs/conteudo-v1.md` — rascunho institucional anterior, só como referência.

Licença MIT.
