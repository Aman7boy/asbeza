import { useEffect, useState } from 'react'

// Two views, so a tiny history-API router is enough — no dependency needed.

const clean = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function usePath() {
  const [path, setPath] = useState(() => clean(window.location.pathname))

  useEffect(() => {
    const onPop = () => setPath(clean(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return path
}

export function navigate(to: string) {
  const next = clean(to)
  if (clean(window.location.pathname) === next) return
  window.history.pushState({}, '', next)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'instant' })
}

/** Click handler for an in-app anchor: keeps modifier clicks working. */
export function linkTo(to: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
}
