'use client'

import { useState } from 'react'

export type CalcRegiao = { key: string; nome: string; cidade: string; anual: number; prorata: number; emerg: number }

const nf = (v: number, d = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ |\s/g, ' ')

// Section 6b: exposure of one minigeração plant. All per-kWp numbers are computed at build time
// (scripts/minigeracao.py); here they are only scaled by the plant size and the credit value.
export default function MiniCalc({ regioes, credito, nEmerg }: { regioes: CalcRegiao[]; credito: number; nEmerg: number }) {
  const [kwp, setKwp] = useState(1000)
  const [reg, setReg] = useState(regioes[0].key)
  const [cen, setCen] = useState<'prorata' | 'emerg'>('prorata')
  const [cred, setCred] = useState(Number(credito.toFixed(3)))
  const r = regioes.find((x) => x.key === reg) ?? regioes[0]
  const perKwp = cen === 'prorata' ? r.prorata : r.emerg
  const mwh = (perKwp * kwp) / 1000
  const reais = perKwp * kwp * (Number.isFinite(cred) ? cred : 0)
  const share = perKwp / r.anual

  return (
    <div className="mcalc">
      <div className="mctl">
        <label className="emrange">
          <span>
            potência da usina · <b>{nf(kwp)} kWp</b>
          </span>
          <input type="range" min={75} max={5000} step={25} value={kwp} onChange={(e) => setKwp(Number(e.target.value))} aria-label="Potência da usina em kWp" />
        </label>
        <span className="eseg" role="group" aria-label="Região (perfil solar)">
          {regioes.map((x) => (
            <button key={x.key} type="button" className="ebtn" aria-pressed={reg === x.key} onClick={() => setReg(x.key)} title={`perfil solar de ${x.cidade}`}>
              {x.nome}
            </button>
          ))}
        </span>
        <span className="eseg" role="group" aria-label="Cenário de corte">
          <button type="button" className="ebtn" aria-pressed={cen === 'prorata'} onClick={() => setCen('prorata')}>
            cortada como as usinas
          </button>
          <button type="button" className="ebtn" aria-pressed={cen === 'emerg'} onClick={() => setCen('emerg')}>
            só no plano emergencial
          </button>
        </span>
        <label className="mcred">
          <span>crédito</span>
          <span className="mcin">
            R$
            <input type="number" inputMode="decimal" min={0} max={3} step={0.01} value={cred} onChange={(e) => setCred(e.target.valueAsNumber)} aria-label="Valor do crédito em reais por kWh" />
            /kWh
          </span>
        </label>
      </div>
      <div className="tiles" aria-live="polite">
        <div className="tile">
          <div className="tl">energia perdida</div>
          <div className="tv">{nf(mwh, mwh < 10 ? 1 : 0)} MWh</div>
          <div className="tu">por ano · {nf(share * 100, 1)} % da geração</div>
        </div>
        <div className="tile">
          <div className="tl">crédito perdido</div>
          <div className="tv">R$ {nf(reais / 1000, reais < 10000 ? 1 : 0)} mil</div>
          <div className="tu">por ano · a R$ {nf(Number.isFinite(cred) ? cred : 0, 3)}/kWh</div>
        </div>
        <div className="tile">
          <div className="tl">geração do ano</div>
          <div className="tv">{nf((r.anual * kwp) / 1000)} MWh</div>
          <div className="tu">
            perfil solar de {r.cidade} ·{' '}
            {cen === 'prorata' ? 'corte hora a hora, na proporção das usinas' : `${nEmerg} acionamentos, injeção zerada na janela`}
          </div>
        </div>
      </div>
    </div>
  )
}
