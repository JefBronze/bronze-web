'use client'
// Section 7a: a one-cylinder four-stroke engine in 3D, cut open, with the p–V diagram running in step.
// three.js is imported only when the section comes near the viewport, so the page's first load does not pay for it.
// Geometry is built in code from lib/engine.ts (no model file). Colours come from the page's CSS tokens and follow the theme.
import { useEffect, useRef, useState } from 'react'
import type * as T from 'three'
import {
  clearanceHeight,
  crankRadius,
  cycleMs,
  ENGINE,
  pinHeight,
  pressure,
  STROKE_NAME,
  STROKE_TEXT,
  STROKES,
  strokeAt,
  valveLift,
  volume,
  type Stroke,
} from '@/lib/engine'
import { dec, fmt } from '@/lib/format'

const SPEEDS = [
  { key: 'lenta', label: 'lenta', s: 10 },
  { key: 'media', label: 'média', s: 4 },
  { key: 'rapida', label: 'rápida', s: 1.2 },
] as const
type SpeedKey = (typeof SPEEDS)[number]['key']
const REAL_RPM = 2000
const STROKE_FILL: Record<Stroke, string> = { admissao: 'var(--c1)', compressao: 'var(--c2)', combustao: 'var(--c4)', escape: 'var(--mute)' }

// ---- p–V diagram (SVG, drawn once; only the dot moves) --------------------------------------------------
const PV = { w: 320, h: 230, x0: 40, x1: 308, y0: 196, y1: 14, vMax: 280, pMax: 65 }
const px = (v: number) => PV.x0 + (v / PV.vMax) * (PV.x1 - PV.x0)
const py = (p: number) => PV.y0 - (p / PV.pMax) * (PV.y0 - PV.y1)
const pvPath = (from: number, to: number) => {
  let d = ''
  for (let a = from; a <= to; a += 2) d += `${a === from ? 'M' : 'L'}${px(volume(a)).toFixed(1)} ${py(pressure(a)).toFixed(1)}`
  return d
}
const PV_PATHS = STROKES.map((s, i) => ({ s, d: pvPath(i * 180, i * 180 + 180) }))

// ---- layout of the 3D model, mm (y up, crank axis at the origin) ----------------------------------------
const PISTON_H = 44
const PIN_BELOW_TOP = 16
const HEAD_Y = crankRadius + ENGINE.rod + PIN_BELOW_TOP + clearanceHeight
const LINER_BOTTOM = 58
const VALVE_X = 17
const CAM_Y = HEAD_Y + 72

function cssColor(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export default function Engine3D() {
  const box = useRef<HTMLDivElement>(null)
  const mount = useRef<HTMLDivElement>(null)
  const dot = useRef<SVGCircleElement>(null)
  const angleText = useRef<HTMLSpanElement>(null)
  const pText = useRef<HTMLSpanElement>(null)
  const state = useRef({ angle: 400, playing: true, speed: 4 as number, jump: null as number | null })
  const [stroke, setStroke] = useState<Stroke>('combustao')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<SpeedKey>('media')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'nowebgl'>('idle')

  useEffect(() => {
    const el = mount.current
    const outer = box.current
    if (!el || !outer) return
    let disposed = false
    let cleanup = () => {}

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        setStatus('loading')
        import('three').then((THREE) => {
          if (disposed) return
          // Reduced motion: start still, on the power stroke; the visitor can press play.
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            state.current.playing = false
            setPlaying(false)
          }
          try {
            cleanup = build(THREE, el, outer)
            setStatus('ready')
          } catch (e) {
            console.warn('[motor 3D] WebGL indisponível:', (e as Error).message)
            setStatus('nowebgl')
          }
        })
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(outer)

    function build(THREE: typeof T, host: HTMLDivElement, watch: HTMLDivElement) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      host.appendChild(renderer.domElement)
      renderer.domElement.setAttribute('role', 'img')
      renderer.domElement.setAttribute('aria-label', 'Modelo 3D de um cilindro de motor a combustão em corte: pistão, biela, virabrequim, válvulas, comando e vela.')

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(30, 4 / 3, 10, 4000)
      camera.position.set(250, 190, 600)
      camera.lookAt(0, 105, 0)
      scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.6))
      const sun = new THREE.DirectionalLight(0xffffff, 2.2)
      sun.position.set(220, 400, 380)
      scene.add(sun)

      const root = new THREE.Group()
      root.rotation.y = -0.45
      scene.add(root)

      const mat = (opts: T.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, ...opts })
      const steel = mat()
      const dark = mat({ roughness: 0.6 })
      const accent = mat({ metalness: 0.5 })
      const block = mat({ roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide })
      const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.1, depthWrite: false, roughness: 0.2, metalness: 0, side: THREE.DoubleSide })
      const gasMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.4, depthWrite: false, roughness: 1, metalness: 0 })
      const glowMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
      const lineMat = new THREE.LineBasicMaterial()
      const geoms: T.BufferGeometry[] = []
      const g = <G extends T.BufferGeometry>(x: G) => (geoms.push(x), x)
      const edges = (mesh: T.Mesh) => {
        const l = new THREE.LineSegments(g(new THREE.EdgesGeometry(mesh.geometry, 30)), lineMat)
        mesh.add(l)
        return mesh
      }

      // Cylinder liner and head, back half only: the cut faces the camera.
      const liner = new THREE.LatheGeometry(
        [new THREE.Vector2(37, LINER_BOTTOM), new THREE.Vector2(48, LINER_BOTTOM), new THREE.Vector2(48, HEAD_Y), new THREE.Vector2(37, HEAD_Y), new THREE.Vector2(37, LINER_BOTTOM)],
        48,
        Math.PI / 2,
        Math.PI,
      )
      root.add(edges(new THREE.Mesh(g(liner), block)))
      const head = new THREE.Mesh(g(new THREE.BoxGeometry(120, 36, 60)), block)
      head.position.set(0, HEAD_Y + 18, -30)
      root.add(edges(head))
      // Front halves as glass, so the piston reads as inside the cylinder.
      const linerProfile = [new THREE.Vector2(37, LINER_BOTTOM), new THREE.Vector2(48, LINER_BOTTOM), new THREE.Vector2(48, HEAD_Y), new THREE.Vector2(37, HEAD_Y), new THREE.Vector2(37, LINER_BOTTOM)]
      root.add(edges(new THREE.Mesh(g(new THREE.LatheGeometry(linerProfile, 48, -Math.PI / 2, Math.PI)), glass)))
      const headFront = new THREE.Mesh(g(new THREE.BoxGeometry(120, 36, 60)), glass)
      headFront.position.set(0, HEAD_Y + 18, 30)
      root.add(edges(headFront))

      // Gas in the chamber, between the piston crown and the head.
      const gas = new THREE.Mesh(g(new THREE.CylinderGeometry(36.5, 36.5, 1, 40, 1, false, Math.PI / 2, Math.PI)), gasMat)
      root.add(gas)

      // Piston with its pin.
      const piston = new THREE.Group()
      const crown = new THREE.Mesh(g(new THREE.CylinderGeometry(35.5, 35.5, PISTON_H, 48)), steel)
      crown.position.y = PIN_BELOW_TOP - PISTON_H / 2
      piston.add(edges(crown))
      for (const yy of [8, 4]) {
        const ring = new THREE.Mesh(g(new THREE.TorusGeometry(35.6, 0.8, 6, 48)), dark)
        ring.rotation.x = Math.PI / 2
        ring.position.y = yy
        piston.add(ring)
      }
      const pin = new THREE.Mesh(g(new THREE.CylinderGeometry(9, 9, 60, 20)), dark)
      pin.rotation.x = Math.PI / 2
      piston.add(pin)
      root.add(piston)

      // Connecting rod.
      const rod = new THREE.Mesh(g(new THREE.BoxGeometry(13, ENGINE.rod, 9)), accent)
      root.add(edges(rod))

      // Crankshaft: main journals, two webs with counterweights, crank pin.
      const crank = new THREE.Group()
      const main = new THREE.Mesh(g(new THREE.CylinderGeometry(13, 13, 110, 24)), dark)
      main.rotation.x = Math.PI / 2
      crank.add(main)
      for (const z of [-16, 16]) {
        const web = new THREE.Mesh(g(new THREE.BoxGeometry(34, crankRadius + 22, 9)), steel)
        web.position.set(0, (crankRadius + 22) / 2 - 11, z)
        crank.add(edges(web))
        const cw = new THREE.Mesh(g(new THREE.CylinderGeometry(46, 46, 9, 32, 1, false, Math.PI / 2, Math.PI)), steel)
        cw.rotation.x = Math.PI / 2
        cw.position.z = z
        crank.add(edges(cw))
      }
      const cpin = new THREE.Mesh(g(new THREE.CylinderGeometry(11, 11, 42, 20)), dark)
      cpin.rotation.x = Math.PI / 2
      cpin.position.y = crankRadius
      crank.add(cpin)
      root.add(crank)

      // Valves, camshafts (half crank speed) and the spark plug.
      const valve = (x: number, m: T.Material) => {
        const v = new THREE.Group()
        const disc = new THREE.Mesh(g(new THREE.CylinderGeometry(14, 9, 4, 28)), m)
        disc.position.y = -2
        const stem = new THREE.Mesh(g(new THREE.CylinderGeometry(2.6, 2.6, 66, 10)), m)
        stem.position.y = 33
        v.add(edges(disc), stem)
        v.position.x = x
        root.add(v)
        return v
      }
      const inMat = mat({ metalness: 0.4 })
      const exMat = mat({ metalness: 0.4 })
      const vIn = valve(-VALVE_X, inMat)
      const vEx = valve(VALVE_X, exMat)
      const cam = (x: number) => {
        const c = new THREE.Group()
        const shaft = new THREE.Mesh(g(new THREE.CylinderGeometry(6, 6, 70, 16)), dark)
        shaft.rotation.x = Math.PI / 2
        const lobe = new THREE.Mesh(g(new THREE.CylinderGeometry(9, 12, 10, 3)), steel)
        lobe.rotation.x = Math.PI / 2
        lobe.position.y = -4
        c.add(shaft, edges(lobe))
        c.position.set(x, CAM_Y, 0)
        root.add(c)
        return c
      }
      const camIn = cam(-VALVE_X)
      const camEx = cam(VALVE_X)
      const plug = new THREE.Mesh(g(new THREE.CylinderGeometry(5, 5, 50, 14)), dark)
      plug.position.set(0, HEAD_Y + 25, 0)
      root.add(plug)
      const glow = new THREE.Mesh(g(new THREE.SphereGeometry(7, 16, 12)), glowMat)
      glow.position.set(0, HEAD_Y - 2, 0)
      root.add(glow)
      const flash = new THREE.PointLight(0xffaa44, 0, 220)
      flash.position.set(0, HEAD_Y - 8, 10)
      root.add(flash)

      // Theme: re-read tokens whenever the page switches light/dark.
      const col = new THREE.Color()
      const gasCols = { in: new THREE.Color(), comp: new THREE.Color(), fire: new THREE.Color(), core: new THREE.Color(), ex: new THREE.Color() }
      const paint = () => {
        steel.color.set(cssColor('--ink2', '#4A463F'))
        dark.color.set(cssColor('--ink', '#1A1917'))
        accent.color.set(cssColor('--c2', '#8a6737'))
        block.color.set(cssColor('--bg2', '#F3F0EA'))
        glass.color.set(cssColor('--ink2', '#4A463F'))
        lineMat.color.set(cssColor('--mute', '#7A746B'))
        inMat.color.set(cssColor('--c1', '#2f6f8f'))
        exMat.color.set(cssColor('--c4', '#b5523b'))
        gasCols.in.set(cssColor('--c1', '#2f6f8f'))
        gasCols.comp.set(cssColor('--c2', '#8a6737'))
        gasCols.fire.set(cssColor('--c4', '#b5523b'))
        gasCols.core.set(cssColor('--sol', '#e0b04a'))
        gasCols.ex.set(cssColor('--mute', '#7A746B'))
        glowMat.color.copy(gasCols.core)
      }
      paint()
      const mo = new MutationObserver(paint)
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', paint)

      // Size follows the column.
      const resize = () => {
        const w = host.clientWidth
        const h = Math.round(Math.min(560, Math.max(300, w * 0.78)))
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(host)

      // Drag to turn the model.
      let drag: { x: number; y: number; ry: number; rx: number } | null = null
      const canvas = renderer.domElement
      canvas.style.touchAction = 'pan-y'
      const down = (e: PointerEvent) => {
        drag = { x: e.clientX, y: e.clientY, ry: root.rotation.y, rx: root.rotation.x }
        canvas.setPointerCapture(e.pointerId)
      }
      const move = (e: PointerEvent) => {
        if (!drag) return
        root.rotation.y = Math.max(-1.5, Math.min(1.5, drag.ry + (e.clientX - drag.x) / 160))
        root.rotation.x = Math.max(-0.35, Math.min(0.5, drag.rx + (e.clientY - drag.y) / 300))
      }
      const up = () => (drag = null)
      canvas.addEventListener('pointerdown', down)
      canvas.addEventListener('pointermove', move)
      canvas.addEventListener('pointerup', up)
      canvas.addEventListener('pointercancel', up)

      // Pose everything for a crank angle (0–720°).
      let shownStroke: Stroke | null = null
      const pose = (a: number) => {
        const t = (a * Math.PI) / 180
        const pinY = pinHeight(a)
        piston.position.y = pinY
        crank.rotation.z = -t
        const cx = crankRadius * Math.sin(t)
        const cy = crankRadius * Math.cos(t)
        rod.position.set(cx / 2, (cy + pinY) / 2, 0)
        rod.rotation.z = Math.atan2(cx, pinY - cy)
        const top = pinY + PIN_BELOW_TOP
        gas.scale.y = Math.max(0.5, HEAD_Y - top)
        gas.position.y = (HEAD_Y + top) / 2
        vIn.position.y = HEAD_Y - valveLift(a, 'in')
        vEx.position.y = HEAD_Y - valveLift(a, 'ex')
        camIn.rotation.z = ((a - 90) / 2) * (Math.PI / 180)
        camEx.rotation.z = ((a - 630) / 2) * (Math.PI / 180)

        const s = strokeAt(a)
        const k = (a % 180) / 180
        // Fresh charge (blue), squeezed (darker), burning (yellow to red), burnt gas leaving (grey).
        if (s === 'admissao') {
          col.copy(gasCols.in)
          gasMat.opacity = 0.18 + 0.17 * k
        } else if (s === 'compressao') {
          col.copy(gasCols.in).lerp(gasCols.comp, k)
          gasMat.opacity = 0.35 + 0.3 * k
        } else if (s === 'combustao') {
          col.copy(gasCols.core).lerp(gasCols.fire, Math.min(1, k * 2.5))
          gasMat.opacity = 0.8 - 0.4 * k
        } else {
          col.copy(gasCols.fire).lerp(gasCols.ex, Math.min(1, k * 3))
          gasMat.opacity = 0.4 - 0.25 * k
        }
        gasMat.color.copy(col)
        gasMat.emissive.copy(col).multiplyScalar(s === 'combustao' ? 0.9 * (1 - k) : 0)
        // The spark: a few degrees before TDC, and the flame front just after.
        const spark = a > 350 && a < 372 ? 1 - Math.abs(a - 360) / 12 : 0
        glowMat.opacity = Math.max(0, spark)
        flash.intensity = s === 'combustao' ? 9000 * Math.max(0, 1 - k * 3) : spark * 6000

        if (dot.current) {
          dot.current.setAttribute('cx', px(volume(a)).toFixed(1))
          dot.current.setAttribute('cy', py(pressure(a)).toFixed(1))
        }
        if (angleText.current) angleText.current.textContent = `${Math.round(a)}°`
        if (pText.current) pText.current.textContent = `${dec(pressure(a), 1)} bar · ${dec(volume(a), 0)} cm³`
        if (s !== shownStroke) {
          shownStroke = s
          setStroke(s)
        }
      }

      // Animate only while the model is on screen and the tab is visible.
      let visible = true
      const vis = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)))
      vis.observe(watch)
      let last = performance.now()
      let raf = 0
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame)
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        const st = state.current
        if (st.jump !== null) {
          st.angle = st.jump
          st.jump = null
        } else if (st.playing && visible && !document.hidden) {
          st.angle = (st.angle + (720 * dt) / st.speed) % 720
        } else if (!drag && !visible) return
        pose(st.angle)
        renderer.render(scene, camera)
      }
      raf = requestAnimationFrame(frame)

      return () => {
        cancelAnimationFrame(raf)
        vis.disconnect()
        ro.disconnect()
        mo.disconnect()
        mq.removeEventListener('change', paint)
        geoms.forEach((x) => x.dispose())
        ;[steel, dark, accent, block, glass, gasMat, glowMat, lineMat, inMat, exMat].forEach((m) => m.dispose())
        renderer.dispose()
        canvas.remove()
      }
    }

    return () => {
      disposed = true
      io.disconnect()
      cleanup()
    }
  }, [])

  const toggle = () => {
    state.current.playing = !state.current.playing
    setPlaying(state.current.playing)
  }
  const pickSpeed = (k: SpeedKey) => {
    state.current.speed = SPEEDS.find((s) => s.key === k)!.s
    setSpeed(k)
  }
  const goTo = (s: Stroke) => {
    state.current.jump = STROKES.indexOf(s) * 180 + 90
    state.current.playing = false
    setPlaying(false)
  }
  const sp = SPEEDS.find((s) => s.key === speed)!
  const slower = Math.round((sp.s * 1000) / cycleMs(REAL_RPM))

  return (
    <div className="engine" ref={box}>
      <div className="enginev">
        <div className="engine3d" ref={mount}>
          {status !== 'ready' && (
            <p className="engineph">
              {status === 'nowebgl' ? 'Este navegador não exibe 3D (WebGL). Os quatro tempos estão desenhados em 7b, logo abaixo.' : 'Carregando o modelo 3D…'}
            </p>
          )}
          <div className="enginehud" aria-live="polite">
            <span className="enginest" style={{ color: STROKE_FILL[stroke] }}>
              {STROKES.indexOf(stroke) + 1}º tempo · {STROKE_NAME[stroke]}
            </span>
            <span className="engineang">
              virabrequim <span ref={angleText}>400°</span>
            </span>
          </div>
          <p className="enginetx">{STROKE_TEXT[stroke]}</p>
        </div>
        <div className="enginepv">
          <svg className="svg" viewBox={`0 0 ${PV.w} ${PV.h}`} role="img" aria-label="Diagrama pressão por volume do ciclo idealizado: a área dentro da curva é o trabalho de cada ciclo.">
            <text className="axl" x={PV.x0} y={10}>pressão, bar</text>
            {[0, 20, 40, 60].map((p) => (
              <g key={p}>
                <line x1={PV.x0} y1={py(p)} x2={PV.x1} y2={py(p)} stroke="var(--line)" strokeDasharray={p ? '1 4' : undefined} />
                <text className="ax" x={PV.x0 - 6} y={py(p) + 4} textAnchor="end">{p}</text>
              </g>
            ))}
            {PV_PATHS.map(({ s, d }) => (
              <path key={s} d={d} fill="none" stroke={STROKE_FILL[s]} strokeWidth={s === stroke ? 3 : 1.5} opacity={s === stroke ? 1 : 0.55} />
            ))}
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
        <span className="eseg" role="group" aria-label="ir para um tempo">
          {STROKES.map((s, i) => (
            <button key={s} type="button" className="ebtn" aria-pressed={stroke === s && !playing} onClick={() => goTo(s)}>
              {i + 1}º
            </button>
          ))}
        </span>
        <span className="enote">
          1 ciclo a cada {dec(sp.s, 1)} s aqui; a {fmt(REAL_RPM)} rpm, um motor real faz o mesmo em {fmt(cycleMs(REAL_RPM))} ms ({fmt(slower)} vezes mais rápido). Arraste para girar.
        </span>
      </div>
    </div>
  )
}
