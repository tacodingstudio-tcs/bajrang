import { useRef, type ReactNode } from 'react'
import { m, useMotionValue, useSpring, useTransform } from 'framer-motion'

/** Wraps its children in a subtle 3D tilt that follows the cursor —
 * a common "premium" interaction cue on hover, desktop only. */
export function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 250, damping: 22 })
  const sry = useSpring(ry, { stiffness: 250, damping: 22 })
  const scale = useMotionValue(1)
  const sScale = useSpring(scale, { stiffness: 250, damping: 22 })

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width  - 0.5
    const py = (e.clientY - rect.top)  / rect.height - 0.5
    ry.set(px * 10)
    rx.set(-py * 10)
  }
  function onEnter() { scale.set(1.02) }
  function onLeave() { rx.set(0); ry.set(0); scale.set(1) }

  return (
    <m.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ rotateX: srx, rotateY: sry, scale: sScale, transformPerspective: 800 }}
      className={className}
    >
      {children}
    </m.div>
  )
}
