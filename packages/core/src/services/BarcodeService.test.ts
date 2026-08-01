// packages/core/src/services/BarcodeService.test.ts
// ─────────────────────────────────────────────────────────────
// Covers the web (HID keyboard-wedge) capture path: buffering
// keystrokes, flushing on Enter or on a silence timeout, ignoring
// modifier keys and short/incidental typing, and format guessing.
// The Tauri/desktop path needs a real Tauri runtime and is out of
// scope for these unit tests (see vitest.config.ts coverage excludes).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// platform.isDesktop() reads window.__TAURI_INTERNALS__ / __TAURI__ at
// import time — jsdom's default `window` has neither, so the singleton
// resolves to 'web' and BarcodeService takes the keydown-listener branch.
import { BarcodeService } from './BarcodeService'

function keydown(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key })
}

describe('BarcodeService (web keyboard-wedge path)', () => {
  let service: BarcodeService

  beforeEach(() => {
    vi.useFakeTimers()
    service = new BarcodeService()
  })

  afterEach(() => {
    service.dispose()
    vi.useRealTimers()
  })

  it('dispatches a scan on Enter with the buffered characters', () => {
    const handler = vi.fn()
    service.onScan(handler)

    '1234567890123'.split('').forEach(ch => document.dispatchEvent(keydown(ch)))
    document.dispatchEvent(keydown('Enter'))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0]).toMatchObject({
      value: '1234567890123',
      format: 'EAN_13',
      source: 'keyboard',
    })
  })

  it('flushes on silence timeout when the scanner does not send Enter', () => {
    const handler = vi.fn()
    service.onScan(handler)

    'ABCD1234'.split('').forEach(ch => document.dispatchEvent(keydown(ch)))
    expect(handler).not.toHaveBeenCalled() // no Enter yet, timer still pending

    vi.advanceTimersByTime(100)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0].value).toBe('ABCD1234')
  })

  it('discards buffers shorter than MIN_BARCODE_LENGTH (incidental fast typing)', () => {
    const handler = vi.fn()
    service.onScan(handler)

    'ab'.split('').forEach(ch => document.dispatchEvent(keydown(ch)))
    document.dispatchEvent(keydown('Enter'))

    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores modifier-only keypresses without polluting the buffer', () => {
    const handler = vi.fn()
    service.onScan(handler)

    document.dispatchEvent(keydown('Shift'))
    document.dispatchEvent(keydown('Control'))
    '1234'.split('').forEach(ch => document.dispatchEvent(keydown(ch)))
    document.dispatchEvent(keydown('Enter'))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0].value).toBe('1234')
  })

  it('does not throw on synthetic events with a non-string key (extension interference)', () => {
    const handler = vi.fn()
    service.onScan(handler)

    const weirdEvent = new KeyboardEvent('keydown', {})
    Object.defineProperty(weirdEvent, 'key', { value: undefined })

    expect(() => document.dispatchEvent(weirdEvent)).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('pause() suppresses dispatch and resume() restores it', () => {
    const handler = vi.fn()
    service.onScan(handler)
    service.pause()

    '1234'.split('').forEach(ch => document.dispatchEvent(keydown(ch)))
    document.dispatchEvent(keydown('Enter'))
    expect(handler).not.toHaveBeenCalled()

    service.resume()
    '5678'.split('').forEach(ch => document.dispatchEvent(keydown(ch)))
    document.dispatchEvent(keydown('Enter'))
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0].value).toBe('5678')
  })

  it('unsubscribe stops a specific handler from receiving further scans', () => {
    const handler = vi.fn()
    const unsubscribe = service.onScan(handler)
    unsubscribe()

    '1234'.split('').forEach(ch => document.dispatchEvent(keydown(ch)))
    document.dispatchEvent(keydown('Enter'))

    expect(handler).not.toHaveBeenCalled()
  })

  it('dispose() removes the keydown listener so later events are not buffered', () => {
    const handler = vi.fn()
    service.onScan(handler)
    service.dispose()

    '1234'.split('').forEach(ch => document.dispatchEvent(keydown(ch)))
    document.dispatchEvent(keydown('Enter'))

    expect(handler).not.toHaveBeenCalled()
  })

  it.each([
    ['1234567890123', 'EAN_13'],
    ['12345678', 'EAN_8'],
    ['123456789012', 'UPC_A'],
    ['ABC123', 'UNKNOWN'],
  ])('guesses format %s -> %s', (value, expected) => {
    const handler = vi.fn()
    service.onScan(handler)

    value.split('').forEach(ch => document.dispatchEvent(keydown(ch)))
    document.dispatchEvent(keydown('Enter'))

    expect(handler.mock.calls[0]![0].format).toBe(expected)
  })
})
