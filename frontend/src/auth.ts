const BASE_URL = import.meta.env.VITE_API_URL ?? ''
const REFRESH_TOKEN_KEY = 'ds_refresh_token'

// Access token: in-memory only (not persisted, XSS-safe)
// Refresh token: localStorage (survives page reloads; cleared on logout)
let accessToken: string | null = null
let refreshToken: string | null = localStorage.getItem(REFRESH_TOKEN_KEY)
let refreshTimer: ReturnType<typeof setTimeout> | null = null

type AuthListener = () => void
const listeners: AuthListener[] = []

function notify() {
  listeners.forEach((fn) => fn())
}

export function onAuthChange(fn: AuthListener): () => void {
  listeners.push(fn)
  return () => {
    const idx = listeners.indexOf(fn)
    if (idx !== -1) listeners.splice(idx, 1)
  }
}

export function getAccessToken(): string | null {
  return accessToken
}

export function isAuthenticated(): boolean {
  return accessToken !== null
}

export function getCurrentUser(): { sub: string; username: string; role: string } | null {
  if (!accessToken) return null
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1])) as { sub: string; username: string; role?: string }
    return { sub: payload.sub, username: payload.username, role: payload.role ?? 'editor' }
  } catch {
    return null
  }
}

function parseExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function scheduleRefresh(token: string) {
  if (refreshTimer) clearTimeout(refreshTimer)
  const exp = parseExpiry(token)
  if (!exp) return
  // Refresh 60 seconds before expiry
  const delay = Math.max(0, exp - Date.now() - 60_000)
  refreshTimer = setTimeout(async () => {
    try {
      await refresh()
    } catch {
      setTokens(null, null)
    }
  }, delay)
}

function setTokens(access: string | null, rtoken: string | null) {
  accessToken = access
  refreshToken = rtoken
  if (rtoken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, rtoken)
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }
  if (refreshTimer) clearTimeout(refreshTimer)
  if (access) scheduleRefresh(access)
  notify()
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Login failed')
  }
  const data = await res.json() as { access_token: string; refresh_token: string }
  setTokens(data.access_token, data.refresh_token)
}

export async function refresh(): Promise<void> {
  if (!refreshToken) throw new Error('No refresh token')
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error('Refresh failed')
  const data = await res.json() as { access_token: string; refresh_token?: string }
  // Use the rotated refresh token if the server returns one; otherwise keep the existing one
  setTokens(data.access_token, data.refresh_token ?? refreshToken)
}

export function logout(): void {
  setTokens(null, null)
}
