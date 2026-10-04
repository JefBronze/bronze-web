'use client'
// Section 9d: the EM-i powertrain in 3D with the power flowing in each mode, a flow diagram in kW, and the road load.
// Scene: ./scene.ts (loaded on demand). Physics: lib/powertrain.ts.
import { useEffect, useMemo, useRef, useState } from 'react'
import { KWH_PER_LEQ } from '@/lib/ev'
import { flows, MODE_NAME, roadLoad, type Mode } from '@/lib/powertrain'
import { dec, fmt, pct } from '@/lib/format'
import type { Part, PowertrainScene, View } from './scene'

const MODES: Mode[] = ['ev', 'serie', 'paralelo', 'regen', 'recarga']
const MODE_TEXT: Record<Mode, string> = {
  ev: 'Só a bateria: ela alimenta o motor de tração P3 pelo barramento CC; o motor a combustão fica desligado e a embreagem, aberta.',
  serie: 'O motor 1.5 gira no seu ponto de melhor rendimento só para mover o gerador P1; a eletricidade vai ao P3 e o que sobra carrega a bateria. As rodas não sentem o motor a combustão.',
  paralelo: 'A embreagem fecha e o motor 1.5 empurra as rodas pela relação fixa (estrada, velocidade constante); o P3 ajuda nas acelerações e o P1 aproveita a sobra para carregar.',
  regen: 'Na frenagem, o P3 vira gerador: a inércia do carro volta para a bateria em vez de virar calor nos freios.',
  recarga: 'Parado na tomada: o carregador de bordo converte a corrente alternada em contínua e enche a bateria.',
}

// ---- flow diagram --------------------------------------------------------------------------------------------
const NODES = {
  tank: { x: 60, y: 46, label: 'tanque' },
  engine: { x: 210, y: 46, label: 'motor 1.5' },
  p1: { x: 360, y: 46, label: 'gerador P1' },
  bus: { x: 360, y: 150, label: 'barramento CC' },
  battery: { x: 210, y: 254, label: 'bateria' },
  plug: { x: 60, y: 254, label: 'tomada' },
  p3: { x: 510, y: 254, label: 'motor P3' },
  wheels: { x: 510, y: 46, label: 'rodas' },
}
type NodeKey = keyof typeof NODES
const KIND_COLOR = { fuel: 'var(--c2)', mech: 'var(--ink2)', elec: 'var(--c1)', grid: 'var(--c3)' }

export default function Powertrain3D() {
  const box = useRef<HTMLDivElement>(null)
  const mount = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<PowertrainScene | null>(null)
  const [mode, setMode] = useState<Mode>('ev')
  const [kmh, setKmh] = useState(60)
  const [playing, setPlaying] = useState(true)
  const [view, setView] = useState<'geral' | 'edht' | 'bateria'>('geral')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'nowebgl'>('idle')
  const [progress, setProgress] = useState(0)
  const [hover, setHover] = useState<(Part & { x: number; y: number }) | null>(null)

  const speed = mode === 'recarga' ? 0 : kmh
  const f = useMemo(() => flows(mode, speed), [mode, speed])
  const load = useMemo(() => roadLoad(speed), [speed])

  useEffect(() => {
    sceneRef.current?.setMode(mode, speed)
  }, [mode, speed])

  useEffect(() => {
    const el = mount.current
    const outer = box.current
    if (!el || !outer) return
    let disposed = false
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        setStatus('loading')
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduced) setPlaying(false)
        import('./scene')
          .then(({ createPowertrainScene }) => createPowertrainScene(el, { reducedMotion: reduced, onProgress: setProgress, onHover: setHover }))
          .then((sc) => {
            if (disposed) return sc.dispose()
            sceneRef.current = sc
            sc.setMode('ev', 60)
            setStatus('ready')
          })
          .catch((e: Error) => {
            console.warn('[trem de força 3D]', e.message)
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

  const go = (v: 'geral' | 'edht' | 'bateria') => {
    setView(v)
    import('./scene').then(({ VIEWS }) => sceneRef.current?.flyTo(VIEWS[v] as View))
  }
  const toggle = () => {
    sceneRef.current?.setPlaying(!playing)
    setPlaying(!playing)
  }

  // Links of the diagram: [from, to, kW, kind]. The battery talks to the DC bus, except when charging from the plug.
  const batteryEdge: [NodeKey, NodeKey, number, keyof typeof KIND_COLOR] =
    mode === 'recarga' ? ['bus', 'battery', 0, 'elec'] : f.battery >= 0 ? ['battery', 'bus', f.battery, 'elec'] : ['bus', 'battery', -f.battery, 'elec']
  const edges: [NodeKey, NodeKey, number, keyof typeof KIND_COLOR][] = [
    ['tank', 'engine', f.fuel, 'fuel'],
    ['engine', 'p1', f.engineToP1, 'mech'],
    ['engine', 'wheels', f.engineToWheels, 'mech'],
    ['p1', 'bus', f.p1Elec, 'elec'],
    batteryEdge,
    f.p3Elec >= 0 ? ['bus', 'p3', f.p3Elec, 'elec'] : ['p3', 'bus', -f.p3Elec, 'elec'],
    f.p3Mech >= 0 ? ['p3', 'wheels', f.p3Mech, 'mech'] : ['wheels', 'p3', -f.p3Mech, 'mech'],
    ['plug', 'battery', f.plug, 'grid'],
  ]

  const perKm = (kw: number) => (speed > 0 ? (kw / speed) * 100 : 0)
  const evKwh = mode === 'ev' ? perKm(f.battery) : 0
  const fuelL = f.fuel > 0 ? perKm(f.fuel) / KWH_PER_LEQ : 0

  // Road-load chart.
  const RL = { w: 560, h: 220, x0: 40, x1: 548, y0: 186, y1: 16, vMax: 175, pMax: 70 }
  const rx = (v: number) => RL.x0 + (v / RL.vMax) * (RL.x1 - RL.x0)
  const ry = (p: number) => RL.y0 - (p / RL.pMax) * (RL.y0 - RL.y1)
  const vs = Array.from({ length: 71 }, (_, i) => (i / 70) * RL.vMax)
  const rollPath = `M${rx(0)} ${ry(0)}` + vs.map((v) => `L${rx(v).toFixed(1)} ${ry(roadLoad(v).roll / 1000).toFixed(1)}`).join('') + `L${rx(RL.vMax)} ${ry(0)}Z`
  const totalLine = vs.map((v, i) => `${i ? 'L' : 'M'}${rx(v).toFixed(1)} ${ry(roadLoad(v).total / 1000).toFixed(1)}`).join('')
  const aeroPath = totalLine + vs.slice().reverse().map((v) => `L${rx(v).toFixed(1)} ${ry(roadLoad(v).roll / 1000).toFixed(1)}`).join('') + 'Z'

  return (
    <div className="engine ptrain" ref={box}>
      <div className="ctl enginemode">
        <span className="eseg" role="group" aria-label="modo de operação">
          {MODES.map((m) => (
            <button key={m} type="button" className="ebtn" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {MODE_NAME[m]}
            </button>
          ))}
        </span>
        <span className="eseg" role="group" aria-label="vista">
          {(
            [
              ['geral', 'carro'],
              ['edht', 'E-DHT'],
              ['bateria', 'bateria'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className="ebtn" aria-pressed={view === k} onClick={() => go(k)}>
              {label}
            </button>
          ))}
        </span>
      </div>
      <div className="enginev enginev1">
        <div className="engine3d" ref={mount}>
          {status !== 'ready' && (
            <div className="engineph">
              {status === 'nowebgl' ? (
                <p>Este navegador não exibe 3D (WebGL). O diagrama ao lado mostra o mesmo fluxo de energia.</p>
              ) : (
                <p>
                  Carregando o modelo 3D (0,7 MB)… {status === 'loading' && progress > 0 ? `${Math.round(progress * 100)} %` : ''}
                  <span className="enginebar" style={{ width: `${Math.round(progress * 100)}%` }} />
                </p>
              )}
            </div>
          )}
          <div className="enginehud" aria-live="polite">
            <span className="enginest" style={{ color: 'var(--c1)' }}>
              modo {MODE_NAME[mode]}
              {mode !== 'recarga' ? ` · ${speed} km/h` : ''}
            </span>
            <span className="engineang">
              {mode === 'recarga' ? `${dec(f.plug, 1)} kW da tomada` : `${dec(Math.abs(f.wheels), 1)} kW nas rodas`}
            </span>
          </div>
          {hover && (
            <div className="enginetip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
              <b>{hover.name}</b>
              <span>{hover.text}</span>
            </div>
          )}
          <p className="enginetx">{MODE_TEXT[mode]}</p>
        </div>
      </div>
      <div className="ctl enginectl">
        <button type="button" className="ebtn" onClick={toggle} aria-pressed={playing}>
          {playing ? 'pausar' : 'tocar'}
        </button>
        <label className="emrange">
          velocidade <b>{kmh} km/h</b>
          <input type="range" min={10} max={175} step={5} value={kmh} disabled={mode === 'recarga'} onChange={(e) => setKmh(Number(e.target.value))} />
        </label>
        <span className="enote">Câmera lenta. Pontos âmbar: combustível; cinza: força mecânica; azul: eletricidade; verde: tomada. Cada ponto ≈ 2 kW.</span>
      </div>

      <div className="g2e" style={{ marginTop: 28 }}>
        <div>
          <div className="instl">
            <span>fluxo de energia agora</span>
            <span>kW</span>
          </div>
          <svg className="svg" viewBox="0 0 570 300" role="img" aria-label={`Fluxo de energia no modo ${MODE_NAME[mode]}, em kW.`}>
            <defs>
              {Object.entries(KIND_COLOR).map(([k, c]) => (
                <marker key={k} id={`pt-${k}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto">
                  <path d="M0 0L10 5L0 10Z" fill={c} />
                </marker>
              ))}
            </defs>
            {edges.map(([a, b, kw, kind], i) => {
              if (kw < 0.05) return null
              const A = NODES[a]
              const B = NODES[b]
              const width = Math.min(14, 1.5 + kw / 6)
              const midX = (A.x + B.x) / 2
              const midY = (A.y + B.y) / 2
              // Straight links stop at the box edges (boxes are 84 × 30), so the arrowheads stay visible.
              const dx = B.x - A.x
              const dy = B.y - A.y
              const len = Math.hypot(dx, dy) || 1
              const cut = (ux: number, uy: number) => Math.min(Math.abs(ux) > 1e-6 ? 46 / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? 19 / Math.abs(uy) : Infinity)
              const t = cut(dx / len, dy / len)
              const d =
                a === 'engine' && b === 'wheels'
                  ? `M${A.x + 40} ${A.y - 16}C${A.x + 120} ${A.y - 54} ${B.x - 120} ${B.y - 54} ${B.x - 44} ${B.y - 16}`
                  : `M${A.x + (dx / len) * t} ${A.y + (dy / len) * t}L${B.x - (dx / len) * (t + 6)} ${B.y - (dy / len) * (t + 6)}`
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={KIND_COLOR[kind]} strokeWidth={width} strokeLinecap="round" opacity={0.85} markerEnd={`url(#pt-${kind})`} />
                  <text className="axa halo" x={a === 'engine' && b === 'wheels' ? midX : midX + 8} y={a === 'engine' && b === 'wheels' ? A.y - 34 : midY - 6} textAnchor="middle">
                    {dec(kw, 1)} kW
                  </text>
                </g>
              )
            })}
            {Object.entries(NODES).map(([k, n]) => (
              <g key={k}>
                <rect x={n.x - 42} y={n.y - 15} width={84} height={30} rx={6} fill="var(--bg)" stroke="var(--line)" />
                <text className="ax" x={n.x} y={n.y + 4} textAnchor="middle" fill="var(--ink)">
                  {n.label}
                </text>
              </g>
            ))}
          </svg>
          <dl className="emnums">
            <div>
              <dt>bateria</dt>
              <dd>{f.battery >= 0 ? `${dec(f.battery, 1)} kW saindo` : `${dec(-f.battery, 1)} kW entrando`}</dd>
            </div>
            <div>
              <dt>combustível{f.fuel > 0 && f.battery < 0 ? ' (parte vai para a bateria)' : ''}</dt>
              <dd>{f.fuel > 0 ? `${dec(f.fuel, 1)} kW (${dec(fuelL, 1)} L/100 km)` : 'zero'}</dd>
            </div>
            <div>
              <dt>{mode === 'ev' ? 'consumo elétrico' : 'perdas no caminho'}</dt>
              <dd>{mode === 'ev' ? `${dec(evKwh, 1)} kWh/100 km` : `${dec(Math.max(0, f.losses), 1)} kW`}</dd>
            </div>
            <div>
              <dt>rotação: rodas · motor · P3</dt>
              <dd>
                {fmt(f.wheelRpm)} · {fmt(f.engineRpm)} · {fmt(Math.abs(f.p3Rpm))} rpm
              </dd>
            </div>
          </dl>
        </div>
        <div>
        <div className="instl">
          <span>potência que o carro pede às rodas, no plano, em velocidade constante</span>
          <span>kW</span>
        </div>
        <svg className="svg" viewBox={`0 0 ${RL.w} ${RL.h}`} role="img" aria-label={`A ${speed} km/h, ${dec(load.total / 1000, 1)} kW: ${pct(load.aero / Math.max(1, load.total))} para vencer o ar.`}>
          <path d={rollPath} fill="var(--c3)" opacity={0.35} />
          <path d={aeroPath} fill="var(--c1)" opacity={0.35} />
          <path d={totalLine} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
          {speed > 0 && (
            <>
              <line x1={rx(speed)} y1={RL.y1} x2={rx(speed)} y2={RL.y0} stroke="var(--ink)" strokeDasharray="3 3" />
              <circle cx={rx(speed)} cy={ry(load.total / 1000)} r={5} fill="var(--ink)" stroke="var(--bg)" strokeWidth={2} />
              <text className="axa halo" x={rx(speed) + (speed > 120 ? -8 : 8)} y={ry(load.total / 1000) - 10} textAnchor={speed > 120 ? 'end' : 'start'}>
                {`${dec(load.total / 1000, 1)} kW · ar ${pct(load.aero / load.total)}`}
              </text>
            </>
          )}
          <line x1={RL.x0} y1={RL.y0} x2={RL.x1} y2={RL.y0} stroke="var(--line)" />
          {[0, 50, 100, 150].map((v) => (
            <text key={v} className="ax" x={rx(v)} y={RL.y0 + 16} textAnchor="middle">
              {v}
            </text>
          ))}
          <text className="ax" x={RL.x1} y={RL.y0 + 30} textAnchor="end">km/h</text>
          {[0, 20, 40, 60].map((p) => (
            <text key={p} className="ax" x={RL.x0 - 6} y={ry(p) + 4} textAnchor="end">
              {p}
            </text>
          ))}
        </svg>
        <div className="legend">
          <span>
            <i className="sw" style={{ background: 'var(--c1)' }} />
            arrasto do ar (cresce com v³)
          </span>
          <span>
            <i className="sw" style={{ background: 'var(--c3)' }} />
            rolamento dos pneus (cresce com v)
          </span>
        </div>
      </div>
      </div>
    </div>
  )
}
