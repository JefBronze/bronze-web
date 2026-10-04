// Section 10a, the three.js side: the traction motor cut through the middle of the stack, and its inverter.
// Imported dynamically by EMotor3D.tsx. Model: public/models/emotor.glb (npm run model:emotor). Every colour and motion is
// computed from lib/emotor.ts: the rotor angle sets the d axis, the controller places the current vector, the three phase
// currents follow, each slot glows with its phase's current, and space-vector PWM drives the six switches.
// Coordinates: three.js, mm, X along the shaft (toward the viewer's right-back), Y up.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import LAYOUT from '@/lib/emotor-layout.json'
import { invPark, operatingPoint, sector, svpwm, switchStates, type Machine, type OperatingPoint } from '@/lib/emotor'

export type View = { pos: [number, number, number]; target: [number, number, number] }
export type Part = { name: string; text: string }
export type FrameInfo = {
  /** Electrical angle of the current vector in the stator (A-axis) frame, rad. */
  thetaS: number
  /** Rotor d-axis electrical angle in the same frame, rad. */
  thetaD: number
  currents: [number, number, number]
  duty: [number, number, number]
  states: [boolean, boolean, boolean]
  sector: number
  carrier: number
  vAlpha: number
  vBeta: number
  op: OperatingPoint
}

export const VIEWS: Record<string, View> = {
  corte: { pos: [-620, 70, 150], target: [30, 10, 0] },
  inversor: { pos: [-300, 470, 330], target: [45, 170, 0] },
  geral: { pos: [-560, 330, 520], target: [40, 60, 0] },
}

const PARTS: [RegExp, Part][] = [
  [/^rotor/, { name: 'Rotor de ímãs permanentes', text: 'chapas de aço-silício com 16 ímãs em V (8 polos); o eixo leva o torque ao redutor' }],
  [/^ranhura/, { name: 'Condutores do estator (hairpin)', text: 'barras de cobre retangulares, 6 por ranhura; a cor mostra a corrente da fase agora' }],
  [/^estator/, { name: 'Estator', text: 'pacote de chapas finas de aço-silício, isoladas entre si para cortar as correntes parasitas' }],
  [/^cabeca_bobina/, { name: 'Cabeças de bobina', text: 'onde as barras hairpin se ligam; é a parte do cobre que mais esquenta' }],
  [/^carcaca/, { name: 'Carcaça', text: 'alumínio com canais de óleo de refrigeração (os furos no corte)' }],
  [/^rolamentos/, { name: 'Rolamentos e resolver', text: 'o resolver mede o ângulo do rotor; sem ele o controle vetorial não sabe onde pôr o campo' }],
  [/^barramentos/, { name: 'Barramentos U, V, W', text: 'levam as três fases do inversor ao enrolamento' }],
  [/^chave_/, { name: 'Transistor de potência', text: 'um de seis; cada braço tem um em cima e um embaixo, nunca ligados ao mesmo tempo' }],
  [/^inversor_base/, { name: 'Placa fria e substratos', text: 'cerâmica com cobre (DBC) sobre a placa de refrigeração líquida' }],
  [/^capacitor/, { name: 'Capacitor do barramento CC', text: 'filme plástico; segura a tensão enquanto os transistores chaveiam milhares de vezes por segundo' }],
  [/^barramento_dc/, { name: 'Barramento CC (+ e −)', text: 'vem da bateria, passando pelo conversor elevador' }],
]

// Winding: q = 2 slots per pole per phase; 60° phase belts in the order A+, C−, B+, A−, C+, B− (each two slots).
const BELT_PHASE = [0, 2, 1, 0, 2, 1]
const BELT_SIGN = [1, -1, 1, -1, 1, -1]
/** Electrical angle of phase A's magnetic axis in the slot frame: belt A+ is centred at 15°, its axis 90° further. */
const A_AXIS = (105 * Math.PI) / 180
/** Carrier periods shown per electrical cycle (the real inverter switches ~10 kHz: hundreds per cycle). */
export const SHOWN_CARRIERS = 12

function cssColor(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

type Opts = {
  machine: Machine
  onProgress: (share: number) => void
  onFrame: (f: FrameInfo) => void
  onHover: (p: (Part & { x: number; y: number }) | null) => void
  reducedMotion: boolean
}

export async function createEMotorScene(host: HTMLElement, opts: Opts) {
  const m = opts.machine
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  const mobile = window.matchMedia('(max-width: 760px)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const canvas = renderer.domElement
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'Motor elétrico de ímãs permanentes cortado ao meio: estator com 48 ranhuras de condutores hairpin, rotor de 8 polos com ímãs em V, carcaça refrigerada a óleo e o inversor com seis transistores em cima.')
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 20, 6000)
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(-500, 600, 400)
  key.castShadow = true
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048)
  Object.assign(key.shadow.camera, { left: -350, right: 350, top: 350, bottom: -350, near: 50, far: 2000 })
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.6
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x8a8070, 0.25))
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.16 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -LAYOUT.housingOD / 2 - 10
  ground.receiveShadow = true
  scene.add(ground)

  const gltf = await new GLTFLoader().loadAsync('/models/emotor.glb', (e) => {
    if (e.total) opts.onProgress(e.loaded / e.total)
  })
  const model = gltf.scene
  scene.add(model)
  const byName = new Map<string, THREE.Object3D>()
  model.traverse((o) => {
    if (o.name) byName.set(o.name, o)
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })
  const rotor = byName.get('rotor')!

  // Finishes (Blender colours are only a preview).
  const FINISH: Record<string, [string, number, number]> = {
    laminacao: ['#5a5f68', 0.55, 0.42],
    cobre: ['#c27a4a', 0.95, 0.3],
    ima_n: ['#b5523b', 0.25, 0.45],
    ima_s: ['#3f6f9e', 0.25, 0.45],
    aluminio: ['#a3a29d', 0.25, 0.6],
    aco: ['#8e9197', 0.65, 0.32],
    ceramica: ['#efebe1', 0, 0.35],
    silicio: ['#20222a', 0.4, 0.35],
    capacitor: ['#2a2a2e', 0, 0.55],
    isolante: ['#d9c27a', 0, 0.6],
    corte: ['#b5523b', 0, 0.75],
  }
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  model.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (mat?.name) materials.set(mat.name, mat)
  })
  materials.forEach((mat, name) => {
    const f = FINISH[name]
    if (f) {
      mat.color.set(f[0])
      mat.metalness = f[1]
      mat.roughness = f[2]
    }
    mat.envMapIntensity = 0.55
  })

  // Each slot gets its own copper material so it can glow with its phase current.
  type Slot = { phase: number; sign: number; mat: THREE.MeshStandardMaterial }
  const slots: Slot[] = []
  for (let k = 0; k < LAYOUT.slots; k++) {
    const node = byName.get(`ranhura_${k}`)
    if (!node) continue
    const belt = Math.floor(k / 2) % 6
    const mat = (materials.get('cobre') as THREE.MeshStandardMaterial).clone()
    node.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && (mesh.material as THREE.Material).name === 'cobre') mesh.material = mat
    })
    slots.push({ phase: BELT_PHASE[belt], sign: BELT_SIGN[belt], mat })
  }
  // The six switches: own materials so they can light up.
  const switches = ['a', 'b', 'c'].flatMap((leg) =>
    ['h', 'l'].map((t) => {
      const node = byName.get(`chave_${leg}_${t}`) as THREE.Mesh
      const mat = (node.material as THREE.MeshStandardMaterial).clone()
      node.material = mat
      return { leg: 'abc'.indexOf(leg), high: t === 'h', mat }
    }),
  )

  // Axes drawn on the section face: the rotor's d axis (magnet north) and the stator current vector.
  const X_FACE = -3
  const arrow = (len: number) => {
    const g = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, len, 12), new THREE.MeshBasicMaterial())
    shaft.position.y = len / 2
    const head = new THREE.Mesh(new THREE.ConeGeometry(5.5, 14, 16), shaft.material)
    head.position.y = len + 7
    g.add(shaft, head)
    g.position.x = X_FACE
    g.renderOrder = 5
    scene.add(g)
    return { g, mat: shaft.material as THREE.MeshBasicMaterial }
  }
  const dArrow = arrow(48)
  const iArrow = arrow(62)

  // Theme.
  const C = { pos: new THREE.Color(), neg: new THREE.Color(), on: new THREE.Color(), off: new THREE.Color(), copper: new THREE.Color('#c27a4a') }
  const paint = () => {
    materials.get('corte')?.color.set(cssColor('--c4', '#b5523b'))
    C.pos.set(cssColor('--c4', '#b5523b'))
    C.neg.set(cssColor('--c1', '#2f6f8f'))
    C.on.set('#ffd27a')
    C.off.set('#20222a')
    dArrow.mat.color.set(cssColor('--c4', '#b5523b'))
    iArrow.mat.color.set(cssColor('--c1', '#2f6f8f'))
  }
  paint()
  const mo = new MutationObserver(paint)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', paint)

  // Camera: orbit by dragging, tween between views (wall-clock).
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
      if (!drag.touch) sph.phi = Math.min(1.5, Math.max(0.3, drag.phi - (e.clientY - drag.y) / 260))
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
    const h = Math.round(Math.min(600, Math.max(340, w * (mobile ? 0.95 : 0.68))))
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(host)

  // ---- the drive -----------------------------------------------------------------------------------
  const state = {
    rpm: 3000,
    torque: 180,
    playing: !opts.reducedMotion,
    /** Displayed rotor speed, revolutions per second (slow motion). */
    shownRevPerS: 0.12,
    thetaM: 0,
    op: operatingPoint(m, 3000, 180),
  }
  const setDemand = (rpm: number, torque: number) => {
    state.rpm = rpm
    state.torque = torque
    state.op = operatingPoint(m, rpm, torque)
  }

  const pose = () => {
    const op = state.op
    rotor.rotation.x = state.thetaM
    // d axis (magnet north of pole 0) in slot-frame electrical angle; current vector leads it by 90° + β when motoring.
    const dElec = m.p * state.thetaM
    const gamma = Math.atan2(op.iq, op.id) // current angle from d, rad (≈ 90° + β motoring, ≈ −(90° + β) braking)
    const iElec = dElec + gamma
    const thetaS = iElec - A_AXIS // in the A-axis frame
    const thetaD = dElec - A_AXIS
    const is = op.is
    const currents: [number, number, number] = [0, 1, 2].map((k) => is * Math.cos(thetaS - (k * 2 * Math.PI) / 3)) as [number, number, number]
    const norm = Math.max(1, m.iMax)
    slots.forEach((s) => {
      const i = s.sign * currents[s.phase]
      const k = Math.min(1, Math.abs(i) / norm)
      const c = i >= 0 ? C.pos : C.neg
      // Copper tinted toward red (current one way) or blue (the other), plus a glow, by the share of the current limit.
      s.mat.color.copy(C.copper).lerp(c, Math.min(1, k * 1.6))
      s.mat.emissive.copy(c).multiplyScalar(k * 0.9)
    })
    // Arrows: physical angle = electrical / p (one pole pair shown).
    dArrow.g.rotation.x = dElec / m.p
    iArrow.g.rotation.x = iElec / m.p
    // Inverter: the voltage vector from the dq voltages, rotated to the stator frame, then SVPWM.
    const { alpha, beta } = invPark(op.vd, op.vq, thetaD)
    const duty = svpwm(alpha, beta, m.vdc)
    const carrier = (((thetaS / (2 * Math.PI)) * SHOWN_CARRIERS) % 1 + 1) % 1
    const states = switchStates(duty, carrier)
    switches.forEach((sw) => {
      const on = sw.high ? states[sw.leg] : !states[sw.leg]
      sw.mat.emissive.copy(on ? C.on : C.off).multiplyScalar(on ? 1.6 : 0)
    })
    opts.onFrame({ thetaS, thetaD, currents, duty, states, sector: sector(alpha, beta), carrier, vAlpha: alpha, vBeta: beta, op })
  }

  setView(VIEWS.corte)
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
      const k = Math.min(1, (now - tween.start) / 1100)
      const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
      camera.position.fromArray(tween.from.pos).lerp(tmp.fromArray(tween.to.pos), e)
      target.fromArray(tween.from.target).lerp(tmp.fromArray(tween.to.target), e)
      camera.lookAt(target)
      if (k >= 1) tween = null
    }
    if (state.playing && state.op.is > 0) state.thetaM = (state.thetaM + dt * state.shownRevPerS * 2 * Math.PI) % (2 * Math.PI)
    pose()
    renderer.render(scene, camera)
  }
  pose()
  raf = requestAnimationFrame(frame)

  return {
    flyTo,
    setDemand,
    setPlaying: (p: boolean) => (state.playing = p),
    setShownSpeed: (revPerS: number) => (state.shownRevPerS = revPerS),
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
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
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

export type EMotorScene = Awaited<ReturnType<typeof createEMotorScene>>
