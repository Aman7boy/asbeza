import { brand } from '../content'
import { cx } from '../lib/cx'
import { linkTo } from '../lib/router'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        'depth relative grid size-8 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-surface-2 to-raised',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="url(#logo-g)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4ade80" />
            <stop offset="1" stopColor="#a3e635" />
          </linearGradient>
        </defs>
        <path d="M20 4c0 8-5.5 12-11 12" />
        <path d="M20 4c-8 0-13 4.5-13 11v5" />
      </svg>
    </span>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <a
      href="/"
      onClick={linkTo('/')}
      className={cx('inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-fg', className)}
    >
      <LogoMark />
      {brand.name}
    </a>
  )
}
