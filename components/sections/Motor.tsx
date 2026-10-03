import { clearanceHeight, crankRadius, ENGINE, ottoEfficiency, pinHeight, STROKE_NAME, STROKES, valveLift, type Stroke } from '@/lib/engine'
import { dec, fmt, monthLabel, pct } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import Engine3D from '../engine/Engine3D'
import { Kicker, Lido, Metodo, ParaVoce, Swatch } from '../ui'

const STROKE_FILL: Record<Stroke, string> = { admissao: 'var(--c1)', compressao: 'var(--c2)', combustao: 'var(--c4)', escape: 'var(--mute)' }

/**
 * Where the fuel's energy goes in a conventional gasoline car, combined city/highway driving (55 % city).
 * U.S. DOE / EPA, fueleconomy.gov, "Where the Energy Goes: Gasoline Vehicles" (verified 2026-10-03).
 * The ranges overlap, so they do not add up to exactly 100 %.
 */
const ENERGY: [string, number, number, string][] = [
  ['perdas no motor (calor no escape, no radiador, atrito, bombeamento)', 0.68, 0.72, 'var(--c4)'],
  ['acessórios (ar-condicionado, alternador, bombas)', 0.04, 0.06, 'var(--c2)'],
  ['transmissão', 0.03, 0.05, 'var(--c5)'],
  ['motor ligado parado', 0.03, 0.03, 'var(--mute)'],
  ['chega às rodas', 0.18, 0.25, 'var(--c3)'],
]
const WHEELS = ENERGY[4]

/**
 * Density (kg/m³) and lower heating value (kcal/kg), Balanço Energético Nacional 2026 (EPE), Anexo VIII.9
 * "Densidades e poderes caloríficos" (dashboard.epe.gov.br/apps/livro-ben, matriz_densidades_poderes_calorificos.xlsx,
 * read 2026-10-03). "Gasolina automotiva" in the table is gasolina A (no ethanol).
 */
const BEN = {
  gasolinaA: { dens: 742, pci: 10400 },
  anidro: { dens: 791.11, pci: 6750 },
  hidratado: { dens: 809, pci: 6300 },
}
const KCAL_MJ = 4.1868e-3
const mjPerLitre = (f: { dens: number; pci: number }) => (f.dens / 1000) * f.pci * KCAL_MJ

// Four-strokes strip: each panel shows the cylinder at the middle of its stroke.
const S = 0.9
const PW = 170
const panelTop = 16
const headY = panelTop + 24
const y = (mmAboveCrank: number) => headY + (crankRadius + ENGINE.rod + 16 + clearanceHeight - mmAboveCrank) * S

function Panel({ s, i }: { s: Stroke; i: number }) {
  const a = i * 180 + 90
  const cx = i * PW + PW / 2
  const pinY = pinHeight(a)
  const crown = y(pinY + 16)
  const half = (ENGINE.bore / 2) * S
  const down = s === 'admissao' || s === 'combustao'
  const vIn = valveLift(a, 'in') * S
  const vEx = valveLift(a, 'ex') * S
  const crankY = y(0)
  const pinYY = y(pinY)
  const t = (a * Math.PI) / 180
  const cpx = cx + crankRadius * Math.sin(t) * S
  const cpy = crankY - crankRadius * Math.cos(t) * S
  return (
    <g>
      {/* gas */}
      <rect x={cx - half} y={headY} width={half * 2} height={crown - headY} fill={STROKE_FILL[s]} opacity={s === 'combustao' ? 0.55 : 0.28} />
      {/* liner and head */}
      <path d={`M${cx - half} ${headY}V${y(60)}M${cx + half} ${headY}V${y(60)}`} stroke="var(--ink2)" strokeWidth={2} fill="none" />
      <rect x={cx - half - 10} y={panelTop} width={half * 2 + 20} height={headY - panelTop} fill="var(--bg2)" stroke="var(--ink2)" />
      {/* valves: intake left, exhaust right */}
      {(
        [
          [-15, vIn, 'var(--c1)'],
          [15, vEx, 'var(--c4)'],
        ] as const
      ).map(([dx, lift, c]) => (
        <g key={dx}>
          <line x1={cx + dx * S} y1={panelTop - 6} x2={cx + dx * S} y2={headY + lift} stroke={c} strokeWidth={2} />
          <line x1={cx + dx * S - 11} y1={headY + lift} x2={cx + dx * S + 11} y2={headY + lift} stroke={c} strokeWidth={3} />
        </g>
      ))}
      {/* spark plug */}
      <line x1={cx} y1={panelTop - 8} x2={cx} y2={headY + 2} stroke="var(--ink)" strokeWidth={3} />
      {s === 'combustao' && <circle cx={cx} cy={headY + 6} r={6} fill="var(--sol)" />}
      {/* piston, rod, crank */}
      <rect x={cx - half + 1} y={crown} width={half * 2 - 2} height={44 * S} fill="var(--ink2)" rx={2} />
      <line x1={cx} y1={pinYY} x2={cpx} y2={cpy} stroke="var(--c2)" strokeWidth={6} strokeLinecap="round" />
      <circle cx={cx} cy={crankY} r={crankRadius * S} fill="none" stroke="var(--line)" strokeDasharray="2 3" />
      <circle cx={cpx} cy={cpy} r={5} fill="var(--ink)" />
      <circle cx={cx} cy={crankY} r={4} fill="var(--ink)" />
      {/* direction of the piston */}
      <path
        d={down ? `M${cx + half + 16} ${crown - 10}v26l-5 -7m5 7l5 -7` : `M${cx + half + 16} ${crown + 22}v-26l-5 7m5 -7l5 7`}
        stroke="var(--ink)"
        fill="none"
        strokeWidth={1.5}
      />
      <text className="axa" x={cx} y={crankY + crankRadius * S + 22} textAnchor="middle">{`${i + 1}º · ${STROKE_NAME[s]}`}</text>
      <text className="ax" x={cx} y={crankY + crankRadius * S + 38} textAnchor="middle">{`${i * 180}°–${i * 180 + 180}°`}</text>
    </g>
  )
}

export default function Motor({ o }: { o: Observatory }) {
  const litro = (o.fuel.curitiba as Record<string, number>).GASOLINA
  const mes = monthLabel(o.fuel.month.replace(/^(\d{2})\/(\d{4})$/, '$2-$1'))
  const stripH = y(0) + crankRadius * S + 46
  // Gasolina C = gasolina A + anhydrous ethanol by volume (E32), ignoring the small volume contraction of the blend.
  const blend = o.litro.blend
  const mjC = (1 - blend) * mjPerLitre(BEN.gasolinaA) + blend * mjPerLitre(BEN.anidro)
  const mjE = mjPerLitre(BEN.hidratado)
  const ratio = mjE / mjC
  const etanol = (o.fuel.curitiba as Record<string, number>).ETANOL
  const priceRatio = etanol / litro
  const fuels = [
    { name: `gasolina C (E${Math.round(blend * 100)})`, mj: mjC, price: litro, c: 'var(--c4)' },
    { name: 'etanol hidratado', mj: mjE, price: etanol, c: 'var(--c3)' },
  ]

  return (
    <section className="sec" id="motor" aria-labelledby="motor-h">
      <div className="wrap">
        <Kicker n={7}>O motor por dentro</Kicker>
        <h2 className="h2" id="motor-h">Do litro ao movimento: quatro tempos, e só um deles empurra o carro.</h2>
        <Lido>
          Dos R$ {dec(litro)} que o litro de gasolina custava em Curitiba em {mes}, entre R$ {dec(litro * WHEELS[1])} e R$ {dec(litro * WHEELS[2])} viram movimento nas
          rodas. O resto sai como calor pelo escape e pelo radiador, ou se perde em atrito, acessórios e marcha lenta. Mesmo um motor perfeito, com a taxa de
          compressão de 12:1 deste exemplo, não passaria de {pct(ottoEfficiency)}.
        </Lido>

        <div className="inst">
          <div className="instl">
            <span>7a · motor 1.0 em corte · 4 cilindros, 16 válvulas, comando duplo</span>
            <span>3D</span>
          </div>
          <Engine3D />
        </div>

        <div className="inst" style={{ marginTop: 40 }}>
          <div className="instl">
            <span>7b · os quatro tempos · duas voltas do virabrequim</span>
            <span>esquema</span>
          </div>
          <svg className="svg" viewBox={`0 0 ${PW * 4} ${stripH}`} role="img" aria-label="Os quatro tempos: admissão, compressão, combustão e expansão, escape. Admissão à esquerda, escape à direita.">
            {STROKES.map((s, i) => (
              <Panel key={s} s={s} i={i} />
            ))}
          </svg>
          <div className="legend">
            <span><Swatch color="var(--c1)" />válvula de admissão</span>
            <span><Swatch color="var(--c4)" />válvula de escape</span>
            <span><Swatch color="var(--sol)" />faísca da vela</span>
          </div>
        </div>

        <div className="inst" style={{ marginTop: 40 }}>
          <div className="instl">
            <span>7c · para onde vai a energia de um litro · carro a gasolina, uso misto</span>
            <span>% da energia do combustível</span>
          </div>
          <div className="eflow">
            {ENERGY.map(([name, lo, hi, c]) => (
              <div key={name} className="efrow">
                <span className="efn">{name}</span>
                <span className="efbar" aria-hidden>
                  <i style={{ left: 0, width: `${lo * 100}%`, background: c }} />
                  <i style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%`, background: c, opacity: 0.45 }} />
                </span>
                <span className="efv">{lo === hi ? pct(lo) : `${dec(lo * 100, 0)}–${pct(hi)}`}</span>
              </div>
            ))}
          </div>
          <div className="stamp">
            <span>U.S. DOE/EPA · fueleconomy.gov, &quot;Where the Energy Goes: Gasoline Vehicles&quot; · 55 % cidade, 45 % estrada · as faixas se sobrepõem</span>
          </div>
          <Metodo>
            <p>
              7a é um motor 1.0 de exemplo, de quatro cilindros e 16 válvulas, modelado no Blender por script (<code>scripts/blender/motor.py</code>) e animado
              no navegador com three.js. 7a e 7b usam a mesma geometria, calculada em <code>lib/engine.ts</code>: diâmetro de {dec(ENGINE.bore, 0)} mm, curso de{' '}
              {dec(ENGINE.stroke, 1)} mm, biela de {ENGINE.rod} mm, taxa de compressão {ENGINE.r}:1, ordem de ignição 1-3-4-2. A posição de cada pistão sai da
              geometria biela-manivela; cada came está girado para abrir a sua válvula no ângulo certo. As válvulas abrem só no próprio tempo, sem o cruzamento
              que motores reais usam, e as partículas do gás são ilustrativas, para deixar o ciclo legível.
            </p>
            <p>
              O diagrama pressão × volume é um ciclo Otto idealizado: admissão e escape perto da pressão atmosférica, compressão e expansão politrópicas (expoente{' '}
              {dec(ENGINE.n, 1)}) e combustão instantânea no ponto morto superior, com pico de {ENGINE.pPeak} bar. A área dentro da curva é o trabalho de cada ciclo. O
              rendimento do ciclo Otto ideal é 1 − 1/r<sup>γ−1</sup>; com r = {ENGINE.r} e γ = 1,4, dá {pct(ottoEfficiency)}.
            </p>
            <p>
              7c usa a média de cidade e estrada do Departamento de Energia dos EUA para carros a gasolina convencionais; os números dependem do carro e do uso e
              servem de ordem de grandeza. O valor em reais aplica a faixa &quot;chega às rodas&quot; à mediana do litro de gasolina comum em Curitiba no levantamento da ANP
              de {mes} (seção 6).
            </p>
          </Metodo>
        </div>

        <div className="inst" style={{ marginTop: 40 }}>
          <div className="instl">
            <span>7d · gasolina × etanol · energia em cada litro</span>
            <span>MJ por litro · Curitiba, {mes}</span>
          </div>
          <div className="eflow">
            {fuels.map((f) => (
              <div key={f.name} className="efrow">
                <span className="efn">
                  {f.name} · R$ {dec(f.price)}/L · <b>R$ {dec((f.price / f.mj) * 100)} por 100 MJ</b>
                </span>
                <span className="efbar" aria-hidden>
                  <i style={{ left: 0, width: `${(f.mj / 32) * 100}%`, background: f.c }} />
                </span>
                <span className="efv">{dec(f.mj, 1)} MJ</span>
              </div>
            ))}
          </div>
          <p className="efnote">
            Um litro de etanol hidratado tem {pct(ratio)} da energia de um litro de gasolina C. Em Curitiba, em {mes}, o etanol custava {pct(priceRatio)} do preço
            da gasolina: {priceRatio < ratio ? 'mais barato por unidade de energia' : 'mais caro por unidade de energia'}. A regra prática dos 70 % da seção 6 vem
            desta conta; com a gasolina E{Math.round(blend * 100)} de hoje, a paridade de energia fica em {pct(ratio)}.
          </p>
          <div className="stamp">
            <span>
              Densidade e poder calorífico inferior: Balanço Energético Nacional 2026 (EPE), Anexo VIII · gasolina A {fmt(BEN.gasolinaA.dens)} kg/m³ e {fmt(BEN.gasolinaA.pci)} kcal/kg ·
              anidro {dec(BEN.anidro.dens)} kg/m³ e {fmt(BEN.anidro.pci)} kcal/kg · hidratado {fmt(BEN.hidratado.dens)} kg/m³ e {fmt(BEN.hidratado.pci)} kcal/kg · preços: ANP, mediana de {mes}
            </span>
          </div>
          <ParaVoce label={null}>
            Por que está aqui: o motor a combustão é a máquina térmica que quase todo brasileiro usa todo dia. As usinas térmicas que entram quando chove pouco, e
            que puxam a bandeira tarifária da seção 2, seguem o mesmo princípio: queimar combustível, aproveitar parte do calor e rejeitar o resto.
          </ParaVoce>
        </div>
      </div>
    </section>
  )
}
