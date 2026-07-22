import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Play, Pause, Download, Copy, Check,
  GitBranch, MapPin, Keyboard, GraduationCap,
  Terminal as TermIcon, Folder, Briefcase, Sun, Moon,
} from 'lucide-react'
import { Terminal, type ThemeName } from './Terminal'
import { MatrixRain } from './MatrixRain'

// Theme hook: reads the persisted site palette from the document root and toggles it cleanly.

const THEME_CYCLE: ThemeName[] = ['light', 'dark']
const THEME_ICONS: Record<ThemeName, React.ElementType> = { light: Sun, dark: Moon }

function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  const applyTheme = useCallback((t: ThemeName) => {
    document.documentElement.classList.toggle('dark', t === 'dark')
    try { localStorage.setItem('kl-theme', t) } catch (_) {}
    setThemeState(t)
  }, [])

  const cycle = useCallback(() => {
    setThemeState(cur => {
      const next = THEME_CYCLE[(THEME_CYCLE.indexOf(cur) + 1) % THEME_CYCLE.length]
      document.documentElement.classList.toggle('dark', next === 'dark')
      try { localStorage.setItem('kl-theme', next) } catch (_) {}
      return next
    })
  }, [])

  return { theme, applyTheme, cycle }
}

// Audio engine: manages the ambient soundtrack, station switching, and the tiny click effects.

function useAudio() {
  const lofiRef = useRef<HTMLAudioElement | null>(null)
  const rainRef = useRef<HTMLAudioElement | null>(null)
  const ctxRef  = useRef<AudioContext | null>(null)   // key-click only

  const [playing, setPlaying]   = useState(false)
  const [station, setStation]   = useState<'lofi' | 'rain'>('lofi')
  const [keyclick, setKeyclick] = useState(true)
  const stationRef = useRef<'lofi' | 'rain'>('lofi')
  stationRef.current = station

  useEffect(() => {
    const lofi = new Audio('/lofi.mp3')
    lofi.loop = true; lofi.volume = 0.32; lofi.preload = 'metadata'
    const onMeta = () => {
      if (lofi.duration && isFinite(lofi.duration))
        lofi.currentTime = Math.random() * lofi.duration
    }
    lofi.addEventListener('loadedmetadata', onMeta)

    const rain = new Audio('/rain.mp3')
    rain.loop = true; rain.volume = 0.45; rain.preload = 'metadata'

    lofiRef.current = lofi; rainRef.current = rain
    return () => {
      lofi.removeEventListener('loadedmetadata', onMeta)
      lofi.pause(); lofi.src = ''
      rain.pause(); rain.src = ''
      lofiRef.current = null; rainRef.current = null
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const a = stationRef.current === 'lofi' ? lofiRef.current : rainRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { try { await a.play() } catch (_) {} setPlaying(true) }
  }, [playing])

  const selectStation = useCallback(async (s: 'lofi' | 'rain') => {
    const wasPlaying = playing
    const prev = stationRef.current === 'lofi' ? lofiRef.current : rainRef.current
    if (wasPlaying) prev?.pause()
    stationRef.current = s; setStation(s)
    if (wasPlaying) {
      const next = s === 'lofi' ? lofiRef.current : rainRef.current
      try { await next?.play() } catch (_) {}
    }
  }, [playing])

  // Pre-rendered key-click buffers (built once via OfflineAudioContext for quality)
  const keyBufsRef = useRef<AudioBuffer[] | null>(null)
  const keyBufsBuilding = useRef(false)

  const buildKeyBufs = useCallback(async (ac: AudioContext) => {
    if (keyBufsBuilding.current || keyBufsRef.current) return
    keyBufsBuilding.current = true
    // 5 distinct switch personalities: click freq + body freq + duration
    const configs = [
      { cf: 2400, bf: 340, dur: 0.055 },  // crisp clicky
      { cf: 1850, bf: 270, dur: 0.068 },  // soft thocky
      { cf: 2900, bf: 430, dur: 0.046 },  // sharp bright
      { cf: 2100, bf: 305, dur: 0.062 },  // mid tactile
      { cf: 1650, bf: 250, dur: 0.072 },  // deep muted
    ]
    try {
      keyBufsRef.current = await Promise.all(configs.map(async ({ cf, bf, dur }) => {
        const sr = ac.sampleRate
        const len = Math.floor(sr * dur)
        const oac = new OfflineAudioContext(1, len, sr)

        // --- Click layer: bandpass-filtered white noise, fast decay ---
        const nb1 = oac.createBuffer(1, len, sr)
        const d1 = nb1.getChannelData(0)
        for (let i = 0; i < len; i++) d1[i] = Math.random() * 2 - 1
        const s1 = oac.createBufferSource(); s1.buffer = nb1
        const bp = oac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = cf; bp.Q.value = 2.2
        const g1 = oac.createGain()
        g1.gain.setValueAtTime(0.6, 0)
        g1.gain.exponentialRampToValueAtTime(0.001, dur * 0.40)
        s1.connect(bp); bp.connect(g1); g1.connect(oac.destination); s1.start(0)

        // --- Body layer: lowpass-filtered white noise, medium decay ---
        const nb2 = oac.createBuffer(1, len, sr)
        const d2 = nb2.getChannelData(0)
        for (let i = 0; i < len; i++) d2[i] = Math.random() * 2 - 1
        const s2 = oac.createBufferSource(); s2.buffer = nb2
        const lp = oac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bf
        const g2 = oac.createGain()
        g2.gain.setValueAtTime(0.38, 0)
        g2.gain.exponentialRampToValueAtTime(0.001, dur * 0.88)
        s2.connect(lp); lp.connect(g2); g2.connect(oac.destination); s2.start(0)

        return oac.startRendering()
      }))
    } catch (_) {}
    keyBufsBuilding.current = false
  }, [])

  const click = useCallback(() => {
    if (!keyclick) return
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext()
      const ac = ctxRef.current
      // Kick off buffer building on first click (async, ~50ms)
      if (!keyBufsRef.current) { buildKeyBufs(ac); return }
      const bufs = keyBufsRef.current
      const src = ac.createBufferSource()
      src.buffer = bufs[Math.floor(Math.random() * bufs.length)]
      // Random playback rate = pitch variation without rebuilding buffers
      src.playbackRate.value = 0.90 + Math.random() * 0.20
      src.connect(ac.destination)
      src.start()
    } catch (_) {}
  }, [keyclick, buildKeyBufs])

  return { playing, station, keyclick, setKeyclick, togglePlay, selectStation, click }
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Tag({ t }: { t: string }) {
  return (
    <span style={{ border: '1px solid var(--tag-border)', color: 'var(--tag-text)' }}
      className="inline-block px-1.5 py-0 text-[10px] font-bold tracking-wide mr-1 mb-1 transition-colors duration-200">
      [{t}]
    </span>
  )
}

function Prompt({ cmd }: { cmd: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 text-sm">
      <TermIcon size={13} style={{ color: 'var(--fg-dim)' }} className="shrink-0" />
      <span style={{ color: 'var(--fg-muted)' }}>$</span>
      <span className="font-bold tracking-tight" style={{ color: 'var(--fg)' }}>{cmd}</span>
    </div>
  )
}

function Rule() {
  return (
    <div className="flex items-center my-10">
      <span style={{ color: 'var(--border)' }} className="text-xs select-none">+</span>
      <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
      <span style={{ color: 'var(--border)' }} className="text-xs select-none">+</span>
    </div>
  )
}

function HBtn({ active, onClick, children, title }: {
  active?: boolean; onClick: () => void; children: React.ReactNode; title?: string
}) {
  const s: React.CSSProperties = active
    ? { background: 'var(--fg)', color: 'var(--bg)', border: '1px solid var(--fg)' }
    : { background: 'transparent', color: 'var(--fg)', border: '1px solid var(--border)' }
  return (
    <button onClick={onClick} title={title} style={s}
      className="flex items-center gap-1 px-2 py-0.5 text-[11px] transition-colors duration-150 hover:opacity-75">
      {children}
    </button>
  )
}

function ExpEntry({ org, role, period, bullets }: {
  org: string; role: string; period: string; bullets: string[]
}) {
  return (
    <div style={{ borderLeftColor: 'var(--border)' }}
      className="border-l-2 pl-4 pb-5 mb-1 pr-3 pt-1 transition-all duration-150"
      onMouseEnter={e => {
        e.currentTarget.style.borderLeftColor = 'var(--border-strong)'
        e.currentTarget.style.background = 'var(--hover-bg)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderLeftColor = 'var(--border)'
        e.currentTarget.style.background = ''
      }}
    >
      <div className="flex flex-wrap gap-x-3 justify-between items-start mb-0.5">
        <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{org}</span>
        <span className="text-[11px] tabular-nums shrink-0 mt-0.5" style={{ color: 'var(--fg-muted)' }}>{period}</span>
      </div>
      <div className="text-xs italic mb-2" style={{ color: 'var(--fg-muted)' }}>{role}</div>
      <ul className="space-y-0.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--fg-muted)' }}>
            <span style={{ color: 'var(--fg-dim)' }} className="select-none shrink-0 mt-px">›</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProjEntry({ name, sub, tech, bullets }: {
  name: string; sub: string; tech: string[]; bullets: string[]
}) {
  return (
    <div style={{ border: '1px solid var(--border)' }}
      className="p-4 mb-3 transition-all duration-150"
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-strong)'
        e.currentTarget.style.background = 'var(--hover-bg)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = ''
      }}
    >
      <div className="flex flex-wrap gap-x-3 justify-between items-start mb-2">
        <span className="font-bold text-sm" style={{ color: 'var(--fg)' }}>{name}</span>
        <span className="text-[11px] italic mt-0.5" style={{ color: 'var(--fg-muted)' }}>{sub}</span>
      </div>
      <div className="flex flex-wrap mb-3">{tech.map(t => <Tag key={t} t={t} />)}</div>
      <ul className="space-y-0.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--fg-muted)' }}>
            <span style={{ color: 'var(--fg-dim)' }} className="select-none shrink-0 mt-px">›</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { theme, applyTheme, cycle: cycleTheme } = useTheme()
  const audio = useAudio()
  const [copied, setCopied] = useState(false)
  const [matrixRain, setMatrixRain] = useState(false)
  const [statusHover, setStatusHover] = useState(false)
  const [headerH, setHeaderH] = useState(88)
  const headerRef = useRef<HTMLElement>(null)

  // Measure the sticky header height so the page content can reserve the correct top padding.
  useEffect(() => {
    if (!headerRef.current) return
    const ro = new ResizeObserver(() => setHeaderH(headerRef.current?.offsetHeight ?? 88))
    ro.observe(headerRef.current)
    return () => ro.disconnect()
  }, [])

  // Shared action wrapper: plays the tactile key-click before the underlying action runs.
  const btn = (fn: () => void) => { audio.click(); fn() }

  // Please don't sell my infomation... 
  const CONTACT = 'Kevin Li | (236) 518-7903 | kevin.shangkun.li@gmail.com'
  const copy = () => {
    try {
      const el = document.createElement('textarea')
      el.value = CONTACT
      el.style.cssText = 'position:fixed;top:-9999px;opacity:0'
      document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    } catch (_) {}
    setCopied(true); setTimeout(() => setCopied(false), 2200)
  }

  const ThemeIcon = THEME_ICONS[theme]

  return (
    // The overall shell is a fixed header with a scrollable content stack and a bottom terminal.
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: "'JetBrains Mono', monospace" }}
      className="min-h-screen transition-colors duration-200">

      <MatrixRain active={matrixRain} />

      {/* ═══════════════════ FIXED HEADER ════════════════════════════════════ */}
      <header ref={headerRef} style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', zIndex: 50 }}
        className="fixed top-0 inset-x-0 transition-colors duration-200">

        {/* Row 1: terminal-style identity block and the compact contact badges. */}
        <div style={{ borderBottom: '1px solid var(--border)' }}
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2.5 mb-2.5 sm:mb-0 text-xs">
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--fg-muted)' }}>kevin@ubc:~</span>
            <span style={{ color: 'var(--fg-muted)' }}>$</span>
            <span className="font-semibold ml-1" style={{ color: 'var(--fg)' }}>cat resume.md</span>
            <span style={{ background: 'var(--cursor-color)' }}
              className="inline-block w-[7px] h-[13px] ml-0.5 cursor-blink shrink-0" aria-hidden />
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] shrink-0">
            {/* Desktop: status badge — fixed width from longer text, crossfades on hover */}
            <a
              href="mailto:kevin.shangkun.li@gmail.com"
              onMouseEnter={() => setStatusHover(true)}
              onMouseLeave={() => setStatusHover(false)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                border: `1px solid ${statusHover ? 'var(--border-strong)' : 'var(--badge-border)'}`,
                color: statusHover ? 'var(--fg)' : 'var(--badge-text)',
                textDecoration: 'none',
                transition: 'color 0.15s, border-color 0.15s',
                cursor: 'pointer',
              }}
              className="px-1.5 py-0.5 hidden sm:inline-flex"
            >
              {/* Always-visible anchor text — keeps the badge width stable */}
              <span style={{ visibility: statusHover ? 'hidden' : 'visible', whiteSpace: 'nowrap' }}>
                [STATUS: SEEKING OPPORTUNITIES]
              </span>
              {/* Hover label, absolutely centred over the badge */}
              <span style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: statusHover ? 1 : 0,
                transition: 'opacity 0.15s',
                whiteSpace: 'nowrap',
              }}>
                [click to email]
              </span>
            </a>
            <span style={{ border: '1px solid var(--badge-border)', color: 'var(--badge-text)' }} className="px-1.5 py-0.5 hidden sm:inline">
              [VANCOUVER, BC]
            </span>
            {/* Mobile: compact badge */}
            <a
              href="mailto:kevin.shangkun.li@gmail.com"
              style={{ border: '1px solid var(--badge-border)', color: 'var(--badge-text)', textDecoration: 'none' }}
              className="px-1.5 py-0.5 inline sm:hidden"
            >
              [OPEN TO WORK]
            </a>
          </div>
        </div>

        {/* Row 2: audio strip and theme toggle controls for playback, station selection, and theme cycling. */}
        <div style={{ background: 'var(--bg-subtle)' }}
          className="flex flex-wrap items-center gap-2 px-5 py-2 text-[11px] transition-colors duration-200">
          <span style={{ color: 'var(--fg-dim)' }} className="mr-1 hidden sm:inline">AUDIO</span>

          <HBtn onClick={() => btn(audio.togglePlay)}>
            {audio.playing ? <Pause size={9} /> : <Play size={9} />}
            <span>{audio.playing ? 'PAUSE' : 'PLAY'}</span>
          </HBtn>

          <span style={{ color: 'var(--border)' }} className="hidden sm:inline">|</span>
          <span style={{ color: 'var(--fg-muted)' }} className="hidden sm:inline">STATION:</span>

          <HBtn active={audio.station === 'lofi'} onClick={() => btn(() => audio.selectStation('lofi'))}>
            LOFI
          </HBtn>
          <HBtn active={audio.station === 'rain'} onClick={() => btn(() => audio.selectStation('rain'))}>
            RAIN
          </HBtn>

          <span style={{ color: 'var(--border)' }} className="hidden sm:inline">|</span>
          <HBtn active={audio.keyclick} onClick={() => { audio.click(); audio.setKeyclick(k => !k) }}
            title="Toggle key-click sound">
            <Keyboard size={9} />
            <span className="hidden sm:inline">KEY-CLICK {audio.keyclick ? 'ON' : 'OFF'}</span>
          </HBtn>

          <span style={{ color: 'var(--border)' }} className="hidden sm:inline">|</span>
          <HBtn onClick={() => btn(cycleTheme)} title="Toggle theme">
            <ThemeIcon size={9} />
            <span className="hidden sm:inline">THEME: {theme.toUpperCase()}</span>
          </HBtn>
        </div>
      </header>

      {/* ═════════════════ PAGE CONTENT ══════════════════════════════════ */}
      <main
        className="max-w-2xl mx-auto px-5 pt-10"
        style={{ paddingTop: headerH + 24, paddingBottom: 100, position: 'relative', zIndex: 2 }}
      >

          {/* ── HERO ──────────────────────────────────────────────────────── */}
          <section>
            <div style={{ color: 'var(--border)' }} className="text-[11px] select-none whitespace-pre font-mono leading-none overflow-hidden">
              {`+${'─'.repeat(58)}+`}
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}
              className="px-5 py-6">
              <h1 className="text-4xl font-black tracking-tight leading-none mb-2" style={{ color: 'var(--fg)' }}>
                Kevin Li
              </h1>
              <p className="text-sm mb-5 leading-snug" style={{ color: 'var(--fg-muted)' }}>
                Computer Engineering Student @ The University of British Columbia
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-x-5 gap-y-1.5 text-xs mb-6"
                style={{ color: 'var(--fg-muted)' }}>
                <a href="https://github.com/kevinli808" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 underline underline-offset-2"
                  style={{ color: 'var(--fg-muted)' }}>
                  <GitBranch size={11} className="shrink-0" />github.com/kevinli808
                </a>
                <a href="https://www.linkedin.com/in/kevinli-kl/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 underline underline-offset-2"
                  style={{ color: 'var(--fg-muted)' }}>
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                    <rect width="4" height="12" x="2" y="9"/>
                    <circle cx="4" cy="4" r="2"/>
                  </svg>
                  linkedin.com/in/kevinli-kl
                </a>
                <span className="hidden sm:flex items-center gap-1.5"><MapPin size={11} className="shrink-0" />Vancouver, BC</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => btn(copy)}
                  style={{ border: '1px solid var(--fg)', color: 'var(--fg)' }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-150 hover:opacity-75">
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'COPIED TO CLIPBOARD' : '[Copy Contact]'}
                </button>
                <a href="/resume.pdf" target="_blank" rel="noopener noreferrer"
                  onClick={() => audio.click()}
                  style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs hover:opacity-75">
                  <Download size={11} />[Download PDF]
                </a>
              </div>
            </div>
            <div style={{ color: 'var(--border)' }} className="text-[11px] select-none whitespace-pre font-mono leading-none overflow-hidden">
              {`+${'─'.repeat(58)}+`}
            </div>
          </section>

          <Rule />

          {/* ── EDUCATION ─────────────────────────────────────────────────── */}
          <section id="education">
            <Prompt cmd="cat 01_education.txt" />
            <div className="flex items-start gap-3 mb-1">
              <GraduationCap size={14} style={{ color: 'var(--fg-dim)' }} className="mt-0.5 shrink-0" />
              <div className="flex-1 p-4 transition-all duration-150"
                style={{ border: '1px solid var(--border)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                  e.currentTarget.style.background = 'var(--hover-bg)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.background = ''
                }}>
                <div className="flex flex-wrap justify-between items-start gap-x-4 mb-1">
                  <span className="font-bold text-sm" style={{ color: 'var(--fg)' }}>The University of British Columbia</span>
                  <span className="text-[11px] shrink-0" style={{ color: 'var(--fg-muted)' }}>Vancouver, BC</span>
                </div>
                <div className="text-xs italic mb-1" style={{ color: 'var(--fg-muted)' }}>
                  Bachelor of Applied Science (Engineering) in Computer Engineering
                </div>
                <div className="text-[11px]" style={{ color: 'var(--fg-dim)' }}>Sept 2025 – Present</div>
              </div>
            </div>
          </section>

          <Rule />

          {/* ── EXPERIENCE ────────────────────────────────────────────────── */}
          <section id="experience">
            <Prompt cmd="cat 02_research_and_experience.txt" />
            <div className="flex items-start gap-3">
              <Briefcase size={14} style={{ color: 'var(--fg-dim)' }} className="mt-1 shrink-0" />
              <div className="flex-1">
                <ExpEntry org="UBC Sustaingineering" role="Software Developer (Software & Electrical Team)" period="Sept 2025 – Present"
                  bullets={[
                    'Incorporating sensors into the Sustainable Mobile Research Testbed (SMRT) Project.',
                    'Programming a Remote Monitoring System (RMS) to collect and process operational data.',
                  ]} />
                <ExpEntry org="UBC-V Senate" role="Applied Science Student Senator" period="Apr 2026 – Present"
                  bullets={[
                    "Representing 7,000+ undergraduate students on UBC's highest academic governing body.",
                    "Interfacing with the EUS, Nursing Undergraduate Society (NUS), and Planning Students' Association (PSA).",
                  ]} />
                <ExpEntry org="UBC ECE – Dependable Systems Lab" role="Research Intern" period="May 2026 – July 2026"
                  bullets={['Integrating cybersecurity applications into system frameworks.']} />
                <ExpEntry org="UBC Engineering Undergraduate Society (EUS)" role="Vice-President First Year Council" period="Oct 2025 – Apr 2026"
                  bullets={[
                    'Managed EWeek and special projects for over 1,200 first-year engineering students.',
                    'Collaborated across undergraduate societies for faculty-wide integration.',
                  ]} />
                <ExpEntry org="Dept. of National Defence – Vernon Cadet Training Centre" role="Professional Development Staff Cadet" period="Summer 2024"
                  bullets={['Formulated instructional standards and provided guidance to staff cadets.']} />
              </div>
            </div>
          </section>

          <Rule />

          {/* ── PROJECTS ──────────────────────────────────────────────────── */}
          <section id="projects">
            <Prompt cmd="cat 03_personal_projects.txt" />
            <div className="flex items-start gap-3">
              <Folder size={14} style={{ color: 'var(--fg-dim)' }} className="mt-1 shrink-0" />
              <div className="flex-1">
                <ProjEntry name="Auto-Score: The Future of Scorekeeping" sub="Computer vision scoreboard"
                  tech={['C++', 'Python', 'OpenCV', 'ESP32-CAM', 'Arduino']}
                  bullets={[
                    'Semi-automatic scoreboard for lower-level volleyball scorekeeping.',
                    'Utilizes OpenCV computer vision on an ESP32-CAM module to recognize and react to live in-game events.',
                  ]} />
                <ProjEntry name="5×5×5 LED Cube" sub="3D spatial display"
                  tech={['C++', 'Arduino', 'Accelerometer', 'Gyroscope', 'Magnetometer']}
                  bullets={[
                    '3D spatial display device programmed with full 3D positional awareness.',
                    'Developing an interactive 3D platform game engine taking advantage of physical orientation.',
                  ]} />
                <ProjEntry name="Desk Tamagotchi" sub="Interactive desktop toy state machine"
                  tech={['C++', 'Arduino', '8×8 Dot Matrix', 'Temp/Humidity Sensors']}
                  bullets={[
                    'Interactive desktop toy featuring 4 distinct active states.',
                    'Modes: Firework animation, gravity simulator, driving game, and Tamagotchi pet mode.',
                  ]} />
              </div>
            </div>
          </section>

          <Rule />

          {/* ── FOOTER ────────────────────────────────────────────────────── */}
          <footer className="text-center text-[11px] space-y-1 pb-2" style={{ color: 'var(--fg-dim)' }}>
            <div className="select-none">{`+${'─'.repeat(30)}+`}</div>
            <div>
              <span style={{ color: 'var(--fg-muted)' }}>kevin@ubc:~ $ </span>
              <span style={{ background: 'var(--cursor-color)' }}
                className="inline-block w-[7px] h-[12px] cursor-blink align-middle" aria-hidden />
            </div>
            <div className="tracking-[0.3em] uppercase text-[10px]">EOF</div>
          </footer>
        </main>

      {/* ══ FIXED BOTTOM TERMINAL ═══════════════════════════════════════════ */}
      <Terminal
        headerHeight={headerH}
        theme={theme}
        onTheme={t => { audio.click(); applyTheme(t) }}
        audioPlaying={audio.playing}
        onAudioToggle={() => { audio.click(); audio.togglePlay() }}
        onMatrixToggle={() => { audio.click(); setMatrixRain(r => !r) }}
        onKeyClick={audio.click}
      />
    </div>
  )
}
