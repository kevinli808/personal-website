import { useEffect, useRef } from 'react'

// Character glyph set used to create the green rain effect on the canvas.
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃ'

// MatrixRain renders a lightweight full-screen canvas overlay when the terminal command
// matrix has been toggled on.
export function MatrixRain({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    // When the effect is disabled, cancel the animation loop immediately so the invisible
    // canvas layer does not keep consuming CPU time.
    if (!active) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // The animation uses a grid-based drop model for a lightweight, stable effect.
    const fontSize = 13
    let cols = 0
    let drops: number[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      cols = Math.floor(canvas.width / fontSize)
      drops = Array.from({ length: cols }, () => Math.random() * -50)
    }
    resize()
    window.addEventListener('resize', resize)

    let frame = 0
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      frame++
      if (frame % 2 !== 0) return

      ctx.fillStyle = 'rgba(0, 17, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = `${fontSize}px "JetBrains Mono", monospace`

      drops.forEach((y, i) => {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        // bright head
        ctx.fillStyle = '#aaffaa'
        ctx.fillText(char, i * fontSize, y * fontSize)
        // re-draw slightly dimmer trail char
        ctx.fillStyle = '#00ff41'
        if (y > 1) ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * fontSize, (y - 1) * fontSize)

        if (y * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i] += 0.5
      })
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
        opacity: 0.18,
      }}
      aria-hidden
    />
  )
}
