import { useMemo } from 'react'
import * as THREE from 'three'
import Professor, { PROFESSORS } from './Professor.jsx'
import ProfSchott from './ProfSchott.jsx'
import ProfZaman from './ProfZaman.jsx'
import { AVATARS } from './talk.js'
import { DRUMS, LECTERNS } from './layout.js'

// who teaches in which classroom (matches the slide decks): Hogwarts professors, except the
// rooms where a real professor's avatar teaches and students can chat with their AI agent
export const ROOM_PROFESSOR = {
  2400: 'tauhid-zaman', // MGT 409 AI Foundations for Managers
  2410: 'mcgonagall', // MGT 404 Basics of Economics
  2420: 'peter-schott', // MGT 407 Statistics
  2430: 'slughorn', // MGT 887 Negotiations
  2200: 'snape', // MGT 402 Basics of Accounting
  2210: 'lockhart', // MGT 538 Mastering Influence & Persuasion
  2220: 'moody', // MGT 800 Crisis Management in Tech
  2230: 'flitwick', // MGT 541 Corporate Finance
}

// avatars of real professors, keyed by backend professor id (see AVATARS in talk.js)
const CHAT_AVATARS = { 'tauhid-zaman': ProfZaman, 'peter-schott': ProfSchott }

function plaqueTex(name) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#c9a44a'
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#2a1d0c'
  g.fillRect(8, 8, 496, 112)
  g.fillStyle = '#f3dfa8'
  g.font = 'bold 44px Georgia, serif'
  g.textAlign = 'center'
  g.fillText(`Prof. ${name.split(' ').slice(-1)[0]}`, 256, 80)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function Faculty() {
  const items = useMemo(
    () =>
      DRUMS.map((d, i) => {
        const who = ROOM_PROFESSOR[d.id]
        const { fc, back, t, half, rot } = d.front
        const lec = LECTERNS[i]
        return {
          who,
          Avatar: CHAT_AVATARS[who],
          pos: [fc[0] + back[0] * 1.15 - t[0] * half * 0.3, 0, fc[1] + back[1] * 1.15 - t[1] * half * 0.3],
          rot,
          plaque: { p: [lec.x + back[0] * 0.26, 0.85, lec.z + back[1] * 0.26], rot, mat: new THREE.MeshBasicMaterial({ map: plaqueTex((AVATARS[who] || PROFESSORS[who]).name) }) },
        }
      }),
    [],
  )
  return (
    <>
      {items.map((it, i) => (
        <group key={i}>
          {it.Avatar ? (
            <it.Avatar position={it.pos} rotation={it.rot} />
          ) : (
            <Professor who={it.who} position={it.pos} rotation={it.rot} phase={i * 1.7} />
          )}
          <mesh position={it.plaque.p} rotation={[0, it.plaque.rot, 0]} material={it.plaque.mat}>
            <planeGeometry args={[0.6, 0.15]} />
          </mesh>
        </group>
      ))}
      {/* Hagrid keeps an eye on the Labubus in the courtyard */}
      <Professor who="hagrid" position={[-10.5, -5, -2]} rotation={Math.PI / 2} />
    </>
  )
}
