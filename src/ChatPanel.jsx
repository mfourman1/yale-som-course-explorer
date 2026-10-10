import { useEffect, useRef, useState } from 'react'
import { talk } from './talk.js'

// Chat window for a professor agent. Messages are { role: 'user' | 'professor', content }.
// The backend is stateless, so every request sends the conversation so far as history.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

// **bold** and `code` inside a line
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>
    return part
  })
}

// paragraphs plus "- " and "1. " lists: the subset of markdown the agents are told to use
function Rich({ text }) {
  const blocks = []
  let list = null
  for (const line of text.split('\n')) {
    const bullet = line.match(/^\s*(?:[-*•]|(\d+)\.)\s+(.*)$/)
    if (bullet) {
      const kind = bullet[1] ? 'ol' : 'ul'
      if (!list || list.kind !== kind) blocks.push((list = { kind, items: [] }))
      list.items.push(bullet[2])
    } else {
      list = null
      if (line.trim()) blocks.push({ kind: 'p', text: line })
    }
  }
  return blocks.map((b, i) => {
    if (b.kind === 'p') return <p key={i}>{inline(b.text)}</p>
    const List = b.kind
    return (
      <List key={i}>
        {b.items.map((item, j) => (
          <li key={j}>{inline(item)}</li>
        ))}
      </List>
    )
  })
}

export default function ChatPanel({ prof, messages, setMessages, onClose }) {
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()
  const listRef = useRef()
  const last = prof.name.split(' ').at(-1)

  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  async function send(raw) {
    const text = raw.trim()
    if (!text || pending) return
    const history = messages
    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    setError('')
    setPending(true)
    talk.thinking = true
    try {
      const res = await fetch(`${API_URL}/api/professors/${prof.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `The server returned an error (${res.status}).`)
      setMessages((m) => [...m, { role: 'professor', content: data.reply }])
      talk.talkUntil = performance.now() + Math.min(9000, 1500 + data.reply.length * 20)
    } catch (e) {
      // take the unanswered question back out so it can be resent
      setMessages((m) => m.slice(0, -1))
      setInput(text)
      setError(e instanceof TypeError ? `Can't reach the professor backend at ${API_URL}. Is it running?` : e.message)
    } finally {
      setPending(false)
      talk.thinking = false
    }
  }

  return (
    <aside className="chat" aria-label={`Chat with Prof. ${prof.name}`}>
      <header className="chat-head">
        <div>
          <div className="kicker">AI professor · {prof.course}</div>
          <h2>Prof. {prof.name}</h2>
        </div>
        <button className="chat-close" onClick={() => onClose(true)} aria-label="Close chat and keep walking">
          ×
        </button>
      </header>

      <div className="chat-log" ref={listRef} aria-live="polite">
        {messages.length === 0 && !pending && (
          <div className="chat-empty">
            <p>
              Ask Prof. {last} about {prof.course.split(' · ')[0]}, stats, AI, or any course at SOM this fall.
            </p>
            <div className="chips">
              {prof.suggestions.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role}`}>
            {msg.role === 'professor' ? <Rich text={msg.content} /> : msg.content}
          </div>
        ))}
        {pending && (
          <div className="msg professor typing" aria-label={`Prof. ${last} is typing`}>
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {error && (
        <div className="chat-error" role="alert">
          {error}
        </div>
      )}
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          rows={2}
          maxLength={4000}
          placeholder={`Message Prof. ${last}…`}
          aria-label={`Message Prof. ${last}`}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
        />
        <button className="go" type="submit" disabled={pending || !input.trim()}>
          Send
        </button>
      </form>
      <div className="chat-note">AI persona built from the SOM course catalog. It can make mistakes.</div>
    </aside>
  )
}
