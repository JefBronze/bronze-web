// Section 9d, the three.js side: the EM-i powertrain with energy flowing along its paths. Imported on demand by
// Powertrain3D.tsx. Model: public/models/powertrain.glb (npm run model:powertrain). Speeds and power split come from
// lib/powertrain.ts; gears turn in the model's real ratios (meshing gears counter-rotate).
// Coordinates: three.js, mm. Blender (x, y, z) → three (x, z, −y). Rotating nodes turn about three's Z.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import L from '@/lib/powertrain-layout.json'
import { flows, wheelRpm, type Flows, type Mode } from '@/lib/powertrain'

export type View = { pos: [number, number, number]; target: [number, number, number] }
export type Part = { name: string; text: string }

export const VIEWS: Record<string, View> = {
  geral: { pos: [3400, 2300, 3300], target: [0, 250, 0] },
  edht: { pos: [2400, 1100, -1300], target: [1220, 420, -250] },
  bateria: { pos: [600, 2600, 1400], target: [-250, 200, 0] },
}

const PARTS: [RegExp, Part][] = [
  [/^roda/, { name: 'Roda e pneu', text: '235/50 R19; o freio a disco fica atrás do aro' }],
  [/^semieixo/, { name: 'Semieixo', text: 'leva o torque do diferencial à roda, com juntas homocinéticas nas pontas' }],
  [/^diferencial/, { name: 'Diferencial e coroa', text: 'divide o torque entre as rodas e deixa uma girar mais que a outra nas curvas' }],
  [/^pinhao_motor/, { name: 'Pinhão do motor a combustão', text: 'liga o motor 1.5 às rodas por uma relação fixa, quando a embreagem fecha' }],
  [/^embreagem/, { name: 'Embreagem', text: 'aberta nos modos elétrico e série; fechada no modo paralelo' }],
  [/^motor_bloco/, { name: 'Motor 1.5 (combustão)', text: '73 kW; no EM-i ele quase sempre gera eletricidade e só às vezes empurra as rodas' }],
  [/^motor_polia/, { name: 'Polia do virabrequim', text: 'gira quando o motor a combustão está ligado' }],
  [/^p1_/, { name: 'Gerador P1', text: 'no eixo do motor: gera eletricidade e dá a partida' }],
  [/^p3_/, { name: 'Motor de tração P3', text: '160 kW e 262 N·m (o da seção acima); move o carro e regenera na frenagem' }],
  [/^intermediaria/, { name: 'Engrenagem intermediária', text: 'reduz a rotação do P3 até as rodas' }],
  [/^edht_carcaca/, { name: 'E-DHT 11 em 1', text: 'transmissão de uma marcha com os dois motores, inversores e conversor elevador numa carcaça' }],
  [/^bateria/, { name: 'Bateria LFP 18,4 kWh', text: 'fosfato de ferro-lítio, sob o assoalho; módulos de células prismáticas' }],
  [/^tampa_bateria/, { name: 'Tampa da bateria', text: 'removida no desenho para mostrar os módulos' }],
  [/^tanque/, { name: 'Tanque de 60 L', text: 'à frente do eixo traseiro' }],
  [/^escape/, { name: 'Escapamento', text: 'catalisador, silencioso e saída' }],
  [/^carregador/, { name: 'Carregador de bordo', text: 'converte a corrente alternada da tomada em contínua para a bateria (6,6 kW)' }],
  [/^tomada/, { name: 'Tomada de recarga', text: 'corrente alternada e contínua' }],
  [/^cabos_at/, { name: 'Cabos de alta tensão', text: 'laranja por norma: centenas de volts em corrente contínua' }],
  [/^chassi/, { name: 'Longarinas e subchassis', text: 'a estrutura simplificada, sem a carroceria' }],
]

const toThree = ([x, y, z]: number[]) => new THREE.Vector3(x, z, -y)
const P = Object.fromEntries(Object.entries(L.points).map(([k, v]) => [k, toThree(v)])) as Record<keyof typeof L.points, THREE.Vector3>

type Link = { key: keyof Flows; path: THREE.Vector3[]; kind: 'fuel' | 'mech' | 'elec' | 'grid'; reverse?: (f: Flows) => boolean }
const LINKS: Link[] = [
  { key: 'fuel', path: [P.tank, toThree([-900, 0, 420]), toThree([800, -150, 520]), P.engine], kind: 'fuel' },
  { key: 'engineToP1', path: [P.engine, P.p1], kind: 'mech' },
  { key: 'engineToWheels', path: [P.engine, P.p1, P.edht, P.diff, P.wheelFL], kind: 'mech' },
  { key: 'engineToWheels', path: [P.diff, P.wheelFR], kind: 'mech' },
  { key: 'p1Elec', path: [P.p1, P.edht, P.batteryFront, P.battery], kind: 'elec' },
  { key: 'p3Elec', path: [P.battery, P.batteryFront, P.edht, P.p3], kind: 'elec', reverse: (f) => f.p3Elec < 0 },
  { key: 'p3Mech', path: [P.p3, P.edht, P.diff, P.wheelFL], kind: 'mech', reverse: (f) => f.p3Mech < 0 },
  { key: 'p3Mech', path: [P.diff, P.wheelFR], kind: 'mech', reverse: (f) => f.p3Mech < 0 },
  { key: 'plug', path: [P.port, toThree([-1300, 650, 500]), P.obc, P.battery], kind: 'grid' },
]

function cssColor(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

type Opts = { onProgress: (s: number) => void; onHover: (p: (Part & { x: number; y: number }) | null) => void; reducedMotion: boolean }

export async function createPowertrainScene(host: HTMLElement, opts: Opts) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  const mobile = window.matchMedia('(max-width: 760px)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const canvas = renderer.domElement
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'Trem de força do Geely EX5 EM-i em 3D: bateria sob o assoalho, motor 1.5, transmissão E-DHT com gerador e motor de tração, semieixos, rodas, tanque, carregador e tomada, com o fluxo de energia do modo escolhido.')
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 50, 20000)
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(1500, 4000, 2500)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -2600, right: 2600, top: 2600, bottom: -2600, near: 100, far: 9000 })
  key.shadow.bias = -0.0003
  key.shadow.normalBias = 2
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x8a8070, 0.3))
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.ShadowMaterial({ opacity: 0.16 }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const gltf = await new GLTFLoader().loadAsync('/models/powertrain.glb', (e) => {
    if (e.total) opts.onProgress(e.loaded / e.total)
  })
  const model = gltf.scene
  scene.add(model)
  const byName = new Map<string, THREE.Object3D>()
  model.traverse((o) => {
    if (o.name) byName.set(o.name, o)
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.castShadow = true
      m.receiveShadow = true
    }
  })
  const node = (n: string) => byName.get(n)!

  const FINISH: Record<string, [string, number, number]> = {
    aluminio: ['#a3a29d', 0.25, 0.6],
    aco: ['#8e9197', 0.65, 0.32],
    laminacao: ['#5a5f68', 0.55, 0.42],
    cobre: ['#c27a4a', 0.95, 0.3],
    ima_n: ['#b5523b', 0.25, 0.45],
    ima_s: ['#3f6f9e', 0.25, 0.45],
    borracha: ['#1b1b1c', 0, 0.85],
    roda: ['#a8abb0', 0.75, 0.3],
    celula: ['#46586e', 0.2, 0.5],
    plastico: ['#232326', 0, 0.55],
    laranja: ['#e8771c', 0, 0.5],
    ferro: ['#4d4844', 0.45, 0.7],
    chassi: ['#8a8c90', 0.4, 0.5],
  }
  model.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (!m?.name) return
    const f = FINISH[m.name]
    if (f) {
      m.color.set(f[0])
      m.metalness = f[1]
      m.roughness = f[2]
    }
    if (m.name === 'vidro') {
      m.transparent = true
      m.opacity = 0.12
      m.depthWrite = false
      m.color.set('#cfd8e2')
      m.roughness = 0.1
      m.metalness = 0
    }
    m.envMapIntensity = 0.55
  })

  // ---- energy particles ----------------------------------------------------------------------------
  const MAX_PER_LINK = 40
  const curves = LINKS.map((l) => new THREE.CatmullRomCurve3(l.path, false, 'centripetal', 0.2))
  const lengths = curves.map((c) => c.getLength())
  const total = LINKS.length * MAX_PER_LINK
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(total * 3)
  const col = new Float32Array(total * 4)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4))
  const dots = new THREE.Points(geo, new THREE.PointsMaterial({ size: 34, vertexColors: true, transparent: true, depthWrite: false, depthTest: false }))
  dots.frustumCulled = false
  dots.renderOrder = 10
  scene.add(dots)
  const C = { fuel: new THREE.Color(), mech: new THREE.Color(), elec: new THREE.Color(), grid: new THREE.Color() }
  const paint = () => {
    C.fuel.set(cssColor('--c2', '#8a6737'))
    C.mech.set(cssColor('--ink2', '#4A463F'))
    C.elec.set(cssColor('--c1', '#2f6f8f'))
    C.grid.set(cssColor('--c3', '#5d7f3b'))
  }
  paint()
  const mo = new MutationObserver(paint)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', paint)

  // ---- camera ------------------------------------------------------------------------------------
  const target = new THREE.Vector3()
  const sph = new THREE.Spherical()
  let tween: { from: View; to: View; start: number } | null = null
  const setView = (v: View) => {
    camera.position.set(...v.pos)
    target.set(...v.target)
    camera.lookAt(target)
  }
  const flyTo = (v: View) => {
    tween = { from: { pos: camera.position.toArray() as View['pos'], target: target.toArray() as View['target'] }, to: v, start: performance.now() }
  }
  let drag: { x: number; y: number; theta: number; phi: number; touch: boolean } | null = null
  canvas.style.touchAction = 'pan-y'
  const onDown = (e: PointerEvent) => {
    sph.setFromVector3(camera.position.clone().sub(target))
    drag = { x: e.clientX, y: e.clientY, theta: sph.theta, phi: sph.phi, touch: e.pointerType === 'touch' }
    tween = null
    canvas.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (drag) {
      sph.setFromVector3(camera.position.clone().sub(target))
      sph.theta = drag.theta - (e.clientX - drag.x) / 220
      if (!drag.touch) sph.phi = Math.min(1.45, Math.max(0.25, drag.phi - (e.clientY - drag.y) / 260))
      camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(sph))
      camera.lookAt(target)
      opts.onHover(null)
      return
    }
    if (e.pointerType === 'mouse') pick(e)
  }
  const onUp = (e: PointerEvent) => {
    const moved = drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4
    drag = null
    if (!moved && e.pointerType !== 'mouse') pick(e)
  }
  const onLeave = () => opts.onHover(null)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('pointerleave', onLeave)
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  function pick(e: PointerEvent) {
    const r = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects(model.children, true)[0]
    if (!hit) return opts.onHover(null)
    let o: THREE.Object3D | null = hit.object
    while (o && !PARTS.some(([re]) => re.test(o!.name))) o = o.parent
    const part = o && PARTS.find(([re]) => re.test(o!.name))
    opts.onHover(part ? { ...part[1], x: e.clientX - r.left, y: e.clientY - r.top } : null)
  }

  const resize = () => {
    const w = host.clientWidth
    const h = Math.round(Math.min(600, Math.max(340, w * (mobile ? 0.9 : 0.62))))
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(host)

  // ---- motion ------------------------------------------------------------------------------------
  const state = { mode: 'ev' as Mode, kmh: 60, playing: !opts.reducedMotion, f: flows('ev', 60), wheel: 0, engine: 0, phase: 0 }
  const setMode = (mode: Mode, kmh: number) => {
    state.mode = mode
    state.kmh = kmh
    state.f = flows(mode, kmh)
  }
  /** Slow motion: the wheels turn at 0,25 rev/s at 100 km/h, everything else in proportion. */
  const SLOW = 0.25 / (wheelRpm(100) / 60)
  const ratio = { pinion: L.ringR / L.pinionR, idler: L.ringR / L.idlerSmallR, p3: (L.ringR / L.idlerSmallR) * (L.idlerBigR / L.p3PinionR) }

  const pose = (dt: number) => {
    const f = state.f
    const wRev = (f.wheelRpm / 60) * SLOW
    const eRev = (f.engineRpm / 60) * SLOW
    if (state.playing) {
      state.wheel += wRev * dt * 2 * Math.PI
      state.engine += eRev * dt * 2 * Math.PI
      state.phase += dt
    }
    const w = state.wheel
    for (const n of ['roda_fe', 'roda_fd', 'roda_te', 'roda_td', 'semieixo_e', 'semieixo_d', 'diferencial']) node(n).rotation.z = -w
    node('pinhao_motor').rotation.z = w * ratio.pinion
    node('intermediaria').rotation.z = w * ratio.idler
    node('p3_rotor').rotation.z = -w * ratio.p3
    // The engine side: free-running (series) or locked to the pinion (parallel); still when off.
    const engineAngle = f.clutch ? w * ratio.pinion : state.engine
    node('motor_polia').rotation.z = engineAngle
    node('p1_rotor').rotation.z = engineAngle
    node('embreagem').rotation.z = engineAngle

    // Particles: on each active link, dots in proportion to the power (1 dot ≈ 2 kW), moving at a steady pace.
    let i = 0
    LINKS.forEach((l, k) => {
      const kw = Math.abs(f[l.key] as number)
      const n = Math.min(MAX_PER_LINK, Math.round(kw / 2) + (kw > 0.3 ? 2 : 0))
      const rev = l.reverse?.(f) ?? false
      const c = C[l.kind]
      for (let j = 0; j < MAX_PER_LINK; j++, i++) {
        if (j >= n) {
          col[i * 4 + 3] = 0
          continue
        }
        let s = (((j / n + (state.phase * 650) / lengths[k]) % 1) + 1) % 1
        if (rev) s = 1 - s
        const p = curves[k].getPointAt(s)
        pos[i * 3] = p.x
        pos[i * 3 + 1] = p.y + 30
        pos[i * 3 + 2] = p.z
        col[i * 4] = c.r
        col[i * 4 + 1] = c.g
        col[i * 4 + 2] = c.b
        col[i * 4 + 3] = 0.95
      }
    })
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  }

  setView(VIEWS.geral)
  let visible = true
  const vis = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)))
  vis.observe(host)
  let prev = performance.now()
  let raf = 0
  const tmp = new THREE.Vector3()
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.max(0, Math.min(0.1, (now - prev) / 1000)) // rAF's timestamp can precede performance.now()
    prev = now
    if (!visible || document.hidden) return
    if (tween) {
      const k = Math.min(1, (now - tween.start) / 1200)
      const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
      camera.position.fromArray(tween.from.pos).lerp(tmp.fromArray(tween.to.pos), e)
      target.fromArray(tween.from.target).lerp(tmp.fromArray(tween.to.target), e)
      camera.lookAt(target)
      if (k >= 1) tween = null
    }
    pose(dt)
    renderer.render(scene, camera)
  }
  pose(0)
  raf = requestAnimationFrame(frame)

  return {
    flyTo,
    setMode,
    setPlaying: (p: boolean) => (state.playing = p),
    dispose: () => {
      cancelAnimationFrame(raf)
      vis.disconnect()
      ro.disconnect()
      mo.disconnect()
      mq.removeEventListener('change', paint)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}

export type PowertrainScene = Awaited<ReturnType<typeof createPowertrainScene>>
