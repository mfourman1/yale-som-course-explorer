// Shared state between professor avatars inside the 3D canvas and the chat UI outside it.
// Avatars read it every frame, so it lives in a plain object instead of React state.
export const talk = {
  aimed: null, // id of the professor under the crosshair and within reach
  chatting: null, // id of the professor whose chat window is open (he turns to face the player)
  thinking: false, // waiting for the backend's reply
  talkUntil: 0, // performance.now() until which the professor gestures as if speaking
}

// Professors that have a 3D avatar and a backend agent, keyed by the backend's professor id.
export const AVATARS = {
  'tauhid-zaman': {
    name: 'Tauhid Zaman',
    course: 'MGT 409 · AI Foundations for Managers',
    suggestions: ['Explain the central limit theorem', 'Which classes cover regression?', 'When does MGT 409 meet?'],
  },
  'peter-schott': {
    name: 'Peter Schott',
    course: 'MGT 407 · Statistics',
    suggestions: ['What is regression to the mean?', 'Explain a confidence interval', 'Which classes cover international trade?'],
  },
}

const listeners = new Set()

export function setAimed(id, on) {
  const next = on ? id : talk.aimed === id ? null : talk.aimed
  if (next === talk.aimed) return
  talk.aimed = next
  listeners.forEach((f) => f(next))
}

export function onAimChange(f) {
  listeners.add(f)
  return () => listeners.delete(f)
}

// true when a key press is meant for a text box, not for walking around
export const typing = (e) => e.target instanceof Element && !!e.target.closest('input, textarea, [contenteditable]')
