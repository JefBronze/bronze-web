'use client'
// Section 8a: the traction motor and inverter in 3D, with the field-oriented-control instruments running in step:
// the space-vector hexagon (inverter states, voltage and current vectors, rotating d-q axes), the three phase currents
// with the PWM pattern, and the torque–speed map with the operating point. Scene: ./scene.ts (loaded on demand).
import { useEffect, useMemo, useRef, useState } from 'react'
import { baseRpm, electricalHz, emfLimitRpm, invPark, operatingPoint, svpwm, switchStates, torqueEnvelope, torqueParts, vPhaseMax } from '@/lib/emotor'
import { MACHINE } from '@/lib/ev'
import { dec, fmt } from '@/lib/format'
import type { EMotorScene, FrameInfo, Part, View } from './scene'

const M = MACHINE
const PHASE = ['A', 'B', 'C']
const PHASE_COLOR = ['var(--c4)', 'var(--c1)', 'var(--c3)']
const STATE_NAMES = ['100', '110', '010', '011', '001', '101'] // upper switches a b c for the six active vectors V1…V6

// ---- space-vector diagram geometry --------------------------------------------------------------------------
const SV = { w: 300, h: 300, c: 150, r: 112 }
const hexR = SV.r // |V1…V6| = 2/3·vdc drawn at r; linear limit circle vdc/√3 at r·(√3/2)
const svPt = (ang: number, len: number) => [SV.c + len * Math.cos(ang), SV.c - len * Math.sin(ang)] as const
const vScale = hexR / ((2 / 3) * M.vdc)

// ---- waveforms -----------------------------------------------------------------------------------------------
const WF = { w: 620, h: 210, x0: 34, x1: 610, yc: 70, amp: 50, pwm0: 140, pwmH: 16 }
const wx = (th: number) => WF.x0 + (th / (2 * Math.PI)) * (WF.x1 - WF.x0)

// ---- torque–speed map -----------------------------------------------------------------------------------------
const TS = { w: 560, h: 260, x0: 44, x1: 548, y0: 220, y1: 20, rpmMax: M.rpmMax, tMax: 300 }
const tx = (rpm: number) => TS.x0 + (rpm / TS.rpmMax) * (TS.x1 - TS.x0)
const ty = (t: number) => TS.y0 - (t / TS.tMax) * (TS.y0 - TS.y1)
const ENVELOPE = Array.from({ length: 81 }, (_, i) => (i / 80) * TS.rpmMax)
  .map((r, i) => `${i ? 'L' : 'M'}${tx(r).toFixed(1)} ${ty(torqueEnvelope(M, Math.max(1, r))).toFixed(1)}`)
  .join('')

export default function EMotor3D() {
  const box = useRef<HTMLDivElement>(null)
  const mount = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<EMotorScene | null>(null)
  const vrefEl = useRef<SVGLineElement>(null)
  const irefEl = useRef<SVGLineElement>(null)
  const dAxisEl = useRef<SVGLineElement>(null)
  const qAxisEl = useRef<SVGLineElement>(null)
  const sectorEl = useRef<SVGPathElement>(null)
  const stateEl = useRef<SVGTextElement>(null)
  const cursorEl = useRef<SVGLineElement>(null)
  const legA = useRef<SVGRectElement>(null)
  const legB = useRef<SVGRectElement>(null)
  const legC = useRef<SVGRectElement>(null)
  const [mode, setMode] = useState<'tracao' | 'regen'>('tracao')
  const [torquePct, setTorquePct] = useState(70)
  const [rpm, setRpm] = useState(3000)
  const [playing, setPlaying] = useState(true)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'nowebgl'>('idle')
  const [progress, setProgress] = useState(0)
  const [hover, setHover] = useState<(Part & { x: number; y: number }) | null>(null)
  const [view, setView] = useState<'corte' | 'inversor' | 'geral'>('corte')

  const torqueReq = ((mode === 'regen' ? -1 : 1) * torquePct * M.tPeak) / 100
  const op = useMemo(() => operatingPoint(M, rpm, torqueReq), [rpm, torqueReq])
  const parts = useMemo(() => torqueParts(M, op.is), [op.is])

  useEffect(() => {
    sceneRef.current?.setDemand(rpm, torqueReq)
  }, [rpm, torqueReq])

  useEffect(() => {
    const el = mount.current
    const outer = box.current
    if (!el || !outer) return
    let disposed = false
    function draw(f: FrameInfo) {
      const setLine = (el: SVGLineElement | null, ang: number, len: number) => {
        if (!el) return
        const [x, y] = svPt(ang, len)
        el.setAttribute('x2', x.toFixed(1))
        el.setAttribute('y2', y.toFixed(1))
      }
      const vmag = Math.hypot(f.vAlpha, f.vBeta)
      setLine(vrefEl.current, Math.atan2(f.vBeta, f.vAlpha), vmag * vScale)
      setLine(irefEl.current, f.thetaS, (f.op.is / M.iMax) * hexR * 0.8)
      setLine(dAxisEl.current, f.thetaD, hexR * 1.18)
      setLine(qAxisEl.current, f.thetaD + Math.PI / 2, hexR * 1.18)
      if (sectorEl.current) {
        const a0 = ((f.sector - 1) * Math.PI) / 3
        const [x0, y0] = svPt(a0, hexR)
        const [x1, y1] = svPt(a0 + Math.PI / 3, hexR)
        sectorEl.current.setAttribute('d', `M${SV.c} ${SV.c}L${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}Z`)
      }
      if (stateEl.current) stateEl.current.textContent = `chaves ${f.states.map((s) => (s ? '1' : '0')).join('')}`
      const th = ((f.thetaS % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      if (cursorEl.current) {
        cursorEl.current.setAttribute('x1', wx(th).toFixed(1))
        cursorEl.current.setAttribute('x2', wx(th).toFixed(1))
      }
      ;[legA, legB, legC].forEach((r, k) => r.current?.setAttribute('opacity', f.states[k] ? '1' : '0.15'))
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        setStatus('loading')
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduced) setPlaying(false)
        import('./scene')
          .then(({ createEMotorScene }) =>
            createEMotorScene(el, { machine: M, reducedMotion: reduced, onProgress: setProgress, onHover: setHover, onFrame: draw }),
          )
          .then((sc) => {
            if (disposed) return sc.dispose()
            sceneRef.current = sc
            setStatus('ready')
          })
          .catch((e: Error) => {
            console.warn('[motor elétrico 3D]', e.message)
            setStatus('nowebgl')
          })
      },
      { rootMargin: '500px 0px' },
    )
    io.observe(outer)
    return () => {
      disposed = true
      io.disconnect()
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  // One electrical cycle of the PWM pattern, for the operating point (12 carrier periods shown).
  const pwmPaths = useMemo(() => {
    const out = ['', '', '']
    const n = 1200
    for (let k = 0; k < 3; k++) {
      let d = ''
      for (let i = 0; i <= n; i++) {
        const th = (i / n) * 2 * Math.PI
        const thetaD = th - Math.atan2(op.iq, op.id)
        const { alpha, beta } = invPark(op.vd, op.vq, thetaD)
        const duty = svpwm(alpha, beta, M.vdc)
        const s = switchStates(duty, ((th / (2 * Math.PI)) * 12) % 1)[k]
        const y = WF.pwm0 + k * (WF.pwmH + 6) + (s ? 0 : WF.pwmH)
        d += `${i ? 'L' : 'M'}${wx(th).toFixed(1)} ${y}`
      }
      out[k] = d
    }
    return out
  }, [op])
  const currentPaths = useMemo(
    () =>
      [0, 1, 2].map((k) => {
        let d = ''
        for (let i = 0; i <= 240; i++) {
          const th = (i / 240) * 2 * Math.PI
          const v = (op.is / M.iMax) * Math.cos(th - (k * 2 * Math.PI) / 3)
          d += `${i ? 'L' : 'M'}${wx(th).toFixed(1)} ${(WF.yc - v * WF.amp).toFixed(1)}`
        }
        return d
      }),
    [op.is],
  )

  const go = (v: 'corte' | 'inversor' | 'geral') => {
    setView(v)
    import('./scene').then(({ VIEWS }) => sceneRef.current?.flyTo(VIEWS[v] as View))
  }
  const toggle = () => {
    sceneRef.current?.setPlaying(!playing)
    setPlaying(!playing)
  }
  const fe = electricalHz(M, rpm)
  const vmax = 0.95 * vPhaseMax(M.vdc)

  return (
    <div className="engine" ref={box}>
      <div className="ctl enginemode">
        <span className="eseg" role="group" aria-label="vista">
          {(
            [
              ['corte', 'motor em corte'],
              ['inversor', 'inversor'],
              ['geral', 'conjunto'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className="ebtn" aria-pressed={view === k} onClick={() => go(k)}>
              {label}
            </button>
          ))}
        </span>
        <span className="eseg" role="group" aria-label="modo">
          <button type="button" className="ebtn" aria-pressed={mode === 'tracao'} onClick={() => setMode('tracao')}>
            tração
          </button>
          <button type="button" className="ebtn" aria-pressed={mode === 'regen'} onClick={() => setMode('regen')}>
            regeneração
          </button>
        </span>
      </div>
      <div className="enginev">
        <div className="engine3d" ref={mount}>
          {status !== 'ready' && (
            <div className="engineph">
              {status === 'nowebgl' ? (
                <p>Este navegador não exibe 3D (WebGL). Os instrumentos ao lado seguem funcionando.</p>
              ) : (
                <p>
                  Carregando o modelo 3D (1 MB)… {status === 'loading' && progress > 0 ? `${Math.round(progress * 100)} %` : ''}
                  <span className="enginebar" style={{ width: `${Math.round(progress * 100)}%` }} />
                </p>
              )}
            </div>
          )}
          <div className="enginehud" aria-live="polite">
            <span className="enginest" style={{ color: mode === 'regen' ? 'var(--c3)' : 'var(--c4)' }}>
              {mode === 'regen' ? 'regeneração: o motor vira gerador' : 'tração'} · {fmt(Math.abs(op.torque))} N·m · {dec(Math.abs(op.power) / 1000, 0)} kW
            </span>
            <span className="engineang">
              {fmt(rpm)} rpm · {fmt(fe)} Hz
            </span>
          </div>
          {hover && (
            <div className="enginetip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
              <b>{hover.name}</b>
              <span>{hover.text}</span>
            </div>
          )}
          <p className="enginetx">
            Seta vermelha: eixo d, o norte do ímã. Seta azul: o campo das correntes do estator, {mode === 'regen' ? 'atrás' : 'à frente'} do ímã em {dec((Math.abs(Math.atan2(op.iq, op.id)) * 180) / Math.PI, 0)}° elétricos. As ranhuras brilham com a corrente de cada fase (vermelho num sentido, azul no outro). Câmera lenta: o motor real gira a {fmt(rpm)} rpm.
          </p>
        </div>
        <div className="enginepv">
          <svg className="svg" viewBox={`0 0 ${SV.w} ${SV.h}`} role="img" aria-label="Diagrama do vetor espacial: o hexágono dos seis estados ativos do inversor, o vetor de tensão de referência, o vetor de corrente e os eixos d e q do rotor.">
            <path ref={sectorEl} d="" fill="var(--c2)" opacity={0.14} />
            <polygon
              points={Array.from({ length: 6 }, (_, k) => svPt((k * Math.PI) / 3, hexR).map((v) => v.toFixed(1)).join(',')).join(' ')}
              fill="none"
              stroke="var(--line)"
            />
            <circle cx={SV.c} cy={SV.c} r={hexR * (Math.sqrt(3) / 2)} fill="none" stroke="var(--line)" strokeDasharray="2 4" />
            {STATE_NAMES.map((n, k) => {
              const [x, y] = svPt((k * Math.PI) / 3, hexR + 14)
              return (
                <text key={n} className="ax" x={x} y={y + 4} textAnchor="middle">
                  {n}
                </text>
              )
            })}
            <line ref={dAxisEl} x1={SV.c} y1={SV.c} x2={SV.c} y2={SV.c} stroke="var(--c4)" strokeDasharray="4 3" />
            <line ref={qAxisEl} x1={SV.c} y1={SV.c} x2={SV.c} y2={SV.c} stroke="var(--mute)" strokeDasharray="4 3" />
            <line ref={irefEl} x1={SV.c} y1={SV.c} x2={SV.c} y2={SV.c} stroke="var(--c1)" strokeWidth={3} />
            <line ref={vrefEl} x1={SV.c} y1={SV.c} x2={SV.c} y2={SV.c} stroke="var(--ink)" strokeWidth={2} />
            <text ref={stateEl} className="axa" x={8} y={16}>
              chaves 000
            </text>
            <text className="ax" x={SV.w - 8} y={16} textAnchor="end">
              setor ativo
            </text>
          </svg>
          <div className="legend">
            <span>
              <i className="sw" style={{ background: 'var(--ink)' }} />
              tensão pedida
            </span>
            <span>
              <i className="sw" style={{ background: 'var(--c1)' }} />
              corrente
            </span>
            <span>
              <i className="sw" style={{ background: 'var(--c4)' }} />
              eixo d (ímã)
            </span>
          </div>
          <dl className="emnums">
            <div>
              <dt>i<sub>d</sub> / i<sub>q</sub></dt>
              <dd>
                {fmt(op.id)} / {fmt(op.iq)} A
              </dd>
            </div>
            <div>
              <dt>torque do ímã + relutância</dt>
              <dd>
                {fmt(Math.sign(op.torque) * parts.magnet)} + {fmt(Math.sign(op.torque) * parts.reluctance)} N·m
              </dd>
            </div>
            <div>
              <dt>tensão de fase / limite</dt>
              <dd>
                {fmt(op.vs)} / {fmt(vmax)} V
              </dd>
            </div>
            <div>
              <dt>controle</dt>
              <dd>{op.fieldWeakening ? 'enfraquecimento de campo' : 'máximo torque por ampère'}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="ctl enginectl">
        <button type="button" className="ebtn" onClick={toggle} aria-pressed={playing}>
          {playing ? 'pausar' : 'tocar'}
        </button>
        <label className="emrange">
          torque pedido <b>{torquePct} %</b>
          <input type="range" min={0} max={100} step={1} value={torquePct} onChange={(e) => setTorquePct(Number(e.target.value))} />
        </label>
        <label className="emrange">
          rotação real <b>{fmt(rpm)} rpm</b>
          <input type="range" min={0} max={M.rpmMax} step={100} value={rpm} onChange={(e) => setRpm(Number(e.target.value))} />
        </label>
        {op.limited && <span className="enote">Acima de {fmt(baseRpm(M))} rpm a potência máxima ({dec(M.pPeak / 1000, 0)} kW) limita o torque.</span>}
      </div>

      <div className="g2e" style={{ marginTop: 28 }}>
        <div>
          <div className="instl">
            <span>correntes nas três fases e PWM do inversor · um ciclo elétrico</span>
            <span>{fmt(fe)} Hz</span>
          </div>
          <svg className="svg" viewBox={`0 0 ${WF.w} ${WF.h}`} role="img" aria-label="As três correntes senoidais defasadas de 120 graus e, abaixo, o liga-desliga dos três braços do inversor que as produz.">
            <line x1={WF.x0} y1={WF.yc} x2={WF.x1} y2={WF.yc} stroke="var(--line)" />
            {currentPaths.map((d, k) => (
              <path key={k} d={d} fill="none" stroke={PHASE_COLOR[k]} strokeWidth={2} />
            ))}
            {pwmPaths.map((d, k) => (
              <g key={k}>
                <rect ref={[legA, legB, legC][k]} x={4} y={WF.pwm0 + k * (WF.pwmH + 6)} width={22} height={WF.pwmH} rx={3} fill={PHASE_COLOR[k]} opacity={0.15} />
                <text className="ax" x={15} y={WF.pwm0 + k * (WF.pwmH + 6) + 12} textAnchor="middle" fill="var(--bg)">
                  {PHASE[k]}
                </text>
                <path d={d} fill="none" stroke={PHASE_COLOR[k]} strokeWidth={1.2} />
              </g>
            ))}
            <line ref={cursorEl} x1={WF.x0} y1={8} x2={WF.x0} y2={WF.h - 4} stroke="var(--ink)" strokeDasharray="3 3" />
            <text className="ax" x={WF.x0} y={WF.yc - WF.amp - 6}>{`±${fmt(op.is)} A`}</text>
          </svg>
          <p className="enote">PWM desenhado com 12 períodos por ciclo para caber no olho; o inversor real chaveia na casa de 10 mil vezes por segundo.</p>
        </div>
        <div>
          <div className="instl">
            <span>torque × rotação · motor de tração</span>
            <span>N·m</span>
          </div>
          <svg className="svg" viewBox={`0 0 ${TS.w} ${TS.h}`} role="img" aria-label={`Curva de torque máximo: ${M.tPeak} N·m até ${fmt(baseRpm(M))} rpm, depois potência constante de ${M.pPeak / 1000} kW. Ponto de operação atual marcado.`}>
            <rect x={tx(emfLimitRpm(M))} y={TS.y1} width={tx(TS.rpmMax) - tx(emfLimitRpm(M))} height={TS.y0 - TS.y1} fill="var(--c2)" opacity={0.08} />
            <text className="ax" x={tx(TS.rpmMax) - 4} y={TS.y1 + 12} textAnchor="end">só com enfraquecimento de campo</text>
            <path d={`${ENVELOPE}L${tx(TS.rpmMax)} ${TS.y0}L${TS.x0} ${TS.y0}Z`} fill="var(--c4)" opacity={0.08} />
            <path d={ENVELOPE} fill="none" stroke="var(--c4)" strokeWidth={2} />
            <line x1={tx(baseRpm(M))} y1={ty(M.tPeak)} x2={tx(baseRpm(M))} y2={TS.y0} stroke="var(--c4)" strokeDasharray="2 3" />
            <text className="ax" x={tx(baseRpm(M)) + 4} y={ty(M.tPeak) - 6}>{`${fmt(baseRpm(M))} rpm`}</text>
            <text className="axa" x={TS.x0 + 6} y={ty(M.tPeak) - 6}>{`${M.tPeak} N·m`}</text>
            <circle cx={tx(rpm)} cy={ty(Math.abs(op.torque))} r={6} fill={mode === 'regen' ? 'var(--c3)' : 'var(--ink)'} stroke="var(--bg)" strokeWidth={2} />
            <line x1={TS.x0} y1={TS.y0} x2={TS.x1} y2={TS.y0} stroke="var(--line)" />
            {[0, 4000, 8000, 12000, 16000].map((r) => (
              <text key={r} className="ax" x={tx(r)} y={TS.y0 + 16} textAnchor="middle">
                {r / 1000}k
              </text>
            ))}
            <text className="ax" x={TS.x1} y={TS.y0 + 30} textAnchor="end">rpm</text>
          </svg>
        </div>
      </div>
    </div>
  )
}
