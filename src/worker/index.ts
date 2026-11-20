import { Hono } from 'hono'
import type { Context } from 'hono'

import {
  CATEGORIES,
  CURRENCIES,
  PLANS,
  STOCKS,
  type PlanCode,
  normalisePhone,
  type Category,
  type Product,
  type ProductInput,
  type PublicShop,
  type Stock,
} from '../lib/catalogue'
import { draftListing } from './assistant'
import { checkPassword, hashPassword, loginKey, newSalt, sameSecret } from './auth'
import { getStore, type Env, type ShopPatch } from './store'

// The Worker in front of the site. /api/* serves the price board data and the
// trader accounts; anything else falls through to the built assets (SPA mode).
const app = new Hono<{ Bindings: Env }>()

const NO_STORE = { 'cache-control': 'no-store' }

function clientIp(c: Context<{ Bindings: Env }>) {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    null
  )
}

function isProduction(env: Env) {
  return env.ENVIRONMENT === 'production' || env.SEED_DEMO_DATA === 'false'
}

function demoMode(env: Env) {
  return !isProduction(env)
}

function body(c: Context<{ Bindings: Env }>) {
  return c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
}

type Result<T> = { value: T } | { error: string }

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

const isCurrency = (value: unknown) => CURRENCIES.some((option) => option.code === value)
const isPlan = (value: unknown) => PLANS.some((option) => option.code === value)

async function currentAdmin(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const header = c.req.header('authorization') ?? ''
  if (!header.toLowerCase().startsWith('bearer ')) return false
  const token = header.slice(7).trim()
  if (!token) return false
  return getStore(c.env).adminForToken(token)
}

const adminDeny = (c: Context<{ Bindings: Env }>) => c.json({ error: 'Admin sign in required.' }, 401, NO_STORE)

/* --------------------------------- auth ---------------------------------- */

type Credentials = { phone: string; password: string }

function readCredentials(input: Record<string, unknown>): Result<Credentials> {
  const phone = normalisePhone(text(input.phone, 24))
  const password = typeof input.password === 'string' ? input.password.slice(0, 128) : ''
  if (!phone) return { error: 'Enter your phone number.' }
  if (!password) return { error: 'Enter your password.' }
  return { value: { phone, password } }
}

type Signup = {
  name: string
  location: string
  houseNumber: string
  phone: string
  hours: string
  currency: string
  plan: PlanCode
  paymentMethod?: string
  paymentAccount?: string
  password: string
}

function readSignup(input: Record<string, unknown>): Result<Signup> {
  const name = text(input.name, 60)
  if (name.length < 2) return { error: 'Enter your shop name.' }

  const location = text(input.location, 90)
  if (location.length < 2) return { error: 'Enter your market or area.' }

  const houseNumber = text(input.houseNumber, 20)
  if (!houseNumber) return { error: 'Enter your house or shop number.' }

  const phone = normalisePhone(text(input.phone, 24))
  if (phone.length < 7 || phone.length > 15) return { error: 'Enter a phone number customers can call.' }

  const password = typeof input.password === 'string' ? input.password : ''
  if (password.length < 6) return { error: 'Use a password of at least 6 characters.' }

  return {
    value: {
      name,
      location,
      houseNumber,
      phone,
      password,
      hours: text(input.hours, 60) || 'Open daily, 6 am – 7 pm',
      currency: isCurrency(input.currency) ? String(input.currency) : 'ETB',
      plan: isPlan(input.plan) ? (String(input.plan) as PlanCode) : 'free',
      paymentMethod: text(input.paymentMethod, 40) || undefined,
      paymentAccount: text(input.paymentAccount, 80) || undefined,
    },
  }
}

async function currentShop(c: Context<{ Bindings: Env }>): Promise<PublicShop | null> {
  const header = c.req.header('authorization') ?? ''
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const token = header.slice(7).trim()
  if (!token) return null
  return getStore(c.env).shopForToken(token)
}

const deny = (c: Context<{ Bindings: Env }>) =>
  c.json({ error: 'Sign in to your trader account first.' }, 401, NO_STORE)

/* ------------------------------- products -------------------------------- */

function readPrice(value: unknown): number | null {
  const price = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return null
  return Math.round(price * 100) / 100
}

function readProduct(input: Record<string, unknown>): Result<ProductInput> {
  const name = text(input.name, 60)
  if (name.length < 2) return { error: 'Enter a product name.' }

  const category = CATEGORIES.includes(input.category as Category) ? (input.category as Category) : null
  if (!category) return { error: 'Pick a category.' }

  const price = readPrice(input.price)
  if (price === null) return { error: 'Enter a price of 0 or more.' }

  const unit = text(input.unit, 16) || 'kg'
  const stock = STOCKS.includes(input.stock as Stock) ? (input.stock as Stock) : 'in'
  const emoji = Array.from(text(input.emoji, 8)).slice(0, 2).join('') || '🥬'

  return { value: { name, category, unit, price, stock, emoji, note: text(input.note, 48) } }
}

function readPatch(input: Record<string, unknown>): Result<Partial<ProductInput>> {
  const patch: Partial<ProductInput> = {}

  if ('name' in input) {
    const name = text(input.name, 60)
    if (name.length < 2) return { error: 'Enter a product name.' }
    patch.name = name
  }
  if ('category' in input) {
    if (!CATEGORIES.includes(input.category as Category)) return { error: 'Unknown category.' }
    patch.category = input.category as Category
  }
  if ('price' in input) {
    const price = readPrice(input.price)
    if (price === null) return { error: 'Enter a price of 0 or more.' }
    patch.price = price
  }
  if ('unit' in input) {
    const unit = text(input.unit, 16)
    if (!unit) return { error: 'Pick a unit.' }
    patch.unit = unit
  }
  if ('stock' in input) {
    if (!STOCKS.includes(input.stock as Stock)) return { error: 'Unknown stock state.' }
    patch.stock = input.stock as Stock
  }
  if ('emoji' in input) {
    const emoji = Array.from(text(input.emoji, 8)).slice(0, 2).join('')
    if (emoji) patch.emoji = emoji
  }
  if ('note' in input) patch.note = text(input.note, 48)
  if ('deliveryAvailable' in input) patch.deliveryAvailable = Boolean(input.deliveryAvailable)
  if ('version' in input) {
    const version = Number(input.version)
    if (!Number.isInteger(version) || version < 1) return { error: 'That product changed. Refresh and try again.' }
    patch.version = version
  }

  if (Object.keys(patch).length === 0) return { error: 'Nothing to update.' }
  return { value: patch }
}

function readShopPatch(input: Record<string, unknown>): Result<ShopPatch> {
  const patch: ShopPatch = {}

  if ('name' in input) {
    const name = text(input.name, 60)
    if (name.length < 2) return { error: 'Enter your shop name.' }
    patch.name = name
  }
  if ('location' in input) {
    const location = text(input.location, 90)
    if (location.length < 2) return { error: 'Enter your market or area.' }
    patch.location = location
  }
  if ('houseNumber' in input) {
    const houseNumber = text(input.houseNumber, 20)
    if (!houseNumber) return { error: 'Enter your house or shop number.' }
    patch.houseNumber = houseNumber
  }
  if ('hours' in input) patch.hours = text(input.hours, 60)
  if ('currency' in input) {
    if (!isCurrency(input.currency)) return { error: 'Pick a supported currency.' }
    patch.currency = String(input.currency)
  }
  if ('plan' in input) {
    if (!isPlan(input.plan)) return { error: 'Pick a supported plan.' }
    patch.plan = String(input.plan) as PlanCode
  }
  if ('paymentMethod' in input) patch.paymentMethod = text(input.paymentMethod, 40)
  if ('paymentAccount' in input) patch.paymentAccount = text(input.paymentAccount, 80)

  if ('latitude' in input) {
    if (input.latitude === null) patch.latitude = null
    else {
      const latitude = typeof input.latitude === 'number' ? input.latitude : Number.parseFloat(String(input.latitude ?? ''))
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { error: 'Enter a valid latitude.' }
      patch.latitude = latitude
    }
  }
  if ('longitude' in input) {
    if (input.longitude === null) patch.longitude = null
    else {
      const longitude = typeof input.longitude === 'number' ? input.longitude : Number.parseFloat(String(input.longitude ?? ''))
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { error: 'Enter a valid longitude.' }
      patch.longitude = longitude
    }
  }
  if ('deliveryAvailable' in input) patch.deliveryAvailable = Boolean(input.deliveryAvailable)
  if ('deliveryRadiusKm' in input) {
    if (input.deliveryRadiusKm === null) patch.deliveryRadiusKm = null
    else {
      const value = typeof input.deliveryRadiusKm === 'number' ? input.deliveryRadiusKm : Number.parseFloat(String(input.deliveryRadiusKm ?? ''))
      if (!Number.isFinite(value) || value < 0 || value > 1000) return { error: 'Enter a valid delivery radius.' }
      patch.deliveryRadiusKm = value
    }
  }
  if ('deliveryFee' in input) {
    if (input.deliveryFee === null) patch.deliveryFee = null
    else {
      const value = typeof input.deliveryFee === 'number' ? input.deliveryFee : Number.parseFloat(String(input.deliveryFee ?? ''))
      if (!Number.isFinite(value) || value < 0) return { error: 'Enter a valid delivery fee.' }
      patch.deliveryFee = Math.round(value * 100) / 100
    }
  }
  if ('minOrderAmount' in input) {
    if (input.minOrderAmount === null) patch.minOrderAmount = null
    else {
      const value = typeof input.minOrderAmount === 'number' ? input.minOrderAmount : Number.parseFloat(String(input.minOrderAmount ?? ''))
      if (!Number.isFinite(value) || value < 0) return { error: 'Enter a valid minimum order.' }
      patch.minOrderAmount = Math.round(value * 100) / 100
    }
  }
  if ('deliveryNotes' in input) patch.deliveryNotes = text(input.deliveryNotes, 160)
  if ('version' in input) {
    const version = Number(input.version)
    if (!Number.isInteger(version) || version < 1) return { error: 'That shop changed. Refresh and try again.' }
    patch.version = version
  }

  if (Object.keys(patch).length === 0) return { error: 'Nothing to update.' }
  return { value: patch }
}

/* -------------------------------- public --------------------------------- */

app.get('/api/catalogue', async (c) => {
  const store = getStore(c.env)
  const [allShops, allListings] = await Promise.all([store.listShops(), store.listListings()])
  const shops = allShops.filter((shop) => !shop.suspended)
  const allowed = new Set(shops.map((shop) => shop.id))
  const listings = allListings.filter((listing) => allowed.has(listing.shopId))
  return c.json({ shops, listings }, 200, NO_STORE)
})

app.get('/api/health', (c) => c.json({ ok: true }, 200, NO_STORE))

/* ------------------------------ click tracking ---------------------------- */

app.post('/api/clicks', async (c) => {
  const input = await body(c)
  const path = text(input.path, 240) || '/'
  const target = text(input.target, 240) || 'unknown'
  const visitorId = text(input.visitorId, 80) || null
  const x = typeof input.x === 'number' && Number.isFinite(input.x) ? Math.round(input.x) : null
  const y = typeof input.y === 'number' && Number.isFinite(input.y) ? Math.round(input.y) : null
  const shop = await currentShop(c)
  const event = await getStore(c.env).recordClick({
    visitorId,
    userId: shop?.id ?? null,
    path,
    target,
    x,
    y,
    userAgent: c.req.header('user-agent') ?? null,
  })
  return c.json({ ok: true, id: event.id }, 201, NO_STORE)
})

/* --------------------------- listing assistant --------------------------- */

// Turns a trader's short note into a filled-in product form. The model call
// runs through the Respan gateway, so it needs RESPAN_API_KEY; without it the
// form keeps working and the trader types the fields themselves.
app.post('/api/assistant/listing', async (c) => {
  const shop = await currentShop(c)
  if (!shop) return deny(c)
  if (shop.suspended) return c.json({ error: 'Your account is suspended. Contact the platform admin.' }, 403, NO_STORE)
  const settings = await getStore(c.env).getSettings()
  if (settings.maintenanceMode) return c.json({ error: 'The platform is in maintenance mode.' }, 503, NO_STORE)

  const note = text((await body(c)).note, 400)
  if (note.length < 4) return c.json({ error: 'Write a few words about what you are selling.' }, 400, NO_STORE)

  const drafted = await draftListing(c.env, note)
  if ('error' in drafted) return c.json({ error: drafted.error }, drafted.status, NO_STORE)
  return c.json({ draft: drafted.value }, 200, NO_STORE)
})

/* --------------------------- trader accounts ----------------------------- */

app.post('/api/trader/signup', async (c) => {
  const store = getStore(c.env)
  const settings = await store.getSettings()
  if (!settings.signupEnabled) return c.json({ error: 'New trader accounts are currently disabled.' }, 403, NO_STORE)

  const parsed = readSignup(await body(c))
  if ('error' in parsed) return c.json({ error: parsed.error }, 400, NO_STORE)

  const { password, ...shop } = parsed.value

  if (await store.findShopByPhone(shop.phone)) {
    return c.json({ error: 'That phone number already has an account. Sign in instead.' }, 409, NO_STORE)
  }

  const salt = newSalt()
  let created: PublicShop
  try {
    created = await store.createShop({ ...shop, passwordHash: await hashPassword(password, salt), salt })
  } catch {
    // D1 raises a unique-constraint error if two signups race on one phone.
    return c.json({ error: 'That phone number already has an account. Sign in instead.' }, 409, NO_STORE)
  }

  const ip = clientIp(c)
  const userAgent = c.req.header('user-agent') ?? null
  if (await store.countRecentLoginFailures(shop.phone, ip, 15 * 60 * 1000) >= 10) {
    return c.json({ error: 'Too many attempts. Try again later.' }, 429, NO_STORE)
  }
  const token = await store.createSession(created.id, { ip, userAgent })
  return c.json({ token, shop: created }, 201, NO_STORE)
})

app.post('/api/trader/login', async (c) => {
  const parsed = readCredentials(await body(c))
  if ('error' in parsed) return c.json({ error: parsed.error }, 400, NO_STORE)

  const store = getStore(c.env)
  const ip = clientIp(c)
  const userAgent = c.req.header('user-agent') ?? null
  const key = loginKey(parsed.value.phone)
  if (await store.countRecentLoginFailures(key, ip, 15 * 60 * 1000) >= 5) {
    return c.json({ error: 'Too many attempts. Try again later.' }, 429, NO_STORE)
  }
  const record = await store.findShopByPhone(key)
  if (!record || !(await checkPassword(parsed.value.password, record))) {
    await store.recordLoginAttempt(key, ip, false)
    return c.json({ error: 'Phone number or password is not right.' }, 401, NO_STORE)
  }
  await store.recordLoginAttempt(key, ip, true)

  const token = await store.createSession(record.id, { ip, userAgent })
  return c.json(
    {
      token,
      shop: {
        id: record.id,
        name: record.name,
        location: record.location,
        houseNumber: record.houseNumber,
        phone: record.phone,
        hours: record.hours,
        currency: record.currency,
        plan: ((record.plan as PlanCode) ?? 'free') as PlanCode,
        paymentMethod: record.paymentMethod,
        paymentAccount: record.paymentAccount,
      },
    },
    200,
    NO_STORE,
  )
})

app.get('/api/trader/me', async (c) => {
  const shop = await currentShop(c)
  if (!shop) return deny(c)
  const products = await getStore(c.env).listProducts(shop.id)
  return c.json({ shop, products }, 200, NO_STORE)
})

app.post('/api/trader/logout', async (c) => {
  const header = c.req.header('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (token) await getStore(c.env).deleteSession(token)
  return c.json({ ok: true }, 200, NO_STORE)
})

app.patch('/api/trader/shop', async (c) => {
  const shop = await currentShop(c)
  if (!shop) return deny(c)
  if (shop.suspended) return c.json({ error: 'Your account is suspended. Contact the platform admin.' }, 403, NO_STORE)
  const settings = await getStore(c.env).getSettings()
  if (settings.maintenanceMode) return c.json({ error: 'The platform is in maintenance mode.' }, 503, NO_STORE)
  const parsed = readShopPatch(await body(c))
  if ('error' in parsed) return c.json({ error: parsed.error }, 400, NO_STORE)
  let saved: PublicShop | null
  try {
    saved = await getStore(c.env).saveShop(shop.id, parsed.value)
  } catch (error) {
    if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
      return c.json({ error: 'This shop changed in another session. Refresh and try again.' }, 409, NO_STORE)
    }
    throw error
  }
  if (!saved) return c.json({ error: 'That shop is gone.' }, 404, NO_STORE)
  return c.json({ shop: saved }, 200, NO_STORE)
})

/* ------------------------------- products -------------------------------- */

app.post('/api/products', async (c) => {
  const shop = await currentShop(c)
  if (!shop) return deny(c)
  if (shop.suspended) return c.json({ error: 'Your account is suspended. Contact the platform admin.' }, 403, NO_STORE)
  const settings = await getStore(c.env).getSettings()
  if (settings.maintenanceMode) return c.json({ error: 'The platform is in maintenance mode.' }, 503, NO_STORE)
  const parsed = readProduct(await body(c))
  if ('error' in parsed) return c.json({ error: parsed.error }, 400, NO_STORE)
  const product = await getStore(c.env).createProduct(shop.id, parsed.value)
  return c.json({ product }, 201, NO_STORE)
})

app.patch('/api/products/:id', async (c) => {
  const shop = await currentShop(c)
  if (!shop) return deny(c)
  if (shop.suspended) return c.json({ error: 'Your account is suspended. Contact the platform admin.' }, 403, NO_STORE)
  const settings = await getStore(c.env).getSettings()
  if (settings.maintenanceMode) return c.json({ error: 'The platform is in maintenance mode.' }, 503, NO_STORE)
  const parsed = readPatch(await body(c))
  if ('error' in parsed) return c.json({ error: parsed.error }, 400, NO_STORE)
  let product: Product | null
  try {
    product = await getStore(c.env).updateProduct(shop.id, c.req.param('id'), parsed.value)
  } catch (error) {
    if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
      return c.json({ error: 'This product changed in another session. Refresh and try again.' }, 409, NO_STORE)
    }
    throw error
  }
  if (!product) return c.json({ error: 'That product is not on your board.' }, 404, NO_STORE)
  return c.json({ product }, 200, NO_STORE)
})

app.delete('/api/products/:id', async (c) => {
  const shop = await currentShop(c)
  if (!shop) return deny(c)
  if (shop.suspended) return c.json({ error: 'Your account is suspended. Contact the platform admin.' }, 403, NO_STORE)
  const settings = await getStore(c.env).getSettings()
  if (settings.maintenanceMode) return c.json({ error: 'The platform is in maintenance mode.' }, 503, NO_STORE)
  const removed = await getStore(c.env).deleteProduct(shop.id, c.req.param('id'))
  if (!removed) return c.json({ error: 'That product is not on your board.' }, 404, NO_STORE)
  return c.json({ ok: true }, 200, NO_STORE)
})

/* ------------------------------- admin ---------------------------------- */

app.post('/api/admin/login', async (c) => {
  const input = await body(c)
  const password = typeof input.password === 'string' ? input.password : ''
  const store = getStore(c.env)
  const ip = clientIp(c)
  const userAgent = c.req.header('user-agent') ?? null
  if (await store.countRecentLoginFailures('admin', ip, 15 * 60 * 1000) >= 5) {
    return c.json({ error: 'Too many attempts. Try again later.' }, 429, NO_STORE)
  }
  const expected = c.env.ADMIN_PASSWORD ?? (demoMode(c.env) ? 'asbeza-admin' : null)
  if (!expected) return c.json({ error: 'Admin password is not configured.' }, 503, NO_STORE)
  if (!sameSecret(password, expected)) {
    await store.recordLoginAttempt('admin', ip, false)
    return c.json({ error: 'Wrong admin password.' }, 401, NO_STORE)
  }
  await store.recordLoginAttempt('admin', ip, true)
  const token = await store.createAdminSession({ ip, userAgent })
  return c.json({ token }, 200, NO_STORE)
})

app.post('/api/admin/logout', async (c) => {
  const header = c.req.header('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (token) await getStore(c.env).deleteAdminSession(token)
  return c.json({ ok: true }, 200, NO_STORE)
})

app.get('/api/admin/shops', async (c) => {
  if (!(await currentAdmin(c))) return adminDeny(c)
  const shops = await getStore(c.env).listAdminShops()
  return c.json({ shops }, 200, NO_STORE)
})

app.post('/api/admin/shops/:id/suspend', async (c) => {
  if (!(await currentAdmin(c))) return adminDeny(c)
  const input = await body(c)
  const suspended = input.suspended !== false
  const shop = await getStore(c.env).setShopSuspended(c.req.param('id'), suspended)
  if (!shop) return c.json({ error: 'Trader not found.' }, 404, NO_STORE)
  return c.json({ shop }, 200, NO_STORE)
})

app.post('/api/admin/shops/:id/payment', async (c) => {
  if (!(await currentAdmin(c))) return adminDeny(c)
  const shop = await getStore(c.env).markShopPaid(c.req.param('id'))
  if (!shop) return c.json({ error: 'Trader not found.' }, 404, NO_STORE)
  return c.json({ shop }, 200, NO_STORE)
})

app.delete('/api/admin/shops/:id', async (c) => {
  if (!(await currentAdmin(c))) return adminDeny(c)
  const removed = await getStore(c.env).deleteShop(c.req.param('id'))
  if (!removed) return c.json({ error: 'Trader not found.' }, 404, NO_STORE)
  return c.json({ ok: true }, 200, NO_STORE)
})

app.get('/api/admin/settings', async (c) => {
  if (!(await currentAdmin(c))) return adminDeny(c)
  const settings = await getStore(c.env).getSettings()
  return c.json({ settings }, 200, NO_STORE)
})

app.get('/api/admin/clicks', async (c) => {
  if (!(await currentAdmin(c))) return adminDeny(c)
  const events = await getStore(c.env).listClickEvents(500)
  return c.json({ events }, 200, NO_STORE)
})

app.patch('/api/admin/settings', async (c) => {
  if (!(await currentAdmin(c))) return adminDeny(c)
  const input = await body(c)
  const patch: { maintenanceMode?: boolean; signupEnabled?: boolean } = {}
  if (typeof input.maintenanceMode === 'boolean') patch.maintenanceMode = input.maintenanceMode
  if (typeof input.signupEnabled === 'boolean') patch.signupEnabled = input.signupEnabled
  const settings = await getStore(c.env).saveSettings(patch)
  return c.json({ settings }, 200, NO_STORE)
})

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
