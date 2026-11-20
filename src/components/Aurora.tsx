import { cx } from '../lib/cx'

// Slow-moving colour fields behind the board header and the sign-in page.
// Pure CSS; each blob is a blurred radial gradient on its own animation.
export function Aurora({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  return (
    <div aria-hidden className={cx('pointer-events-none absolute inset-0 overflow-hidden', className)} style={{ opacity: intensity }}>
      <div className="round absolute left-1/2 top-[-20%] h-[70%] w-[90%] -translate-x-1/2 animate-aurora-a rounded-full bg-[radial-gradient(closest-side,rgb(34_197_94/0.32),transparent)] blur-3xl" />
      <div className="round absolute left-[8%] top-[4%] h-[60%] w-[55%] animate-aurora-b rounded-full bg-[radial-gradient(closest-side,rgb(163_230_53/0.16),transparent)] blur-3xl" />
      <div className="round absolute right-[4%] top-[8%] h-[58%] w-[52%] animate-aurora-c rounded-full bg-[radial-gradient(closest-side,rgb(16_185_129/0.22),transparent)] blur-3xl" />
    </div>
  )
}
