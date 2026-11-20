// The trader's listing assistant. One short note ("2 quintals of teff at 4 800
// birr, fresh from Bale") comes back as a filled-in product form, so a trader
// can put today's price on the board in a few seconds.
//
// The model call goes through the Respan hosted gateway: an OpenAI-compatible
// endpoint at https://api.respan.ai/api that authenticates with RESPAN_API_KEY
// and logs every request under Gateway › Logs. The Worker never holds a
// provider key, and without RESPAN_API_KEY the route simply reports that the
// assistant is off while the rest of the board keeps working.

import {
  CATEGORIES,
  PRODUCTS,
  STOCKS,
  UNITS,
  type Category,
  type ProductInput,
  type Stock,
} from '../lib/catalogue'
import type { Env } from './store'

const DEFAULT_BASE_URL = 'https://api.respan.ai/api'
const MODEL = 'gpt-5.5'
const TIMEOUT_MS = 20_000

const SYSTEM_PROMPT = `You turn one short note from an Ethiopian market trader into a single product listing for Asbeza, a shared fruit and vegetable price board.

Reply with JSON only, no prose and no code fences:
{"name": string, "emoji": string, "category": string, "unit": string, "price": number, "stock": string, "note": string}

Rules:
- name: 2-60 characters, keep the Amharic name when the trader writes one, e.g. "Teff ጤፍ".
- category: exactly one of ${CATEGORIES.join(', ')}.
- unit: exactly one of ${UNITS.join(', ')}.
- price: a plain number in Ethiopian birr for one unit, no currency symbol and no thousands separators.
- stock: exactly one of ${STOCKS.join(', ')} ("in", "low", "out").
- emoji: one emoji for the product.
- note: at most 6 words, such as "fresh from Bale".
If the note does not mention a price, use 0.`

export type Draft = { value: ProductInput } | { error: string; status: 503 | 502 }

function gatewayUrl(env: Env) {
  return (env.RESPAN_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

/** The listing assistant needs the server-side Respan key and nothing else. */
export function assistantReady(env: Env) {
  return Boolean(env.RESPAN_API_KEY?.trim())
}

function readJson(content: string): Record<string, unknown> | null {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(content.slice(start, end + 1))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function pickCategory(raw: unknown, fallback?: Category): Category {
  const wanted = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return CATEGORIES.find((category) => category.toLowerCase() === wanted) ?? fallback ?? 'Vegetable'
}

function pickUnit(raw: unknown, fallback: string): string {
  const wanted = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return UNITS.find((unit) => unit.toLowerCase() === wanted) ?? fallback
}

function pickStock(raw: unknown): Stock {
  const wanted = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return STOCKS.find((stock) => stock === wanted) ?? 'in'
}

function pickEmoji(raw: unknown, fallback: string) {
  const wanted = Array.from(typeof raw === 'string' ? raw.trim() : '').slice(0, 2).join('')
  return wanted || fallback
}

/** Reads whatever the model wrote back into the shape the product form needs. */
export function toDraft(raw: Record<string, unknown>): ProductInput | null {
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : ''
  if (name.length < 2) return null

  const price = typeof raw.price === 'number' ? raw.price : Number.parseFloat(String(raw.price ?? ''))
  if (!Number.isFinite(price) || price < 0) return null

  const known = PRODUCTS.find((item) => {
    const label = item.name.toLowerCase()
    return label === name.toLowerCase() || label.startsWith(`${name.toLowerCase()} `)
  })

  return {
    name,
    emoji: pickEmoji(raw.emoji, known?.emoji ?? '🥬'),
    category: pickCategory(raw.category, known?.category as Category | undefined),
    unit: pickUnit(raw.unit, known?.unit ?? 'kg'),
    price: Math.min(Math.round(price * 100) / 100, 1_000_000),
    stock: pickStock(raw.stock),
    note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 48) : '',
  }
}

/**
 * One chat completion against the Respan gateway. The returned draft has
 * already been checked against the board's categories, units and stock states.
 */
export async function draftListing(env: Env, note: string): Promise<Draft> {
  const apiKey = env.RESPAN_API_KEY?.trim()
  if (!apiKey) {
    return { error: 'The listing assistant is not switched on for this board yet.', status: 503 }
  }

  let response: Response
  try {
    response = await fetch(`${gatewayUrl(env)}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: note },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return { error: 'The listing assistant could not reach the model. Try again in a moment.', status: 502 }
  }

  if (!response.ok) {
    return { error: `The listing assistant is unavailable right now (${response.status}).`, status: 502 }
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: unknown } }>
  } | null
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    return { error: 'The listing assistant sent back nothing readable.', status: 502 }
  }

  const draft = toDraft(readJson(content) ?? {})
  if (!draft) {
    return { error: 'The listing assistant could not read a product and price from that note.', status: 502 }
  }
  return { value: draft }
}
