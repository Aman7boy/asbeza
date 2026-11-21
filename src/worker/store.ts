import type { NewShopInput, Product, ProductInput, PublicShop, ShopRecord } from '../lib/catalogue'
import { round2 } from '../lib/catalogue'
import { hashPassword, newSalt, newToken } from './auth'
import { DEMO_PASSWORD, DEMO_TRADERS, SEEDED_AT } from './seed'

export type Env = {
  ASSETS: Fetcher
  /** Optional D1 database. Without it accounts live in memory and reset. */
  DB?: D1Database
  /** Server-side Respan key: routes the listing assistant through the gateway. */
  RESPAN_API_KEY?: string
  /** Optional admin password; defaults to a demo password only in development. */
  ADMIN_PASSWORD?: string
  /** Optional gateway base URL, for a Respan Enterprise endpoint. */
  RESPAN_BASE_URL?: string
  /** Set to "false" to disable demo traders/products. Defaults to enabled outside production. */
  SEED_DEMO_DATA?: string
  /** Set to "production" to disable development-only defaults. */
  ENVIRONMENT?: string
}

/** The shop details a trader can edit; the login phone and id stay put. */
export type ShopPatch = Partial<Omit<PublicShop, 'id' | 'phone'>>

export type AdminShop = PublicShop & {
  productCount: number
  createdAt: string
}

export type AppSettings = {
  maintenanceMode: boolean
  signupEnabled: boolean
}

export type ClickEvent = {
  id: string
  createdAt: string
  visitorId: string | null
  userId: string | null
  path: string
  target: string
  x: number | null
  y: number | null
  userAgent: string | null
}

type SessionRecord = {
  shopId?: string
  expiresAt: string
  ip: string | null
  userAgent: string | null
}

export type Store = {
  listShops(): Promise<PublicShop[]>
  listListings(): Promise<Product[]>

  findShopByPhone(phone: string): Promise<ShopRecord | null>
  createShop(input: NewShopInput): Promise<PublicShop>
  getShop(shopId: string): Promise<PublicShop | null>
  saveShop(shopId: string, patch: ShopPatch): Promise<PublicShop | null>

  createSession(shopId: string, metadata?: { ip?: string | null; userAgent?: string | null }): Promise<string>
  shopForToken(token: string): Promise<PublicShop | null>
  deleteSession(token: string): Promise<void>

  listProducts(shopId: string): Promise<Product[]>
  createProduct(shopId: string, input: ProductInput): Promise<Product>
  updateProduct(shopId: string, id: string, patch: Partial<ProductInput>): Promise<Product | null>
  deleteProduct(shopId: string, id: string): Promise<boolean>

  /* ------------------------------- admin ------------------------------- */
  createAdminSession(metadata?: { ip?: string | null; userAgent?: string | null }): Promise<string>
  adminForToken(token: string): Promise<boolean>
  deleteAdminSession(token: string): Promise<void>

  listAdminShops(): Promise<AdminShop[]>
  setShopSuspended(shopId: string, suspended: boolean): Promise<PublicShop | null>
  markShopPaid(shopId: string): Promise<PublicShop | null>
  deleteShop(shopId: string): Promise<boolean>

  getSettings(): Promise<AppSettings>
  saveSettings(patch: Partial<AppSettings>): Promise<AppSettings>

  /* ----------------------------- click tracking ---------------------------- */
  recordClick(input: {
    visitorId?: string | null
    userId?: string | null
    path: string
    target: string
    x?: number | null
    y?: number | null
    userAgent?: string | null
  }): Promise<ClickEvent>
  listClickEvents(limit?: number): Promise<ClickEvent[]>

  /* ----------------------------- auth security ---------------------------- */
  recordLoginAttempt(key: string, ip: string | null, success: boolean): Promise<void>
  countRecentLoginFailures(key: string, ip: string | null, windowMs: number): Promise<number>
}

export function getStore(env: Env): Store {
  return env.DB ? d1Store(env.DB, env) : memoryStore(env)
}

const now = () => new Date().toISOString()

function isProduction(env: Env) {
  return env.ENVIRONMENT === 'production' || env.SEED_DEMO_DATA === 'false'
}

function seedDemoData(env: Env) {
  if (env.SEED_DEMO_DATA === 'false') return false
  if (env.SEED_DEMO_DATA === 'true') return true
  return !isProduction(env)
}

function publicShop(record: ShopRecord): PublicShop {
  const plan = (record.plan as PublicShop['plan']) ?? 'free'
  const nowMs = Date.now()
  const due = record.nextPaymentDue ? Date.parse(record.nextPaymentDue) : null
  const overdue = plan !== 'free' && due !== null && !Number.isNaN(due) && due < nowMs
  const suspended = Boolean(record.suspended) || overdue
  const paymentStatus: PublicShop['paymentStatus'] =
    plan === 'free' ? 'paid' : overdue ? 'overdue' : (record.paymentStatus ?? 'paid')
  return {
    id: record.id,
    version: record.version ?? 1,
    name: record.name,
    location: record.location,
    houseNumber: record.houseNumber,
    phone: record.phone,
    hours: record.hours,
    currency: record.currency,
    plan,
    suspended,
    paymentStatus,
    paymentMethod: record.paymentMethod,
    paymentAccount: record.paymentAccount,
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
    deliveryAvailable: record.deliveryAvailable ?? true,
    deliveryRadiusKm: record.deliveryRadiusKm ?? 5,
    deliveryFee: record.deliveryFee ?? 0,
    minOrderAmount: record.minOrderAmount ?? 0,
    deliveryNotes: record.deliveryNotes ?? '',
    locationSource: record.locationSource ?? 'manual',
    locationUpdatedAt: record.locationUpdatedAt ?? null,
    lastPaymentAt: record.lastPaymentAt ?? null,
    nextPaymentDue: record.nextPaymentDue ?? (plan === 'free' ? null : new Date(nowMs + 30 * 86400000).toISOString()),
  }
}

/* ------------------------------------------------------------------------- *
 * In-memory store
 * ------------------------------------------------------------------------- */

type Memory = {
  shops: ShopRecord[]
  products: Product[]
  sessions: Map<string, SessionRecord>
  adminSessions: Map<string, SessionRecord>
  settings: { maintenanceMode: boolean; signupEnabled: boolean }
  clicks: ClickEvent[]
  loginAttempts: { id: string; key: string; ip: string | null; createdAt: string; success: boolean }[]
}

let memory: Promise<Memory> | undefined

async function seedMemory(env: Env): Promise<Memory> {
  const shops: ShopRecord[] = []
  const products: Product[] = []
  if (seedDemoData(env)) {
    for (const trader of DEMO_TRADERS) {
      const salt = newSalt()
      shops.push({
        id: trader.id,
        version: 1,
        name: trader.name,
        location: trader.location,
        latitude: trader.latitude ?? null,
        longitude: trader.longitude ?? null,
        houseNumber: trader.houseNumber,
        phone: trader.phone,
        hours: trader.hours,
        currency: trader.currency,
        paymentMethod: trader.paymentMethod,
        paymentAccount: trader.paymentAccount,
        deliveryAvailable: true,
        deliveryRadiusKm: 5,
        deliveryFee: 0,
        minOrderAmount: 0,
        deliveryNotes: '',
        locationSource: 'seed',
        locationUpdatedAt: SEEDED_AT,
        passwordHash: await hashPassword(DEMO_PASSWORD, salt),
        salt,
        createdAt: SEEDED_AT,
      })
      for (const listing of trader.listings) {
        products.push({
          ...listing,
          version: 1,
          shopId: trader.id,
          updatedAt: SEEDED_AT,
          deliveryAvailable: true,
        })
      }
    }
  }
  return {
    shops,
    products,
    sessions: new Map(),
    adminSessions: new Map(),
    settings: { maintenanceMode: false, signupEnabled: true },
    clicks: [],
    loginAttempts: [],
  }
}

function memoryState(env: Env) {
  memory ??= seedMemory(env)
  return memory
}

function memoryStore(env: Env): Store {
  return {
    async listShops() {
      const state = await memoryState(env)
      return [...state.shops].sort((a, b) => a.name.localeCompare(b.name)).map(publicShop)
    },

    async listListings() {
      const state = await memoryState(env)
      return state.products.map((product) => ({ ...product }))
    },

    async findShopByPhone(phone) {
      const state = await memoryState(env)
      const found = state.shops.find((shop) => shop.phone === phone)
      return found ? { ...found } : null
    },

    async createShop(input) {
      const state = await memoryState(env)
      if (state.shops.some((shop) => shop.phone === input.phone)) throw new Error('DUPLICATE_PHONE')
      const plan = (input.plan ?? 'free') as PublicShop['plan']
      const shop: ShopRecord = {
        ...input,
        version: 1,
        plan,
        suspended: false,
        paymentStatus: plan === 'free' ? 'paid' : 'paid',
        lastPaymentAt: plan === 'free' ? null : now(),
        nextPaymentDue: plan === 'free' ? null : new Date(Date.now() + 30 * 86400000).toISOString(),
        id: crypto.randomUUID(),
        createdAt: now(),
        deliveryAvailable: input.deliveryAvailable ?? true,
        deliveryRadiusKm: input.deliveryRadiusKm ?? 5,
        deliveryFee: input.deliveryFee ?? 0,
        minOrderAmount: input.minOrderAmount ?? 0,
        deliveryNotes: input.deliveryNotes ?? '',
        locationSource: input.locationSource ?? 'signup',
        locationUpdatedAt: input.latitude != null || input.longitude != null ? now() : null,
      }
      state.shops.push(shop)
      return publicShop(shop)
    },

    async getShop(shopId) {
      const state = await memoryState(env)
      const found = state.shops.find((shop) => shop.id === shopId)
      return found ? publicShop(found) : null
    },

    async saveShop(shopId, patch) {
      const state = await memoryState(env)
      const found = state.shops.find((shop) => shop.id === shopId)
      if (!found) return null
      const expectedVersion = typeof patch.version === 'number' ? patch.version : undefined
      if (expectedVersion !== undefined && (found.version ?? 1) !== expectedVersion) throw new Error('VERSION_CONFLICT')
      const { version: _ignored, ...data } = patch
      Object.assign(found, data)
      if ('latitude' in patch || 'longitude' in patch) {
        found.locationUpdatedAt = now()
        found.locationSource = 'manual'
      }
      found.version = (found.version ?? 1) + 1
      return publicShop(found)
    },

    async createSession(shopId, metadata) {
      const state = await memoryState(env)
      const token = newToken()
      state.sessions.set(token, {
        shopId,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        ip: metadata?.ip ?? null,
        userAgent: metadata?.userAgent ?? null,
      })
      return token
    },

    async shopForToken(token) {
      const state = await memoryState(env)
      const session = state.sessions.get(token)
      if (!session?.shopId) return null
      if (Date.parse(session.expiresAt) <= Date.now()) {
        state.sessions.delete(token)
        return null
      }
      const found = state.shops.find((shop) => shop.id === session.shopId)
      return found ? publicShop(found) : null
    },

    async deleteSession(token) {
      const state = await memoryState(env)
      state.sessions.delete(token)
    },

    async listProducts(shopId) {
      const state = await memoryState(env)
      return state.products.filter((product) => product.shopId === shopId).map((product) => ({ ...product }))
    },

    async createProduct(shopId, input) {
      const state = await memoryState(env)
      const product: Product = {
        ...input,
        version: 1,
        shopId,
        price: round2(input.price),
        id: crypto.randomUUID(),
        previousPrice: null,
        updatedAt: now(),
        deliveryAvailable: input.deliveryAvailable ?? true,
      }
      state.products.push(product)
      return { ...product }
    },

    async updateProduct(shopId, id, patch) {
      const state = await memoryState(env)
      const index = state.products.findIndex((product) => product.id === id && product.shopId === shopId)
      if (index === -1) return null
      const current = state.products[index]
      const expectedVersion = typeof patch.version === 'number' ? patch.version : undefined
      if (expectedVersion !== undefined && (current.version ?? 1) !== expectedVersion) throw new Error('VERSION_CONFLICT')
      const { version: _ignored, ...dataPatch } = patch
      const price = dataPatch.price === undefined ? current.price : round2(dataPatch.price)
      const product: Product = {
        ...current,
        ...dataPatch,
        version: (current.version ?? 1) + 1,
        shopId,
        price,
        previousPrice: price !== current.price ? current.price : current.previousPrice,
        updatedAt: now(),
      }
      state.products[index] = product
      return { ...product }
    },

    async deleteProduct(shopId, id) {
      const state = await memoryState(env)
      const index = state.products.findIndex((product) => product.id === id && product.shopId === shopId)
      if (index === -1) return false
      state.products.splice(index, 1)
      return true
    },

    async createAdminSession(metadata) {
      const state = await memoryState(env)
      const token = newToken()
      state.adminSessions.set(token, {
        expiresAt: new Date(Date.now() + 12 * 3600000).toISOString(),
        ip: metadata?.ip ?? null,
        userAgent: metadata?.userAgent ?? null,
      })
      return token
    },
    async adminForToken(token) {
      const state = await memoryState(env)
      const session = state.adminSessions.get(token)
      if (!session) return false
      if (Date.parse(session.expiresAt) <= Date.now()) {
        state.adminSessions.delete(token)
        return false
      }
      return true
    },
    async deleteAdminSession(token) {
      const state = await memoryState(env)
      state.adminSessions.delete(token)
    },
    async listAdminShops() {
      const state = await memoryState(env)
      return [...state.shops]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((shop) => ({
          ...publicShop(shop),
          productCount: state.products.filter((product) => product.shopId === shop.id).length,
          createdAt: shop.createdAt,
        }))
    },
    async setShopSuspended(shopId, suspended) {
      const state = await memoryState(env)
      const found = state.shops.find((shop) => shop.id === shopId)
      if (!found) return null
      found.suspended = suspended
      found.version = (found.version ?? 1) + 1
      return publicShop(found)
    },
    async markShopPaid(shopId) {
      const state = await memoryState(env)
      const found = state.shops.find((shop) => shop.id === shopId)
      if (!found) return null
      found.suspended = false
      found.paymentStatus = 'paid'
      found.lastPaymentAt = now()
      found.nextPaymentDue = new Date(Date.now() + 30 * 86400000).toISOString()
      found.version = (found.version ?? 1) + 1
      return publicShop(found)
    },
    async deleteShop(shopId) {
      const state = await memoryState(env)
      const index = state.shops.findIndex((shop) => shop.id === shopId)
      if (index === -1) return false
      state.shops.splice(index, 1)
      for (let i = state.products.length - 1; i >= 0; i -= 1) {
        if (state.products[i].shopId === shopId) state.products.splice(i, 1)
      }
      for (const [token, session] of state.sessions) {
        if (session.shopId === shopId) state.sessions.delete(token)
      }
      return true
    },
    async getSettings() {
      const state = await memoryState(env)
      return { ...state.settings }
    },
    async saveSettings(patch) {
      const state = await memoryState(env)
      if (patch.maintenanceMode !== undefined) state.settings.maintenanceMode = patch.maintenanceMode
      if (patch.signupEnabled !== undefined) state.settings.signupEnabled = patch.signupEnabled
      return { ...state.settings }
    },
    async recordClick(input) {
      const state = await memoryState(env)
      const event: ClickEvent = {
        id: crypto.randomUUID(),
        createdAt: now(),
        visitorId: input.visitorId ?? null,
        userId: input.userId ?? null,
        path: input.path.slice(0, 240),
        target: input.target.slice(0, 240),
        x: input.x ?? null,
        y: input.y ?? null,
        userAgent: input.userAgent ?? null,
      }
      state.clicks.unshift(event)
      if (state.clicks.length > 5000) state.clicks.length = 5000
      return event
    },
    async listClickEvents(limit = 200) {
      const state = await memoryState(env)
      return state.clicks.slice(0, Math.max(1, Math.min(limit, 1000))).map((event) => ({ ...event }))
    },
    async recordLoginAttempt(key, ip, success) {
      const state = await memoryState(env)
      state.loginAttempts.push({ id: crypto.randomUUID(), key, ip, createdAt: now(), success })
      if (state.loginAttempts.length > 10000) state.loginAttempts.shift()
    },
    async countRecentLoginFailures(key, ip, windowMs) {
      const state = await memoryState(env)
      const cutoff = Date.now() - windowMs
      return state.loginAttempts.filter((attempt) => !attempt.success && Date.parse(attempt.createdAt) >= cutoff && (attempt.key === key || (ip !== null && attempt.ip === ip))).length
    },
  }
}

/* ------------------------------------------------------------------------- *
 * D1 store
 * ------------------------------------------------------------------------- */

type ShopRow = {
  id: string
  name: string
  location: string
  latitude: number | null
  longitude: number | null
  house_number: string
  phone: string
  hours: string
  currency: string
  plan: string | null
  suspended: number | null
  payment_status: string | null
  payment_method: string | null
  payment_account: string | null
  last_payment_at: string | null
  next_payment_due: string | null
  password_hash: string
  salt: string
  created_at: string
  version: number | null
  delivery_available: number | null
  delivery_radius_km: number | null
  delivery_fee: number | null
  min_order_amount: number | null
  delivery_notes: string | null
  location_source: string | null
  location_updated_at: string | null
}

type ProductRow = {
  id: string
  shop_id: string
  name: string
  category: string
  emoji: string
  unit: string
  price: number
  previous_price: number | null
  stock: string
  note: string | null
  updated_at: string
  version: number | null
  delivery_available: number | null
}

type ClickRow = {
  id: string
  created_at: string
  visitor_id: string | null
  user_id: string | null
  path: string
  target: string
  x: number | null
  y: number | null
  user_agent: string | null
}

function shopFromRow(row: ShopRow): ShopRecord {
  return {
    id: row.id,
    version: row.version ?? 1,
    name: row.name,
    location: row.location,
    latitude: row.latitude,
    longitude: row.longitude,
    houseNumber: row.house_number,
    phone: row.phone,
    hours: row.hours,
    currency: row.currency,
    plan: (row.plan as PublicShop['plan']) ?? 'free',
    suspended: Boolean(row.suspended),
    paymentStatus: (row.payment_status as PublicShop['paymentStatus']) ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    paymentAccount: row.payment_account ?? undefined,
    deliveryAvailable: row.delivery_available === null ? true : Boolean(row.delivery_available),
    deliveryRadiusKm: row.delivery_radius_km,
    deliveryFee: row.delivery_fee,
    minOrderAmount: row.min_order_amount,
    deliveryNotes: row.delivery_notes ?? '',
    locationSource: row.location_source ?? 'manual',
    locationUpdatedAt: row.location_updated_at,
    lastPaymentAt: row.last_payment_at,
    nextPaymentDue: row.next_payment_due,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: row.created_at,
  }
}

function productFromRow(row: ProductRow): Product {
  return {
    version: row.version ?? 1,
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    category: row.category as Product['category'],
    emoji: row.emoji,
    unit: row.unit,
    price: row.price,
    previousPrice: row.previous_price,
    stock: row.stock as Product['stock'],
    note: row.note ?? '',
    updatedAt: row.updated_at,
    deliveryAvailable: row.delivery_available === null ? true : Boolean(row.delivery_available),
  }
}

function clickFromRow(row: ClickRow): ClickEvent {
  return {
    id: row.id,
    createdAt: row.created_at,
    visitorId: row.visitor_id,
    userId: row.user_id,
    path: row.path,
    target: row.target,
    x: row.x,
    y: row.y,
    userAgent: row.user_agent,
  }
}

function insertProduct(db: D1Database, product: Product) {
  return db
    .prepare(
      `INSERT INTO products (id, shop_id, name, category, emoji, unit, price, previous_price, stock, note, updated_at, version, delivery_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      product.id,
      product.shopId,
      product.name,
      product.category,
      product.emoji,
      product.unit,
      product.price,
      product.previousPrice,
      product.stock,
      product.note,
      product.updatedAt,
      product.version ?? 1,
      product.deliveryAvailable === false ? 0 : 1,
    )
}

const migrations = new WeakMap<D1Database, Promise<void>>()

function ready(db: D1Database, env: Env) {
  let pending = migrations.get(db)
  if (!pending) {
    pending = (async () => {
      await db.batch([
        db.prepare(
          `CREATE TABLE IF NOT EXISTS shops (
             id TEXT PRIMARY KEY,
             name TEXT NOT NULL,
             location TEXT NOT NULL DEFAULT '',
             latitude REAL,
             longitude REAL,
             house_number TEXT NOT NULL DEFAULT '',
             phone TEXT NOT NULL UNIQUE,
             hours TEXT NOT NULL DEFAULT '',
             currency TEXT NOT NULL DEFAULT 'ETB',
             plan TEXT NOT NULL DEFAULT 'free',
             suspended INTEGER NOT NULL DEFAULT 0,
             payment_status TEXT NOT NULL DEFAULT 'paid',
             last_payment_at TEXT,
             next_payment_due TEXT,
             password_hash TEXT NOT NULL,
             salt TEXT NOT NULL,
             created_at TEXT NOT NULL,
             version INTEGER NOT NULL DEFAULT 1,
             delivery_available INTEGER NOT NULL DEFAULT 1,
             delivery_radius_km REAL,
             delivery_fee REAL,
             min_order_amount REAL,
             delivery_notes TEXT,
             location_source TEXT,
             location_updated_at TEXT
           )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS products (
             id TEXT PRIMARY KEY,
             shop_id TEXT NOT NULL,
             name TEXT NOT NULL,
             category TEXT NOT NULL,
             emoji TEXT NOT NULL,
             unit TEXT NOT NULL,
             price REAL NOT NULL,
             previous_price REAL,
             stock TEXT NOT NULL,
             note TEXT NOT NULL DEFAULT '',
             updated_at TEXT NOT NULL,
             version INTEGER NOT NULL DEFAULT 1,
             delivery_available INTEGER NOT NULL DEFAULT 1
           )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS sessions (
             token TEXT PRIMARY KEY,
             shop_id TEXT NOT NULL,
             created_at TEXT NOT NULL,
             expires_at TEXT,
             ip TEXT,
             user_agent TEXT,
             last_used_at TEXT
           )`,
        ),
        db.prepare('CREATE INDEX IF NOT EXISTS products_shop_idx ON products (shop_id)'),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS admin_sessions (
             token TEXT PRIMARY KEY,
             created_at TEXT NOT NULL,
             expires_at TEXT,
             ip TEXT,
             user_agent TEXT,
             last_used_at TEXT
           )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS app_settings (
             key TEXT PRIMARY KEY,
             value TEXT NOT NULL
           )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS click_events (
             id TEXT PRIMARY KEY,
             created_at TEXT NOT NULL,
             visitor_id TEXT,
             user_id TEXT,
             path TEXT NOT NULL,
             target TEXT NOT NULL,
             x INTEGER,
             y INTEGER,
             user_agent TEXT
           )`,
        ),
        db.prepare('CREATE INDEX IF NOT EXISTS click_events_created_idx ON click_events (created_at)'),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS login_attempts (
             id TEXT PRIMARY KEY,
             key TEXT NOT NULL,
             created_at TEXT NOT NULL,
             success INTEGER NOT NULL DEFAULT 0
           )`,
        ),
        db.prepare('CREATE INDEX IF NOT EXISTS login_attempts_key_idx ON login_attempts (key, created_at)'),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS delivery_zones (
             id TEXT PRIMARY KEY,
             shop_id TEXT NOT NULL,
             name TEXT NOT NULL,
             latitude REAL NOT NULL,
             longitude REAL NOT NULL,
             radius_km REAL NOT NULL DEFAULT 5,
             fee REAL NOT NULL DEFAULT 0,
             min_order REAL NOT NULL DEFAULT 0,
             active INTEGER NOT NULL DEFAULT 1,
             created_at TEXT NOT NULL,
             updated_at TEXT NOT NULL
           )`,
        ),
        db.prepare('CREATE INDEX IF NOT EXISTS delivery_zones_shop_idx ON delivery_zones (shop_id)'),
      ])

      for (const statement of [
        'ALTER TABLE shops ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE shops ADD COLUMN payment_status TEXT NOT NULL DEFAULT \'paid\'',
        'ALTER TABLE shops ADD COLUMN last_payment_at TEXT',
        'ALTER TABLE shops ADD COLUMN next_payment_due TEXT',
        'ALTER TABLE shops ADD COLUMN payment_method TEXT',
        'ALTER TABLE shops ADD COLUMN payment_account TEXT',
        'ALTER TABLE shops ADD COLUMN latitude REAL',
        'ALTER TABLE shops ADD COLUMN longitude REAL',
        'ALTER TABLE shops ADD COLUMN version INTEGER NOT NULL DEFAULT 1',
        'ALTER TABLE shops ADD COLUMN delivery_available INTEGER NOT NULL DEFAULT 1',
        'ALTER TABLE shops ADD COLUMN delivery_radius_km REAL',
        'ALTER TABLE shops ADD COLUMN delivery_fee REAL',
        'ALTER TABLE shops ADD COLUMN min_order_amount REAL',
        'ALTER TABLE shops ADD COLUMN delivery_notes TEXT',
        'ALTER TABLE shops ADD COLUMN location_source TEXT',
        'ALTER TABLE shops ADD COLUMN location_updated_at TEXT',
        'ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1',
        'ALTER TABLE products ADD COLUMN delivery_available INTEGER NOT NULL DEFAULT 1',
        'ALTER TABLE sessions ADD COLUMN expires_at TEXT',
        'ALTER TABLE sessions ADD COLUMN ip TEXT',
        'ALTER TABLE sessions ADD COLUMN user_agent TEXT',
        'ALTER TABLE sessions ADD COLUMN last_used_at TEXT',
        'ALTER TABLE admin_sessions ADD COLUMN expires_at TEXT',
        'ALTER TABLE admin_sessions ADD COLUMN ip TEXT',
        'ALTER TABLE admin_sessions ADD COLUMN user_agent TEXT',
        'ALTER TABLE admin_sessions ADD COLUMN last_used_at TEXT',
      ]) {
        try {
          await db.prepare(statement).run()
        } catch {
          // Column already exists.
        }
      }

      await db
        .prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('maintenanceMode', 'false')")
        .run()
      await db
        .prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('signupEnabled', 'true')")
        .run()

      const shops = await db.prepare('SELECT COUNT(*) AS total FROM shops').first<{ total: number }>()
      if (shops?.total) return
      if (!seedDemoData(env)) return

      for (const trader of DEMO_TRADERS) {
        const salt = newSalt()
        await db
          .prepare(
            `INSERT INTO shops (id, name, location, latitude, longitude, house_number, phone, hours, currency, plan, payment_method, payment_account, password_hash, salt, created_at, version, delivery_available, delivery_radius_km, delivery_fee, min_order_amount, delivery_notes, location_source, location_updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            trader.id,
            trader.name,
            trader.location,
            trader.latitude ?? null,
            trader.longitude ?? null,
            trader.houseNumber,
            trader.phone,
            trader.hours,
            trader.currency,
            'free',
            trader.paymentMethod ?? null,
            trader.paymentAccount ?? null,
            await hashPassword(DEMO_PASSWORD, salt),
            salt,
            SEEDED_AT,
            1,
            1,
            5,
            0,
            0,
            '',
            'seed',
            SEEDED_AT,
          )
          .run()

        await db.batch(
          trader.listings.map((listing) =>
            insertProduct(db, { ...listing, shopId: trader.id, updatedAt: SEEDED_AT, version: 1, deliveryAvailable: true }),
          ),
        )
      }
    })()
    migrations.set(db, pending)
  }
  return pending
}

function d1Store(db: D1Database, env: Env): Store {
  return {
    async listShops() {
      await ready(db, env)
      const { results } = await db
        .prepare('SELECT * FROM shops ORDER BY name COLLATE NOCASE')
        .all<ShopRow>()
      return results.map((row) => publicShop(shopFromRow(row)))
    },

    async listListings() {
      await ready(db, env)
      const { results } = await db.prepare('SELECT * FROM products ORDER BY name COLLATE NOCASE').all<ProductRow>()
      return results.map(productFromRow)
    },

    async findShopByPhone(phone) {
      await ready(db, env)
      const row = await db.prepare('SELECT * FROM shops WHERE phone = ?').bind(phone).first<ShopRow>()
      return row ? shopFromRow(row) : null
    },

    async createShop(input) {
      await ready(db, env)
      const id = crypto.randomUUID()
      const createdAt = now()
      const plan = (input.plan ?? 'free') as PublicShop['plan']
      await db
        .prepare(
          `INSERT INTO shops (id, name, location, latitude, longitude, house_number, phone, hours, currency, plan, suspended, payment_status, payment_method, payment_account, last_payment_at, next_payment_due, password_hash, salt, created_at, version, delivery_available, delivery_radius_km, delivery_fee, min_order_amount, delivery_notes, location_source, location_updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          input.name,
          input.location,
          input.latitude ?? null,
          input.longitude ?? null,
          input.houseNumber,
          input.phone,
          input.hours,
          input.currency,
          plan,
          0,
          'paid',
          input.paymentMethod ?? null,
          input.paymentAccount ?? null,
          plan === 'free' ? null : now(),
          plan === 'free' ? null : new Date(Date.now() + 30 * 86400000).toISOString(),
          input.passwordHash,
          input.salt,
          createdAt,
          1,
          input.deliveryAvailable === false ? 0 : 1,
          input.deliveryRadiusKm ?? 5,
          input.deliveryFee ?? 0,
          input.minOrderAmount ?? 0,
          input.deliveryNotes ?? '',
          input.locationSource ?? 'signup',
          input.latitude != null || input.longitude != null ? createdAt : null,
        )
        .run()
      return publicShop({ ...input, id, createdAt, plan: input.plan ?? 'free', version: 1 })
    },

    async getShop(shopId) {
      await ready(db, env)
      const row = await db.prepare('SELECT * FROM shops WHERE id = ?').bind(shopId).first<ShopRow>()
      return row ? publicShop(shopFromRow(row)) : null
    },

    async saveShop(shopId, patch) {
      await ready(db, env)
      const row = await db.prepare('SELECT * FROM shops WHERE id = ?').bind(shopId).first<ShopRow>()
      if (!row) return null
      const current = shopFromRow(row)
      const expectedVersion = typeof patch.version === 'number' ? patch.version : undefined
      if (expectedVersion !== undefined && (current.version ?? 1) !== expectedVersion) throw new Error('VERSION_CONFLICT')
      const { version: _ignored, ...data } = patch
      const next = { ...publicShop(current), ...data }
      await db
        .prepare(
          `UPDATE shops SET name = ?, location = ?, latitude = ?, longitude = ?, house_number = ?, hours = ?, currency = ?, plan = ?, payment_method = ?, payment_account = ?, version = ?, delivery_available = ?, delivery_radius_km = ?, delivery_fee = ?, min_order_amount = ?, delivery_notes = ?, location_source = ?, location_updated_at = ? WHERE id = ?`,
        )
        .bind(
          next.name,
          next.location,
          next.latitude ?? null,
          next.longitude ?? null,
          next.houseNumber,
          next.hours,
          next.currency,
          next.plan ?? 'free',
          next.paymentMethod ?? null,
          next.paymentAccount ?? null,
          (current.version ?? 1) + 1,
          next.deliveryAvailable === false ? 0 : 1,
          next.deliveryRadiusKm ?? null,
          next.deliveryFee ?? null,
          next.minOrderAmount ?? null,
          next.deliveryNotes ?? '',
          next.locationSource ?? 'manual',
          'latitude' in patch || 'longitude' in patch ? now() : current.locationUpdatedAt,
          shopId,
        )
        .run()
      const updatedRecord: ShopRecord = {
        ...current,
        ...data,
        version: (current.version ?? 1) + 1,
        locationUpdatedAt: 'latitude' in patch || 'longitude' in patch ? now() : current.locationUpdatedAt,
        locationSource: 'latitude' in patch || 'longitude' in patch ? 'manual' : current.locationSource,
      }
      return publicShop(updatedRecord)
    },

    async createSession(shopId, metadata) {
      await ready(db, env)
      const token = newToken()
      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
      await db
        .prepare('INSERT INTO sessions (token, shop_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(token, shopId, now(), expiresAt, metadata?.ip ?? null, metadata?.userAgent ?? null)
        .run()
      return token
    },

    async shopForToken(token) {
      await ready(db, env)
      const row = await db
        .prepare('SELECT shops.* FROM sessions JOIN shops ON shops.id = sessions.shop_id WHERE sessions.token = ? AND (sessions.expires_at IS NULL OR sessions.expires_at > ?)')
        .bind(token, now())
        .first<ShopRow>()
      if (!row) {
        await db.prepare('DELETE FROM sessions WHERE token = ? AND expires_at IS NOT NULL AND expires_at <= ?').bind(token, now()).run()
        return null
      }
      return publicShop(shopFromRow(row))
    },

    async deleteSession(token) {
      await ready(db, env)
      await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
    },

    async listProducts(shopId) {
      await ready(db, env)
      const { results } = await db
        .prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY name COLLATE NOCASE')
        .bind(shopId)
        .all<ProductRow>()
      return results.map(productFromRow)
    },

    async createProduct(shopId, input) {
      await ready(db, env)
      const product: Product = {
        ...input,
        version: 1,
        shopId,
        id: crypto.randomUUID(),
        price: round2(input.price),
        previousPrice: null,
        updatedAt: now(),
        deliveryAvailable: input.deliveryAvailable ?? true,
      }
      await insertProduct(db, product).run()
      return product
    },

    async updateProduct(shopId, id, patch) {
      await ready(db, env)
      const row = await db
        .prepare('SELECT * FROM products WHERE id = ? AND shop_id = ?')
        .bind(id, shopId)
        .first<ProductRow>()
      if (!row) return null

      const current = productFromRow(row)
      const expectedVersion = typeof patch.version === 'number' ? patch.version : undefined
      if (expectedVersion !== undefined && (current.version ?? 1) !== expectedVersion) throw new Error('VERSION_CONFLICT')
      const { version: _ignored, ...dataPatch } = patch
      const price = dataPatch.price === undefined ? current.price : round2(dataPatch.price)
      const product: Product = {
        ...current,
        ...dataPatch,
        version: (current.version ?? 1) + 1,
        shopId,
        price,
        previousPrice: price !== current.price ? current.price : current.previousPrice,
        updatedAt: now(),
      }

      await db
        .prepare(
          `UPDATE products
             SET name = ?, category = ?, emoji = ?, unit = ?, price = ?,
                 previous_price = ?, stock = ?, note = ?, updated_at = ?, version = ?, delivery_available = ?
           WHERE id = ? AND shop_id = ?`,
        )
        .bind(
          product.name,
          product.category,
          product.emoji,
          product.unit,
          product.price,
          product.previousPrice,
          product.stock,
          product.note,
          product.updatedAt,
          product.version,
          product.deliveryAvailable === false ? 0 : 1,
          id,
          shopId,
        )
        .run()
      return product
    },

    async deleteProduct(shopId, id) {
      await ready(db, env)
      const result = await db.prepare('DELETE FROM products WHERE id = ? AND shop_id = ?').bind(id, shopId).run()
      return (result.meta.changes ?? 0) > 0
    },

    async createAdminSession(metadata) {
      await ready(db, env)
      const token = newToken()
      const expiresAt = new Date(Date.now() + 12 * 3600000).toISOString()
      await db
        .prepare('INSERT INTO admin_sessions (token, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)')
        .bind(token, now(), expiresAt, metadata?.ip ?? null, metadata?.userAgent ?? null)
        .run()
      return token
    },
    async adminForToken(token) {
      await ready(db, env)
      const row = await db
        .prepare('SELECT token FROM admin_sessions WHERE token = ? AND (expires_at IS NULL OR expires_at > ?)')
        .bind(token, now())
        .first<{ token: string }>()
      if (!row) {
        await db.prepare('DELETE FROM admin_sessions WHERE token = ? AND expires_at IS NOT NULL AND expires_at <= ?').bind(token, now()).run()
        return false
      }
      return true
    },
    async deleteAdminSession(token) {
      await ready(db, env)
      await db.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run()
    },
    async listAdminShops() {
      await ready(db, env)
      const { results: shops } = await db.prepare('SELECT * FROM shops ORDER BY name COLLATE NOCASE').all<ShopRow>()
      const { results: counts } = await db.prepare('SELECT shop_id, COUNT(*) AS total FROM products GROUP BY shop_id').all<{ shop_id: string; total: number }>()
      const countMap = new Map(counts.map((row) => [row.shop_id, row.total]))
      return shops.map((row) => {
        const shop = shopFromRow(row)
        return {
          ...publicShop(shop),
          productCount: countMap.get(row.id) ?? 0,
          createdAt: row.created_at,
        }
      })
    },
    async setShopSuspended(shopId, suspended) {
      await ready(db, env)
      const row = await db.prepare('SELECT * FROM shops WHERE id = ?').bind(shopId).first<ShopRow>()
      if (!row) return null
      await db.prepare('UPDATE shops SET suspended = ?, version = ? WHERE id = ?').bind(suspended ? 1 : 0, (row.version ?? 1) + 1, shopId).run()
      const updated = { ...shopFromRow(row), suspended, version: (row.version ?? 1) + 1 }
      return publicShop(updated)
    },
    async markShopPaid(shopId) {
      await ready(db, env)
      const row = await db.prepare('SELECT * FROM shops WHERE id = ?').bind(shopId).first<ShopRow>()
      if (!row) return null
      const due = new Date(Date.now() + 30 * 86400000).toISOString()
      await db
        .prepare('UPDATE shops SET suspended = 0, payment_status = ?, last_payment_at = ?, next_payment_due = ?, version = ? WHERE id = ?')
        .bind('paid', now(), due, (row.version ?? 1) + 1, shopId)
        .run()
      const updated = { ...shopFromRow(row), suspended: false, paymentStatus: 'paid' as PublicShop['paymentStatus'], lastPaymentAt: now(), nextPaymentDue: due, version: (row.version ?? 1) + 1 }
      return publicShop(updated)
    },
    async deleteShop(shopId) {
      await ready(db, env)
      await db.prepare('DELETE FROM products WHERE shop_id = ?').bind(shopId).run()
      await db.prepare('DELETE FROM sessions WHERE shop_id = ?').bind(shopId).run()
      await db.prepare('DELETE FROM delivery_zones WHERE shop_id = ?').bind(shopId).run()
      const result = await db.prepare('DELETE FROM shops WHERE id = ?').bind(shopId).run()
      return (result.meta.changes ?? 0) > 0
    },
    async getSettings() {
      await ready(db, env)
      const rows = await db.prepare('SELECT key, value FROM app_settings').all<{ key: string; value: string }>()
      const map = new Map(rows.results.map((row) => [row.key, row.value]))
      return {
        maintenanceMode: map.get('maintenanceMode') === 'true',
        signupEnabled: map.get('signupEnabled') !== 'false',
      }
    },
    async saveSettings(patch) {
      await ready(db, env)
      if (patch.maintenanceMode !== undefined) {
        await db
          .prepare("INSERT INTO app_settings (key, value) VALUES ('maintenanceMode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
          .bind(String(patch.maintenanceMode))
          .run()
      }
      if (patch.signupEnabled !== undefined) {
        await db
          .prepare("INSERT INTO app_settings (key, value) VALUES ('signupEnabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
          .bind(String(patch.signupEnabled))
          .run()
      }
      return this.getSettings()
    },
    async recordClick(input) {
      await ready(db, env)
      const event: ClickEvent = {
        id: crypto.randomUUID(),
        createdAt: now(),
        visitorId: input.visitorId ?? null,
        userId: input.userId ?? null,
        path: input.path.slice(0, 240),
        target: input.target.slice(0, 240),
        x: input.x ?? null,
        y: input.y ?? null,
        userAgent: input.userAgent ?? null,
      }
      await db
        .prepare(
          `INSERT INTO click_events (id, created_at, visitor_id, user_id, path, target, x, y, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          event.id,
          event.createdAt,
          event.visitorId,
          event.userId,
          event.path,
          event.target,
          event.x,
          event.y,
          event.userAgent,
        )
        .run()
      return event
    },
    async listClickEvents(limit = 200) {
      await ready(db, env)
      const safeLimit = Math.max(1, Math.min(limit, 1000))
      const { results } = await db
        .prepare('SELECT * FROM click_events ORDER BY created_at DESC LIMIT ?')
        .bind(safeLimit)
        .all<ClickRow>()
      return results.map(clickFromRow)
    },
    async recordLoginAttempt(key, ip, success) {
      await ready(db, env)
      await db
        .prepare('INSERT INTO login_attempts (id, key, ip, created_at, success) VALUES (?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), key, ip, now(), success ? 1 : 0)
        .run()
    },
    async countRecentLoginFailures(key, ip, windowMs) {
      await ready(db, env)
      const cutoff = new Date(Date.now() - windowMs).toISOString()
      const row = await db
        .prepare('SELECT COUNT(*) AS total FROM login_attempts WHERE success = 0 AND created_at >= ? AND (key = ? OR ip = ?)')
        .bind(cutoff, key, ip)
        .first<{ total: number }>()
      return row?.total ?? 0
    },
  }
}