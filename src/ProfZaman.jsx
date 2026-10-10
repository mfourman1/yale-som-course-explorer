import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { Arm, B, BOX, CYL, Head, PINK, TORSO, m, useChatAvatar } from './chatAvatar.jsx'

// Prof. Tauhid Zaman (MGT 409): black BLACKPINK hoodie, jeans, sneakers, and a pink Labubu
// hanging from his belt loop. Behavior (aiming, facing the player, gestures) is in chatAvatar.jsx.

const SKIN = '#c68e64' // light brown
const HAIR = '#16110f'
const HOODIE = '#141417'
const DENIM = '#27324a'

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

export default function ProfZaman({ position = [0, 0, 0], rotation = 0 }) {
  const keychain = useRef()
  const refs = useChatAvatar('tauhid-zaman', position, rotation, (t, turn) => {
    // the Labubu swings on its chain, harder when he turns
    keychain.current.rotation.z = Math.sin(t * 2.3) * 0.18 - Math.max(-0.5, Math.min(0.5, turn))
    keychain.current.rotation.x = Math.sin(t * 1.7 + 1) * 0.1
  })
  const printMat = useMemo(() => new THREE.MeshStandardMaterial({ map: printTex(), transparent: true, roughness: 0.9 }), [])

  return (
    <group position={position}>
      <group ref={refs.root}>
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

        <Arm side={-1} armRef={refs.armR} sleeve={HOODIE} cuff={PINK} skin={SKIN} />
        <Arm side={1} armRef={refs.armL} sleeve={HOODIE} cuff={PINK} skin={SKIN} />

        {/* Labubu keychain on his left belt loop */}
        <group ref={keychain} position={[0.22, 0.92, 0.05]}>
          <B g={CYL} c="#c9ccd2" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, -0.04, 0]} s={[0.004, 0.08, 0.004]} />
          <Labubu fur="#ff8fc7" expression="mischief" height={0.17} position={[0, -0.25, 0.01]} />
        </group>

        {/* short black hair with a swoop in front */}
        <Head refs={refs} skin={SKIN} brow={HAIR}>
          <B c={HAIR} p={[0, 0.19, -0.025]} s={[0.122, 0.07, 0.13]} />
          <B c={HAIR} p={[0, 0.12, -0.03]} s={[0.119, 0.11, 0.105]} />
          <B c={HAIR} p={[0.02, 0.215, 0.07]} r={[0.3, 0, 0]} s={[0.075, 0.035, 0.05]} />
        </Head>
      </group>
    </group>
  )
}
