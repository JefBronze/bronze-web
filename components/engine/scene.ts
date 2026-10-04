// The three.js side of section 9a. Imported dynamically by Engine3D.tsx, so three.js and the model only load
// when the visitor reaches the section. The model (public/models/motor.glb) is built by `npm run model` from
// scripts/blender/motor.py; every motion here comes from lib/engine.ts and lib/engine-layout.json.
// Coordinates: three.js, millimetres, X along the crank, Y up, Z toward the viewer (Blender's -Y).
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import LAYOUT from '@/lib/engine-layout.json'
import { clearanceHeight, crankRadius, ENGINE, strokeAt, valveLift, type Stroke } from '@/lib/engine'

export type Mode = 'um' | 'quatro'
export type View = { pos: [number, number, number]; target: [number, number, number] }
export type Part = { name: string; text: string }
export type FrameInfo = { angle: number; stroke: Stroke }

const DECK = crankRadius + ENGINE.rod + LAYOUT.pinBelowCrown + clearanceHeight
const ROOF = LAYOUT.roof
const TAN = Math.tan((LAYOUT.valveTilt * Math.PI) / 180)
const roofY = (z: number) => DECK + ROOF - Math.abs(z) * TAN
const SEAT_Y = roofY(LAYOUT.valveSeatY)
const U_IN = new THREE.Vector3(0, Math.cos((LAYOUT.valveTilt * Math.PI) / 180), -Math.sin((LAYOUT.valveTilt * Math.PI) / 180))
const CAM_Y = SEAT_Y + U_IN.y * (LAYOUT.valveLength + LAYOUT.camR)
const CAM_Z = LAYOUT.valveSeatY + -U_IN.z * (LAYOUT.valveLength + LAYOUT.camR)
const X1 = LAYOUT.cylX[0]
const OFF = LAYOUT.offsets

export const VIEWS: Record<string, View> = {
  geral4: { pos: [470, 430, 1020], target: [10, 105, 0] },
  geral1: { pos: [-1000, 330, 300], target: [-120, 135, 0] },
  admissao: { pos: [-760, 290, -10], target: [-120, 180, -40] },
  compressao: { pos: [-820, 220, 230], target: [-120, 145, 0] },
  combustao: { pos: [-860, 250, 230], target: [-120, 150, 0] },
  escape: { pos: [-760, 270, 300], target: [-120, 175, 45] },
  ordem: { pos: [60, 460, 1000], target: [0, 100, 0] },
  correia: { pos: [600, 300, 360], target: [196, 150, 0] },
}

const PARTS: [RegExp, Part][] = [
  [/^virabrequim/, { name: 'Virabrequim', text: 'transforma o sobe e desce dos pistões em rotação' }],
  [/^volante/, { name: 'Volante', text: 'massa que suaviza os pulsos de cada combustão; a coroa dentada é por onde o motor de partida gira o motor' }],
  [/^pistao/, { name: 'Pistão', text: 'recebe a pressão da combustão; os anéis vedam a câmara' }],
  [/^biela/, { name: 'Biela', text: 'liga o pistão ao virabrequim' }],
  [/^valvula_adm/, { name: 'Válvula de admissão', text: 'deixa entrar ar com combustível; duas por cilindro' }],
  [/^valvula_esc/, { name: 'Válvula de escape', text: 'deixa sair o gás queimado; duas por cilindro' }],
  [/^mola/, { name: 'Mola de válvula', text: 'fecha a válvula depois que o came passa' }],
  [/^comando/, { name: 'Comando de válvulas', text: 'gira na metade da velocidade do virabrequim; cada came abre uma válvula' }],
  [/^bloco/, { name: 'Bloco', text: 'cilindros, galerias de água e mancais do virabrequim' }],
  [/^cabecote/, { name: 'Cabeçote', text: 'câmara de combustão em telhado, dutos e guias das válvulas' }],
  [/^tampa/, { name: 'Tampa de válvulas', text: 'fecha o cabeçote por cima' }],
  [/^carter/, { name: 'Cárter', text: 'reservatório de óleo' }],
  [/^velas/, { name: 'Vela de ignição e bobina', text: 'solta a faísca que inicia a combustão' }],
  [/^injetores/, { name: 'Bico injetor e flauta', text: 'pulveriza combustível no duto de admissão, antes da válvula' }],
  [/^coletor_adm/, { name: 'Coletor de admissão', text: 'distribui o ar entre os cilindros; a borboleta, na ponta, controla quanto entra' }],
  [/^coletor_esc/, { name: 'Coletor de escape', text: 'junta os gases dos quatro cilindros' }],
  [/^correia/, { name: 'Correia dentada', text: 'sincroniza comandos e virabrequim: duas voltas do virabrequim, uma do comando' }],
]

function cssColor(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

type Opts = {
  onProgress: (share: number) => void
  onFrame: (f: FrameInfo) => void
  onHover: (p: (Part & { x: number; y: number }) | null) => void
  reducedMotion: boolean
}

export async function createEngineScene(host: HTMLElement, opts: Opts) {
  const DEBUG = location.search.includes('motordebug')
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  const mobile = window.matchMedia('(max-width: 760px)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const canvas = renderer.domElement
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'Modelo 3D de um motor 1.0 de quatro cilindros em corte: bloco, cabeçote, pistões, bielas, virabrequim, comandos, válvulas, molas, velas, bicos injetores, coletores e correia dentada.')
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 20, 6000)
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(-300, 700, 500)
  key.castShadow = true
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048)
  Object.assign(key.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 50, far: 2000 })
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.6
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x8a8070, 0.25))
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.18 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -112
  ground.receiveShadow = true
  scene.add(ground)

  // ---- model ---------------------------------------------------------------------------------------
  const gltf = await new GLTFLoader().loadAsync('/models/motor.glb', (e) => {
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
  const crank = node('virabrequim')
  const flywheel = node('volante')
  const camIn = node('comando_adm')
  const camEx = node('comando_esc')
  const pistons = [1, 2, 3, 4].map((n) => node(`pistao_${n}`))
  const rods = [1, 2, 3, 4].map((n) => node(`biela_${n}`))
  type Valve = { v: THREE.Object3D; spring: THREE.Object3D; rest: THREE.Vector3; springRest: THREE.Vector3; dir: THREE.Vector3; side: 'in' | 'ex'; cyl: number; front: boolean }
  const valves: Valve[] = []
  for (let n = 1; n <= 4; n++)
    for (const side of ['adm', 'esc'] as const)
      for (const tag of ['a', 'b']) {
        const v = node(`valvula_${side}_${n}_${tag}`)
        const spring = node(`mola_${side}_${n}_${tag}`)
        valves.push({
          v,
          spring,
          rest: v.position.clone(),
          springRest: spring.scale.clone(),
          dir: new THREE.Vector3(0, 1, 0).applyQuaternion(v.quaternion),
          side: side === 'adm' ? 'in' : 'ex',
          cyl: n - 1,
          front: tag === 'a',
        })
      }

  // Materials: keep the model's metals, paint the cut faces with the page's red, follow the theme.
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  model.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (m && m.name) materials.set(m.name, m)
  })
  // Physically plausible finishes (the Blender colours are only a preview): cast aluminium is matte, machined steel is not.
  const FINISH: Record<string, [string, number, number]> = {
    aluminio: ['#a3a29d', 0.25, 0.6],
    ferro: ['#4d4844', 0.45, 0.7],
    aco: ['#8e9197', 0.65, 0.32],
    pistao: ['#bdbcb7', 0.35, 0.42],
    valvula_adm: ['#7590aa', 0.55, 0.35],
    valvula_esc: ['#a8806f', 0.55, 0.4],
    mola: ['#3c3e43', 0.6, 0.45],
    ceramica: ['#efebe1', 0, 0.3],
    borracha: ['#18181a', 0, 0.8],
    plastico: ['#232326', 0, 0.55],
    corte: ['#b5523b', 0, 0.75],
  }
  materials.forEach((m, name) => {
    const f = FINISH[name]
    if (f) {
      m.color.set(f[0])
      m.metalness = f[1]
      m.roughness = f[2]
    }
    m.envMapIntensity = 0.55
  })

  // ---- timing belt (built here so it can move) -------------------------------------------------------
  const pulleys: [number, number, number][] = [
    [0, 0, LAYOUT.crankPulleyR + 1.8],
    [CAM_Y, -CAM_Z, LAYOUT.camPulleyR + 1.8],
    [CAM_Y, CAM_Z, LAYOUT.camPulleyR + 1.8],
  ]
  const pts: [number, number][] = []
  for (const [cy, cz, r] of pulleys) for (let i = 0; i < 160; i++) pts.push([cy + r * Math.cos((i / 160) * Math.PI * 2), cz + r * Math.sin((i / 160) * Math.PI * 2)])
  const loop = hull2(pts)
  const beltLen = loop.reduce((s, p, i) => s + Math.hypot(p[0] - loop[(i + 1) % loop.length][0], p[1] - loop[(i + 1) % loop.length][1]), 0)
  const belt = beltMesh(loop, LAYOUT.timingX, 18, 3.2)
  const beltTex = stripes()
  beltTex.repeat.set(beltLen / 9.5, 1)
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.85, metalness: 0, bumpMap: beltTex, bumpScale: 1.4, map: beltTex })
  belt.material = beltMat
  belt.name = 'correia'
  belt.castShadow = true
  model.add(belt)

  // ---- gas in each cylinder, the spark, and the particles of cylinder 1 -------------------------------
  const gasMat = [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.35, depthWrite: false, roughness: 1, metalness: 0 }))
  const halfL = new THREE.CylinderGeometry(35.6, 35.6, 1, 48, 1, false, Math.PI / 2, Math.PI)
  const halfT = new THREE.CylinderGeometry(35.6, 35.6, 1, 48, 1, false, 0, Math.PI)
  const gas = LAYOUT.cylX.map((x, i) => {
    const g = new THREE.Mesh(halfL, gasMat[i])
    g.position.x = x
    g.renderOrder = 2
    scene.add(g)
    return g
  })
  const sparkLights = LAYOUT.cylX.map((x) => {
    const l = new THREE.PointLight(0xffb347, 0, 260, 1.6)
    l.position.set(x, DECK + ROOF - 8, 0)
    scene.add(l)
    return l
  })

  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  )
  flame.rotation.y = Math.PI / 2 // keep the half behind the section plane
  flame.renderOrder = 4
  scene.add(flame)

  const N = 260
  const pGeo = new THREE.BufferGeometry()
  const pPos = new Float32Array(N * 3)
  const pCol = new Float32Array(N * 4)
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 4))
  const pMat = new THREE.PointsMaterial({ size: 5, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true })
  const particles = new THREE.Points(pGeo, pMat)
  particles.renderOrder = 3
  particles.frustumCulled = false
  scene.add(particles)
  const rnd = mulberry(7)
  const P = Array.from({ length: N }, (_, j) => ({ t: j / N, u: rnd(), v: rnd(), x: X1 + 3 + rnd() * 26, w: rnd() }))
  const intakePath = [new THREE.Vector2(SEAT_Y + 26, -78), new THREE.Vector2(SEAT_Y + 9, -24), new THREE.Vector2(SEAT_Y - 2, -14)]
  const exhaustPath = [new THREE.Vector2(SEAT_Y - 2, 14), new THREE.Vector2(SEAT_Y + 8, 24), new THREE.Vector2(SEAT_Y + 22, 78)]

  // ---- colours (theme) ---------------------------------------------------------------------------
  const C = { fresh: new THREE.Color(), squeezed: new THREE.Color(), flame: new THREE.Color(), hot: new THREE.Color(), burnt: new THREE.Color() }
  const paint = () => {
    const corte = materials.get('corte')
    if (corte) corte.color.set(cssColor('--c4', '#b5523b'))
    C.fresh.set(cssColor('--c1', '#2f6f8f'))
    C.squeezed.set(cssColor('--c2', '#8a6737'))
    C.flame.set('#ffd27a')
    C.hot.set(cssColor('--c4', '#b5523b'))
    C.burnt.set(cssColor('--mute', '#7A746B'))
  }
  paint()
  const mo = new MutationObserver(paint)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', paint)

  // ---- modes -------------------------------------------------------------------------------------
  let mode: Mode = 'quatro'
  const setMode = (m: Mode) => {
    mode = m
    model.traverse((o) => {
      if (!o.name) return
      if (/_T$/.test(o.name)) o.visible = m === 'um'
      if (/_L$/.test(o.name)) o.visible = m === 'quatro'
    })
    flywheel.visible = m === 'quatro'
    // In the transverse cut, the valves in front of the section plane would float in front of it.
    valves.forEach((v) => {
      const hidden = m === 'um' && v.cyl === 0 && v.front
      v.v.visible = !hidden
      v.spring.visible = !hidden
    })
    gas.forEach((g, i) => {
      g.geometry = m === 'um' ? halfT : halfL
      g.visible = m === 'quatro' || i === 0
      if (m === 'um' && i === 0) g.visible = false // cylinder 1 shows particles instead
    })
    particles.visible = m === 'um'
    belt.visible = m === 'quatro'
  }

  // ---- camera: orbit around a target by dragging; tweens between views ---------------------------
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
      if (!drag.touch) sph.phi = Math.min(1.45, Math.max(0.35, drag.phi - (e.clientY - drag.y) / 260))
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
    const hit = ray.intersectObjects(model.children, true).find((h) => h.object.visible && isShown(h.object))
    if (!hit) return opts.onHover(null)
    let o: THREE.Object3D | null = hit.object
    while (o && !PARTS.some(([re]) => re.test(o!.name))) o = o.parent
    const part = o && PARTS.find(([re]) => re.test(o!.name))
    opts.onHover(part ? { ...part[1], x: e.clientX - r.left, y: e.clientY - r.top } : null)
  }
  const isShown = (o: THREE.Object3D | null): boolean => !o || (o.visible && isShown(o.parent))

  // ---- size ---------------------------------------------------------------------------------------
  const resize = () => {
    const w = host.clientWidth
    const h = Math.round(Math.min(620, Math.max(340, w * (mobile ? 0.95 : 0.7))))
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(host)

  // ---- pose for a crank angle ---------------------------------------------------------------------
  const tmp = new THREE.Vector3()
  const lerpPath = (path: THREE.Vector2[], s: number) => {
    const k = Math.min(path.length - 1.0001, Math.max(0, s * (path.length - 1)))
    const i = Math.floor(k)
    return path[i].clone().lerp(path[i + 1], k - i)
  }
  let lastAngle = -1
  const pose = (theta: number) => {
    const t = (theta * Math.PI) / 180
    crank.rotation.x = t
    flywheel.rotation.x = t
    camIn.rotation.x = t / 2
    camEx.rotation.x = t / 2
    if (lastAngle >= 0) {
      let d = theta - lastAngle
      if (d < -360) d += 720
      // The belt moves at the crank pulley's rim speed; one texture repeat is one tooth (9,5 mm).
      beltTex.offset.x -= ((d * Math.PI) / 180) * (LAYOUT.crankPulleyR + 1.8) / 9.5
    }
    lastAngle = theta

    LAYOUT.cylX.forEach((x, i) => {
      const a = (((theta + OFF[i]) % 720) + 720) % 720
      const pa = ((theta + (OFF[i] % 360)) * Math.PI) / 180
      const cy = crankRadius * Math.cos(pa)
      const cz = crankRadius * Math.sin(pa)
      const pinY = cy + Math.sqrt(ENGINE.rod ** 2 - cz ** 2)
      pistons[i].position.set(x, pinY, 0)
      rods[i].position.set(x, pinY, 0)
      rods[i].rotation.x = Math.atan2(-cz, pinY - cy)
      const crown = pinY + LAYOUT.pinBelowCrown
      const top = DECK + ROOF * 0.45
      gas[i].scale.y = Math.max(0.5, top - crown)
      gas[i].position.y = (top + crown) / 2
      const s = strokeAt(a)
      const k = (a % 180) / 180
      const m = gasMat[i]
      if (s === 'admissao') {
        m.color.copy(C.fresh)
        m.opacity = 0.15 + 0.15 * k
      } else if (s === 'compressao') {
        m.color.copy(C.fresh).lerp(C.squeezed, k)
        m.opacity = 0.3 + 0.25 * k
      } else if (s === 'combustao') {
        m.color.copy(C.flame).lerp(C.hot, Math.min(1, k * 2.5))
        m.opacity = 0.75 - 0.4 * k
      } else {
        m.color.copy(C.hot).lerp(C.burnt, Math.min(1, k * 3))
        m.opacity = 0.35 - 0.2 * k
      }
      m.emissive.copy(m.color).multiplyScalar(s === 'combustao' ? 1.2 * (1 - k) : 0)
      const spark = a > 352 && a < 368 ? 1 - Math.abs(a - 360) / 8 : 0
      sparkLights[i].intensity = (s === 'combustao' ? 90000 * Math.max(0, 1 - k * 3) : 0) + spark * 60000
      if (i === 0) {
        if (mode === 'um') moveParticles(a, crown)
        const burning = mode === 'um' && s === 'combustao' && k < 0.45
        flame.visible = burning
        if (burning) {
          const r = Math.min(44, 6 + k * 160)
          flame.scale.set(r, Math.min(r, (DECK + ROOF - crown) * 0.9), r)
          flame.position.set(X1 + 0.5, DECK + ROOF - 6, 0)
          ;(flame.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k / 0.45)
        }
      }
    })
    valves.forEach((vv) => {
      const a = theta + OFF[vv.cyl]
      const lift = valveLift(a, vv.side)
      vv.v.position.copy(vv.rest).addScaledVector(vv.dir, -lift)
      vv.spring.scale.set(vv.springRest.x, vv.springRest.y * (LAYOUT.springH - lift) / LAYOUT.springH, vv.springRest.z)
    })
    opts.onFrame({ angle: ((theta % 720) + 720) % 720, stroke: strokeAt(theta) })
  }

  function moveParticles(a: number, crown: number) {
    const s = strokeAt(a)
    const k = (a % 180) / 180
    const plug = tmp.set(X1 + 14, DECK + ROOF - 4, 0)
    for (let j = 0; j < N; j++) {
      const p = P[j]
      const z = -32 + 64 * p.u
      const yIn = crown + 1.5 + (roofY(z) - 1.5 - crown - 1.5) * p.v
      let y = yIn
      let zz = z
      let alpha = 0.95
      let col = C.fresh
      let mix = 0
      let mixTo = C.fresh
      if (s === 'admissao') {
        const lead = k * 1.08 - p.t
        if (lead < 0) {
          const q = 1 + lead * 3.2
          if (q < 0) alpha = 0
          else {
            const v = lerpPath(intakePath, q)
            y = v.x + (p.v - 0.5) * 12
            zz = v.y + (p.u - 0.5) * 10
          }
        }
      } else if (s === 'compressao') {
        mixTo = C.squeezed
        mix = k * 0.8
      } else if (s === 'combustao') {
        const d = Math.hypot(p.x - plug.x, yIn - plug.y, z)
        const front = k * 260
        if (d < front) {
          col = C.flame
          mixTo = k < 0.3 ? C.hot : C.burnt
          mix = Math.min(1, (front - d) / 120 + k)
        }
      } else {
        col = C.burnt
        const lead = k * 1.08 - p.t
        if (lead > 0) {
          const q = Math.min(1, lead * 3.2)
          const v = lerpPath(exhaustPath, q)
          y = yIn + (v.x - yIn) * Math.min(1, q * 2.5)
          zz = z + (v.y - z) * Math.min(1, q * 2.5)
          alpha = q >= 1 ? 0 : 0.95
        }
      }
      pPos[j * 3] = p.x
      pPos[j * 3 + 1] = y
      pPos[j * 3 + 2] = zz
      const c = col.clone().lerp(mixTo, mix)
      pCol[j * 4] = c.r
      pCol[j * 4 + 1] = c.g
      pCol[j * 4 + 2] = c.b
      pCol[j * 4 + 3] = alpha
    }
    pGeo.attributes.position.needsUpdate = true
    pGeo.attributes.color.needsUpdate = true
  }

  // ---- loop ---------------------------------------------------------------------------------------
  const state = { angle: 400, playing: !opts.reducedMotion, cycleSeconds: 4, jump: null as number | null }
  setMode('quatro')
  setView(VIEWS.geral4)
  let visible = true
  const vis = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)))
  vis.observe(host)
  let prev = performance.now()
  let raf = 0
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.1, (now - prev) / 1000)
    prev = now
    if (!visible || document.hidden) return
    if (tween) {
      // Wall-clock, so a slow device still finishes the move on time.
      const k = Math.min(1, (now - tween.start) / 1100)
      const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
      camera.position.fromArray(tween.from.pos).lerp(tmp.fromArray(tween.to.pos), e)
      target.fromArray(tween.from.target).lerp(tmp.fromArray(tween.to.target), e)
      camera.lookAt(target)
      if (k >= 1) tween = null
    }
    if (state.jump !== null) {
      state.angle = state.jump
      state.jump = null
    } else if (state.playing) state.angle = (state.angle + (720 * dt) / state.cycleSeconds) % 720
    pose(state.angle)
    renderer.render(scene, camera)
    if (DEBUG) canvas.dataset.cam = `${camera.position.toArray().map(Math.round)} -> ${target.toArray().map(Math.round)}`
  }
  pose(state.angle)
  raf = requestAnimationFrame(frame)

  return {
    setMode,
    flyTo,
    setPlaying: (p: boolean) => (state.playing = p),
    setCycleSeconds: (s: number) => (state.cycleSeconds = s),
    jumpTo: (a: number) => (state.jump = a),
    mode: () => mode,
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
      beltTex.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}

export type EngineScene = Awaited<ReturnType<typeof createEngineScene>>

// ---- helpers --------------------------------------------------------------------------------------

function hull2(points: [number, number][]) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: [number, number][] = []
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/** A flat belt along a closed (y, z) loop at a given x: outer and inner faces and both edges; u runs 0→1 along the loop. */
function beltMesh(loop: [number, number][], x: number, width: number, thick: number) {
  const n = loop.length
  const cum = [0]
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(loop[i % n][0] - loop[i - 1][0], loop[i % n][1] - loop[i - 1][1]))
  const total = cum[n]
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const [y, z] = loop[i % n]
    const [y0, z0] = loop[(i - 1 + n) % n]
    const [y1, z1] = loop[(i + 1) % n]
    // Outward normal of a counter-clockwise loop in (y, z).
    const l = Math.hypot(z1 - z0, y1 - y0) || 1
    const ny = (z1 - z0) / l
    const nz = -(y1 - y0) / l
    for (const [px, py, pz] of [
      [x - width / 2, y + ny * thick, z + nz * thick],
      [x + width / 2, y + ny * thick, z + nz * thick],
      [x + width / 2, y, z],
      [x - width / 2, y, z],
    ]) {
      pos.push(px, py, pz)
      uv.push(cum[i] / total, 0)
    }
  }
  for (let i = 0; i < n; i++)
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k
      const b = i * 4 + ((k + 1) % 4)
      const c = (i + 1) * 4 + ((k + 1) % 4)
      const d = (i + 1) * 4 + k
      idx.push(a, d, b, b, d, c)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return new THREE.Mesh(g)
}

/** Belt teeth: light/dark bands, repeated along the belt and scrolled with the crank. */
function stripes() {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 4
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#2a2a2b'
  ctx.fillRect(0, 0, 32, 4)
  ctx.fillStyle = '#0d0d0e'
  ctx.fillRect(0, 0, 14, 4)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
