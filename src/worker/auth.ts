import type { ShopRecord } from '../lib/catalogue'
import { normalisePhone } from '../lib/catalogue'

// Password hashing and session tokens for trader accounts. Runs in the Worker
// using Web Crypto, which workerd and D1 deployments both provide.

const ITERATIONS = 100_000

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function newSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
}

export function newToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)).buffer)
}

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return toHex(bits)
}

/** Length-independent comparison, so a wrong password cannot be timed out. */
export function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return difference === 0
}

export async function checkPassword(password: string, record: ShopRecord) {
  return sameSecret(await hashPassword(password, record.salt), record.passwordHash)
}

/** Logins accept "+251 91 123 4567", "0911234567" or plain digits. */
export const loginKey = (phone: string) => normalisePhone(phone)
