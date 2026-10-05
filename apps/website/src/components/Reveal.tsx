import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Slides a section up (transform only — fading opacity tanks measured text contrast) into view the first time it crosses the viewport. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Trigger as soon as the element approaches the viewport (not only once
    // 15% of it is already inside) — a tall section could otherwise sit
    // rendered-but-invisible for a while during a fast scroll.
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${visible ? 'translate-y-0' : 'translate-y-3'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
