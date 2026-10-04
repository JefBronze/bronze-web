import { copelCredit, mmgdStats } from "@/lib/derive";
import { brDate, dayMonth, dec, fmt, pct } from "@/lib/format";
import type { Observatory } from "@/lib/observatory";
import MiniCalc, { type CalcRegiao } from "../MiniCalc";
import { BRONZE_URL, Kicker, Lido, Metodo, ParaVoce } from "../ui";

const MES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const NOMES: Record<string, string> = {
  SE: "SE/CO",
  S: "Sul",
  NE: "Nordeste",
  N: "Norte",
};
const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;
const TOP = 16;
const LEFT = 26;

// Section 6: minigeração distribuída (75 kW–5 MW) is not cut today. ANEEL wants it observable and controllable
// (CP 33/2026) and admits physical cuts in critical situations (CP 9/2026). How often does the SIN have energy to spare,
// and what would a plant lose if it were cut the way the ONS already cuts utility-scale solar?
export default function Mini({ o }: { o: Observatory }) {
  const s = mmgdStats(o);
  const { days, periodo } = o.mmgd;
  const credito = copelCredit(o);
  const emergDays = new Set(s.emergencias.map((e) => e.d));

  // 6a calendar: one column per week (Monday first), one row per weekday; colour = oversupply cut that day.
  const d0 = new Date(`${periodo[0]}T12:00:00Z`);
  const offset = (d0.getUTCDay() + 6) % 7;
  const max = Math.max(...days.map((d) => d.mwh));
  const level = (mwh: number) =>
    mwh <= 0 ? 0 : Math.min(4, 1 + Math.floor(Math.sqrt(mwh / max) * 4));
  const cells = days.map((d, i) => {
    const k = i + offset;
    return {
      ...d,
      x: LEFT + Math.floor(k / 7) * STEP,
      y: TOP + (k % 7) * STEP,
      lv: level(d.mwh),
    };
  });
  const weeks = Math.ceil((days.length + offset) / 7);
  const W = LEFT + weeks * STEP;
  const H = TOP + 7 * STEP + 4;
  const months = cells.filter((c) => c.d.endsWith("-01"));

  const regioes: CalcRegiao[] = (["SE", "S", "NE", "N"] as const).map((k) => ({
    key: k,
    nome: NOMES[k],
    cidade: o.mmgd.regioes[k].cidade,
    anual: o.mmgd.regioes[k].anual,
    prorata: o.mmgd.regioes[k].prorata,
    emerg: o.mmgd.regioes[k].emerg,
  }));
  const emergList = s.emergencias.map((e) => dayMonth(e.d)).join(" e ");

  return (
    <section className="sec" id="minigeracao" aria-labelledby="mini-h">
      <div className="wrap">
        <Kicker n={6}>Minigeração sob controle</Kicker>
        <h2 className="h2" id="mini-h">
          A minigeração ainda não é cortada. Se fosse, quanto perderia?
        </h2>
        <p className="lede">
          A ANEEL quer que as distribuidoras possam ver e comandar à distância
          cerca de 68 mil usinas de minigeração (de 75 kW a 5 MW, mais de 13
          GW): é a Consulta Pública 33/2026, aberta até 9 de novembro de 2026.
          Outra consulta, a 9/2026, admite cortar fisicamente a geração
          distribuída em situações críticas, e ainda não tem decisão. Hoje o
          corte na rede de distribuição só alcança as usinas Tipo III.
        </p>
        <Lido label="Lido no ONS">
          De {brDate(periodo[0])} a {brDate(periodo[1])}, o ONS cortou eólica e
          solar por sobra de energia em {s.cutDays} dos {s.nDays} dias,{" "}
          {dec(s.totalGWh / 1000, 1)} TWh no total. Num domingo, o corte médio é{" "}
          {dec(s.sundayX, 1)} vezes o de um dia útil. O maior foi em{" "}
          {dayMonth(s.worst.d)}: {fmt(Math.round(s.worst.mwh / 1000))} GWh. O
          plano emergencial na distribuição foi acionado em {emergList}, dois
          domingos. Se uma usina de 1 MWp perto de {s.se.cidade} fosse cortada
          na mesma proporção que as usinas solares, hora a hora, perderia{" "}
          {fmt(Math.round(s.se.prorata))} MWh no ano, {pct(s.shareSE)} da
          geração.
        </Lido>

        <div className="inst" style={{ marginTop: 28 }}>
          <div className="instl">
            <span>
              6a · os dias em que sobrou energia · eólica + solar cortadas por
              sobra (ENE)
            </span>
            <span>
              {brDate(periodo[0])} a {brDate(periodo[1])}
            </span>
          </div>
          <div className="mcal">
            <svg
              className="svg"
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`Calendário de ${s.nDays} dias: o ONS cortou geração eólica e solar por sobra de energia em ${s.cutDays} dias; os domingos concentram os maiores cortes; o plano emergencial foi acionado em ${emergList}.`}
            >
              {months.map((c) => (
                <text key={c.d} className="ax" x={c.x} y={10}>
                  {MES[Number(c.d.slice(5, 7)) - 1]}
                </text>
              ))}
              {["seg", "qua", "sex", "dom"].map((n, i) => (
                <text
                  key={n}
                  className={n === "dom" ? "axl" : "ax"}
                  x={0}
                  y={TOP + [0, 2, 4, 6][i] * STEP + CELL - 2}
                >
                  {n}
                </text>
              ))}
              {cells.map((c) => (
                <rect
                  key={c.d}
                  x={c.x}
                  y={c.y}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  className={`mcell l${c.lv}`}
                  strokeWidth={emergDays.has(c.d) ? 1.6 : 0}
                >
                  <title>{`${brDate(c.d)}: ${c.mwh > 0 ? `${fmt(Math.round(c.mwh / 1000))} GWh cortados por sobra; no pior horário, ${c.sol} % da solar das usinas` : "sem corte por sobra"}${emergDays.has(c.d) ? " · plano emergencial acionado" : ""}`}</title>
                </rect>
              ))}
            </svg>
          </div>
          <div className="legend">
            <span>
              <i className="mkey l0" aria-hidden="true" /> sem corte
            </span>
            <span>
              <i className="mkey l1" aria-hidden="true" />
              <i className="mkey l2" aria-hidden="true" />
              <i className="mkey l3" aria-hidden="true" />
              <i className="mkey l4" aria-hidden="true" /> até{" "}
              {fmt(Math.round(max / 1000))} GWh no dia
            </span>
            <span>
              <i className="mkey l4 out" aria-hidden="true" /> plano emergencial
              acionado
            </span>
          </div>
          <div className="stamp">
            <span>
              ONS · restrição de eólicas e fotovoltaicas (constrained-off),
              meia-hora por usina · build mensal
            </span>
          </div>
        </div>

        <div className="inst" style={{ marginTop: 36 }}>
          <div className="instl">
            <span>
              6b · se a sua minigeração fosse cortada · cenários, não previsão
            </span>
            <span>por ano</span>
          </div>
          <MiniCalc
            regioes={regioes}
            credito={credito}
            nEmerg={s.emergencias.length}
          />
          <div className="stamp">
            <span>
              perfil solar: Open-Meteo, irradiância horária · cortes: ONS ·
              crédito pré-preenchido: Copel B1 {o.b1.reh}, R$ {dec(credito, 3)}
              /kWh
            </span>
          </div>
          <Metodo>
            6a soma, por dia, a geração não realizada apurada pelo ONS
            (referência menos verificada) de todas as usinas eólicas e solares
            despachadas por ele, só nas meias-horas com motivo ENE, sobra de
            energia no sistema; MWh = MW médios × 0,5 h. 6b tem dois cenários.
            &quot;Cortada como as usinas&quot;: em cada hora dos últimos 12
            meses, a usina perde a mesma fração que as usinas solares do ONS
            perderam por sobra de energia naquela hora (corte ÷ (gerado +
            corte), Brasil inteiro). &quot;Só no plano emergencial&quot;: a
            injeção é zerada nas janelas dos {s.emergencias.length} acionamentos
            do Plano Emergencial de Gestão de Excedentes na Rede de Distribuição
            ({s.emergencias.map((e) => brDate(e.d)).join(", ")}), que hoje vale
            só para usinas Tipo III. A geração de 1 kWp vem da irradiância
            horizontal horária do Open-Meteo numa cidade por subsistema, vezes
            um fator de desempenho de {dec(o.mmgd.pr, 2)}: é estimativa, sem
            inclinação nem sombra. O crédito vem pré-preenchido com o valor do
            kWh injetado na Copel em 2026 (TE mais a parcela da TUSD que ainda é
            compensada, Lei 14.300; seção 5); troque pelo da sua distribuidora.
            As duas consultas públicas ainda não têm decisão, e nenhuma diz hoje
            se a energia cortada seria compensada. Números da CP 33/2026: voto
            da diretoria da ANEEL, processo 48500.002211/2026-10, § 69–70.
          </Metodo>
          <ParaVoce>
            Opera uma frota de minigeração? A Consulta Pública 33/2026 recebe
            contribuições até 9 de novembro de 2026. A{" "}
            <a className="bz" href={BRONZE_URL}>
              Bronze Engenharia
            </a>{" "}
            calcula a exposição de cada usina da sua frota com os dados do ONS,
            e a primeira sai de graça. Fale com{" "}
            <a href="mailto:contato@data-joule.com">contato@data-joule.com</a>.
          </ParaVoce>
        </div>
      </div>
    </section>
  );
}
