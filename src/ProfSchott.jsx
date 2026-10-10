import { Arm, B, BOX, CONE, CYL, Head, TORSO, m, useChatAvatar } from './chatAvatar.jsx'

// Prof. Peter Schott (MGT 407 Statistics): Californian surfer. Light-blue open-collar
// button-down like his faculty photo, khaki chinos, brown shoes, swept-back sandy blond
// hair, and his surfboard leaning against the whiteboard behind him.
// Behavior (aiming, facing the player, gestures) is in chatAvatar.jsx.

const SKIN = '#f1d0b8' // light
const HAIR = '#b8925a' // sandy blond
const SHIRT = '#a9c3e3'
const SHIRT_DARK = '#93add0'
const KHAKI = '#c4ab80'
const LEATHER = '#5b3a26'
const SURF_TEAL = '#2bb3c0'

function Surfboard() {
  return (
    <group position={[-0.95, 0, -0.6]} rotation={[-0.22, 0.4, 0]}>
      <B c="#f6f1e6" p={[0, 0.98, 0]} s={[0.25, 0.97, 0.035]} />
      <B c={SURF_TEAL} p={[0, 0.98, 0.002]} s={[0.035, 0.93, 0.036]} />
      <B g={BOX} c={SURF_TEAL} p={[0, 0.3, -0.05]} s={[0.012, 0.1, 0.08]} />
    </group>
  )
}

export default function ProfSchott({ position = [0, 0, 0], rotation = 0 }) {
  const refs = useChatAvatar('peter-schott', position, rotation)

  return (
    <group position={position}>
      {/* the surfboard stays put while he turns */}
      <group rotation={[0, rotation, 0]}>
        <Surfboard />
      </group>

      <group ref={refs.root}>
        {/* brown shoes + khaki chinos + belt */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B g={BOX} c={LEATHER} p={[0.1 * sx, 0.045, 0.035]} s={[0.11, 0.09, 0.27]} />
            <B g={CYL} c={KHAKI} p={[0.1 * sx, 0.5, 0]} s={[0.076, 0.82, 0.076]} />
          </group>
        ))}
        <B g={CYL} c={KHAKI} p={[0, 0.92, 0]} s={[0.19, 0.12, 0.13]} />
        <B g={CYL} c={LEATHER} p={[0, 0.975, 0]} s={[0.196, 0.035, 0.136]} />
        <B g={BOX} c="#c9ccd2" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, 0.975, 0.137]} s={[0.04, 0.03, 0.01]} />

        {/* tucked-in button-down with an open collar */}
        <mesh geometry={TORSO} material={m(SHIRT)} position={[0, 1.27, 0]} scale={[0.97, 0.93, 0.66]} />
        <B c={SHIRT} p={[0, 1.52, 0]} s={[0.24, 0.08, 0.135]} />
        <B g={BOX} c={SHIRT_DARK} p={[0, 1.24, 0.134]} s={[0.025, 0.46, 0.006]} />
        {[1.38, 1.27, 1.16, 1.05].map((y) => (
          <B key={y} c="#f4f6fa" p={[0, y, 0.139]} s={[0.008, 0.008, 0.005]} />
        ))}
        <B g={CONE} c={SKIN} p={[0, 1.515, 0.128]} r={[Math.PI - 0.25, 0, 0]} s={[0.045, 0.11, 0.012]} />
        {[-1, 1].map((sx) => (
          <B key={sx} g={BOX} c={SHIRT_DARK} p={[0.048 * sx, 1.52, 0.14]} r={[0.25, 0, 0.42 * sx]} s={[0.022, 0.1, 0.008]} />
        ))}

        <Arm side={-1} armRef={refs.armR} sleeve={SHIRT} cuff={SHIRT_DARK} skin={SKIN} />
        <Arm side={1} armRef={refs.armL} sleeve={SHIRT} cuff={SHIRT_DARK} skin={SKIN} />

        {/* swept-back hair with volume and a side part */}
        <Head refs={refs} skin={SKIN} brow="#8a6a3e">
          <B c={HAIR} p={[0.005, 0.195, -0.02]} s={[0.126, 0.078, 0.135]} />
          <B c={HAIR} p={[0, 0.12, -0.035]} s={[0.12, 0.112, 0.105]} />
          <B c={HAIR} p={[-0.025, 0.232, 0.06]} r={[0.35, 0, 0.12]} s={[0.1, 0.042, 0.065]} />
          {[-1, 1].map((sx) => (
            <B key={sx} c={HAIR} p={[0.108 * sx, 0.165, 0.0]} s={[0.025, 0.05, 0.07]} />
          ))}
        </Head>
      </group>
    </group>
  )
}
