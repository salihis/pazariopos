// packages/core/src/platform/PlatformDetectionService.ts
// ─────────────────────────────────────────────────────────────
// Detects at runtime whether the app is running inside Tauri
// (desktop) or a plain browser (web). All service factories
// across the monorepo delegate their "which impl?" decision here.
// ─────────────────────────────────────────────────────────────

// Tauri v2 injects `window.__TAURI_INTERNALS__` (v2 changed from __TAURI__)
// We check both for forward/backward compatibility during migration.
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
    __TAURI__?: unknown              // Tauri v1 fallback
  }
}

export type PlatformType = 'desktop' | 'web' | 'mobile-web'

class PlatformDetectionService {
  private readonly _type: PlatformType

  constructor() {
    this._type = this.#detect()
  }

  // ── Public API ──────────────────────────────────────────────

  get type(): PlatformType {
    return this._type
  }

  isDesktop(): boolean {
    return this._type === 'desktop'
  }

  isWeb(): boolean {
    return this._type === 'web' || this._type === 'mobile-web'
  }

  isMobileWeb(): boolean {
    return this._type === 'mobile-web'
  }

  // ── Private ─────────────────────────────────────────────────

  #detect(): PlatformType {
    // Tauri v2 primary signal
    if (typeof window !== 'undefined' &&
        (window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined)) {
      return 'desktop'
    }

    // Mobile browser detection (used for UX hints, not capability gating)
    if (typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      return 'mobile-web'
    }

    return 'web'
  }
}

// Singleton — created once, shared across all imports
export const platform = new PlatformDetectionService()
