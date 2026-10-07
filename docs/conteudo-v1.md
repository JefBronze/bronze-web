# bronze-engenharia.com.br — estrutura e textos (rascunho v1)

Site institucional e portfólio da Bronze Engenharia de Energia: engenharia de energia regulada (CREA) + Internet da Energia.
Uma página longa, português principal, versão em inglês com o mesmo conteúdo (`/en`).
Só o que existe e funciona; nada ao vivo (sem APIs, sem telemetria). Itens entre [colchetes] precisam de você.

Público: parceiros técnicos (GEDISA, distribuidoras, LF Energy, Hydro-Québec), clientes que pesquisam quem está por trás da Data Joule.

---

## 1. Cabeçalho

PT: Bronze Engenharia de Energia · Projetos · Sobre · Contato · EN
EN: Bronze Energy Engineering · Projects · About · Contact · PT

---

## 2. Abertura (hero)

**PT**
Título: Engenharia de energia, com dados.
Texto: Unimos engenharia elétrica com responsabilidade técnica e Internet da Energia: dados públicos do setor elétrico, padrões abertos e dispositivos conectados à rede. Projetos que medem, explicam e reduzem custos de energia.
Linha de apoio: Curitiba · Montréal · CREA-PR 194835/D

**EN**
Title: Energy engineering, built on data.
Text: We combine licensed electrical engineering with the Internet of Energy: public power-sector data, open standards and grid-connected devices. Projects that measure, explain and cut energy costs.
Support line: Curitiba · Montréal · CREA-PR 194835/D

---

## 3. Áreas de atuação (3 blocos)

**PT**
1. **Eficiência tarifária** — Auditoria de faturas de média tensão: demanda contratada, ultrapassagem, energia reativa, modalidade tarifária e tributos.
2. **Dados do setor elétrico** — Análise de bases públicas da ANEEL, ONS e CCEE para responder perguntas concretas de custo, rede e geração.
3. **Internet da Energia** — Integração de cargas e equipamentos com a rede usando padrões abertos: OpenADR, OCPP e projetos da LF Energy.

**EN**
1. **Tariff efficiency** — Audit of medium-voltage bills: contracted demand, overrun charges, reactive energy, tariff option and taxes.
2. **Power-sector data** — Analysis of public datasets from ANEEL, ONS and CCEE to answer concrete questions about cost, grid and generation.
3. **Internet of Energy** — Connecting loads and equipment to the grid through open standards: OpenADR, OCPP and LF Energy projects.

---

## 4. Projetos (cartões: problema · o que foi feito · resultado · status)

### 4.1 Data Joule — auditoria de faturas Grupo A
**PT**
Problema: empresas de média tensão pagam por demanda que não usam, multas e reativo sem perceber.
O que fizemos: um serviço de auditoria independente que lê 12 faturas e devolve o valor recuperável em 5 dias úteis.
Status: em operação · data-joule.com
**EN**
Problem: medium-voltage businesses pay for unused demand, overrun fines and reactive energy without noticing.
What we built: an independent audit service that reads 12 bills and returns the recoverable amount in 5 business days.
Status: live · data-joule.com

### 4.2 Demanda ociosa no Paraná — dados públicos da ANEEL
**PT**
Problema: não existia um número público sobre quanto da demanda de pico fica sem uso nas empresas de média tensão.
O que fizemos: analisamos a BDGD/ANEEL 2025 da Copel — 11.780 unidades A4 com 12 meses de medição — e valoramos com a tarifa vigente (REH 3.472/2025).
Resultado: 16% da demanda de pico fica sem uso num mês típico; R$ 122 milhões por ano em demanda ociosa no estado. Em educação, 30%; em hospitais, 21%.
Status: concluído (set/2026)
**EN**
Problem: there was no public figure for how much peak demand goes unused in medium-voltage businesses.
What we did: we analysed ANEEL's 2025 distribution database for Copel — 11,780 A4 units with 12 months of metering — and priced it at the current tariff.
Result: 16% of peak demand sits idle in a typical month; R$ 122 million a year in idle demand statewide. 30% in education, 21% in hospitals.
Status: completed (Sep 2026)

### 4.3 Tarifas brasileiras em padrão aberto (URPX · LF Energy)
**PT**
Problema: tarifas de energia só existem em PDFs de resoluções; cada empresa as redigita do seu jeito.
O que fizemos: modelamos a tarifa residencial da Copel e as bandeiras tarifárias no URPX, o padrão aberto de tarifas da LF Energy, e recalculamos uma fatura real a partir do modelo.
Resultado: fatura reproduzida com diferença de R$ 0,04, incluindo ICMS, PIS/COFINS "por dentro".
Status: protótipo · próximo passo: tarifas do Grupo A (Verde e Azul)
**EN**
Problem: electricity tariffs only exist as PDF resolutions; everyone re-types them their own way.
What we did: we modelled Copel's residential tariff and the national tariff flags in URPX, LF Energy's open tariff standard, and recomputed a real bill from the model.
Result: bill reproduced within R$ 0.04, including Brazil's tax-inclusive ICMS and PIS/COFINS.
Status: prototype · next: Grupo A (Verde and Azul) tariffs

_(Seção do laboratório OpenADR removida em out/2026: o laboratório em Montréal foi desligado.)_

### 4.5 Auditoria de cortes de geração (em desenvolvimento)
**PT**
Problema: geradores eólicos e solares têm direito a compensação por cortes, mas precisam decidir com base num número que não conseguem verificar.
O que estamos fazendo: um método reproduzível, com dados públicos do ONS e da CCEE, para recalcular a energia cortada por usina.
Status: em desenvolvimento
**EN**
Problem: wind and solar generators are entitled to compensation for curtailment but must decide based on a number they cannot verify.
What we are building: a reproducible method, using public ONS and CCEE data, to recompute curtailed energy per plant.
Status: in development

---

## 5. Como trabalhamos (4 princípios)

**PT**
- **Independência:** não vendemos energia, painéis solares nem migração para o mercado livre.
- **Método reproduzível:** cada número cita a norma, a tarifa ou a base de dados de onde veio.
- **Padrões abertos:** preferimos formatos e ferramentas abertos (OpenADR, OCPP, LF Energy) a soluções fechadas.
- **Responsabilidade técnica:** trabalhos assinados por engenheiro registrado, com ART quando exigida.

**EN**
- **Independence:** we do not sell energy, solar panels or free-market migration.
- **Reproducible method:** every figure cites the regulation, tariff or dataset it came from.
- **Open standards:** we favour open formats and tools (OpenADR, OCPP, LF Energy) over closed ones.
- **Licensed responsibility:** work signed by a registered engineer, with ART when required.

---

## 6. Sobre

**PT**
Jeferson Bronze — Engenheiro de energia, CREA-PR 194835/D. [Formação: curso, instituição, ano] [Experiência: 2–3 linhas — empresas/projetos anteriores] Fundador da Bronze Engenharia de Energia e da Data Joule. Atua entre Curitiba e Montréal.
[Foto profissional — opcional]

**EN**
Jeferson Bronze — Energy engineer, CREA-PR 194835/D. [Education] [Experience] Founder of Bronze Energy Engineering and Data Joule. Works between Curitiba and Montréal.

---

## 7. Contato

**PT/EN**
[E-mail: contato@data-joule.com]
[LinkedIn: URL do seu perfil]
WhatsApp: +1 438 979 6085

---

## 8. Rodapé

Bronze Engenharia de Energia · CNPJ 19.824.419/0001-96 · Curitiba/PR · [Registro da empresa no CREA-PR, se houver] · Política de privacidade

---

## Decisões técnicas (para quando formos construir)

- Domínio principal bronze-engenharia.com.br; bronze-engenharia.com redireciona para ele.
- O .com.br está com DNS no GoDaddy: mudar os nameservers para a Vercel (como o .com) ou criar os registros que a Vercel pedir.
- O .com ainda tem MX do Google Workspace (cancelado): remover ou trocar pelos do ImprovMX antes de publicar qualquer e-mail @bronze-engenharia.
- Projeto Vercel separado do Data Joule; mesma trava: só as páginas públicas escolhidas.
- Identidade visual própria, sóbria, relacionada à da Data Joule (mesma família tipográfica, outra cor de destaque).
