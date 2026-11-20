// Shared model for the price board. Imported by the Worker (data layer) and by
// the React app (rendering), so it stays free of framework code.

export const CATEGORIES = ['Fruit', 'Vegetable', 'Herbs', 'Cereals', 'Pulses', 'Ingredients', 'Chilli powder', 'Spices', 'Supermarket'] as const
export type Category = (typeof CATEGORIES)[number]

export const STOCKS = ['in', 'low', 'out'] as const
export type Stock = (typeof STOCKS)[number]

export const STOCK_LABELS: Record<Stock, string> = {
  in: 'In stock',
  low: 'Few left',
  out: 'Sold out',
}

export const STOCK_STYLES: Record<Stock, string> = {
  in: 'bg-[rgb(34_197_94/0.14)] text-[#8ff0b4]',
  low: 'bg-[rgb(163_230_53/0.14)] text-[#d3f58a]',
  out: 'bg-[rgb(249_115_22/0.14)] text-[#ffb27a]',
}

export const STOCK_DOTS: Record<Stock, string> = {
  in: 'bg-[#4ade80]',
  low: 'bg-[#a3e635]',
  out: 'bg-[#f97316]',
}

export const CATEGORY_STYLES: Record<Category, string> = {
  Fruit: 'bg-[rgb(163_230_53/0.13)] text-[#c4f27a]',
  Vegetable: 'bg-[rgb(34_197_94/0.14)] text-[#8ff0b4]',
  Herbs: 'bg-[rgb(45_212_191/0.13)] text-[#8ff0d8]',
  Cereals: 'bg-[rgb(234_179_8/0.13)] text-[#f5d777]',
  Pulses: 'bg-[rgb(168_85_247/0.13)] text-[#d8b4fe]',
  Ingredients: 'bg-[rgb(110_231_183/0.12)] text-[#a7f3d0]',
  'Chilli powder': 'bg-[rgb(249_115_22/0.14)] text-[#ffb27a]',
  Spices: 'bg-[rgb(132_204_22/0.15)] text-[#c9ee92]',
  Supermarket: 'bg-[rgb(59_130_246/0.14)] text-[#93c5fd]',
}

export const UNITS = ['kg', 'g', '100 g', 'quintal', 'litre', 'bunch', 'piece', 'dozen', 'sack'] as const

export const PLANS = [
  { code: 'free', name: 'Free', fee: 0, label: 'Free — post up to 20 items' },
  { code: 'business', name: 'Business', fee: 100, label: 'Business — 100 ETB / month' },
  { code: 'enterprise', name: 'Enterprise', fee: 300, label: 'Enterprise — 300 ETB / month' },
] as const
export type PlanCode = (typeof PLANS)[number]['code']

export const CURRENCIES = [
  { code: 'ETB', label: 'ETB — Ethiopian birr (Br)' },
  { code: 'USD', label: 'USD — US dollar ($)' },
  { code: 'KES', label: 'KES — Kenyan shilling (KSh)' },
  { code: 'AED', label: 'AED — UAE dirham (د.إ)' },
  { code: 'INR', label: 'INR — Indian rupee (₹)' },
  { code: 'GBP', label: 'GBP — Pound sterling (£)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
] as const

/** A trader's shop as customers see it. */
export type PaymentStatus = 'paid' | 'due' | 'overdue'

export type PublicShop = {
  id: string
  name: string
  /** Market, area or street: "Merkato, Addis Ababa". */
  location: string
  /** House or shop number inside the market. */
  houseNumber: string
  phone: string
  hours: string
  currency: string
  /** Platform subscription plan. */
  plan?: PlanCode
  /** Whether an admin has suspended this trader. */
  suspended?: boolean
  /** Platform subscription payment state. */
  paymentStatus?: PaymentStatus
  /** Preferred payment method for platform fees and customer payments. */
  paymentMethod?: string
  /** Account number, phone or IBAN for the payment method above. */
  paymentAccount?: string
  /** Platform row version used for optimistic concurrency. */
  version?: number
  /** Latitude for the shop, used by the “near me” feature. */
  latitude?: number | null
  /** Longitude for the shop, used by the “near me” feature. */
  longitude?: number | null
  /** Whether this shop can deliver to customers. */
  deliveryAvailable?: boolean
  /** Maximum delivery distance in kilometres. */
  deliveryRadiusKm?: number | null
  /** Delivery fee charged to the customer. */
  deliveryFee?: number | null
  /** Minimum order amount for delivery. */
  minOrderAmount?: number | null
  /** Delivery notes or coverage description. */
  deliveryNotes?: string
  /** How the shop coordinates were captured. */
  locationSource?: string
  /** ISO timestamp when shop coordinates were last changed. */
  locationUpdatedAt?: string | null
  /** ISO timestamp of the last successful payment. */
  lastPaymentAt?: string | null
  /** ISO timestamp when the next monthly payment is due. */
  nextPaymentDue?: string | null
}

/** A shop plus the bits only the data layer needs: login and hashing. */
export type ShopRecord = PublicShop & {
  passwordHash: string
  salt: string
  createdAt: string
}

export type NewShopInput = Omit<ShopRecord, 'id' | 'createdAt'>

export type Product = {
  version?: number
  id: string
  shopId: string
  name: string
  category: Category
  emoji: string
  unit: string
  price: number
  /** Yesterday's selling price, so the board can show a change. */
  previousPrice: number | null
  stock: Stock
  note: string
  updatedAt: string
  /** Whether this product can be delivered. */
  deliveryAvailable?: boolean
}

export type ProductInput = Omit<Product, 'id' | 'shopId' | 'previousPrice' | 'updatedAt'>

/** Common market products with Amharic names, used for quick-add suggestions. */
export const PRODUCTS = [
  { name: 'Wheat ስንዴ', category: 'Cereals', emoji: '🌾', unit: 'kg' },
  { name: 'Maize በቆሎ', category: 'Cereals', emoji: '🌽', unit: 'kg' },
  { name: 'Teff ጤፍ', category: 'Cereals', emoji: '🌾', unit: 'kg' },
  { name: 'Barley ገብስ', category: 'Cereals', emoji: '🌾', unit: 'kg' },
  { name: 'Rice ሩዝ', category: 'Cereals', emoji: '🍚', unit: 'kg' },
  { name: 'Oats አጃ', category: 'Cereals', emoji: '🌾', unit: 'kg' },
  { name: 'Sorghum ማሽላ', category: 'Cereals', emoji: '🌾', unit: 'kg' },
  { name: 'Beans ባቄላ', category: 'Pulses', emoji: '🫘', unit: 'kg' },
  { name: 'Lentils ምስር', category: 'Pulses', emoji: '🫘', unit: 'kg' },
  { name: 'Chickpeas ሽምብራ', category: 'Pulses', emoji: '🫘', unit: 'kg' },
  { name: 'Peas አተር', category: 'Pulses', emoji: '🫛', unit: 'kg' },
  { name: 'Soybeans አኩሪአተር', category: 'Pulses', emoji: '🫘', unit: 'kg' },
  { name: 'Split peas ክክ', category: 'Pulses', emoji: '🫘', unit: 'kg' },
  { name: 'Turmeric እርድ', category: 'Spices', emoji: '🟡', unit: '100 g' },
  { name: 'Black pepper ቁንዶ በርበሬ', category: 'Spices', emoji: '🌶️', unit: '100 g' },
  { name: 'Ginger ዝንጅብል', category: 'Spices', emoji: '🫚', unit: 'kg' },
  { name: 'Garlic powder የነጭ ሽንኩርት ዱቄት', category: 'Spices', emoji: '🧄', unit: '100 g' },
  { name: 'Cinnamon ቀረፋ', category: 'Spices', emoji: '🍂', unit: '100 g' },
  { name: 'Cardamom ኮረሪማ', category: 'Spices', emoji: '🌿', unit: '100 g' },
  { name: 'Cumin ከሙን', category: 'Spices', emoji: '🌿', unit: '100 g' },
  { name: 'Coriander ድንብላል', category: 'Spices', emoji: '🌿', unit: '100 g' },
  { name: 'Cooking oil የምግብ ዘይት', category: 'Ingredients', emoji: '🫗', unit: 'litre' },
  { name: 'Salt ጨው', category: 'Ingredients', emoji: '🧂', unit: 'kg' },
  { name: 'Sugar ስኳር', category: 'Ingredients', emoji: '🍬', unit: 'kg' },
  { name: 'Flour ዱቄት', category: 'Ingredients', emoji: '🌾', unit: 'kg' },
  { name: 'Baking powder የኬክ ዱቄት', category: 'Ingredients', emoji: '🧂', unit: '100 g' },
  { name: 'Yeast እር Sharia', category: 'Ingredients', emoji: '🦠', unit: '100 g' },
  { name: 'Tomato paste የቲማቲም ድልህ', category: 'Ingredients', emoji: '🍅', unit: 'piece' },
  { name: 'Vinegar ኮምጣጤ', category: 'Ingredients', emoji: '🫗', unit: 'litre' },
  { name: 'Milk ወተት', category: 'Supermarket', emoji: '🥛', unit: 'litre' },
  { name: 'Yogurt የርጎት', category: 'Supermarket', emoji: '🥛', unit: 'piece' },
  { name: 'Cheese አይብ', category: 'Supermarket', emoji: '🧀', unit: 'kg' },
  { name: 'Butter ድንች ቅቤ', category: 'Supermarket', emoji: '🧈', unit: 'kg' },
  { name: 'Eggs እንቁላል', category: 'Supermarket', emoji: '🥚', unit: 'dozen' },
  { name: 'Bread ዳቦ', category: 'Supermarket', emoji: '🍞', unit: 'piece' },
  { name: 'Pasta ፓስታ', category: 'Supermarket', emoji: '🍝', unit: 'kg' },
  { name: 'Noodles ኑድልስ', category: 'Supermarket', emoji: '🍜', unit: 'piece' },
  { name: 'Canned tomatoes የቲማቲም ጥሬ', category: 'Supermarket', emoji: '🥫', unit: 'piece' },
  { name: 'Mineral water የማዕድን ውሃ', category: 'Supermarket', emoji: '💧', unit: 'litre' },
  { name: 'Soft drink ሶፍት ድሪንክ', category: 'Supermarket', emoji: '🥤', unit: 'litre' },
  { name: 'Coffee ቡና', category: 'Supermarket', emoji: '☕', unit: 'kg' },
  { name: 'Tea ሻይ', category: 'Supermarket', emoji: '🍵', unit: 'piece' },
  { name: 'Chocolate ቸኮሌት', category: 'Supermarket', emoji: '🍫', unit: 'piece' },
  { name: 'Biscuits ቢስኩት', category: 'Supermarket', emoji: '🍪', unit: 'piece' },
  { name: 'Soap ሳሙና', category: 'Supermarket', emoji: '🧼', unit: 'piece' },
  { name: 'Shampoo ሻምፖ', category: 'Supermarket', emoji: '🧴', unit: 'piece' },
  { name: 'Toothpaste የ meno ሳሙና', category: 'Supermarket', emoji: '🪥', unit: 'piece' },
  { name: 'Detergent የልብስ ማጠቢያ', category: 'Supermarket', emoji: '🧺', unit: 'kg' },
  { name: 'Toilet paper የሽንት ወረቀት', category: 'Supermarket', emoji: '🧻', unit: 'piece' },
] as const

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Great-circle distance in kilometres between two lat/lon points. */
export function distanceKm(a: { latitude?: number | null; longitude?: number | null }, b: { latitude?: number | null; longitude?: number | null }) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadius = 6371
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

/**
 * Logins and duplicates use one canonical form, so "+251 91 123 4567",
 * "0911234567" and "911234567" all resolve to the same account.
 */
export function normalisePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) return `251${digits.slice(1)}`
  if (!digits.startsWith('251') && digits.length === 9 && digits.startsWith('9')) return `251${digits}`
  return digits
}

/** "+251911234567" → "+251 911 234 567"; anything unexpected is shown as typed. */
export function formatPhone(value: string) {
  const digits = normalisePhone(value)
  if (digits.startsWith('251') && digits.length === 12) {
    return `+251 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }
  return value
}

const moneyFormats = new Map<string, Intl.NumberFormat>()

/** `formatMoney(480, 'ETB')` → `Br480`; keeps cents only when they matter. */
export function formatMoney(amount: number, currency: string) {
  const key = `${currency}:${Number.isInteger(amount) ? 0 : 2}`
  let formatter = moneyFormats.get(key)
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        maximumFractionDigits: 2,
      })
    } catch {
      formatter = new Intl.NumberFormat(undefined)
    }
    moneyFormats.set(key, formatter)
  }
  return formatter.format(amount)
}

export function currencySymbol(currency: string) {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1)
    return parts.find((part) => part.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

export type PriceDelta = { change: number; percent: number; direction: 'up' | 'down' }

export function priceDelta(price: number, previous: number | null): PriceDelta | null {
  if (previous === null || previous <= 0 || round2(price) === round2(previous)) return null
  const change = round2(price - previous)
  return {
    change,
    percent: Math.abs((change / previous) * 100),
    direction: change > 0 ? 'up' : 'down',
  }
}

/** "today, 6:15 am" / "yesterday, 9:00 pm" / "4 Nov, 7:30 am". */
export function formatUpdated(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'just now'
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const today = new Date()
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((dayStart(today) - dayStart(date)) / 86_400_000)
  if (days <= 0) return `today, ${time}`
  if (days === 1) return `today, ${time}`
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

/** The most recent update across the board, or null for an empty list. */
export function latestUpdate(products: Product[]): string | null {
  let latest: number | null = null
  for (const product of products) {
    const time = new Date(product.updatedAt).getTime()
    if (!Number.isNaN(time) && (latest === null || time > latest)) latest = time
  }
  return latest === null ? null : new Date(latest).toISOString()
}
