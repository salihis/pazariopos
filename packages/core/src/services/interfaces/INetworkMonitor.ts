// packages/core/src/services/interfaces/INetworkMonitor.ts
// ─────────────────────────────────────────────────────────────
// Abstraction over online/offline state detection.
// Implementations can use browser navigator.onLine, Tauri fetch pings,
// or WebSocket heartbeats.
// ─────────────────────────────────────────────────────────────

import type { NetworkStatus } from '../../types/domain'

export type NetworkStatusHandler = (status: NetworkStatus) => void
export type UnsubscribeFn       = () => void

export interface INetworkMonitor {
  /** Current network status — synchronous read. */
  readonly status: NetworkStatus

  /** Returns true if the last ping/check confirmed connectivity. */
  isOnline(): boolean

  /**
   * Subscribe to status changes.
   * Handler is called immediately with the current status, then on every change.
   */
  onStatusChange(handler: NetworkStatusHandler): UnsubscribeFn

  /** Start background polling / heartbeat. */
  start(): void

  /** Stop background polling. */
  stop(): void
}
