'use client'
// Section 7a: a four-cylinder 1.0 in 3D (model from scripts/blender/motor.py), cut open two ways, with a guided tour,
// part names on hover/tap and the p–V diagram of cylinder 1 running in step. The three.js scene (./scene.ts) and the
// model load only when the section nears the viewport.
import { useEffect, useRef, useState } from 'react'
import LAYOUT from '@/lib/engine-layout.json'
import { cycleMs, pressure, STROKE_NAME, STROKE_TEXT, STROKES, strokeAt, volume, type Stroke } from '@/lib/engine'
import { dec, fmt } from '@/lib/format'
import type { EngineScene, Mode, Part, View } from './scene'

const SPEEDS = [
  { key: 'lenta', label: 'lenta', s: 10 },
  { key: 'media', label: 'média', s: 4 },
  { key: 'rapida', label: 'rápida', s: 1.2 },
] as const
type SpeedKey = (typeof SPEEDS)[number]['key']
const REAL_RPM = 2000
const STROKE_FILL: Record<Stroke, string> = { admissao: 'var(--c1)', compressao: 'var(--c2)', combustao: 'var(--c4)', escape: 'var(--mute)' }

type Step = { title: string; text: string; mode: Mode; view: string; angle?: number; play?: boolean }
const TOUR: Step[] = [
  { title: 'O motor inteiro', mode: 'quatro', view: 'geral4', play: true, text: 'Um motor 1.0 de quatro cilindros em corte: a frente do bloco e do cabeçote foi removida. Cada cilindro tem 250 cm³; juntos, um litro. Passe o mouse (ou toque) numa peça para ver o nome.' },
  { title: '1º tempo · admissão', mode: 'um', view: 'admissao', angle: 95, text: 'O pistão desce e as válvulas de admissão abrem. O bico injetor pulveriza combustível no duto, e o ar com combustível (azul) é puxado para dentro do cilindro.' },
  { title: '2º tempo · compressão', mode: 'um', view: 'compressao', angle: 300, text: 'As válvulas fecham e o pistão sobe: a mistura é espremida em 1/12 do volume e esquenta. A pressão vai de 1 a cerca de 25 bar.' },
  { title: '3º tempo · combustão e expansão', mode: 'um', view: 'combustao', angle: 372, text: 'Perto do ponto mais alto, a vela solta a faísca. A frente de chama atravessa a câmara, a pressão salta para dezenas de bar e empurra o pistão para baixo: é o único tempo que gera trabalho.' },
  { title: '4º tempo · escape', mode: 'um', view: 'escape', angle: 610, text: 'As válvulas de escape abrem e o pistão sobe, expulsando o gás queimado (cinza) para o coletor de escape.' },
  { title: 'Ordem de ignição 1-3-4-2', mode: 'quatro', view: 'ordem', play: true, text: 'Os quatro cilindros revezam a combustão na ordem 1-3-4-2: a cada meia volta do virabrequim, um deles empurra. Por isso o motor gira redondo.' },
  { title: 'Correia dentada', mode: 'quatro', view: 'correia', play: true, text: 'A polia dos comandos tem o dobro do diâmetro da polia do virabrequim, então gira na metade da velocidade. Cada válvula abre uma vez a cada duas voltas: uma vez por ciclo de quatro tempos.' },
]

// ---- p–V diagram ---------------------------------------------------------------------------------------
const PV = { w: 320, h: 230, x0: 40, x1: 308, y0: 196, y1: 14, vMax: 280, pMax: 65 }
const px = (v: number) => PV.x0 + (v / PV.vMax) * (PV.x1 - PV.x0)
const py = (p: number) => PV.y0 - (p / PV.pMax) * (PV.y0 - PV.y1)
const pvPath = (from: number, to: number) => {
  let d = ''
  for (let a = from; a <= to; a += 2) d += `${a === from ? 'M' : 'L'}${px(volume(a)).toFixed(1)} ${py(pressure(a)).toFixed(1)}`
  return d
}
const PV_PATHS = STROKES.map((s, i) => ({ s, d: pvPath(i * 180, i * 180 + 180) }))
// The work loop: compression and expansion between the dead centres.
const WORK = `${pvPath(180, 360)}${pvPath(360, 540).replace(/^M/, 'L')}Z`

const firing = (angle: number) => LAYOUT.offsets.findIndex((o) => strokeAt(angle + o) === 'combustao') + 1

export default function Engine3D() {
  const box = useRef<HTMLDivElement>(null)
  const mount = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<EngineScene | null>(null)
  const dot = useRef<SVGCircleElement>(null)
  const angleText = useRef<HTMLSpanElement>(null)
  const pText = useRef<HTMLSpanElement>(null)
  const fireText = useRef<HTMLSpanElement>(null)
  const [stroke, setStroke] = useState<Stroke>('combustao')
  const [mode, setModeState] = useState<Mode>('quatro')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<SpeedKey>('media')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'nowebgl'>('idle')
  const [progress, setProgress] = useState(0)
  const [hover, setHover] = useState<(Part & { x: number; y: number }) | null>(null)
  const [step, setStep] = useState<number | null>(null)

  useEffect(() => {
    const el = mount.current
    const outer = box.current
    if (!el || !outer) return
    let disposed = false
    let shown: Stroke | null = null
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        setStatus('loading')
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduced) setPlaying(false)
        import('./scene')
          .then(({ createEngineScene }) =>
            createEngineScene(el, {
              reducedMotion: reduced,
              onProgress: setProgress,
              onHover: setHover,
              onFrame: ({ angle }) => {
                const s = strokeAt(angle)
                if (s !== shown) {
                  shown = s
                  setStroke(s)
                }
                if (dot.current) {
                  dot.current.setAttribute('cx', px(volume(angle)).toFixed(1))
                  dot.current.setAttribute('cy', py(pressure(angle)).toFixed(1))
                }
                if (angleText.current) angleText.current.textContent = `${Math.round(angle)}°`
                if (pText.current) pText.current.textContent = `${dec(pressure(angle), 1)} bar · ${dec(volume(angle), 0)} cm³`
                if (fireText.current) fireText.current.textContent = String(firing(angle))
              },
            }),
          )
          .then((sc) => {
            if (disposed) return sc.dispose()
            sceneRef.current = sc
            setStatus('ready')
          })
          .catch((e: Error) => {
            console.warn('[motor 3D]', e.message)
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

  const sc = () => sceneRef.current
  const applyStep = (i: number) => {
    const s = TOUR[i]
    setStep(i)
    setModeState(s.mode)
    sc()?.setMode(s.mode)
    import('./scene').then(({ VIEWS }) => sc()?.flyTo(VIEWS[s.view] as View))
    if (s.angle !== undefined) sc()?.jumpTo(s.angle)
    const play = !!s.play
    sc()?.setPlaying(play)
    setPlaying(play)
  }
  const pickMode = (m: Mode) => {
    setStep(null)
    setModeState(m)
    sc()?.setMode(m)
    import('./scene').then(({ VIEWS }) => sc()?.flyTo(VIEWS[m === 'um' ? 'geral1' : 'geral4'] as View))
  }
  const toggle = () => {
    sc()?.setPlaying(!playing)
    setPlaying(!playing)
  }
  const pickSpeed = (k: SpeedKey) => {
    sc()?.setCycleSeconds(SPEEDS.find((s) => s.key === k)!.s)
    setSpeed(k)
  }
  const goTo = (s: Stroke) => {
    if (mode !== 'um') pickMode('um')
    sc()?.jumpTo(STROKES.indexOf(s) * 180 + 90)
    sc()?.setPlaying(false)
    setPlaying(false)
  }
  const sp = SPEEDS.find((s) => s.key === speed)!
  const slower = Math.round((sp.s * 1000) / cycleMs(REAL_RPM))
  const tour = step === null ? null : TOUR[step]

  return (
    <div className="engine" ref={box}>
      <div className="ctl enginemode">
        <span className="eseg" role="group" aria-label="vista">
          <button type="button" className="ebtn" aria-pressed={mode === 'quatro'} onClick={() => pickMode('quatro')}>
            motor inteiro · 4 cilindros
          </button>
          <button type="button" className="ebtn" aria-pressed={mode === 'um'} onClick={() => pickMode('um')}>
            um cilindro em corte
          </button>
        </span>
        <button type="button" className="ebtn etour" aria-pressed={step !== null} onClick={() => (step === null ? applyStep(0) : setStep(null))}>
          {step === null ? 'tour guiado' : 'sair do tour'}
        </button>
      </div>
      <div className="enginev">
        <div className="engine3d" ref={mount}>
          {status !== 'ready' && (
            <div className="engineph">
              {status === 'nowebgl' ? (
                <p>Este navegador não exibe 3D (WebGL). Os quatro tempos estão desenhados em 7b, logo abaixo.</p>
              ) : (
                <p>
                  Carregando o modelo 3D (1,7 MB)… {status === 'loading' && progress > 0 ? `${Math.round(progress * 100)} %` : ''}
                  <span className="enginebar" style={{ width: `${Math.round(progress * 100)}%` }} />
                </p>
              )}
            </div>
          )}
          <div className="enginehud" aria-live="polite">
            {mode === 'um' ? (
              <span className="enginest" style={{ color: STROKE_FILL[stroke] }}>
                cilindro 1 · {STROKES.indexOf(stroke) + 1}º tempo · {STROKE_NAME[stroke]}
              </span>
            ) : (
              <span className="enginest" style={{ color: 'var(--c4)' }}>
                combustão no cilindro <span ref={fireText}>1</span> · ordem 1-3-4-2
              </span>
            )}
            <span className="engineang">
              virabrequim <span ref={angleText}>400°</span>
            </span>
          </div>
          {hover && (
            <div className="enginetip" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
              <b>{hover.name}</b>
              <span>{hover.text}</span>
            </div>
          )}
          {tour ? (
            <div className="enginetour">
              <p className="enginetourh">
                <span>{tour.title}</span>
                <span>
                  {step! + 1}/{TOUR.length}
                </span>
              </p>
              <p>{tour.text}</p>
              <div className="eseg">
                <button type="button" className="ebtn" disabled={step === 0} onClick={() => applyStep(step! - 1)}>
                  anterior
                </button>
                {step! < TOUR.length - 1 ? (
                  <button type="button" className="ebtn" aria-pressed onClick={() => applyStep(step! + 1)}>
                    próximo
                  </button>
                ) : (
                  <button type="button" className="ebtn" aria-pressed onClick={() => setStep(null)}>
                    fim
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="enginetx">{mode === 'um' ? STROKE_TEXT[stroke] : 'Arraste para girar. Passe o mouse ou toque numa peça para ver o nome.'}</p>
          )}
        </div>
        <div className="enginepv">
          <svg className="svg" viewBox={`0 0 ${PV.w} ${PV.h}`} role="img" aria-label="Diagrama pressão por volume do cilindro 1: a área sombreada é o trabalho de cada ciclo.">
            <text className="axl" x={PV.x0} y={10}>pressão no cilindro 1, bar</text>
            <path d={WORK} fill="var(--c4)" opacity={0.1} />
            {[0, 20, 40, 60].map((p) => (
              <g key={p}>
                <line x1={PV.x0} y1={py(p)} x2={PV.x1} y2={py(p)} stroke="var(--line)" strokeDasharray={p ? '1 4' : undefined} />
                <text className="ax" x={PV.x0 - 6} y={py(p) + 4} textAnchor="end">{p}</text>
              </g>
            ))}
            {PV_PATHS.map(({ s, d }) => (
              <path key={s} d={d} fill="none" stroke={STROKE_FILL[s]} strokeWidth={s === stroke ? 3 : 1.5} opacity={s === stroke ? 1 : 0.55} />
            ))}
            <text className="ax" x={px(110)} y={py(14)}>trabalho</text>
            <circle ref={dot} cx={px(volume(400))} cy={py(pressure(400))} r={5} fill="var(--ink)" stroke="var(--bg)" strokeWidth={2} />
            {[0, 100, 200].map((v) => (
              <text key={v} className="ax" x={px(v)} y={PV.y0 + 16} textAnchor="middle">{v}</text>
            ))}
            <text className="ax" x={PV.x1} y={PV.y0 + 30} textAnchor="end">volume no cilindro, cm³</text>
          </svg>
          <p className="enginepvl">
            <span ref={pText}>
              {dec(pressure(400), 1)} bar · {dec(volume(400), 0)} cm³
            </span>
          </p>
        </div>
      </div>
      <div className="ctl enginectl">
        <button type="button" className="ebtn" onClick={toggle} aria-pressed={playing}>
          {playing ? 'pausar' : 'tocar'}
        </button>
        <span className="eseg" role="group" aria-label="velocidade">
          {SPEEDS.map((s) => (
            <button key={s.key} type="button" className="ebtn" aria-pressed={speed === s.key} onClick={() => pickSpeed(s.key)}>
              {s.label}
            </button>
          ))}
        </span>
        <span className="eseg" role="group" aria-label="ir para um tempo do cilindro 1">
          {STROKES.map((s, i) => (
            <button key={s} type="button" className="ebtn" aria-pressed={mode === 'um' && stroke === s && !playing} onClick={() => goTo(s)}>
              {i + 1}º
            </button>
          ))}
        </span>
        <span className="enote">
          1 ciclo a cada {dec(sp.s, 1)} s aqui; a {fmt(REAL_RPM)} rpm, um motor real faz o mesmo em {fmt(cycleMs(REAL_RPM))} ms ({fmt(slower)} vezes mais rápido).
        </span>
      </div>
    </div>
  )
}
