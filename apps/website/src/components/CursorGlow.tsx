import { useEffect } from 'react'
import { m, useMotionValue, useSpring } from 'framer-motion'

/** A soft gold glow that follows the cursor, only visible over elements
 * tagged `data-glow` (dark hero/quote sections) — a subtle "alive" touch
 * rather than a gimmick that fights the page everywhere. */
export function CursorGlow() {
  const x = useMotionValue(-200)
  const y = useMotionValue(-200)
  const springX = useSpring(x, { stiffness: 150, damping: 20, mass: 0.5 })
  const springY = useSpring(y, { stiffness: 150, damping: 20, mass: 0.5 })

  useEffect(() => {
    // Coarse pointers (touch) get no benefit from this — skip entirely.
    if (window.matchMedia('(pointer: coarse)').matches) return

    let active = false
    const onMove = (e: MouseEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      const el = document.elementFromPoint(e.clientX, e.clientY)
      active = !!el?.closest('[data-glow]')
    }
    const glow = document.getElementById('cursor-glow')
    const onFrame = () => {
      if (glow) glow.style.opacity = active ? '1' : '0'
      requestAnimationFrame(onFrame)
    }
    window.addEventListener('mousemove', onMove)
    const raf = requestAnimationFrame(onFrame)
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf) }
  }, [x, y])

  return (
    <m.div
      id="cursor-glow"
      className="pointer-events-none fixed top-0 left-0 z-40 w-[500px] h-[500px] rounded-full opacity-0 transition-opacity duration-300 hidden sm:block"
      style={{
        x: springX, y: springY,
        translateX: '-50%', translateY: '-50%',
        mixBlendMode: 'screen',
        background: 'radial-gradient(circle, rgba(233,196,120,0.55) 0%, rgba(193,150,67,0.28) 35%, transparent 68%)',
      }}
    />
  )
}
