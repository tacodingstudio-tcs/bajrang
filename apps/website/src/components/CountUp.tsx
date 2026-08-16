import { useEffect, useRef, useState } from 'react'
import { useInView, animate } from 'framer-motion'

/**
 * Animates a number counting up from 0 the first time it scrolls into view.
 * `value` may include a non-numeric suffix (e.g. "24+", "4.6", "24/7") —
 * only the leading numeric part animates, the rest renders as static text.
 */
export function CountUp({ value, duration = 1.4 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const match = value.match(/^(\d+(?:\.\d+)?)(.*)$/)
  const target = match ? parseFloat(match[1]!) : null
  const suffix = match ? match[2]! : ''
  const decimals = match?.[1]?.includes('.') ? match[1]!.split('.')[1]!.length : 0
  const [display, setDisplay] = useState(target === null ? value : '0')

  useEffect(() => {
    if (!inView || target === null) return
    const controls = animate(0, target, {
      duration,
      ease: 'easeOut',
      onUpdate: v => setDisplay(v.toFixed(decimals)),
    })
    return () => controls.stop()
  }, [inView, target, duration, decimals])

  return <span ref={ref}>{display}{suffix}</span>
}
