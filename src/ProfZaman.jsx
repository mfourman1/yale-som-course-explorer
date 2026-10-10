import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { setAimed, talk } from './talk.js'

// Prof. Tauhid Zaman (MGT 409): black BLACKPINK hoodie, jeans, sneakers, and a pink Labubu
// hanging from his belt loop. Built from primitives like the wizard professors.
// Figure faces +z; his own right hand is at -x.
// Put the crosshair on him within reach to talk; while his chat is open he turns to face
// the player, shows a thought bubble while the backend works, and gestures as he answers.

export const ZAMAN_ID = 'tauhid-zaman'
const SKIN = '#c68e64' // light brown
const HAIR = '#16110f'
const HOODIE = '#141417'
const PINK = '#ff4fa3'
const DENIM = '#27324a'
const REACH = 4.2 // meters: how close the player must be to start a chat
const BODY_RADIUS = 0.38 // meters: how far off his center line the crosshair can be and still hit him

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }))
  return mats.get(k)
}
const SPH = new THREE.SphereGeometry(1, 24, 16)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
const TORSO = new THREE.CylinderGeometry(0.19, 0.215, 0.58, 24)
const SMILE = new THREE.TorusGeometry(1, 0.2, 6, 16, Math.PI)

const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

let print
const printTex = () => {
  if (print) return print
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = PINK
  g.font = '900 64px "Arial Black", Impact, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('BLACKPINK', 256, 66)
  print = new THREE.CanvasTexture(c)
  print.colorSpace = THREE.SRGBColorSpace
  return print
}

// ease a rotation toward a target so poses blend instead of snapping
const ease = (obj, x, y, z, k) => {
  obj.rotation.x += (x - obj.rotation.x) * k
  obj.rotation.y += (y - obj.rotation.y) * k
  obj.rotation.z += (z - obj.rotation.z) * k
}

function Arm({ side, armRef }) {
  return (
    <group ref={armRef} position={[0.245 * side, 1.49, 0]}>
      <mesh geometry={CAP} material={m(HOODIE)} position={[0, -0.22, 0]} scale={[0.066, 0.13, 0.066]} />
      <B g={CYL} c={PINK} p={[0, -0.4, 0]} s={[0.062, 0.03, 0.062]} />
      <B c={SKIN} p={[0, -0.47, 0.01]} s={[0.042, 0.052, 0.038]} />
    </group>
  )
}

export default function ProfZaman({ position = [0, 0, 0], rotation = 0 }) {
  const root = useRef()
  const head = useRef()
  const mouth = useRef()
  const armR = useRef()
  const armL = useRef()
  const bubble = useRef()
  const keychain = useRef()
  const yaw = useRef(rotation)
  const wasChatting = useRef(false)
  const waveUntil = useRef(0)
  const dir = useMemo(() => new THREE.Vector3(), [])
  const printMat = useMemo(() => new THREE.MeshStandardMaterial({ map: printTex(), transparent: true, roughness: 0.9 }), [])
  const [px, py, pz] = position

  useFrame(({ camera, clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    const now = performance.now()
    const chatting = talk.chatting === ZAMAN_ID
    const thinking = chatting && talk.thinking
    const talking = chatting && now < talk.talkUntil
    if (chatting && !wasChatting.current) waveUntil.current = now + 1600 // wave hello
    wasChatting.current = chatting

    // is the crosshair on him? closest approach of the view ray to his center line
    camera.getWorldDirection(dir)
    const dx = px - camera.position.x
    const dz = pz - camera.position.z
    const flat = dir.x * dir.x + dir.z * dir.z
    const s = flat > 1e-6 ? (dx * dir.x + dz * dir.z) / flat : -1
    const miss = Math.hypot(camera.position.x + dir.x * s - px, camera.position.z + dir.z * s - pz)
    const hitY = camera.position.y + dir.y * s - py
    setAimed(ZAMAN_ID, s > 0 && Math.hypot(dx, dz) < REACH && miss < BODY_RADIUS && hitY > 0.1 && hitY < 1.95)

    // turn to face the player while chatting; otherwise scan the classroom
    const target = chatting ? Math.atan2(-dx, -dz) : rotation + Math.sin(t * 0.4) * 0.35
    const turn = Math.atan2(Math.sin(target - yaw.current), Math.cos(target - yaw.current))
    yaw.current += turn * Math.min(1, dt * (chatting ? 6 : 2))
    root.current.rotation.y = yaw.current

    // look up/down at the player's eyes; tilt the head while thinking, nod while talking
    const pitch = chatting ? Math.atan2(camera.position.y - (py + 1.72), Math.hypot(dx, dz)) : 0
    const k = Math.min(1, dt * 8)
    ease(head.current, -pitch * 0.8 + (talking ? Math.sin(t * 9) * 0.05 : 0), 0, thinking ? 0.2 : 0, k)
    mouth.current.scale.y = talking ? 0.004 + Math.abs(Math.sin(t * 13)) * 0.014 : 0.0001

    if (now < waveUntil.current) ease(armR.current, 0, 0, -2.55 + Math.sin(t * 12) * 0.3, Math.min(1, dt * 14))
    else if (talking) ease(armR.current, -0.35 - Math.abs(Math.sin(t * 3.2)) * 0.7, 0, -0.15, k)
    else ease(armR.current, 0.05 + Math.sin(t * 1.1) * 0.04, 0, -0.12, k)
    if (talking) ease(armL.current, -0.25 - Math.abs(Math.sin(t * 2.6 + 1)) * 0.45, 0, 0.15, k)
    else ease(armL.current, 0.05 + Math.sin(t * 1.1 + 2) * 0.04, 0, 0.12, k)

    bubble.current.visible = thinking
    bubble.current.children.forEach((dot, i) => (dot.position.y = Math.max(0, Math.sin(t * 6 - i * 0.8)) * 0.04))

    // the Labubu swings on its chain, harder when he turns
    keychain.current.rotation.z = Math.sin(t * 2.3) * 0.18 - Math.max(-0.5, Math.min(0.5, turn))
    keychain.current.rotation.x = Math.sin(t * 1.7 + 1) * 0.1
  })

  return (
    <group position={position}>
      <group ref={root}>
        {/* sneakers + jeans */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B g={BOX} c="#f4f4f6" p={[0.1 * sx, 0.055, 0.035]} s={[0.12, 0.1, 0.27]} />
            <B g={BOX} c={PINK} p={[0.1 * sx, 0.008, 0.035]} s={[0.125, 0.016, 0.275]} />
            <B g={CYL} c={DENIM} p={[0.1 * sx, 0.5, 0]} s={[0.078, 0.82, 0.078]} />
          </group>
        ))}
        <B g={CYL} c={DENIM} p={[0, 0.92, 0]} s={[0.19, 0.12, 0.13]} />

        {/* hoodie: torso, ribbed hem, shoulders, BLACKPINK print, pocket, drawstrings, hood */}
        <mesh geometry={TORSO} material={m(HOODIE)} position={[0, 1.25, 0]} scale={[1, 1, 0.68]} />
        <B g={CYL} c="#0c0c0e" p={[0, 0.975, 0]} s={[0.218, 0.05, 0.15]} />
        <B c={HOODIE} p={[0, 1.52, 0]} s={[0.25, 0.085, 0.14]} />
        <mesh material={printMat} position={[0, 1.325, 0.145]}>
          <planeGeometry args={[0.27, 0.0675]} />
        </mesh>
        <B g={BOX} c="#1c1c20" p={[0, 1.1, 0.146]} s={[0.24, 0.11, 0.012]} />
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B g={CYL} c={PINK} p={[0.035 * sx, 1.47, 0.135]} s={[0.006, 0.12, 0.006]} />
            <B c="#ffffff" p={[0.035 * sx, 1.405, 0.137]} s={[0.01, 0.01, 0.01]} />
          </group>
        ))}
        <B c={HOODIE} p={[0, 1.58, -0.085]} s={[0.15, 0.1, 0.1]} />
        <B g={CYL} c={HOODIE} p={[0, 1.565, -0.01]} s={[0.085, 0.05, 0.08]} />
        <B g={CYL} c={SKIN} p={[0, 1.6, 0]} s={[0.048, 0.08, 0.048]} />

        <Arm side={-1} armRef={armR} />
        <Arm side={1} armRef={armL} />

        {/* Labubu keychain on his left belt loop */}
        <group ref={keychain} position={[0.22, 0.92, 0.05]}>
          <B g={CYL} c="#c9ccd2" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, -0.04, 0]} s={[0.004, 0.08, 0.004]} />
          <Labubu fur="#ff8fc7" expression="mischief" height={0.17} position={[0, -0.25, 0.01]} />
        </group>

        {/* head pivots at the neck so it can look at the player */}
        <group ref={head} position={[0, 1.62, 0]}>
          <B c={SKIN} p={[0, 0.11, 0]} s={[0.115, 0.135, 0.125]} />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B c={SKIN} p={[0.116 * sx, 0.11, 0]} s={[0.02, 0.034, 0.02]} />
              <B c="#ffffff" p={[0.045 * sx, 0.13, 0.112]} s={[0.022, 0.018, 0.012]} />
              <B c="#1d1410" p={[0.045 * sx, 0.13, 0.121]} s={[0.011, 0.012, 0.008]} />
              <B g={BOX} c={HAIR} p={[0.047 * sx, 0.165, 0.112]} r={[0, 0, -0.08 * sx]} s={[0.045, 0.011, 0.01]} />
            </group>
          ))}
          <B c={SKIN} p={[0, 0.09, 0.125]} s={[0.02, 0.026, 0.022]} />
          <mesh geometry={SMILE} material={m('#5a2620')} position={[0, 0.048, 0.112]} rotation={[0, 0, Math.PI]} scale={0.028} />
          <mesh ref={mouth} geometry={SPH} material={m('#3a1512')} position={[0, 0.036, 0.11]} scale={[0.022, 0.0001, 0.01]} />
          {/* short black hair with a swoop in front */}
          <B c={HAIR} p={[0, 0.19, -0.025]} s={[0.122, 0.07, 0.13]} />
          <B c={HAIR} p={[0, 0.12, -0.03]} s={[0.119, 0.11, 0.105]} />
          <B c={HAIR} p={[0.02, 0.215, 0.07]} r={[0.3, 0, 0]} s={[0.075, 0.035, 0.05]} />
          {/* thinking bubble */}
          <group ref={bubble} position={[0, 0.36, 0]} visible={false}>
            {[-1, 0, 1].map((i) => (
              <group key={i}>
                <B c={PINK} o={{ emissive: PINK, emissiveIntensity: 1.2 }} p={[i * 0.05, 0, 0]} s={[0.016, 0.016, 0.016]} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}
