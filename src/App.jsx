import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './World.jsx'
import Player from './Player.jsx'
import Minimap from './Minimap.jsx'
import TouchControls from './TouchControls.jsx'
import ChatPanel from './ChatPanel.jsx'
import { EYE, SPAWN } from './layout.js'
import { AVATARS, onAimChange, talk, typing } from './talk.js'

export default function App() {
  const [locked, setLocked] = useState(false)
  const [where, setWhere] = useState('')
  const [showMap, setShowMap] = useState(true)
  const lockRef = useRef()
  const mapRef = useRef()
  const onLock = useCallback((v) => setLocked(v), [])
  const onWhere = useCallback((w) => setWhere(w), [])
  // phones have no pointer lock, so they get a joystick + drag-to-look instead
  const [isTouch] = useState(() => matchMedia('(pointer: coarse)').matches) // phones + tablets; touchscreen laptops still get mouse mode
  const [touchOn, setTouchOn] = useState(false)
  const touchRef = useRef({ active: false, move: [0, 0], look: [0, 0], jump: false })
  const setTouch = (on) => {
    touchRef.current.active = on
    touchRef.current.move = [0, 0]
    setTouchOn(on)
  }
  const playing = locked || touchOn
  useEffect(() => {
    const k = (e) => e.code === 'KeyM' && !typing(e) && setShowMap((v) => !v)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  // professor chats: aim at an avatar and click (or tap Talk) to open his chat window
  const [aimed, setAimed] = useState(null)
  const [chatWith, setChatWith] = useState(null)
  const [threads, setThreads] = useState({}) // conversation per professor, kept when the window closes
  useEffect(() => onAimChange(setAimed), [])
  const openChat = useCallback((id) => {
    talk.chatting = id
    setChatWith(id)
    touchRef.current.move = [0, 0]
    if (document.pointerLockElement) document.exitPointerLock()
  }, [])
  const closeChat = useCallback((relock) => {
    talk.chatting = null
    setChatWith(null)
    if (relock && !touchRef.current.active) lockRef.current?.()
  }, [])
  const setThread = useCallback((id, update) => setThreads((t) => ({ ...t, [id]: update(t[id] || []) })), [])
  useEffect(() => {
    const click = (e) => e.button === 0 && document.pointerLockElement && talk.aimed && openChat(talk.aimed)
    window.addEventListener('mousedown', click)
    return () => window.removeEventListener('mousedown', click)
  }, [openChat])
  const aimedName = aimed && `Prof. ${AVATARS[aimed].name.split(' ').at(-1)}`

  return (
    <>
      <Canvas
        camera={{ fov: 72, near: 0.05, far: 800, position: [SPAWN.x, EYE, SPAWN.z] }}
        dpr={[1, 1.75]}
      >
        <World />
        <Player lockRef={lockRef} mapRef={mapRef} touchRef={touchRef} onLock={onLock} onWhere={onWhere} />
      </Canvas>

      <div className="where">
        <span className="dot" />
        {where}
      </div>
      <div className={showMap ? 'mapwrap' : 'mapwrap hidden'}>
        <Minimap drawRef={mapRef} />
      </div>
      <button className="maptoggle" onClick={() => setShowMap((s) => !s)}>
        {showMap ? 'hide map' : 'map'}
      </button>
      {playing && !chatWith && <div className={aimed ? 'crosshair on' : 'crosshair'} />}
      {playing && !chatWith && aimed && !touchOn && <div className="talkhint">Click to talk to {aimedName}</div>}
      {touchOn && !chatWith && aimed && (
        <button className="talkbtn" onClick={() => openChat(aimed)}>
          Talk to {aimedName}
        </button>
      )}
      {touchOn && !chatWith && <TouchControls touchRef={touchRef} onPause={() => setTouch(false)} />}
      {chatWith && (
        <ChatPanel
          key={chatWith}
          prof={{ id: chatWith, ...AVATARS[chatWith] }}
          messages={threads[chatWith] || []}
          setMessages={(update) => setThread(chatWith, update)}
          onClose={closeChat}
        />
      )}

      {!playing && !chatWith && (
        <div className="overlay" onClick={() => (isTouch ? setTouch(true) : lockRef.current?.())}>
          <div className="card">
            <div className="kicker">Yale SOM · Evans Hall</div>
            <h1>Floor 2</h1>
            <p className="sub">Classroom drums, the cloister, Ross Library, the Beinecke Terrace Room, and the courtyard.</p>
            <button className="go">{isTouch ? 'Tap to walk in' : 'Click to walk in'}</button>
            {!isTouch && (
              <button
                className="go alt"
                onClick={(e) => {
                  e.stopPropagation()
                  setTouch(true)
                }}
              >
                Use on-screen joystick
              </button>
            )}
            {isTouch ? (
              <div className="keys">
                <span><b>Left thumb</b> joystick to walk (push all the way to hurry)</span>
                <span><b>Right thumb</b> drag to look</span>
              </div>
            ) : (
              <div className="keys">
                <span><b>W A S D</b> walk</span>
                <span><b>Mouse</b> look</span>
                <span><b>Shift</b> sprint</span>
                <span><b>Space</b> jump</span>
                <span><b>C</b> crouch</span>
                <span><b>M</b> map</span>
                <span><b>Esc</b> pause</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
