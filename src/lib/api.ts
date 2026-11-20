import type { Product, ProductInput, PublicShop } from './catalogue'

export type Catalogue = { shops: PublicShop[]; listings: Product[] }
export type Session = { token: string; shop: PublicShop }
export type ShopDetails = Omit<PublicShop, 'id' | 'phone'>

export type SignUpInput = ShopDetails & { phone: string; password: string }

const TOKEN_KEY = 'asbeza:token'
const ADMIN_TOKEN_KEY = 'asbeza:admin'

export function storedAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function rememberAdminToken(token: string) {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function forgetAdminToken() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function rememberToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* private mode without storage still works for this tab */
  }
}

export function forgetToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* nothing to clear */
  }
}

async function request<T>(path: string, init: RequestInit = {}, tokenOverride?: string | null): Promise<T> {
  const token = tokenOverride ?? storedToken()
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0)
  }

  const data = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    throw new ApiError(data?.error ?? `Something went wrong (${response.status}).`, response.status)
  }
  return data as T
}

export type AdminShop = PublicShop & { productCount: number; createdAt: string }
export type AppSettings = { maintenanceMode: boolean; signupEnabled: boolean }
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

export const api = {
  catalogue: () => request<Catalogue>('/api/catalogue'),

  signUp: (input: SignUpInput) =>
    request<Session>('/api/trader/signup', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  signIn: (phone: string, password: string) =>
    request<Session>('/api/trader/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  me: () => request<{ shop: PublicShop; products: Product[] }>('/api/trader/me'),

  signOut: () => request<{ ok: true }>('/api/trader/logout', { method: 'POST' }),

  addProduct: (input: ProductInput) =>
    request<{ product: Product }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateProduct: (id: string, patch: Partial<ProductInput>) =>
    request<{ product: Product }>(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  draftListing: (note: string) =>
    request<{ draft: ProductInput }>('/api/assistant/listing', {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  removeProduct: (id: string) =>
    request<{ ok: true }>(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  saveShop: (details: Partial<ShopDetails>) =>
    request<{ shop: PublicShop }>('/api/trader/shop', {
      method: 'PATCH',
      body: JSON.stringify(details),
    }),

  adminLogin: (password: string) =>
    request<{ token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  adminLogout: () =>
    request<{ ok: true }>('/api/admin/logout', { method: 'POST' }, storedAdminToken()),

  adminShops: () => request<{ shops: AdminShop[] }>('/api/admin/shops', {}, storedAdminToken()),

  adminSuspend: (id: string, suspended: boolean) =>
    request<{ shop: PublicShop }>(`/api/admin/shops/${encodeURIComponent(id)}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ suspended }),
    }, storedAdminToken()),

  adminMarkPaid: (id: string) =>
    request<{ shop: PublicShop }>(`/api/admin/shops/${encodeURIComponent(id)}/payment`, {
      method: 'POST',
    }, storedAdminToken()),

  adminDeleteShop: (id: string) =>
    request<{ ok: true }>(`/api/admin/shops/${encodeURIComponent(id)}`, { method: 'DELETE' }, storedAdminToken()),

  adminSettings: () => request<{ settings: AppSettings }>('/api/admin/settings', {}, storedAdminToken()),

  adminSaveSettings: (patch: Partial<AppSettings>) =>
    request<{ settings: AppSettings }>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }, storedAdminToken()),

  adminClicks: () => request<{ events: ClickEvent[] }>('/api/admin/clicks', {}, storedAdminToken()),
}
