import { ArrowDownRight, ArrowLeft, ArrowUpRight, Check, Loader2, Lock, LogOut, MapPin, Plus, Sparkles, Store, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { Aurora } from '../components/Aurora'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { Logo } from '../components/Logo'
import {
  ApiError,
  api,
  forgetToken,
  rememberToken,
  storedToken,
  type Session,
  type ShopDetails,
} from '../lib/api'
import {
  CATEGORIES,
  CATEGORY_STYLES,
  CURRENCIES,
  PLANS,
  PRODUCTS,
  type PlanCode,
  STOCKS,
  UNITS,
  currencySymbol,
  formatPhone,
  formatUpdated,
  latestUpdate,
  priceDelta,
  round2,
  type Category,
  type Product,
  type ProductInput,
  type PublicShop,
  type Stock,
} from '../lib/catalogue'
import { cx } from '../lib/cx'
import { LANGUAGES } from '../lib/i18n'
import { useLanguage } from '../lib/language'
import { linkTo } from '../lib/router'

const fieldLabel = 'block text-[12px] font-medium text-muted'
const fieldInput =
  'mt-1.5 h-10 w-full rounded-[12px] border border-line bg-bg/70 px-3 text-[13.5px] outline-none transition-colors focus:border-[rgb(34_197_94/0.5)]'

// The trader side: open an account or sign in, then manage the listings and
// shop details that make up this trader's part of the public board.
export function Trader() {
  const { lang, setLang, t } = useLanguage()
  const [token, setToken] = useState<string | null>(() => storedToken())
  const [shop, setShop] = useState<PublicShop | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      forgetToken()
      setToken(null)
      setShop(null)
      setProducts(null)
      setError(t('trader.sessionEnded'))
      return
    }
    setError(err instanceof Error ? err.message : t('common.somethingWrong'))
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    api
      .me()
      .then((next) => {
        if (!active) return
        setShop(next.shop)
        setProducts(next.products)
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) handleError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token, handleError])

  function upsert(product: Product) {
    setProducts((current) => {
      if (!current) return [product]
      const exists = current.some((item) => item.id === product.id)
      return exists ? current.map((item) => (item.id === product.id ? product : item)) : [...current, product]
    })
  }

  function remove(id: string) {
    setProducts((current) => current?.filter((item) => item.id !== id) ?? current)
  }

  async function signOut() {
    await api.signOut().catch(() => undefined)
    forgetToken()
    setToken(null)
    setShop(null)
    setProducts(null)
    setError(null)
  }

  if (!token) {
    return (
      <Auth
        initialError={error}
        onSignedIn={(session) => {
          rememberToken(session.token)
          setShop(session.shop)
          setProducts(null)
          setError(null)
          setToken(session.token)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
        <Container className="flex h-16 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo />              <span className="hidden rounded-full bg-[rgb(34_197_94/0.16)] px-2 py-0.5 text-[11px] font-medium text-[#a7f3c0] sm:inline">
              {t('trader.badge')}
            </span>
            {shop && <span className="hidden max-w-[200px] truncate text-[12.5px] text-muted md:inline">{shop.name}</span>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <select
              value={lang}
              onChange={(event) => setLang(event.target.value as typeof lang)}
              aria-label={t('language')}
              className="h-10 rounded-[12px] border border-line bg-bg/60 px-2 text-[12.5px] text-muted outline-none"
            >
              {LANGUAGES.map((option) => (
                <option key={option.code} value={option.code} className="bg-surface text-fg">
                  {option.native}
                </option>
              ))}
            </select>
            <a
              href="/"
              onClick={linkTo('/')}
              className="inline-flex h-10 items-center gap-1.5 rounded-[12px] px-3 text-[13px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">{t('nav.priceBoard')}</span>
            </a>
            <Button variant="secondary" className="h-10 rounded-[12px] px-3 text-[13px]" onClick={() => void signOut()}>
              <LogOut />
              {t('trader.signOut')}
            </Button>
          </div>
        </Container>
      </header>

      <main className="py-8 pb-20">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-medium text-accent">{t('trader.dashboard')}</p>
              <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.025em] sm:text-[32px]">{t('trader.todayPriceList')}</h1>
              <p className="mt-1.5 max-w-lg text-pretty text-[13.5px] text-muted">
                {t('trader.todayPriceSub')}
              </p>
              {shop && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                  <MapPin className="size-3.5 text-faint" />                   {shop.location} · {t('admin.house')} {shop.houseNumber}
                  <span className="text-faint">· {formatPhone(shop.phone)}</span>
                  <span className="rounded-full bg-[rgb(34_197_94/0.16)] px-2 py-0.5 text-[11px] font-medium text-[#a7f3c0]">
                    {t(`trader.plan${(shop.plan ?? 'free').charAt(0).toUpperCase() + (shop.plan ?? 'free').slice(1)}`)} {t('trader.plan')}
                  </span>
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="depth relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card-sm bg-surface p-4">
              <p className="text-[13.5px] text-[#ffb27a]">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded-[10px] px-2.5 py-1 text-[12.5px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
              >
                Dismiss
              </button>
            </div>
          )}

          {shop?.suspended && (
            <div className="depth relative mt-5 rounded-card-sm bg-surface p-4">
              <p className="text-[13.5px] text-[#ffb27a]">                  {t('trader.suspendedMessage')}
              </p>
            </div>
          )}

          {loading && !shop ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-[86px] animate-pulse rounded-card-sm border border-line bg-surface/60" />
              ))}
            </div>
          ) : shop ? (
            <>
              <Stats products={products ?? []} />

              {!shop.suspended && (
              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
                <div className="flex min-w-0 flex-col gap-4">
                  <AddProduct
                    currency={shop.currency}
                    onAdded={(product) => {
                      upsert(product)
                      setError(null)
                    }}
                    onError={handleError}
                  />
                  <ProductList
                    products={products ?? []}
                    currency={shop.currency}
                    onSaved={upsert}
                    onRemoved={remove}
                    onError={handleError}
                  />
                </div>

                <div className="flex flex-col gap-4 lg:sticky lg:top-24">
                  <ShopForm
                    shop={shop}
                    onSaved={(next) => setShop(next)}
                    onError={handleError}
                  />
                </div>
              </div>
              )}
            </>
          ) : null}
        </Container>
      </main>
    </div>
  )
}

type Mode = 'in' | 'up'

function Auth({ onSignedIn, initialError }: { onSignedIn: (session: Session) => void; initialError?: string | null }) {
  const { lang, setLang, t } = useLanguage()
  const [mode, setMode] = useState<Mode>('in')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    location: '',
    houseNumber: '',
    hours: 'Open daily, 6 am – 7 pm',
    currency: 'ETB',
    plan: 'free',
    paymentMethod: '',
    paymentAccount: '',
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.phone.trim() || !form.password) {
      setError(t('trader.enterPhonePassword'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const session =
        mode === 'in'
          ? await api.signIn(form.phone.trim(), form.password)
          : await api.signUp({
              name: form.name.trim(),
              phone: form.phone.trim(),
              password: form.password,
              location: form.location.trim(),
              houseNumber: form.houseNumber.trim(),
              hours: form.hours.trim(),
              currency: form.currency,
              plan: form.plan as PlanCode,
              paymentMethod: form.paymentMethod.trim(),
              paymentAccount: form.paymentAccount.trim(),
            })
      onSignedIn(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trader.couldNotSignIn'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <Aurora intensity={0.55} />
      <header className="relative">
        <Container className="flex min-h-20 flex-wrap items-center justify-between gap-2">
          <Logo />
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(event) => setLang(event.target.value as typeof lang)}
              aria-label={t('language')}
              className="h-10 rounded-[12px] border border-line bg-bg/60 px-2 text-[12.5px] text-muted outline-none"
            >
              {LANGUAGES.map((option) => (
                <option key={option.code} value={option.code} className="bg-surface text-fg">
                  {option.native}
                </option>
              ))}
            </select>
            <a href="/" onClick={linkTo('/')} className="text-[13px] text-muted transition-colors hover:text-fg">
              {t('nav.priceBoard')}
            </a>
          </div>
        </Container>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-5 pb-24 pt-6 sm:items-center">
        <form onSubmit={submit} className="depth relative w-full max-w-[540px] rounded-card bg-surface p-5 shadow-glow sm:p-6">
          <span className="grid size-11 place-items-center rounded-[14px] bg-[rgb(34_197_94/0.14)] text-accent">
            <Lock className="size-5" />
          </span>
          <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.025em]">
            {mode === 'in' ? t('trader.traderSignIn') : t('trader.openTraderAccount')}
          </h1>
          <p className="mt-1.5 text-pretty text-[13.5px] leading-relaxed text-muted">
            {mode === 'in' ? t('trader.signInToPost') : t('trader.signUpSub')}
          </p>

          <div className="mt-4 flex gap-1 rounded-[12px] bg-bg/70 p-1">
            {(['in', 'up'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMode(option)
                  setError(null)
                }}
                aria-pressed={mode === option}
                className={cx(
                  'h-9 flex-1 rounded-[9px] text-[12.5px] font-medium transition-colors',
                  mode === option ? 'bg-[rgb(34_197_94/0.16)] text-[#a7f3c0]' : 'text-muted hover:text-fg',
                )}
              >
                {option === 'in' ? t('trader.signIn') : t('trader.createAccount')}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {mode === 'up' && (
              <label className="col-span-1 sm:col-span-2">
                <span className={fieldLabel}>{t('trader.shopName')}</span>
                <input
                  value={form.name}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="Alem Spice & Grain"
                  autoComplete="organization"
                  className={fieldInput}
                />
              </label>
            )}

            <label className={mode === 'in' ? 'col-span-1 sm:col-span-2' : 'col-span-1'}>                <span className={fieldLabel}>{t('trader.phone')}</span>
              <input
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                placeholder="+251 91 123 4567"
                autoComplete="tel"
                inputMode="tel"
                className={fieldInput}
              />
            </label>

            <label className={mode === 'in' ? 'col-span-1 sm:col-span-2' : 'col-span-1'}>                <span className={fieldLabel}>{t('trader.password')}</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                placeholder={mode === 'up' ? t('trader.atLeast6') : t('trader.yourPassword')}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                className={fieldInput}
              />
            </label>

            {mode === 'up' && (
              <>
                <label className="col-span-1 sm:col-span-2">
                  <span className={fieldLabel}>{t('trader.marketOrArea')}</span>
                  <input
                    value={form.location}
                    onChange={(event) => update('location', event.target.value)}
                    placeholder="Merkato, Addis Ababa"
                    className={fieldInput}
                  />
                </label>
                <label className="col-span-1">
                  <span className={fieldLabel}>{t('trader.houseShopNo')}</span>
                  <input
                    value={form.houseNumber}
                    onChange={(event) => update('houseNumber', event.target.value)}
                    placeholder="412"
                    className={fieldInput}
                  />
                </label>
                <label className="col-span-1">
                  <span className={fieldLabel}>{t('trader.currency')}</span>
                  <select
                    value={form.currency}
                    onChange={(event) => update('currency', event.target.value)}
                    className={fieldInput}
                  >
                    {CURRENCIES.map((option) => (
                      <option key={option.code} value={option.code} className="bg-surface text-fg">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-1 sm:col-span-2">
                  <span className={fieldLabel}>{t('trader.subscriptionFee')}</span>
                  <select
                    value={form.plan}
                    onChange={(event) => update('plan', event.target.value)}
                    className={fieldInput}
                  >
                    {PLANS.map((plan) => (
                      <option key={plan.code} value={plan.code} className="bg-surface text-fg">
                        {t(`trader.plan${plan.code.charAt(0).toUpperCase() + plan.code.slice(1)}Label`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-1">
                  <span className={fieldLabel}>{t('trader.paymentMethod')}</span>
                  <select
                    value={form.paymentMethod}
                    onChange={(event) => update('paymentMethod', event.target.value)}
                    className={fieldInput}
                  >
                    <option value="" className="bg-surface text-fg">{t('trader.chooseMethod')}</option>
                    <option value="Telebirr" className="bg-surface text-fg">Telebirr</option>
                    <option value="CBE" className="bg-surface text-fg">CBE</option>
                    <option value="Awash Bank" className="bg-surface text-fg">Awash Bank</option>
                    <option value="Bunna Bank" className="bg-surface text-fg">Bunna Bank</option>
                    <option value="Other" className="bg-surface text-fg">Other</option>
                  </select>
                </label>
                <label className="col-span-1">
                  <span className={fieldLabel}>{t('trader.accountPhone')}</span>
                  <input
                    value={form.paymentAccount}
                    onChange={(event) => update('paymentAccount', event.target.value)}
                    placeholder="+2519... or account no."
                    className={fieldInput}
                  />
                </label>
                <label className="col-span-1 sm:col-span-2">
                  <span className={fieldLabel}>{t('trader.openingHours')}</span>
                  <input
                    value={form.hours}
                    onChange={(event) => update('hours', event.target.value)}
                    className={fieldInput}
                  />
                </label>
              </>
            )}
          </div>

          {error && <p className="mt-3 text-[12.5px] text-[#ffb27a]">{error}</p>}

          <Button type="submit" disabled={busy} className="mt-5 w-full">
            {busy ? <Loader2 className="animate-spin" /> : mode === 'in' ? <Lock /> : <Store />}             {busy ? t('trader.working') : mode === 'in' ? t('trader.signIn') : t('trader.openAccount')}
          </Button>

          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">            {t('trader.demoTrader')}: <span className="font-medium text-muted">+251 911 234 567</span> ·{' '}
             <span className="font-medium text-muted">asbeza</span>. {t('trader.memoryNote')}
          </p>
        </form>
      </main>
    </div>
  )
}

function Stats({ products }: { products: Product[] }) {
  const { t } = useLanguage()
  const out = products.filter((product) => product.stock === 'out').length
  const lowered = products.filter((product) => priceDelta(product.price, product.previousPrice)?.direction === 'down').length
  const raised = products.filter((product) => priceDelta(product.price, product.previousPrice)?.direction === 'up').length
  const updated = latestUpdate(products)

  const tiles: Array<{ label: string; value: ReactNode; tone?: string }> = [
    { label: t('trader.onBoard'), value: products.length },
    { label: t('trader.soldOut'), value: out, tone: out > 0 ? 'text-[#ffb27a]' : undefined },
    { label: t('trader.pricesCut'), value: lowered, tone: lowered > 0 ? 'text-[#8ff0b4]' : undefined },
    { label: t('trader.pricesRaised'), value: raised, tone: raised > 0 ? 'text-[#d3f58a]' : undefined },
  ]

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="depth relative rounded-card-sm bg-surface p-4">
          <p className="text-[11.5px] uppercase tracking-[0.06em] text-faint">{tile.label}</p>
          <p className={cx('mt-1.5 text-[24px] font-semibold leading-none tabular-nums', tile.tone)}>{tile.value}</p>
        </div>
      ))}
      <div className="depth relative col-span-2 rounded-card-sm bg-surface p-4 lg:col-span-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] text-muted">
            {t('trader.lastChange')}{' '}
            <span className="font-medium text-fg">{updated ? formatUpdated(updated) : t('trader.nothingYet')}</span>
          </p>
          <p className="text-[12px] text-faint">{t('trader.editVisible')}</p>
        </div>
      </div>
    </div>
  )
}

function AddProduct({
  currency,
  onAdded,
  onError,
}: {
  currency: string
  onAdded: (product: Product) => void
  onError: (err: unknown) => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    name: '',
    emoji: '',
    category: 'Vegetable' as Category,
    unit: 'kg' as string,
    price: '',
    stock: 'in' as Stock,
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [note, setNote] = useState('')
  const [drafting, setDrafting] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  // Ask the board's assistant to read a one-line note and fill the form.
  async function draft() {
    if (note.trim().length < 4) return complain('Say what you are selling, for example "2 quintals of teff at 4800 birr".')
    setDrafting(true)
    setMessage(null)
    try {
      const drafted = await api.draftListing(note.trim())
      setForm((current) => ({
        ...current,
        name: drafted.draft.name,
        emoji: drafted.draft.emoji,
        category: drafted.draft.category,
        unit: drafted.draft.unit,
        price: String(drafted.draft.price),
        stock: drafted.draft.stock,
        note: drafted.draft.note,
      }))
      setMessage('Filled from your note — check the price, then add it.')
      setFailed(false)
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) {
        setMessage(
          err.status === 503 ? 'The drafting helper is not switched on here — type the fields yourself.' : err.message,
        )
        setFailed(true)
      } else {
        onError(err)
      }
    } finally {
      setDrafting(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const price = Number.parseFloat(form.price)
    if (form.name.trim().length < 2) return complain(t('trader.enterProductName'))
    if (!Number.isFinite(price) || price < 0) return complain(t('trader.enterPriceExample'))

    setBusy(true)
    setMessage(null)
    try {
      const { product } = await api.addProduct({
        name: form.name.trim(),
        emoji: form.emoji.trim() || '🥬',
        category: form.category,
        unit: form.unit,
        price,
        stock: form.stock,
        note: form.note.trim(),
      })
      onAdded(product)
      setForm((current) => ({ ...current, name: '', emoji: '', price: '', note: '' }))
      setMessage(`${product.name} ${t('trader.isOnBoard')}`)
      setFailed(false)
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  function complain(text: string) {
    setMessage(text)
    setFailed(true)
  }

  return (
    <section className="depth relative rounded-card bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{t('trader.addProduct')}</h2>
        <span className="text-[11.5px] text-faint">{t('trader.namePriceUnit')}</span>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className={fieldLabel}>{t('trader.sayItOnce')}</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('trader.draftPlaceholder')}
            maxLength={400}
            className={fieldInput}
          />
        </label>
        <Button variant="secondary" onClick={draft} disabled={drafting} className="h-10 px-3 text-[13px]">
          {drafting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {t('trader.draftIt')}
        </Button>
      </div>

      <form onSubmit={submit} className="mt-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-6">
          <label className="col-span-1 sm:col-span-3">
            <span className={fieldLabel}>{t('trader.product')}</span>
            <input
              value={form.name}
              onChange={(event) => {
                const next = event.target.value
                update('name', next)
                const match = PRODUCTS.find((item) => item.name.toLowerCase() === next.trim().toLowerCase())
                if (match) {
                  update('emoji', match.emoji)
                  update('category', match.category as Category)
                  update('unit', match.unit)
                }
              }}
              list="product-suggestions"
              placeholder={t('trader.productPlaceholder')}
              className={fieldInput}
            />
            <datalist id="product-suggestions">
              {PRODUCTS.map((item) => (
                <option key={item.name} value={item.name} />
              ))}
            </datalist>
          </label>
          <label className="col-span-1 sm:col-span-1">
            <span className={fieldLabel}>{t('trader.emoji')}</span>
            <input
              value={form.emoji}
              onChange={(event) => update('emoji', event.target.value)}
              placeholder="🌶️"
              maxLength={4}
              className={fieldInput}
            />
          </label>
          <label className="col-span-1 sm:col-span-2">
            <span className={fieldLabel}>{t('trader.price')} ({currencySymbol(currency)})</span>
            <input
              value={form.price}
              onChange={(event) => update('price', event.target.value)}
              inputMode="decimal"
              placeholder="480"
              className={fieldInput}
            />
          </label>
          <label className="col-span-1 sm:col-span-2">
            <span className={fieldLabel}>{t('trader.category')}</span>
            <select
              value={form.category}
              onChange={(event) => update('category', event.target.value as Category)}
              className={fieldInput}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category} className="bg-surface text-fg">
                  {t(`category.${category}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-1 sm:col-span-2">
            <span className={fieldLabel}>{t('trader.soldBy')}</span>
            <select value={form.unit} onChange={(event) => update('unit', event.target.value)} className={fieldInput}>
              {UNITS.map((unit) => (
                <option key={unit} value={unit} className="bg-surface text-fg">
                  {t('trader.per')} {unit}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-1 sm:col-span-1">
            <span className={fieldLabel}>{t('trader.stock')}</span>
            <select
              value={form.stock}
              onChange={(event) => update('stock', event.target.value as Stock)}
              className={fieldInput}
            >
              {STOCKS.map((stock) => (
                <option key={stock} value={stock} className="bg-surface text-fg">
                  {t(`stock.${stock}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-1 sm:col-span-1">
            <span className={fieldLabel}>{t('trader.note')}</span>
            <input
              value={form.note}
              onChange={(event) => update('note', event.target.value)}
              placeholder={t('trader.notePlaceholder')}
              className={fieldInput}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className={cx('text-[12px]', failed ? 'text-[#ffb27a]' : 'text-muted')}>
            {message ?? t('trader.addedItemsAppear')}
          </p>
          <Button type="submit" disabled={busy} className="h-10 px-4 text-[13px]">
            {busy ? <Loader2 className="animate-spin" /> : <Plus />}
            {t('trader.addToBoard')}
          </Button>
        </div>
      </form>
    </section>
  )
}

function ProductList({
  products,
  currency,
  onSaved,
  onRemoved,
  onError,
}: {
  products: Product[]
  currency: string
  onSaved: (product: Product) => void
  onRemoved: (id: string) => void
  onError: (err: unknown) => void
}) {
  const { t } = useLanguage()
  const sorted = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products])

  return (
    <section className="depth relative rounded-card bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{t('trader.pricesOnBoard')}</h2>
        <span className="text-[11.5px] text-faint">{products.length} {t('trader.items')}</span>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-[12px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-muted">
          {t('trader.nothingListed')}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {sorted.map((product) => (
            <li key={product.id}>
              <ProductRow product={product} currency={currency} onSaved={onSaved} onRemoved={onRemoved} onError={onError} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProductRow({
  product,
  currency,
  onSaved,
  onRemoved,
  onError,
}: {
  product: Product
  currency: string
  onSaved: (product: Product) => void
  onRemoved: (id: string) => void
  onError: (err: unknown) => void
}) {
  const { t } = useLanguage()
  const [price, setPrice] = useState(String(product.price))
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<'saved' | 'failed' | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setPrice(String(product.price))
  }, [product.price])

  async function save(patch: Partial<ProductInput>) {
    setBusy(true)
    try {
      const { product: next } = await api.updateProduct(product.id, { ...patch, version: product.version })
      onSaved(next)
      setFlash('saved')
    } catch (err) {
      onError(err)
      setFlash('failed')
    } finally {
      setBusy(false)
      window.setTimeout(() => setFlash(null), 1800)
    }
  }

  function commitPrice() {
    const next = Number.parseFloat(price)
    if (!Number.isFinite(next) || next < 0) {
      setPrice(String(product.price))
      return
    }
    if (round2(next) === product.price) {
      setPrice(String(product.price))
      return
    }
    void save({ price: next })
  }

  async function remove() {
    if (!confirming) {
      setConfirming(true)
      window.setTimeout(() => setConfirming(false), 3500)
      return
    }
    setBusy(true)
    try {
      await api.removeProduct(product.id)
      onRemoved(product.id)
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="depth relative flex flex-col gap-2.5 rounded-[14px] bg-bg/50 p-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          aria-hidden
          className={cx('grid size-10 shrink-0 place-items-center rounded-[11px] text-[18px]', CATEGORY_STYLES[product.category])}
        >
          {product.emoji}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-medium">{product.name}</p>
          <p className="truncate text-[11.5px] text-faint">
            {product.category}
            {product.note ? ` · ${product.note}` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex h-10 items-center gap-1 rounded-[10px] border border-line bg-surface px-2 focus-within:border-[rgb(34_197_94/0.5)]">
          <span className="text-[11px] text-faint">{currencySymbol(currency)}</span>
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            onBlur={commitPrice}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setPrice(String(product.price))
                event.currentTarget.blur()
              }
            }}
            inputMode="decimal"
            aria-label={`Price for ${product.name}`}
            className="w-16 bg-transparent text-right text-[13px] font-semibold tabular-nums outline-none"
          />
        </label>

        {(() => {
          const delta = priceDelta(product.price, product.previousPrice)
          if (!delta) return null
          return (
            <span
              className={cx(
                'inline-flex h-10 items-center gap-0.5 rounded-[10px] px-2 text-[11.5px] font-medium',
                delta.direction === 'up' ? 'bg-[rgb(34_197_94/0.14)] text-[#8ff0b4]' : 'bg-[rgb(249_115_22/0.14)] text-[#ffb27a]',
              )}
              title={delta.direction === 'up' ? t('trader.priceIncreased') : t('trader.priceDecreased')}
            >
              {delta.direction === 'up' ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.round(delta.percent)}%
            </span>
          )
        })()}

        <select
          value={product.unit}
          onChange={(event) => void save({ unit: event.target.value })}
          aria-label={`Unit for ${product.name}`}
          className="h-10 rounded-[10px] border border-line bg-surface px-2 text-[12px] text-muted outline-none"
        >
          {UNITS.map((unit) => (
            <option key={unit} value={unit} className="bg-surface text-fg">
              {t('trader.per')} {unit}
            </option>
          ))}
        </select>

        <select
          value={product.stock}
          onChange={(event) => void save({ stock: event.target.value as Stock })}
          aria-label={`Stock for ${product.name}`}
          className="h-10 rounded-[10px] border border-line bg-surface px-2 text-[12px] text-muted outline-none"
        >
          {STOCKS.map((stock) => (
            <option key={stock} value={stock} className="bg-surface text-fg">
              {t(`stock.${stock}`)}
            </option>
          ))}
        </select>

        <span className="w-11 text-center text-[10.5px]">
          {busy ? (
            <Loader2 className="mx-auto size-3.5 animate-spin text-faint" />
          ) : flash === 'saved' ? (
            <Check className="mx-auto size-3.5 text-[#8ff0b4]" />
          ) : flash === 'failed' ? (
            <span className="text-[#ffb27a]">!</span>
          ) : null}
        </span>

        <button
          type="button"
          onClick={remove}
          disabled={busy}aria-label={confirming ? `${t('trader.confirmRemoving')} ${product.name}` : `${t('trader.remove')} ${product.name}`}
          className={cx(
            'inline-flex h-10 items-center gap-1 rounded-[10px] px-2 text-[11.5px] transition-colors disabled:opacity-50',
            confirming ? 'bg-[rgb(249_115_22/0.18)] text-[#ffb27a]' : 'text-faint hover:bg-white/[0.06] hover:text-[#ffb27a]',
          )}
        >
          <Trash2 className="size-3.5" />
          {confirming ? t('trader.sure') : ''}
        </button>
      </div>
    </div>
  )
}

function ShopForm({
  shop,
  onSaved,
  onError,
}: {
  shop: PublicShop
  onSaved: (shop: PublicShop) => void
  onError: (err: unknown) => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState<ShopDetails>({
    name: shop.name,
    location: shop.location,
    latitude: shop.latitude ?? null,
    longitude: shop.longitude ?? null,
    houseNumber: shop.houseNumber,
    hours: shop.hours,
    currency: shop.currency,
    plan: shop.plan,
    paymentMethod: shop.paymentMethod ?? '',
    paymentAccount: shop.paymentAccount ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm({
      name: shop.name,
      location: shop.location,
      latitude: shop.latitude ?? null,
      longitude: shop.longitude ?? null,
      houseNumber: shop.houseNumber,
      hours: shop.hours,
      currency: shop.currency,
      plan: shop.plan,
      paymentMethod: shop.paymentMethod ?? '',
      paymentAccount: shop.paymentAccount ?? '',
    })
  }, [shop])

  function update<K extends keyof ShopDetails>(key: K, value: ShopDetails[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const { shop: next } = await api.saveShop({ ...form, version: shop.version })
      onSaved(next)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2200)
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="depth relative rounded-card bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{t('trader.shopDetails')}</h2>
        <span className="text-[11.5px] text-faint">{t('trader.shownOnBoard')}</span>
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-col gap-2.5">
        <label>
          <span className={fieldLabel}>{t('trader.shopName')}</span>
          <input value={form.name} onChange={(event) => update('name', event.target.value)} className={fieldInput} />
        </label>
        <label>
          <span className={fieldLabel}>{t('trader.marketOrArea')}</span>
          <input value={form.location} onChange={(event) => update('location', event.target.value)} className={fieldInput} />
        </label>
        <div className="flex items-center justify-between gap-2 rounded-[12px] border border-line bg-bg/50 px-3 py-2">
          <span className="text-[11.5px] text-muted">
            {form.latitude && form.longitude ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}` : t('trader.locationNotSet')}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) return
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  update('latitude', position.coords.latitude)
                  update('longitude', position.coords.longitude)
                },
                () => undefined,
                { enableHighAccuracy: true, timeout: 10000 },
              )
            }}
            className="rounded-control px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
          >
            {t('trader.useMyLocation')}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label>
            <span className={fieldLabel}>{t('trader.houseShopNo')}</span>
            <input
              value={form.houseNumber}
              onChange={(event) => update('houseNumber', event.target.value)}
              className={fieldInput}
            />
          </label>
          <label>
            <span className={fieldLabel}>{t('trader.currency')}</span>
            <select
              value={form.currency}
              onChange={(event) => update('currency', event.target.value)}
              className={fieldInput}
            >
              {CURRENCIES.map((option) => (
                <option key={option.code} value={option.code} className="bg-surface text-fg">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span className={fieldLabel}>{t('trader.openingHours')}</span>
          <input value={form.hours} onChange={(event) => update('hours', event.target.value)} className={fieldInput} />
        </label>          <label>
            <span className={fieldLabel}>{t('trader.plan')}</span>
            <select
              value={form.plan ?? 'free'}
              onChange={(event) => update('plan', event.target.value as PlanCode)}
              className={fieldInput}
            >
              {PLANS.map((plan) => (
                <option key={plan.code} value={plan.code} className="bg-surface text-fg">
                  {plan.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label>
              <span className={fieldLabel}>{t('trader.paymentMethod')}</span>
              <select
                value={form.paymentMethod ?? ''}
                onChange={(event) => update('paymentMethod', event.target.value)}
                className={fieldInput}
              >
                <option value="" className="bg-surface text-fg">{t('trader.chooseMethod')}</option>
                <option value="Telebirr" className="bg-surface text-fg">Telebirr</option>
                <option value="CBE" className="bg-surface text-fg">CBE</option>
                <option value="Awash Bank" className="bg-surface text-fg">Awash Bank</option>
                <option value="Bunna Bank" className="bg-surface text-fg">Bunna Bank</option>
                <option value="Other" className="bg-surface text-fg">Other</option>
              </select>
            </label>
            <label>
              <span className={fieldLabel}>{t('trader.accountPhone')}</span>
              <input
                value={form.paymentAccount ?? ''}
                onChange={(event) => update('paymentAccount', event.target.value)}
                placeholder="+2519... or account no."
                className={fieldInput}
              />
            </label>
          </div>
          <label>
            <span className={fieldLabel}>{t('trader.loginPhone')}</span>
            <input value={formatPhone(shop.phone)} readOnly className={cx(fieldInput, 'text-muted')} />
          </label>

        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-[11.5px] text-faint">{saved ? t('trader.saved') : t('trader.changeCurrency')}</p>
          <Button type="submit" disabled={busy} variant="secondary" className="h-10 px-4 text-[13px]">
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            {t('trader.saveDetails')}
          </Button>
        </div>
      </form>
    </section>
  )
}
