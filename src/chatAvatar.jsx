import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { setAimed, talk } from './talk.js'

// Shared parts for professors you can chat with (ProfZaman, ProfSchott, ...).
// Each avatar file builds its own outfit and hair; this module handles the head, arms, and
// behavior: aim detection, turning to face the player while chatting, waving hello, the
// thinking bubble, and gesturing while an answer comes in.
// Figures are built in meters, facing +z; the avatar's own right hand is at -x.

export const PINK = '#ff4fa3'
const REACH = 4.2 // meters: how close the player must be to start a chat
const BODY_RADIUS = 0.38 // meters: how far off the center line the crosshair can be and still hit

const mats = new Map()
export const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }))
  return mats.get(k)
}
export const SPH = new THREE.SphereGeometry(1, 24, 16)
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
export const BOX = new THREE.BoxGeometry(1, 1, 1)
export const CONE = new THREE.ConeGeometry(1, 1, 24)
export const TORSO = new THREE.CylinderGeometry(0.19, 0.215, 0.58, 24)
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
const SMILE = new THREE.TorusGeometry(1, 0.2, 6, 16, Math.PI)

export const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => (
  <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />
)

// ease a rotation toward a target so poses blend instead of snapping
const ease = (obj, x, y, z, k) => {
  obj.rotation.x += (x - obj.rotation.x) * k
  obj.rotation.y += (y - obj.rotation.y) * k
  obj.rotation.z += (z - obj.rotation.z) * k
}

// Runs the avatar every frame. Attach the returned refs to the matching parts;
// extra(t, turn) runs after the pose for avatar-specific motion (turn = radians left to turn).
export function useChatAvatar(id, position, rotation, extra) {
  const refs = {
    root: useRef(),
    head: useRef(),
    mouth: useRef(),
    armR: useRef(),
    armL: useRef(),
    bubble: useRef(),
  }
  const yaw = useRef(rotation)
  const wasChatting = useRef(false)
  const waveUntil = useRef(0)
  const dir = useMemo(() => new THREE.Vector3(), [])
  const [px, py, pz] = position

  useFrame(({ camera, clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    const now = performance.now()
    const chatting = talk.chatting === id
    const thinking = chatting && talk.thinking
    const talking = chatting && now < talk.talkUntil
    if (chatting && !wasChatting.current) waveUntil.current = now + 1600 // wave hello
    wasChatting.current = chatting

    // is the crosshair on the avatar? closest approach of the view ray to its center line
    camera.getWorldDirection(dir)
    const dx = px - camera.position.x
    const dz = pz - camera.position.z
    const flat = dir.x * dir.x + dir.z * dir.z
    const s = flat > 1e-6 ? (dx * dir.x + dz * dir.z) / flat : -1
    const miss = Math.hypot(camera.position.x + dir.x * s - px, camera.position.z + dir.z * s - pz)
    const hitY = camera.position.y + dir.y * s - py
    setAimed(id, s > 0 && Math.hypot(dx, dz) < REACH && miss < BODY_RADIUS && hitY > 0.1 && hitY < 1.95)

    // turn to face the player while chatting; otherwise scan the classroom
    const target = chatting ? Math.atan2(-dx, -dz) : rotation + Math.sin(t * 0.4) * 0.35
    const turn = Math.atan2(Math.sin(target - yaw.current), Math.cos(target - yaw.current))
    yaw.current += turn * Math.min(1, dt * (chatting ? 6 : 2))
    refs.root.current.rotation.y = yaw.current

    // look up/down at the player's eyes; tilt the head while thinking, nod while talking
    const pitch = chatting ? Math.atan2(camera.position.y - (py + 1.72), Math.hypot(dx, dz)) : 0
    const k = Math.min(1, dt * 8)
    ease(refs.head.current, -pitch * 0.8 + (talking ? Math.sin(t * 9) * 0.05 : 0), 0, thinking ? 0.2 : 0, k)
    refs.mouth.current.scale.y = talking ? 0.004 + Math.abs(Math.sin(t * 13)) * 0.014 : 0.0001

    const armR = refs.armR.current
    const armL = refs.armL.current
    if (now < waveUntil.current) ease(armR, 0, 0, -2.55 + Math.sin(t * 12) * 0.3, Math.min(1, dt * 14))
    else if (talking) ease(armR, -0.35 - Math.abs(Math.sin(t * 3.2)) * 0.7, 0, -0.15, k)
    else ease(armR, 0.05 + Math.sin(t * 1.1) * 0.04, 0, -0.12, k)
    if (talking) ease(armL, -0.25 - Math.abs(Math.sin(t * 2.6 + 1)) * 0.45, 0, 0.15, k)
    else ease(armL, 0.05 + Math.sin(t * 1.1 + 2) * 0.04, 0, 0.12, k)

    refs.bubble.current.visible = thinking
    refs.bubble.current.children.forEach((dot, i) => (dot.position.y = Math.max(0, Math.sin(t * 6 - i * 0.8)) * 0.04))

    extra?.(t, turn)
  })
  return refs
}

export function Arm({ side, armRef, sleeve, cuff, skin }) {
  return (
    <group ref={armRef} position={[0.245 * side, 1.49, 0]}>
      <mesh geometry={CAP} material={m(sleeve)} position={[0, -0.22, 0]} scale={[0.066, 0.13, 0.066]} />
      <B g={CYL} c={cuff} p={[0, -0.4, 0]} s={[0.062, 0.03, 0.062]} />
      <B c={skin} p={[0, -0.47, 0.01]} s={[0.042, 0.052, 0.038]} />
    </group>
  )
}

// Head, neck, face, and thinking bubble. Pass the hair as children (head-local coordinates:
// the head sphere is centered at y 0.11, radius ~0.12).
export function Head({ refs, skin, brow, children }) {
  return (
    <group ref={refs.head} position={[0, 1.62, 0]}>
      <B g={CYL} c={skin} p={[0, -0.02, 0]} s={[0.048, 0.08, 0.048]} />
      <B c={skin} p={[0, 0.11, 0]} s={[0.115, 0.135, 0.125]} />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B c={skin} p={[0.116 * sx, 0.11, 0]} s={[0.02, 0.034, 0.02]} />
          <B c="#ffffff" p={[0.045 * sx, 0.13, 0.112]} s={[0.022, 0.018, 0.012]} />
          <B c="#1d1410" p={[0.045 * sx, 0.13, 0.121]} s={[0.011, 0.012, 0.008]} />
          <B g={BOX} c={brow} p={[0.047 * sx, 0.165, 0.112]} r={[0, 0, -0.08 * sx]} s={[0.045, 0.011, 0.01]} />
        </group>
      ))}
      <B c={skin} p={[0, 0.09, 0.125]} s={[0.02, 0.026, 0.022]} />
      <mesh geometry={SMILE} material={m('#5a2620')} position={[0, 0.048, 0.112]} rotation={[0, 0, Math.PI]} scale={0.028} />
      <mesh ref={refs.mouth} geometry={SPH} material={m('#3a1512')} position={[0, 0.036, 0.11]} scale={[0.022, 0.0001, 0.01]} />
      {children}
      <group ref={refs.bubble} position={[0, 0.36, 0]} visible={false}>
        {[-1, 0, 1].map((i) => (
          <group key={i}>
            <B c={PINK} o={{ emissive: PINK, emissiveIntensity: 1.2 }} p={[i * 0.05, 0, 0]} s={[0.016, 0.016, 0.016]} />
          </group>
        ))}
      </group>
    </group>
  )
}
