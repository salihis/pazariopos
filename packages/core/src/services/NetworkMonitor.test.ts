// packages/core/src/services/NetworkMonitor.test.ts
// ─────────────────────────────────────────────────────────────
// Covers the health-check ping cycle, browser online/offline event
// handling, and the "offline -> online" reconnect trigger that
// useSaleStore's auto-sync effect depends on (see ARCHITECTURE.md §7).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NetworkMonitor } from './NetworkMonitor'

describe('NetworkMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts online when navigator.onLine is true and no ping has run yet', () => {
    vi.stubGlobal('navigator', { onLine: true })
    const monitor = new NetworkMonitor()
    expect(monitor.status).toBe('online')
    expect(monitor.isOnline()).toBe(true)
  })

  it('starts offline when navigator.onLine is false', () => {
    vi.stubGlobal('navigator', { onLine: false })
    const monitor = new NetworkMonitor()
    expect(monitor.status).toBe('offline')
  })

  it('fires the handler immediately with current status on subscribe', () => {
    vi.stubGlobal('navigator', { onLine: true })
    const monitor = new NetworkMonitor()
    const handler = vi.fn()
    monitor.onStatusChange(handler)
    expect(handler).toHaveBeenCalledWith('online')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe stops further notifications', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const okFetch = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', okFetch)

    const monitor = new NetworkMonitor({ pingIntervalMs: 1000, pingTimeoutMs: 500 })
    const handler = vi.fn()
    const unsubscribe = monitor.onStatusChange(handler)
    handler.mockClear() // drop the immediate call on subscribe

    unsubscribe()
    monitor.start()
    await vi.advanceTimersByTimeAsync(1000)

    expect(handler).not.toHaveBeenCalled()
  })

  it('marks status "degraded" when the health-check ping responds non-OK', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })))

    const monitor = new NetworkMonitor({ pingIntervalMs: 1000, pingTimeoutMs: 500 })
    monitor.start()
    await vi.advanceTimersByTimeAsync(0) // let the immediate #ping() on start() resolve

    expect(monitor.status).toBe('degraded')
  })

  it('marks status "offline" when the health-check ping throws (network unreachable)', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network unreachable')
    }))

    const monitor = new NetworkMonitor({ pingIntervalMs: 1000, pingTimeoutMs: 500 })
    monitor.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(monitor.status).toBe('offline')
  })

  it('fires the reconnect handler TWICE on the offline -> online transition', async () => {
    // useSaleStore's auto-sync effect relies on this double-fire (see
    // NetworkMonitor.ts #setStatus) to kick off queued-sale flushing
    // reliably even if a consumer only wires up on the second call.
    vi.stubGlobal('navigator', { onLine: true })
    const fetchMock = vi.fn()
    // First ping (on start()) fails -> offline. Second ping -> succeeds -> online.
    fetchMock
      .mockImplementationOnce(async () => { throw new Error('down') })
      .mockImplementationOnce(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const monitor = new NetworkMonitor({ pingIntervalMs: 1000, pingTimeoutMs: 500 })
    const handler = vi.fn()
    monitor.onStatusChange(handler)
    handler.mockClear()

    monitor.start()
    await vi.advanceTimersByTimeAsync(0) // -> offline
    expect(monitor.status).toBe('offline')
    handler.mockClear()

    await vi.advanceTimersByTimeAsync(1000) // next interval tick -> online
    expect(monitor.status).toBe('online')
    expect(handler).toHaveBeenCalledWith('online')
    expect(handler.mock.calls.filter(call => call[0] === 'online')).toHaveLength(2)
  })

  it('does NOT double-fire when status was already online (no reconnect edge)', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))

    const monitor = new NetworkMonitor({ pingIntervalMs: 1000, pingTimeoutMs: 500 })
    const handler = vi.fn()
    monitor.onStatusChange(handler)
    handler.mockClear()

    monitor.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(handler.mock.calls.filter(call => call[0] === 'online')).toHaveLength(1)
  })

  it('browser "offline" event sets status to offline without waiting for a ping', () => {
    vi.stubGlobal('navigator', { onLine: true })
    let offlineListener: (() => void) | undefined
    const windowStub = {
      addEventListener: vi.fn((event: string, listener: () => void) => {
        if (event === 'offline') offlineListener = listener
      }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', windowStub)

    const monitor = new NetworkMonitor()
    expect(monitor.status).toBe('online')

    offlineListener?.()
    expect(monitor.status).toBe('offline')
  })

  it('start() is idempotent — calling it twice does not schedule duplicate intervals', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const monitor = new NetworkMonitor({ pingIntervalMs: 1000, pingTimeoutMs: 500 })
    monitor.start()
    monitor.start()
    await vi.advanceTimersByTimeAsync(0)
    fetchMock.mockClear()

    await vi.advanceTimersByTimeAsync(1000)
    // If two intervals had been scheduled, this would be 2.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stop() clears the interval so no further pings occur', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const monitor = new NetworkMonitor({ pingIntervalMs: 1000, pingTimeoutMs: 500 })
    monitor.start()
    await vi.advanceTimersByTimeAsync(0)
    monitor.stop()
    fetchMock.mockClear()

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
