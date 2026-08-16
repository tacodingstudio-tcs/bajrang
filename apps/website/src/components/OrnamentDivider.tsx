/** A hairline with a small rotated-diamond ornament at its centre — a
 * restrained heritage motif, used in place of a plain line wherever a
 * section needs a moment of visual punctuation. */
export function OrnamentDivider({ color = '#c19643' }: { color?: string }) {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      <span className="w-16 h-px" style={{ backgroundColor: color, opacity: 0.5 }} />
      <span className="w-2 h-2 rotate-45 border" style={{ borderColor: color }} />
      <span className="w-16 h-px" style={{ backgroundColor: color, opacity: 0.5 }} />
    </div>
  )
}
