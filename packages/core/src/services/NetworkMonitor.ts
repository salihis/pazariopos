// packages/core/src/services/NetworkMonitor.ts
// ─────────────────────────────────────────────────────────────
// Tracks online/offline state for the sync engine.
//
// Design note: unlike the printer service, network detection does
// NOT need a separate Tauri implementation — both web and desktop
// run inside a WebView with `navigator.onLine` and `fetch`. Tauri
// apps still go through the OS network stack, so the same browser
// APIs work. We layer an active health-check ping on top because
// `navigator.onLine` only reflects "has a network interface", not
// "can actually reach our API" (e.g. wifi connected, ISP down).
// ─────────────────────────────────────────────────────────────

import type {
  INetworkMonitor,
  NetworkStatusHandler,
  UnsubscribeFn,
} from './interfaces/INetworkMonitor'
import type { NetworkStatus } from '../types/domain'

export interface NetworkMonitorConfig {
  /** Endpoint used for active health-check pings. Should be cheap (HEAD/204). */
  healthCheckUrl: string
  /** How often to ping while online, in ms. */
  pingIntervalMs: number
  /** Consider the ping timed out after this many ms. */
  pingTimeoutMs: number
}

const DEFAULT_CONFIG: NetworkMonitorConfig = {
  healthCheckUrl: '/api/health',
  pingIntervalMs: 10_000,
  pingTimeoutMs: 4_000,
}

export class NetworkMonitor implements INetworkMonitor {
  private _status: NetworkStatus
  private handlers = new Set<NetworkStatusHandler>()
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private config: NetworkMonitorConfig

  constructor(config: Partial<NetworkMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this._status = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.#handleBrowserOnline)
      window.addEventListener('offline', this.#handleBrowserOffline)
    }
  }

  // ── INetworkMonitor ──────────────────────────────────────────

  get status(): NetworkStatus {
    return this._status
  }

  isOnline(): boolean {
    return this._status === 'online'
  }

  onStatusChange(handler: NetworkStatusHandler): UnsubscribeFn {
    this.handlers.add(handler)
    handler(this._status) // fire immediately with current status
    return () => this.handlers.delete(handler)
  }

  start(): void {
    if (this.intervalHandle) return
    void this.#ping() // immediate check on start
    this.intervalHandle = setInterval(() => void this.#ping(), this.config.pingIntervalMs)
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  // ── Browser online/offline events (fast path) ───────────────

  #handleBrowserOnline = (): void => {
    // Browser says the interface is up — confirm with a real ping
    // rather than trusting it blindly (captive portals, etc.).
    void this.#ping()
  }

  #handleBrowserOffline = (): void => {
    this.#setStatus('offline')
  }

  // ── Active health-check ping ────────────────────────────────

  async #ping(): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.pingTimeoutMs)

    try {
      const res = await fetch(this.config.healthCheckUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      })
      this.#setStatus(res.ok ? 'online' : 'degraded')
    } catch {
      this.#setStatus('offline')
    } finally {
      clearTimeout(timeout)
    }
  }

  // ── Internal ─────────────────────────────────────────────────

  #setStatus(next: NetworkStatus): void {
    const wasOffline = this._status === 'offline'
    this._status = next

    for (const handler of this.handlers) handler(next)

    // Reconnect transition (offline -> online) is the trigger point
    // consumed by useSaleStore's auto-sync effect.
    if (wasOffline && next === 'online') {
      for (const handler of this.handlers) handler('online')
    }
  }
}

let cachedInstance: INetworkMonitor | null = null

export function getNetworkMonitor(config?: Partial<NetworkMonitorConfig>): INetworkMonitor {
  if (!cachedInstance) {
    cachedInstance = new NetworkMonitor(config)
    cachedInstance.start()
  }
  return cachedInstance
}
