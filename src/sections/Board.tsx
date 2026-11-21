import { ArrowDownRight, ArrowUpRight, Check, ClipboardCopy, Clock, MapPin, Minus, Phone, Plus, QrCode, Search, ShoppingCart, Store, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Aurora } from '../components/Aurora'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { Logo } from '../components/Logo'
import { brand } from '../content'
import { api, type Catalogue } from '../lib/api'
import {
  CATEGORIES,
  CATEGORY_STYLES,
  STOCK_DOTS,
  STOCK_STYLES,
  formatMoney,
  formatPhone,
  formatUpdated,
  latestUpdate,
  priceDelta,
  distanceKm,
  type Category,
  type Product,
  type PublicShop,
} from '../lib/catalogue'
import { cx } from '../lib/cx'
import { LANGUAGES } from '../lib/i18n'
import { useLanguage } from '../lib/language'
import { linkTo } from '../lib/router'

type Sort = 'name' | 'price-asc' | 'price-desc'

const SORTS: Array<{ value: Sort; labelKey: string }> = [
  { value: 'name', labelKey: 'board.sort.name' },
  { value: 'price-asc', labelKey: 'board.sort.priceAsc' },
  { value: 'price-desc', labelKey: 'board.sort.priceDesc' },
]

// The public board: every trader's prices for today in one place, grouped by
// who is selling so a customer knows where to walk.
export function Board() {
  const { lang, setLang, t } = useLanguage()
  const [data, setData] = useState<Catalogue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'All' | Category>('All')
  const [traderId, setTraderId] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('name')
  const [copied, setCopied] = useState(false)
  const [copyNote, setCopyNote] = useState<string | null>(null)

  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      const raw = window.localStorage.getItem('asbeza:buying-list')
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const next: Record<string, number> = {}
      for (const [id, value] of Object.entries(parsed ?? {})) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) next[id] = Math.floor(value)
      }
      return next
    } catch {
      return {}
    }
  })
  const [cartOpen, setCartOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [nearMe, setNearMe] = useState(false)
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [nearMeError, setNearMeError] = useState<string | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem('asbeza:buying-list', JSON.stringify(cart))
    } catch {
      /* ignore storage failures */
    }
  }, [cart])

  const toggleCartItem = useCallback((id: string) => {
    setCart((prev) => {
      if (prev[id]) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: 1 }
    })
    setCartOpen(true)
  }, [])

  const setCartQty = useCallback((id: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: Math.floor(quantity) }
    })
  }, [])

  const removeCartItem = useCallback((id: string) => {
    setCart((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const clearCart = useCallback(() => setCart({}), [])

  useEffect(() => {
    let active = true
    api
      .catalogue()
      .then((next) => {
        if (active) setData(next)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load the price list.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const shops = data?.shops ?? []
  const listings = data?.listings ?? []

  const shopMap = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops])

  useEffect(() => {
    if (!nearMe || userCoords) return
    if (!navigator.geolocation) {
      setNearMeError(t('board.locationUnsupported'))
      setNearMe(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setNearMeError(null)
      },
      () => {
        setNearMeError(t('board.locationDenied'))
        setNearMe(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [nearMe, userCoords, t])

  const counts = useMemo(() => {
    const map = new Map<Category, number>()
    for (const listing of listings) map.set(listing.category, (map.get(listing.category) ?? 0) + 1)
    return map
  }, [listings])

  const shopDistances = useMemo(() => {
    const map = new Map<string, number>()
    if (!userCoords) return map
    for (const shop of shops) {
      const distance = distanceKm(userCoords, shop)
      if (distance !== null) map.set(shop.id, distance)
    }
    return map
  }, [shops, userCoords])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return listings
      .filter((listing) => traderId === 'all' || listing.shopId === traderId)
      .filter((listing) => category === 'All' || listing.category === category)
      .filter((listing) => {
        if (!needle) return true
        const shop = shopMap.get(listing.shopId)
        return [listing.name, listing.note, listing.category, shop?.name ?? '', shop?.location ?? ''].some((field) =>
          field.toLowerCase().includes(needle),
        )
      })
      .filter((listing) => {
        if (!nearMe || !userCoords) return true
        return shopDistances.has(listing.shopId)
      })
      .sort((a, b) => {
        if (nearMe && userCoords) {
          const da = shopDistances.get(a.shopId) ?? Infinity
          const db = shopDistances.get(b.shopId) ?? Infinity
          if (da !== db) return da - db
        }
        if (sort === 'price-asc') return a.price - b.price
        if (sort === 'price-desc') return b.price - a.price
        return a.name.localeCompare(b.name)
      })
  }, [listings, shopMap, traderId, category, query, sort, nearMe, userCoords, shopDistances])

  const nearestShop = useMemo(() => {
    if (!userCoords || shopDistances.size === 0) return null
    let nearest: PublicShop | null = null
    let nearestDistance = Infinity
    for (const shop of shops) {
      const distance = shopDistances.get(shop.id)
      if (distance !== undefined && distance < nearestDistance) {
        nearestDistance = distance
        nearest = shop
      }
    }
    return nearest ? { shop: nearest, distance: nearestDistance } : null
  }, [shops, shopDistances, userCoords])

  const activeShop = traderId === 'all' ? null : (shopMap.get(traderId) ?? null)
  const updated = latestUpdate(listings)
  const outOfStock = listings.filter((listing) => listing.stock === 'out').length

  const cartItems = useMemo(
    () =>
      listings
        .filter((listing) => (cart[listing.id] ?? 0) > 0)
        .map((listing) => ({
          product: listing,
          shop: shopMap.get(listing.shopId),
          quantity: cart[listing.id],
        })),
    [listings, cart, shopMap],
  )

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)

  const cartTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const item of cartItems) {
      const currency = item.shop?.currency ?? 'ETB'
      totals.set(currency, (totals.get(currency) ?? 0) + item.product.price * item.quantity)
    }
    return [...totals.entries()]
  }, [cartItems])

  const cartChanges = useMemo(() => {
    const totals = new Map<string, number>()
    for (const item of cartItems) {
      const currency = item.shop?.currency ?? 'ETB'
      const delta = priceDelta(item.product.price, item.product.previousPrice)
      if (delta) {
        totals.set(currency, (totals.get(currency) ?? 0) + delta.change * item.quantity)
      }
    }
    return [...totals.entries()]
  }, [cartItems])

  const cartTraderGroups = useMemo(() => {
    const groups = new Map<
      string,
      { shop?: PublicShop; currency: string; total: number }
    >()
    for (const item of cartItems) {
      const key = item.shop?.id ?? item.product.shopId
      const currency = item.shop?.currency ?? 'ETB'
      const existing = groups.get(key)
      if (existing) {
        existing.total += item.product.price * item.quantity
      } else {
        groups.set(key, { shop: item.shop, currency, total: item.product.price * item.quantity })
      }
    }
    return [...groups.values()]
  }, [cartItems])

  const copyList = useCallback(async () => {
    const grouped = new Map<string, Product[]>()
    for (const listing of visible) {
      const bucket = grouped.get(listing.shopId)
      if (bucket) bucket.push(listing)
      else grouped.set(listing.shopId, [listing])
    }

    const lines = [`${brand.name} — today’s prices`, `${grouped.size} traders · ${visible.length} items`, '']
    for (const [id, items] of grouped) {
      const shop = shopMap.get(id)
      if (!shop) continue
      const place = `${shop.location}${shop.houseNumber ? `, ${t('admin.house')} ${shop.houseNumber}` : ''}`
      lines.push(`${shop.name} — ${place} · ${formatPhone(shop.phone)}`)
      for (const item of items) {
        const state = item.stock === 'out' ? ' (sold out)' : item.stock === 'low' ? ' (few left)' : ''
        lines.push(`  ${item.name}: ${formatMoney(item.price, shop.currency)} / ${item.unit}${state}`)
      }
      lines.push('')
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setCopyNote(null)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopyNote('Copying is blocked in this browser. Select the prices and copy them by hand.')
    }
  }, [visible, shopMap])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
        <Container className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
          <Logo />
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              aria-label={t('board.shareQr')}
              className="inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-line bg-bg/60 px-2.5 text-[12.5px] text-muted transition-colors hover:text-fg"
            >
              <QrCode className="size-4" />
              <span className="hidden sm:inline">{t('board.qr')}</span>
            </button>
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
              href="#traders"
              className="hidden h-10 items-center rounded-[12px] px-3 text-[13.5px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg sm:inline-flex"
            >
              {t('nav.traders')}
            </a>
            <Button variant="secondary" href="/trader" onClick={linkTo('/trader')} className="h-10 rounded-[12px] px-3.5 text-[13px]">
              <Store />
              {t('nav.traderSignIn')}
            </Button>
          </div>
        </Container>
      </header>

      <section className="relative overflow-hidden pt-12 pb-8 sm:pt-16">
        <Aurora intensity={0.6} />
        <div aria-hidden className="grid-lines absolute inset-x-0 top-0 h-[460px]" />
        <Container className="relative">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <span className="depth relative inline-flex h-8 items-center gap-2 rounded-[12px] bg-white/[0.04] px-3 text-[12.5px] text-muted">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#4ade80] opacity-70" />
                  <span className="round relative inline-flex size-1.5 rounded-full bg-[#4ade80]" />
                </span>
                {t('board.live')} · {shops.length} {t('board.tradersPosting')}
              </span>

              <h1 className="mt-5 max-w-2xl text-balance text-[34px] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-[46px]">
                {t('board.todayPrices')}
              </h1>
              <p className="mt-3 max-w-xl text-pretty text-[14.5px] leading-relaxed text-muted">
                {t('board.heroSub')}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Store className="size-3.5 text-faint" />
                  {shops.length} {t('board.traders')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {listings.length} {t('board.items')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5 text-faint" />
                  {updated ? formatUpdated(updated) : 'waiting for the first price'}
                </span>
              </div>
            </div>

            {data && (
              <div className="depth relative w-full shrink-0 rounded-card bg-surface p-4 sm:w-[300px]">
                <p className="text-[11.5px] uppercase tracking-[0.08em] text-faint">{t('board.lastUpdated')}</p>
                <p className="mt-1 text-[16px] font-medium">{updated ? formatUpdated(updated) : t('board.notUpdatedYet')}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  {listings.length} {t('board.items')} {t('board.from')} {shops.length} {t('board.traders')} · {outOfStock} {t('board.soldOut')}
                </p>
                <Button variant="secondary" onClick={copyList} className="mt-3 w-full text-[13px]">
                  {copied ? <Check /> : <ClipboardCopy />}
                  {copied ? t('board.copied') : t('board.copyList')}
                </Button>
                {copyNote && <p className="mt-2 text-[11.5px] leading-relaxed text-[#d3f58a]">{copyNote}</p>}
              </div>
            )}
          </div>
        </Container>
      </section>

      <section id="traders" className="scroll-mt-24 pb-4">
        <Container>
          <h2 className="text-[15px] font-semibold">{t('board.soldBy')}</h2>
          <div className="mt-2.5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            <TraderChip active={traderId === 'all'} onClick={() => setTraderId('all')} label={t('board.allTraders')} meta={`${shops.length} ${t('board.shops')}`} />
            {shops.map((shop) => (
              <TraderChip
                key={shop.id}
                active={traderId === shop.id}
                onClick={() => setTraderId(shop.id)}
                label={shop.name}
                meta={shop.location}
              />
            ))}
          </div>

          {activeShop && (
            <div className="depth relative mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card-sm bg-surface px-4 py-3 text-[12.5px] text-muted">
              <span className="inline-flex items-center gap-1.5 text-fg">
                <Store className="size-3.5 text-accent" />
                {activeShop.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-faint" />
                {activeShop.location} · {t('board.house')} {activeShop.houseNumber}
              </span>
              <a href={`tel:+${activeShop.phone}`} className="inline-flex items-center gap-1.5 hover:text-fg">
                <Phone className="size-3.5 text-faint" />
                {formatPhone(activeShop.phone)}
              </a>                {activeShop.paymentMethod && (
                <span className="inline-flex items-center gap-1.5">
                  {t('board.pay')}: {activeShop.paymentMethod}{activeShop.paymentAccount ? ` · ${activeShop.paymentAccount}` : ''}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-faint" />
                {activeShop.hours}
              </span>
            </div>
          )}
        </Container>
      </section>

      <section id="prices" className="scroll-mt-24 pb-4">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{t('board.todayPricesHeading')}</h2>
              <p className="mt-1 text-[13px] text-muted">
                {data ? `${visible.length} ${t('board.of')} ${listings.length} ${t('board.items')}` : t('board.loadingBoard')}
                {category !== 'All' ? ` ${t('board.in')} ${t(`category.${category}`)}` : ''}
                {activeShop ? ` ${t('board.from')} ${activeShop.name}` : ''}
              </p>
            </div>
          </div>

          <div className="depth relative mt-4 flex flex-col gap-2.5 rounded-card bg-surface p-2.5 sm:flex-row sm:items-center">
            <label className="depth relative flex h-11 min-w-0 flex-1 items-center gap-2 rounded-control bg-bg/60 px-3">
              <Search className="size-4 shrink-0 text-faint" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('board.searchPlaceholder')}
                aria-label={t('board.searchAria')}
                className="h-full w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
              {query && (
                <button
                  type="button"
                  aria-label={t('board.clearSearch')}
                  onClick={() => setQuery('')}
                  className="grid size-6 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-white/[0.08] hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </label>

            <button
              type="button"
              onClick={() => setNearMe((value) => !value)}
              aria-pressed={nearMe}
              className={cx(
                'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control border px-3 text-[13px] transition-colors',
                nearMe ? 'border-[rgb(34_197_94/0.5)] bg-[rgb(34_197_94/0.14)] text-[#a7f3c0]' : 'border-line bg-bg/60 text-muted hover:text-fg',
              )}
            >
              <MapPin className="size-4" />
              {nearMe ? t('board.nearMeOn') : t('board.nearMe')}
            </button>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              aria-label={t('board.sortAria')}
              className="h-11 shrink-0 rounded-control border border-line bg-bg/60 px-3 text-[13px] text-muted outline-none transition-colors hover:text-fg"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value} className="bg-surface text-fg">
                  {t(option.labelKey)}
                </option>
              ))}
            </select>

            <div className="-mx-0.5 flex shrink-0 gap-1.5 overflow-x-auto px-0.5 pb-0.5 sm:pb-0 scrollbar-none">
              <Chip active={category === 'All'} onClick={() => setCategory('All')} count={listings.length}>
                {t('board.all')}
              </Chip>
              {CATEGORIES.map((option) => (
                <Chip
                  key={option}
                  active={category === option}
                  onClick={() => setCategory(option)}
                  count={counts.get(option) ?? 0}
                  disabled={!counts.get(option)}
                >
                  {t(`category.${option}`)}
                </Chip>
              ))}
            </div>
          </div>

          {nearMeError && (
            <div className="depth relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card-sm bg-surface p-4">
              <p className="text-[13.5px] text-[#ffb27a]">{nearMeError}</p>
              <Button variant="secondary" onClick={() => setNearMeError(null)} className="h-10 text-[13px]">
                {t('board.dismiss')}
              </Button>
            </div>
          )}

          {nearMe && nearestShop && (
            <div className="depth relative mt-4 rounded-card bg-surface p-4">
              <p className="text-[11.5px] uppercase tracking-[0.08em] text-faint">{t('board.nearestDelivery')}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold">{nearestShop.shop.name}</p>
                  <p className="text-[12.5px] text-muted">
                    {nearestShop.shop.location} · {t('board.house')} {nearestShop.shop.houseNumber} · {nearestShop.distance.toFixed(1)} {t('board.kmAway')}
                  </p>
                </div>
                <a href={`tel:+${nearestShop.shop.phone}`} className="inline-flex h-10 items-center gap-1.5 rounded-[12px] bg-[rgb(34_197_94/0.16)] px-3 text-[13px] font-medium text-[#a7f3c0]">
                  <Phone className="size-4" />
                  {formatPhone(nearestShop.shop.phone)}
                </a>
              </div>
            </div>
          )}

          {error && (
            <div className="depth relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card-sm bg-surface p-4">
              <p className="text-[13.5px] text-[#ffb27a]">{error}</p>
              <Button variant="secondary" onClick={() => window.location.reload()} className="h-10 text-[13px]">
                {t('board.tryAgain')}
              </Button>
            </div>
          )}

          {loading && !data ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-[164px] animate-pulse rounded-card-sm border border-line bg-surface/60" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="depth relative mt-4 rounded-card bg-surface px-5 py-12 text-center">
              <p className="text-[15px] font-medium">{t('board.noMatch')}</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted">
                {t('board.noMatchSub')}
              </p>
              <Button
                variant="secondary"
                className="mt-4 text-[13px]"
                onClick={() => {
                  setQuery('')
                  setCategory('All')
                  setTraderId('all')
                }}
              >
                {t('board.showEverything')}
              </Button>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((listing) => {
                const shop = shopMap.get(listing.shopId)
                return (
                  <li key={listing.id}>
                    <ProductCard
                      product={listing}
                      shop={shop}
                      distance={nearMe ? shopDistances.get(listing.shopId) : undefined}
                      selected={Boolean(cart[listing.id])}
                      onToggle={() => toggleCartItem(listing.id)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Container>
      </section>

      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#22c55e] px-4 py-3 text-[13px] font-semibold text-[#052e16] shadow-[0_12px_30px_rgb(34_197_94/0.35)] transition-transform hover:scale-[1.02]"
        >
          <ShoppingCart className="size-4" />
          {t('board.buyingList')} · {cartCount}
          <span className="rounded-full bg-black/15 px-2 py-0.5 text-[11.5px] tabular-nums">
            {cartTotals.length === 1
              ? formatMoney(cartTotals[0][1], cartTotals[0][0])
              : `${cartTotals.length} currencies`}
          </span>
        </button>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close buying list"
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <aside className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-bg shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[18px] font-semibold">{t('board.buyingList')}</h2>
                <p className="text-[12.5px] text-muted">{cartCount} {cartCount === 1 ? t('board.item') : t('board.items')} · {t('board.autoCalculated')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded-control px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
                >
                  {t('board.clear')}
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="grid size-9 place-items-center rounded-control text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
                  aria-label={t('board.close')}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartItems.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-muted">{t('board.buyingListEmpty')}</p>
              ) : (
                <ul className="space-y-3">
                  {cartItems.map(({ product, shop, quantity }) => {
                    const currency = shop?.currency ?? 'ETB'
                    const delta = priceDelta(product.price, product.previousPrice)
                    const subtotal = product.price * quantity
                    const changeTotal = delta ? delta.change * quantity : 0
                    return (
                      <li key={product.id} className="depth relative rounded-card-sm bg-surface p-3.5">
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden
                            className={cx('grid size-9 shrink-0 place-items-center rounded-[12px] text-[18px]', CATEGORY_STYLES[product.category])}
                          >
                            {product.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold">{product.name}</p>
                            <p className="truncate text-[11.5px] text-faint">
                              {shop?.name ?? 'Trader'} · {formatMoney(product.price, currency)} / {product.unit}
                            </p>
                            {shop?.paymentAccount && (
                              <p className="truncate text-[11px] text-faint">
                                {t('board.pay')}: {shop.paymentMethod ?? t('board.payment')} · {shop.paymentAccount}
                              </p>
                            )}
                            {delta ? (
                              <p
                                className={cx(
                                  'mt-1 flex items-center gap-1 text-[11px]',
                                  delta.direction === 'up' ? 'text-[#8ff0b4]' : 'text-[#ffb27a]',
                                )}
                              >
                                {delta.direction === 'up' ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                {formatMoney(Math.abs(delta.change), currency)} {delta.direction === 'up' ? t('board.higher') : t('board.lower')} {t('board.per')} {product.unit}
                                <span className="text-faint">· {Math.round(delta.percent)}%</span>
                              </p>
                            ) : (
                              <p className="mt-1 text-[11px] text-faint">Same price as yesterday</p>
                            )}
                            {delta && (
                              <p
                                className={cx(
                                  'mt-0.5 text-[11px] font-medium',
                                  delta.direction === 'up' ? 'text-[#8ff0b4]' : 'text-[#ffb27a]',
                                )}
                              >
                                {delta.direction === 'up' ? '+' : '-'}
                                {formatMoney(Math.abs(changeTotal), currency)} {t('board.vsYesterday')} {t('board.forThisQuantity')}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCartItem(product.id)}
                            className="grid size-8 shrink-0 place-items-center rounded-control text-faint transition-colors hover:bg-white/[0.06] hover:text-fg"
                            aria-label={`Remove ${product.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-control border border-line bg-bg/60">
                            <button
                              type="button"
                              onClick={() => setCartQty(product.id, quantity - 1)}
                              className="grid size-9 place-items-center text-muted transition-colors hover:text-fg"
                              aria-label={`Decrease ${product.name}`}
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="min-w-9 text-center text-[13px] tabular-nums">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => setCartQty(product.id, quantity + 1)}
                              className="grid size-9 place-items-center text-muted transition-colors hover:text-fg"
                              aria-label={`Increase ${product.name}`}
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <p className="text-[15px] font-semibold tabular-nums">{formatMoney(subtotal, currency)}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-line px-5 py-4">
              {cartTraderGroups.length > 0 && (
                <div className="mb-4 rounded-card-sm bg-surface p-3">
                  <p className="text-[11.5px] uppercase tracking-[0.08em] text-faint">{t('board.payEachTrader')}</p>
                  <ul className="mt-2 space-y-2.5">
                    {cartTraderGroups.map((group, index) => (
                      <li key={group.shop?.id ?? index}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12.5px] font-medium">{group.shop?.name ?? 'Trader'}</span>
                          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums">
                            {formatMoney(group.total, group.currency)}
                          </span>
                        </div>
                        {(group.shop?.paymentMethod || group.shop?.paymentAccount) && (
                          <p className="mt-0.5 truncate text-[11px] text-faint">
                            {group.shop?.paymentMethod ? `${group.shop.paymentMethod}` : t('board.payment')}
                            {group.shop?.paymentAccount ? ` · ${group.shop.paymentAccount}` : ''}
                          </p>
                        )}
                        {!group.shop?.paymentAccount && group.shop?.phone && (
                          <p className="mt-0.5 truncate text-[11px] text-faint">{t('board.phone')}: {formatPhone(group.shop.phone)}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-2">
                {cartTotals.map(([currency, total]) => {
                  const change = cartChanges.find(([itemCurrency]) => itemCurrency === currency)?.[1] ?? 0
                  return (
                    <div key={currency}>
                      <div className="flex items-center justify-between">
                        <span className="text-[12.5px] text-muted">{t('board.totalMoney')} ({currency})</span>
                        <span className="text-[18px] font-semibold tabular-nums">{formatMoney(total, currency)}</span>
                      </div>
                      {change !== 0 && (
                        <div
                          className={cx(
                            'mt-0.5 flex items-center justify-between text-[11.5px]',
                            change > 0 ? 'text-[#8ff0b4]' : 'text-[#ffb27a]',
                          )}
                        >
                          <span className="inline-flex items-center gap-1">
                            {change > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                            {change > 0 ? t('board.rising') : t('board.falling')} {t('board.vsYesterday')}
                          </span>
                          <span className="tabular-nums">
                            {change > 0 ? '+' : '-'}
                            {formatMoney(Math.abs(change), currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {cartTotals.length > 1 && (
                <p className="mt-2 text-[11.5px] text-faint">
                  {t('board.differentCurrencies')}
                </p>
              )}
            </div>
          </aside>
        </div>
      )}

      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close QR code"
            onClick={() => setQrOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="depth relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-card bg-surface p-5 shadow-glow">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold">{t('board.shareBoard')}</h2>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="grid size-9 place-items-center rounded-control text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted">
              {t('board.scanQr')}
            </p>
            <div className="mt-4 flex justify-center rounded-[12px] bg-white p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.location.href)}`}
                alt={t('board.qrAlt')}
                width={220}
                height={220}
                className="h-[220px] w-[220px]"
              />
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-control border border-line bg-bg/60 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{window.location.href}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href)
                    setCopyNote('Link copied')
                  } catch {
                    setCopyNote('Copy blocked; select the link manually.')
                  }
                }}
                className="shrink-0 rounded-control px-2 py-1 text-[12px] text-fg transition-colors hover:bg-white/[0.06]"
              >
                {t('board.copy')}
              </button>
            </div>
            {copyNote && <p className="mt-2 text-[11.5px] leading-relaxed text-[#d3f58a]">{copyNote}</p>}
          </div>
        </div>
      )}

      <footer className="mt-14 border-t border-line py-10">
        <Container className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="max-w-lg">
            <Logo />
            <p className="mt-3 text-[12.5px] leading-relaxed text-faint">
              {t('brand.tagline')}. {t('board.footerNote')}
            </p>
          </div>
          <Button variant="secondary" href="/trader" onClick={linkTo('/trader')} className="text-[13px]">
            <Store />
            {t('board.openTraderAccount')}
          </Button>
        </Container>
      </footer>
    </div>
  )
}

function Chip({
  active,
  onClick,
  count,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors disabled:opacity-40',
        active
          ? 'bg-[rgb(34_197_94/0.18)] text-[#a7f3c0]'
          : 'bg-white/[0.03] text-muted hover:bg-white/[0.07] hover:text-fg',
      )}
    >
      {children}
      <span className={cx('text-[11px] tabular-nums', active ? 'text-[#8ff0b4]' : 'text-faint')}>{count}</span>
    </button>
  )
}

function TraderChip({
  active,
  onClick,
  label,
  meta,
}: {
  active: boolean
  onClick: () => void
  label: string
  meta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'depth relative flex min-w-0 shrink-0 flex-col items-start rounded-[14px] px-3.5 py-2 text-left transition-colors',
        active ? 'bg-[rgb(34_197_94/0.14)]' : 'bg-surface hover:bg-surface-2',
      )}
    >
      <span className={cx('max-w-[220px] truncate text-[13px] font-medium', active ? 'text-[#a7f3c0]' : 'text-fg')}>
        {label}
      </span>
      <span className="max-w-[220px] truncate text-[11.5px] text-faint">{meta}</span>
    </button>
  )
}

function ProductCard({
  product,
  shop,
  distance,
  selected,
  onToggle,
}: {
  product: Product
  shop?: PublicShop
  distance?: number
  selected: boolean
  onToggle: () => void
}) {
  const { t } = useLanguage()
  const delta = priceDelta(product.price, product.previousPrice)
  const soldOut = product.stock === 'out'
  const currency = shop?.currency ?? 'ETB'

  return (
    <article
      onClick={onToggle}
      className={cx(
        'depth relative flex h-full cursor-pointer flex-col rounded-card-sm bg-surface p-3.5 transition-colors hover:bg-surface-2',
        soldOut && 'opacity-75',
        selected && 'ring-2 ring-[rgb(34_197_94/0.55)] bg-surface-2',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cx('grid size-10 shrink-0 place-items-center rounded-[13px] text-[20px]', CATEGORY_STYLES[product.category])}
        >
          {product.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold leading-snug">{product.name}</h3>
          <p className="mt-0.5 truncate text-[11.5px] text-faint">
            {t(`category.${product.category}`)}
            {product.note ? ` · ${product.note}` : ''}
          </p>
        </div>
        <span
          className={cx(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-medium',
            STOCK_STYLES[product.stock],
          )}
        >
          <span className={cx('round size-1.5 rounded-full', STOCK_DOTS[product.stock])} />            {t(`stock.${product.stock}`)}
        </span>
      </div>

      <div className="mt-auto pt-4">
        <p className="text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
          {formatMoney(product.price, currency)}           <span className="ml-1.5 text-[11.5px] font-normal tracking-normal text-muted">{t('board.per')} {product.unit}</span>
        </p>
        <p className="mt-1.5 text-[12px] font-medium text-fg/90">{shop?.name ?? 'Trader'}</p>
        {shop?.paymentAccount && (
          <p className="mt-0.5 truncate text-[11px] text-faint">             {t('board.pay')}: {shop.paymentMethod ?? t('board.payment')} · {shop.paymentAccount}
          </p>
        )}

        <div className="mt-2.5 border-t border-line pt-2">
          {delta ? (
            <p className={cx('flex items-center gap-1 text-[11.5px]', delta.direction === 'up' ? 'text-[#8ff0b4]' : 'text-[#ffb27a]')}>
              {delta.direction === 'up' ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {formatMoney(Math.abs(delta.change), currency)}          {delta.direction === 'up' ? t('board.higher') : t('board.lower')} {t('board.thanYesterday')}
              <span className="text-faint">· {Math.round(delta.percent)}%</span>
            </p>
          ) : (              <p className="text-[11.5px] text-faint">{t('board.sameAsYesterday')}</p>
          )}

          {shop && (
            <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] text-faint">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">
                {shop.location} · {t('board.house')} {shop.houseNumber}
                {distance !== undefined ? ` · ${distance.toFixed(1)} ${t('board.kmAway')}` : ''}
              </span>
            </p>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
            className={cx(
              'mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-control px-3 py-2 text-[12.5px] font-medium transition-colors',
              selected
                ? 'bg-[rgb(34_197_94/0.18)] text-[#a7f3c0]'
                : 'bg-white/[0.05] text-muted hover:bg-white/[0.09] hover:text-fg',
            )}
          >
            {selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
            {selected ? t('board.inBuyingList') : t('board.addToBuyingList')}
          </button>
        </div>
      </div>
    </article>
  )
}
