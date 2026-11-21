import { Loader2, Lock, LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { Aurora } from '../components/Aurora'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { Logo } from '../components/Logo'
import {
  ApiError,
  api,
  forgetAdminToken,
  storedToken,
  rememberAdminToken,
  storedAdminToken,
  type AdminShop,
  type AppSettings,
  type ClickEvent,
} from '../lib/api'
import { cx } from '../lib/cx'
import { linkTo, navigate } from '../lib/router'
import { useLanguage } from '../lib/language'

const fieldInput =
  'mt-1.5 h-10 w-full rounded-[12px] border border-line bg-bg/70 px-3 text-[13.5px] outline-none transition-colors focus:border-[rgb(34_197_94/0.5)]'

export function Admin() {
  const { t } = useLanguage()
  const [token, setToken] = useState<string | null>(() => storedAdminToken())
  const [shops, setShops] = useState<AdminShop[] | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [clicks, setClicks] = useState<ClickEvent[] | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token && storedToken()) navigate('/trader')
  }, [token])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [shopResult, settingsResult, clickResult] = await Promise.all([api.adminShops(), api.adminSettings(), api.adminClicks()])
      setShops(shopResult.shops)
      setSettings(settingsResult.settings)
      setClicks(clickResult.events)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        forgetAdminToken()
        setToken(null)
        setShops(null)
        setSettings(null)
        setClicks(null)
        setError(t('admin.sessionEnded'))
        return
      }
      setError(err instanceof Error ? err.message : t('admin.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) void load()
    else setLoading(false)
  }, [token, load])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const session = await api.adminLogin(password)
      rememberAdminToken(session.token)
      setToken(session.token)
      setPassword('')
    } catch (err) {        setError(err instanceof Error ? err.message : t('admin.couldNotSignIn'))
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await api.adminLogout().catch(() => undefined)
    forgetAdminToken()
    setToken(null)
    setShops(null)
    setSettings(null)
    setClicks(null)
    setError(null)
  }

  async function toggleSuspend(shop: AdminShop) {
    try {
      const { shop: next } = await api.adminSuspend(shop.id, !shop.suspended)
      setShops((current) =>
        current?.map((item) => (item.id === shop.id ? { ...item, ...next } : item)) ?? current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.couldNotUpdate'))
    }
  }

  async function markPaid(shop: AdminShop) {
    try {
      const { shop: next } = await api.adminMarkPaid(shop.id)
      setShops((current) =>
        current?.map((item) => (item.id === shop.id ? { ...item, ...next } : item)) ?? current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.couldNotMarkPayment'))
    }
  }

  async function deleteShop(shop: AdminShop) {      if (!window.confirm(`${t('admin.deleteConfirm')} ${shop.name}`)) return
    try {
      await api.adminDeleteShop(shop.id)
      setShops((current) => current?.filter((item) => item.id !== shop.id) ?? current)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.couldNotDelete'))
    }
  }

  async function updateSettings(patch: Partial<AppSettings>) {
    try {
      const result = await api.adminSaveSettings(patch)
      setSettings(result.settings)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.couldNotSave'))
    }
  }

  if (!token) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <Aurora intensity={0.55} />
        <header className="relative">
          <Container className="flex min-h-20 flex-wrap items-center justify-between gap-2">
            <Logo />
            <a href="/" onClick={linkTo('/')} className="text-[13px] text-muted transition-colors hover:text-fg">
              {t('nav.priceBoard')}
            </a>
          </Container>
        </header>
        <main className="relative flex flex-1 items-start justify-center px-5 pb-24 pt-6 sm:items-center">
          <form onSubmit={signIn} className="depth relative w-full max-w-[420px] rounded-card bg-surface p-5 shadow-glow sm:p-6">
            <span className="grid size-11 place-items-center rounded-[14px] bg-[rgb(34_197_94/0.14)] text-accent">
              <ShieldCheck className="size-5" />
            </span>
            <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.025em]">{t('admin.signIn')}</h1>
            <p className="mt-1.5 text-pretty text-[13.5px] leading-relaxed text-muted">
              {t('admin.signInSub')}
            </p>
            <label className="mt-4 block">
              <span className="block text-[12px] font-medium text-muted">{t('admin.password')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={fieldInput}
                autoComplete="current-password"
              />
            </label>
            {error && <p className="mt-3 text-[12.5px] text-[#ffb27a]">{error}</p>}
            <Button type="submit" disabled={busy} className="mt-5 w-full">
              {busy ? <Loader2 className="animate-spin" /> : <Lock />}
              {busy ? t('trader.working') : t('admin.signIn')}
            </Button>
            <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
              {t('admin.demoPassword')}: <span className="font-medium text-muted">asbeza-admin</span>. {t('admin.setAdminPassword')}
            </p>
          </form>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
        <Container className="flex h-16 flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="hidden rounded-full bg-[rgb(34_197_94/0.16)] px-2 py-0.5 text-[11px] font-medium text-[#a7f3c0] sm:inline">
              Admin
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <a
              href="/"
              onClick={linkTo('/')}
              className="inline-flex h-10 items-center gap-1.5 rounded-[12px] px-3 text-[13px] text-muted transition-colors hover:text-fg"
            >
              {t('nav.priceBoard')}
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
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <aside className="lg:w-60 lg:shrink-0">
              <nav className="depth relative rounded-card bg-surface p-3 lg:sticky lg:top-24">
                <p className="px-2 text-[11.5px] uppercase tracking-[0.08em] text-faint">{t('admin.platformAdministration')}</p>
                <div className="mt-2 flex flex-col gap-1">
                  {[
                    { id: 'admin-settings', label: t('admin.platformSettings') },
                    { id: 'admin-traders', label: t('admin.traders') },
                    { id: 'admin-clicks', label: t('admin.userClicks') },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="rounded-[10px] px-3 py-2 text-left text-[13px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <a href="/" onClick={linkTo('/')} className="mt-3 block rounded-[10px] px-3 py-2 text-[13px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg">
                  {t('nav.priceBoard')}
                </a>
              </nav>
            </aside>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-medium text-accent">{t('admin.platformAdministration')}</p>
              <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.025em] sm:text-[32px]">{t('admin.tradersSecurity')}</h1>
              <p className="mt-1.5 max-w-2xl text-pretty text-[13.5px] text-muted">
                {t('admin.adminSub')}
              </p>
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

          <section id="admin-settings" className="depth relative mt-6 rounded-card bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">{t('admin.platformSettings')}</h2>               <span className="text-[11.5px] text-faint">{t('admin.securityControls')}</span>
            </div>
            {settings ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-bg/70 px-3 py-2.5">
                  <div>                      <p className="text-[13px] font-medium">{t('admin.maintenanceMode')}</p>
                      <p className="text-[11.5px] text-faint">{t('admin.maintenanceSub')}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode}
                    onChange={(event) => void updateSettings({ maintenanceMode: event.target.checked })}
                    className="size-4 accent-[#4ade80]"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-bg/70 px-3 py-2.5">
                  <div>                      <p className="text-[13px] font-medium">{t('admin.newSignups')}</p>
                      <p className="text-[11.5px] text-faint">{t('admin.newSignupsSub')}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.signupEnabled}
                    onChange={(event) => void updateSettings({ signupEnabled: event.target.checked })}
                    className="size-4 accent-[#4ade80]"
                  />
                </label>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-muted">                {t('admin.loadingSettings')}</p>
            )}
          </section>

          <section id="admin-traders" className="depth relative mt-6 rounded-card bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">{t('admin.traders')}</h2>
              <span className="text-[11.5px] text-faint">            {shops?.length ?? 0} {t('admin.accounts')}</span>
            </div>

            {loading && !shops ? (
              <div className="mt-4 grid gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-[64px] animate-pulse rounded-[14px] border border-line bg-surface/60" />
                ))}
              </div>
            ) : !shops || shops.length === 0 ? (
              <p className="mt-4 rounded-[12px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-muted">
                {t('admin.noTraders')}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {shops.map((shop) => (
                  <li
                    key={shop.id}
                    className="depth relative flex flex-col gap-3 rounded-[14px] bg-bg/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13.5px] font-medium">{shop.name}</p>
                        <span
                          className={cx(
                            'rounded-full px-2 py-0.5 text-[10.5px] font-medium',
                            shop.suspended ? 'bg-[rgb(249_115_22/0.18)] text-[#ffb27a]' : 'bg-[rgb(34_197_94/0.16)] text-[#a7f3c0]',
                          )}
                        >
                          {shop.suspended ? t('admin.suspended') : t('admin.active')}
                        </span>
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-muted">
                          {t(`trader.plan${(shop.plan ?? 'free').charAt(0).toUpperCase() + (shop.plan ?? 'free').slice(1)}`)} · {t(`payment.${shop.paymentStatus ?? 'paid'}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-faint">                         {shop.location} · {t('admin.house')} {shop.houseNumber} · {shop.phone} ·                      {shop.productCount} {t('admin.items')}
                      </p>
                      {shop.paymentMethod && (
                        <p className="mt-0.5 text-[11.5px] text-faint">                           {t('admin.payment')}: {shop.paymentMethod}{shop.paymentAccount ? ` · ${shop.paymentAccount}` : ''}
                        </p>
                      )}
                      {shop.nextPaymentDue && (
                        <p className="mt-0.5 text-[11.5px] text-faint">
                          {t('admin.nextPaymentDue')} {new Date(shop.nextPaymentDue).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="secondary"
                        className="h-10 rounded-[10px] px-3 text-[12.5px]"
                        onClick={() => void toggleSuspend(shop)}
                      >
                        {shop.suspended ? t('admin.activate') : t('admin.suspend')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-10 rounded-[10px] px-3 text-[12.5px]"
                        onClick={() => void markPaid(shop)}
                      >
                        {t('admin.markPaid')}
                      </Button>
                      <button
                        type="button"
                        onClick={() => void deleteShop(shop)}
                        className="inline-flex h-10 items-center gap-1 rounded-[10px] px-2 text-[11.5px] text-faint transition-colors hover:bg-white/[0.06] hover:text-[#ffb27a]"
                        aria-label={`${t('admin.delete')} ${shop.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="admin-clicks" className="depth relative mt-6 rounded-card bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">{t('admin.userClicks')}</h2>               <span className="text-[11.5px] text-faint">{clicks?.length ?? 0} {t('admin.recent')}</span>
            </div>
            {clicks === null ? (
              <p className="mt-4 text-[13px] text-muted">{t('admin.loadingClicks')}</p>
            ) : clicks.length === 0 ? (
              <p className="mt-4 rounded-[12px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-muted">
                {t('admin.noClicks')}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-[12px] border border-line">
                <table className="min-w-full text-left text-[12px]">
                  <thead className="bg-bg/60 text-faint">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('admin.time')}</th>
                      <th className="px-3 py-2 font-medium">{t('admin.visitorUser')}</th>
                      <th className="px-3 py-2 font-medium">{t('admin.page')}</th>
                      <th className="px-3 py-2 font-medium">{t('admin.target')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clicks.map((event) => (
                      <tr key={event.id} className="border-t border-line">
                        <td className="whitespace-nowrap px-3 py-2 text-muted">
                          {new Date(event.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {event.userId ? `${t('admin.trader')} ${event.userId.slice(0, 8)}` : event.visitorId ? `${t('admin.visitor')} ${event.visitorId.slice(0, 8)}` : t('admin.anonymous')}
                        </td>
                        <td className="px-3 py-2 text-muted">{event.path}</td>
                        <td className="max-w-[260px] truncate px-3 py-2 text-muted" title={event.target}>
                          {event.target}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
            </div>
          </div>
        </Container>
      </main>
    </div>
  )
}
