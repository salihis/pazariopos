// packages/core/src/store/useAuthStore.ts
// ─────────────────────────────────────────────────────────────
// Auth Phase 1. Persists the JWT in localStorage so a cashier doesn't
// have to log in again every time the app restarts — this is a real
// product decision (not a claude.ai Artifact), and both the web app
// and the Tauri desktop WebView support the Web Storage API natively,
// so this works identically on both platforms.
//
// On startup, apps/web and apps/desktop should call
// `useAuthStore.getState().init()` once (alongside useSaleStore's own
// init()) to restore and verify any previously-saved session.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand'

import type { User } from '../types/domain'
import { authApi, setAuthToken, ApiError } from '../api/salesApi'

const STORAGE_KEY = 'pazariopos:auth-token'

export interface AuthStoreState {
  currentUser: User | null
  isAuthenticating: boolean
  error: string | null

  login(username: string, password: string): Promise<void>
  logout(): void
  /** Restores a previously-saved session, if any. Safe to call once at app startup. */
  init(): Promise<void>
}

export const useAuthStore = create<AuthStoreState>()((set) => ({
  currentUser: null,
  isAuthenticating: false,
  error: null,

  async login(username, password) {
    set({ isAuthenticating: true, error: null })
    try {
      const { token, user } = await authApi.login(username, password)
      setAuthToken(token)
      localStorage.setItem(STORAGE_KEY, token)
      set({ currentUser: user, isAuthenticating: false })
    } catch (err) {
      const message = err instanceof ApiError && err.status === 401
        ? 'Kullanıcı adı veya şifre hatalı.'
        : err instanceof Error ? err.message : String(err)
      set({ isAuthenticating: false, error: message })
      throw err
    }
  },

  logout() {
    setAuthToken(null)
    localStorage.removeItem(STORAGE_KEY)
    set({ currentUser: null })
  },

  async init() {
    const savedToken = localStorage.getItem(STORAGE_KEY)
    if (!savedToken) return

    setAuthToken(savedToken)
    try {
      const user = await authApi.me()
      set({ currentUser: user })
    } catch {
      // Saved token is expired/invalid — clear it rather than keep
      // retrying on every request.
      setAuthToken(null)
      localStorage.removeItem(STORAGE_KEY)
    }
  },
}))
