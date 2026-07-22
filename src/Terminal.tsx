import { useState, useRef, useEffect, useCallback } from 'react'

export type ThemeName = 'light' | 'dark'

interface Props {
  headerHeight: number
  theme: ThemeName
  onTheme: (t: ThemeName) => void
  audioPlaying: boolean
  onAudioToggle: () => void
  onMatrixToggle: () => void
  onKeyClick: () => void
}

type LineType = 'cmd' | 'out' | 'err'
interface Line { id: number; type: LineType; text: string }

// Autocomplete candidates for the terminal command line.
const COMPLETIONS = [
  'ls', 'dir', 'help', 'clear', 'contact', 'whoami', 'matrix', 'ping',
  'download', 'resume',
  'cat 01_education.txt', 'cat 02_experience.txt', 'cat 03_projects.txt',
  'theme dark', 'theme light',
  'audio on', 'audio off',
  'open auto-score', 'open led-cube', 'open desk-tamagotchi',
]

// Maps shorthand file names to the page sections they should scroll into view.
const SECTION_MAP: Record<string, string> = {
  '01': 'education', 'edu': 'education', 'education': 'education',
  '02': 'experience', 'exp': 'experience', 'experience': 'experience',
  '03': 'projects', 'proj': 'projects', 'projects': 'projects',
}

// External project links used by the open <project> shell command.
const PROJECT_URLS: Record<string, string> = {
  'auto-score':      'https://github.com/kevinli808/automaticScoreboard',
  'led-cube':        'https://github.com/kevinli808/led-cube',
  'desk-tamagotchi': 'https://github.com/kevinli808/Desk-Tamagotchi',
}

const INPUT_ROW_H = 44
const HANDLE_H    = 8
const MIN_OUT_H   = 0
const MAX_OUT_H   = 500

export function Terminal({ headerHeight, theme, onTheme, audioPlaying, onAudioToggle, onMatrixToggle, onKeyClick }: Props) {
  const [input, setInput]           = useState('')
  const [isFocused, setIsFocused]   = useState(false)
  const [lines, setLines]           = useState<Line[]>([])
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [histIdx, setHistIdx]       = useState(-1)
  const [savedInput, setSavedInput] = useState('')
  const [outputH, setOutputH]       = useState(MIN_OUT_H)

  const inputRef  = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const uid       = useRef(0)

  const dragging      = useRef(false)
  const dragStartY    = useRef(0)
  const dragStartH    = useRef(0)

  // theme-derived terminal colors
  const tc = theme === 'dark' ? {
    bg:     '#0d1117',
    border: '#30363d',
    fg:     '#e6edf3',
    muted:  '#8b949e',
    dim:    '#484f58',
    prompt: '#484f58',
    cursor: '#3fb950',
    handle: '#30363d',
    hint:   '#30363d',
    cmd:    '#8b949e',
    out:    '#e6edf3',
    err:    '#f85149',
  } : {
    bg:     '#f8f9fa',
    border: '#e5e7eb',
    fg:     '#1a1a1a',
    muted:  '#6b7280',
    dim:    '#9ca3af',
    prompt: '#9ca3af',
    cursor: '#1a1a1a',
    handle: '#d1d5db',
    hint:   '#d1d5db',
    cmd:    '#6b7280',
    out:    '#374151',
    err:    '#dc2626',
  }

  // Output helpers append terminal lines and keep the log scrolled to the newest entry.
  const push = useCallback((texts: string[], type: LineType = 'out') => {
    setLines(prev =>
      [...prev, ...texts.map(text => ({ id: uid.current++, type, text }))].slice(-80)
    )
    setOutputH(h => (h === MIN_OUT_H ? 140 : h))
    requestAnimationFrame(() => {
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
    })
  }, [])

  const scrollTo = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (!el) return
    const offset = el.getBoundingClientRect().top + window.scrollY - headerHeight - 20
    window.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
  }, [headerHeight])

  // Dragging the terminal body resizes the output panel while preserving the fixed shell layout.
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current   = true
    dragStartY.current = e.clientY
    dragStartH.current = outputH
    document.body.style.cursor    = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [outputH])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = dragStartY.current - e.clientY
      setOutputH(Math.min(MAX_OUT_H, Math.max(MIN_OUT_H, dragStartH.current + delta)))
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  // Command router turns shell-style input into the portfolio navigation and UI actions.
  const exec = useCallback((raw: string) => {
    const cmd = raw.trim()
    if (!cmd) return
    setCmdHistory(h => [cmd, ...h.filter(c => c !== cmd)].slice(0, 100))
    setHistIdx(-1); setSavedInput('')
    push([`visitor@kevinli:~ $ ${cmd}`], 'cmd')

    const parts = cmd.split(/\s+/)
    const verb  = parts[0].toLowerCase()
    const arg   = parts.slice(1).join(' ').toLowerCase().trim()

    switch (verb) {
      case 'ls':
      case 'dir':
        push(['01_education.txt   02_experience.txt   03_projects.txt   resume.pdf'])
        break

      case 'cat': {
        if (!arg) { push(['Usage: cat <file>   e.g. cat 01_education.txt'], 'err'); break }
        const key = Object.keys(SECTION_MAP).find(k => arg.includes(k))
        if (key) { push([`→ Scrolling to ${SECTION_MAP[key]}…`]); scrollTo(SECTION_MAP[key]) }
        else push([`cat: ${arg}: No such file or directory`], 'err')
        break
      }

      case 'open': {
        const slug = arg.replace(/\s+/g, '-')
        const url  = PROJECT_URLS[slug]
        if (url) { window.open(url, '_blank', 'noopener,noreferrer'); push([`Opening ${url}…`]) }
        else push([`open: "${arg}" not found. Options: auto-score, led-cube, desk-tamagotchi`], 'err')
        break
      }

      case 'download':
      case 'resume':
        push(['↓ Opening resume.pdf…'])
        window.open('/resume.pdf', '_blank', 'noopener,noreferrer')
        break

      case 'theme': {
        const valid: ThemeName[] = ['dark', 'light']
        if (valid.includes(arg as ThemeName)) { onTheme(arg as ThemeName); push([`Theme → ${arg}`]) }
        else push([`theme: "${arg}" not recognised. Options: dark, light`], 'err')
        break
      }

      case 'audio':
        if (arg === 'on' || arg === 'off') {
          if ((arg === 'on') !== audioPlaying) onAudioToggle()
          push([`Audio ${arg}`])
        } else push(['Usage: audio <on|off>'], 'err')
        break

      case 'clear':
        setLines([]); setOutputH(MIN_OUT_H); return

      case 'help':
        push([
          '┌──────────────────────────────────────────────────┐',
          '│  ls / dir           List all files               │',
          '│  cat <file>         Scroll to section            │',
          '│  open <project>     Open GitHub repo             │',
          '│  download           Open resume.pdf              │',
          '│  theme <t>          dark | light                 │',
          '│  audio <on|off>     Toggle audio                 │',
          '│  clear              Clear terminal               │',
          '│  contact            Copy email to clipboard      │',
          '│  whoami             Display user identity        │',
          '│  ping               Test connection latency      │',
          '│  matrix             Toggle Matrix rain           │',
          '└──────────────────────────────────────────────────┘',
        ])
        break

      case 'contact': {
        const email = 'kevin.shangkun.li@gmail.com'
        try {
          const el = document.createElement('textarea')
          el.value = email; el.style.cssText = 'position:fixed;top:-9999px;opacity:0'
          document.body.appendChild(el); el.select()
          document.execCommand('copy'); document.body.removeChild(el)
        } catch (_) {}
        push([`✓ Copied: ${email}`])
        break
      }

      case 'whoami':
        push(['visitor@kevinli-kl.me (Guest User)'])
        break

      case 'matrix':
        onMatrixToggle(); push(['Matrix rain toggled.'])
        break

      case 'ping':
        push([`pong! latency: ${8 + Math.floor(Math.random() * 15)}ms`])
        break

      default:
        push([`Command not recognized: "${cmd}". Type "help" for available commands.`], 'err')
    }
  }, [push, scrollTo, onTheme, audioPlaying, onAudioToggle, onMatrixToggle])

  // Global shortcuts keep the terminal keyboard-first. Slash or Ctrl/Cmd+K focuses the input.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName ?? ''
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(tag)) {
        e.preventDefault(); inputRef.current?.focus()
      }
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Keyboard handling covers autocomplete, history traversal, and command submission.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      const v = input.toLowerCase().trimStart()
      if (!v) return
      const match = COMPLETIONS.find(c => c.startsWith(v) && c !== v)
      if (match) {
        setInput(match)
        requestAnimationFrame(() => {
          const el = inputRef.current
          if (el) { el.selectionStart = el.selectionEnd = el.value.length }
        })
      }
      return
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) onKeyClick()

    if (e.key === 'Enter') { const v = input; setInput(''); exec(v); return }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!cmdHistory.length) return
      if (histIdx === -1) setSavedInput(input)
      const next = histIdx === -1 ? 0 : Math.min(histIdx + 1, cmdHistory.length - 1)
      setHistIdx(next); setInput(cmdHistory[next]); return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx <= 0) { setHistIdx(-1); setInput(savedInput); return }
      const next = histIdx - 1; setHistIdx(next); setInput(cmdHistory[next])
    }
  }

  const lineColor = (type: LineType) =>
    type === 'err' ? tc.err : type === 'cmd' ? tc.cmd : tc.out

  const showOutput = outputH > 0

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        background: tc.bg,
        borderTop: `1px solid ${tc.border}`,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* ── Drag handle ── */}
      <div
        onMouseDown={onDragStart}
        style={{
          height: HANDLE_H,
          flexShrink: 0,
          cursor: 'ns-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Drag to resize"
      >
        <div style={{ width: 28, height: 2, background: tc.handle, borderRadius: 1 }} />
      </div>

      {/* ── Output panel ── */}
      {showOutput && (
        <div
          ref={outputRef}
          style={{
            flexShrink: 0,
            height: outputH,
            overflowY: 'auto',
            padding: '2px 16px 4px',
          }}
        >
          {lines.map(l => (
            <div key={l.id} style={{ color: lineColor(l.type), fontSize: '11px', lineHeight: '1.55', whiteSpace: 'pre' }}>
              {l.text}
            </div>
          ))}
        </div>
      )}

      {/* ── Input row ── */}
      <div
        style={{
          minHeight: INPUT_ROW_H,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          paddingTop: 12,
          paddingBottom: 12,
          gap: 8,
          padding: '0 16px',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <span style={{ color: tc.prompt, fontSize: '11px', userSelect: 'none', flexShrink: 0 }}>
          visitor@kevinli:~ $
        </span>

        {/* The visible terminal row mirrors the user's typed text with a custom block cursor,
            while the hidden native input captures the keyboard interaction. */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {/* Visible text + block cursor */}
          <div
            style={{
              color: tc.fg,
              fontSize: '11px',
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              pointerEvents: 'none',
              minWidth: 0,
              lineHeight: '1.4',
            }}
          >
            {input || (!isFocused && !input ? <span style={{ color: tc.hint }}>{"Type 'help' or press ⌘K…"}</span> : '')}
            {isFocused && !input && (
              <span
                className="cursor-blink"
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 14,
                  background: tc.cursor,
                  verticalAlign: 'text-bottom',
                  marginLeft: 0,
                }}
              />
            )}
            {input && isFocused && (
              <span
                className="cursor-blink"
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 14,
                  background: tc.cursor,
                  verticalAlign: 'text-bottom',
                  marginLeft: 0,
                }}
              />
            )}
          </div>

          {/* Invisible input captures all keyboard events */}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-label="Terminal command input"
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              opacity: 0,
              width: '100%',
              minHeight: '100%',
              cursor: 'text',
              fontSize: '11px',
              fontFamily: 'inherit',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
            }}
          />
        </div>

        <span style={{ color: tc.hint, fontSize: '10px', flexShrink: 0 }} className="hidden sm:inline">
          Press [/] or [⌘K] to focus · [Tab] autocomplete · [↑↓] history
        </span>
      </div>
    </div>
  )
}
