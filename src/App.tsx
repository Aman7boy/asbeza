import { useEffect } from 'react'

import { Admin } from './sections/Admin'
import { Board } from './sections/Board'
import { Trader } from './sections/Trader'
import { usePath } from './lib/router'

function visitorId() {
  const key = 'asbeza:visitor'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function describeTarget(element: Element | null) {
  if (!element) return 'unknown'
  const tag = element.tagName.toLowerCase()
  const id = element.id ? `#${element.id}` : ''
  const classes = [...element.classList].slice(0, 3).join('.')
  const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  return `${tag}${id}${classes ? `.${classes}` : ''}${text ? `: ${text}` : ''}`
}

// Three views: the public board, the trader dashboard and the admin console.
export function App() {
  const path = usePath()

  useEffect(() => {
    let lastSent = 0
    const id = visitorId()

    function onClick(event: MouseEvent) {
      const now = Date.now()
      if (now - lastSent < 75) return
      lastSent = now

      const token = (() => {
        try {
          return localStorage.getItem('asbeza:token')
        } catch {
          return null
        }
      })()

      void fetch('/api/clicks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          visitorId: id,
          path: window.location.pathname,
          target: describeTarget(event.target instanceof Element ? event.target : null),
          x: event.clientX,
          y: event.clientY,
        }),
        keepalive: true,
      }).catch(() => undefined)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  if (path.startsWith('/admin')) return <Admin />
  return path.startsWith('/trader') ? <Trader /> : <Board />
}
