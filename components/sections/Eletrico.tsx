import { b1Bill } from '@/lib/derive'
import { baseRpm, emfLimitRpm, torqueParts, vPhaseMax } from '@/lib/emotor'
import { EX5, EXAMPLE_PARAMS, evKwhPer100, KWH_PER_LEQ, MACHINE, SOURCES } from '@/lib/ev'
import { brDate, dec, fmt, monthLabel, pct } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import EMotor3D from '../emotor/EMotor3D'
import { BRONZE_URL, Kicker, Lido, Metodo, ParaVoce } from '../ui'

export default function Eletrico({ o }: { o: Observatory }) {
  const kwhPrice = b1Bill(o).total / 1000 // R$/kWh, Copel B1 with taxes and the current flag (section 2)
  const gas = (o.fuel.curitiba as Record<string, number>).GASOLINA
  const mes = monthLabel(o.fuel.month.replace(/^(\d{2})\/(\d{4})$/, '$2-$1'))
  const I = EX5.inmetro
  const rows = [
    { name: 'cidade', ev: evKwhPer100(I.evCityKmLe) * kwhPrice, gas: (100 / I.cityKmL) * gas, kwh: evKwhPer100(I.evCityKmLe), kmL: I.cityKmL },
    { name: 'estrada', ev: evKwhPer100(I.evRoadKmLe) * kwhPrice, gas: (100 / I.roadKmL) * gas, kwh: evKwhPer100(I.evRoadKmLe), kmL: I.roadKmL },
  ]
  const max = Math.max(...rows.flatMap((r) => [r.ev, r.gas]))
  const tp = torqueParts(MACHINE, MACHINE.iMax)
  const fill = (EX5.battery.kwh * kwhPrice)

  const spec: [string, string, string][] = [
    ['Motor de tração (P3)', `síncrono de ímãs permanentes, ${EX5.motor.kw} kW e ${EX5.motor.nm} N·m; enrolamento de barras retangulares (hairpin), refrigerado a óleo`, 'Geely Brasil · enrolamento e óleo: 42how'],
    ['Motor a combustão', `${dec(EX5.engine.litres, 1)} L, ${EX5.engine.cyl} cilindros, ${EX5.engine.valves} válvulas, ${EX5.engine.kw} kW e ${EX5.engine.nm} N·m; eficiência térmica anunciada de ${pct(EX5.engine.bte, 1)}`, 'Geely global · eficiência: Gasgoo, citando a Geely'],
    ['Transmissão', `${EX5.edrive.name}: uma marcha, dois motores elétricos (gerador P1 e tração P3), inversores, conversor elevador de SiC; eficiência combinada de até ${pct(EX5.edrive.eff, 1)}`, 'Geely Brasil · uma marcha: Gasgoo, ithome'],
    ['Bateria', `${EX5.battery.chem} (fosfato de ferro-lítio), ${dec(EX5.battery.kwh, 1)} kWh`, 'Geely Brasil'],
    ['Recarga', `CC até ${EX5.charge.dcKw} kW (30 % → 80 % em ${EX5.charge.dc3080min} min) · CA ${dec(EX5.charge.acKw, 1)} kW`, 'Geely Brasil · CA: imprensa'],
    ['Conjunto', `${EX5.system.cv} cv e ${EX5.system.nm} N·m combinados, 0 a 100 km/h em ${dec(EX5.system.zeroTo100, 1)} s, Cx ${dec(EX5.cd, 3)}`, 'Geely Brasil · Cx: geely.com'],
    ['Inmetro (PBEV 2026)', `${dec(I.cityKmL, 1)} / ${dec(I.roadKmL, 1)} km/L na gasolina (cidade / estrada), ${I.evRangeKm} km só na bateria, nota ${I.rating}`, 'Tabela PBEV 2026, 25/08/2026'],
  ]

  return (
    <section className="sec" id="eletrico" aria-labelledby="eletrico-h">
      <div className="wrap">
        <Kicker n={9}>O motor elétrico por dentro</Kicker>
        <h2 className="h2" id="eletrico-h">Um híbrido plug-in aberto: como 400 volts viram {EX5.motor.nm} N·m.</h2>
        <Lido>
          O {EX5.name}, lançado no Brasil em {brDate(EX5.launch)} por R$ {fmt(EX5.price)}, anda {I.evRangeKm} km só com a bateria de {dec(EX5.battery.kwh, 1)} kWh, segundo o
          Inmetro. Na tomada de uma casa em Curitiba (R$ {dec(kwhPrice)} o kWh), 100 km na cidade custam R$ {dec(rows[0].ev)}; com a gasolina de {mes}, R$ {dec(rows[0].gas)}. Encher a
          bateria custa cerca de R$ {dec(fill)}.
        </Lido>

        <div className="inst">
          <div className="instl">
            <span>9a · motor de tração e inversor em corte · controle vetorial ao vivo</span>
            <span>3D</span>
          </div>
          <EMotor3D />
        </div>

        <div className="g2e" style={{ marginTop: 40 }}>
          <div className="inst">
            <div className="instl">
              <span>9b · o carro · de onde vem cada número</span>
              <span>fonte</span>
            </div>
            <dl className="emspec">
              {spec.map(([k, v, src]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>
                    {v}
                    <small>{src}</small>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="inst">
            <div className="instl">
              <span>9c · quanto custa rodar 100 km · Curitiba</span>
              <span>R$</span>
            </div>
            <div className="eflow">
              {rows.flatMap((r) => [
                <div key={`${r.name}-ev`} className="efrow">
                  <span className="efn">
                    {r.name} · tomada ({dec(r.kwh, 1)} kWh)
                  </span>
                  <span className="efbar" aria-hidden>
                    <i style={{ left: 0, width: `${(r.ev / max) * 100}%`, background: 'var(--c3)' }} />
                  </span>
                  <span className="efv">R$ {dec(r.ev)}</span>
                </div>,
                <div key={`${r.name}-gas`} className="efrow">
                  <span className="efn">
                    {r.name} · gasolina ({dec(100 / r.kmL, 1)} L)
                  </span>
                  <span className="efbar" aria-hidden>
                    <i style={{ left: 0, width: `${(r.gas / max) * 100}%`, background: 'var(--c4)' }} />
                  </span>
                  <span className="efv">R$ {dec(r.gas)}</span>
                </div>,
              ])}
            </div>
            <p className="efnote">
              Na cidade, a mesma distância custa {pct(rows[0].ev / rows[0].gas)} na tomada do que na bomba. O motor elétrico chega a 98 % de eficiência no melhor ponto, segundo a Geely; o
              motor a combustão deste carro anuncia {pct(EX5.engine.bte, 1)}, e um carro a gasolina comum leva 18 a 25 % da energia às rodas (seção 8).
            </p>
            <div className="stamp">
              <span>
                Tarifa: Copel B1 com tributos e bandeira do mês ({o.b1.reh}, seção 2) · gasolina: mediana ANP de Curitiba, {mes} · consumo: Inmetro PBEV 2026
              </span>
            </div>
          </div>
        </div>

        <Metodo>
          <p>
            <b>Controle vetorial.</b> O inversor mede as correntes e o ângulo do rotor (resolver) e as leva ao referencial do rotor com as transformadas de Clarke (três
            fases → α, β) e Park (α, β → d, q). Ali, a corrente vira dois números constantes: i<sub>d</sub>, no eixo do ímã, e i<sub>q</sub>, a 90° dele. O torque é
            T = 3/2 · p · [ψ<sub>f</sub> · i<sub>q</sub> + (L<sub>d</sub> − L<sub>q</sub>) · i<sub>d</sub> · i<sub>q</sub>]: a primeira parcela vem do ímã; a segunda, da
            relutância, porque as barreiras de ar do rotor deixam L<sub>q</sub> maior que L<sub>d</sub>. Com i<sub>d</sub> negativo, a relutância soma torque; o controle
            escolhe a divisão que dá mais torque por ampère (MTPA). No ponto de torque máximo deste exemplo, {fmt(tp.magnet)} N·m vêm do ímã e {fmt(tp.reluctance)} N·m da
            relutância.
          </p>
          <p>
            <b>Inversor.</b> Seis transistores, dois por fase, formam oito estados (seis ativos e dois nulos). A modulação por vetor espacial (SVPWM) alterna os dois estados
            vizinhos ao vetor de tensão pedido e um nulo, em proporções que reproduzem esse vetor na média de cada período de chaveamento. Ela alcança uma tensão de fase de
            V<sub>cc</sub>/√3 ({fmt(vPhaseMax(MACHINE.vdc))} V de pico com {MACHINE.vdc} V), 15 % mais que a modulação senoidal simples. Na regeneração, o mesmo inversor
            trabalha ao contrário: a corrente fica atrás do ímã, o torque freia o carro e a energia volta à bateria.
          </p>
          <p>
            <b>Enfraquecimento de campo.</b> A tensão induzida pelos ímãs cresce com a rotação. Acima de {fmt(baseRpm(MACHINE))} rpm, a potência máxima limita o torque; a partir
            de cerca de {fmt(emfLimitRpm(MACHINE))} rpm, só os ímãs já igualariam a tensão do inversor, e o controle injeta i<sub>d</sub> negativo para cancelar parte do fluxo.
            O ponto de operação mostrado é a menor corrente que entrega o torque pedido dentro do limite de corrente e de 95 % do limite de tensão.
          </p>
          <p>
            <b>O que é dado e o que é exemplo.</b> Torque e potência do motor, bateria, recarga e consumo são publicados (9b). A Geely, como todo fabricante, não publica os
            parâmetros elétricos internos; aqui são valores de exemplo coerentes com o publicado: {EXAMPLE_PARAMS.join(', ')}. O fluxo do ímã (ψ<sub>f</sub> ={' '}
            {dec(MACHINE.psiF, 4)} Wb) é calibrado para que o MTPA no limite de corrente dê exatamente {EX5.motor.nm} N·m. O modelo 3D é um motor desse porte, modelado no
            Blender por script (<code>scripts/blender/emotor.py</code>).
          </p>
          <p>
            <b>Consumo.</b> O Inmetro publica o modo elétrico em km/L equivalente: 1 litro de gasolina E22 = 28,99 MJ = {dec(KWH_PER_LEQ, 3)} kWh, medidos na tomada
            (Portaria Inmetro nº 169/2023, Anexo E). Daí os {dec(rows[0].kwh, 1)} e {dec(rows[1].kwh, 1)} kWh/100 km de 9c, cálculo nosso. Os valores publicados já são
            ajustados para uso real; que a coluna seja só do modo elétrico é inferência nossa (bate com os números, mas a tabela não diz). Os km/L na gasolina são com a
            gasolina de ensaio E22; a da bomba é E32.
          </p>
        </Metodo>
        <ParaVoce>
          Frota elétrica ou híbrida na empresa? O custo do km depende da tarifa: no Grupo A, carregar fora da ponta pode custar uma fração do horário de ponta. A{' '}
          <a className="bz" href={BRONZE_URL}>Bronze Engenharia</a> calcula com a sua fatura: <a href="mailto:contato@data-joule.com">contato@data-joule.com</a>. Fontes:{' '}
          <a href={SOURCES.geelyBrasil}>Geely Brasil</a>, <a href={SOURCES.inmetro}>Inmetro PBEV</a>, <a href={SOURCES.portaria169}>Portaria 169/2023</a>.
        </ParaVoce>
      </div>
    </section>
  )
}
