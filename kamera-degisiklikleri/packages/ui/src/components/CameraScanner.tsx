// packages/ui/src/components/CameraScanner.tsx
// ─────────────────────────────────────────────────────────────
// Camera-based barcode scanning (getUserMedia + ZXing), for devices
// that have no physical HID/serial scanner — primarily phones, but
// also PCs with a webcam.
//
// This is deliberately a *separate* input path from BarcodeService
// (packages/core): BarcodeService listens passively for input that
// arrives already-decoded (Tauri hardware event or HID keyboard-wedge
// keystrokes). A camera has no such upstream decoder — this component
// pulls frames from <video> itself and runs ZXing's decoder in-browser,
// then hands the caller a plain string exactly like a scanner would.
//
// Why not fold this into BarcodeService: that service is constructed
// once per app (platform-detected, no DOM video element of its own) and
// every screen already shares one instance via getBarcodeService(). A
// camera needs a live <video> element mounted somewhere on screen, a
// stream lifecycle tied to *that* component's mount/unmount, and a
// visible "camera is on" state the user can see and stop — that's
// screen-local UI state, not a singleton service concern.
//
// Autostart note (why this is a modal, not an always-on embed):
// Safari on iOS (and several Android WebViews) refuse getUserMedia
// unless it is called synchronously from a user gesture (a click/tap).
// A camera that "just opens" the moment a screen mounts will silently
// fail on exactly the phones this is built for. So "otomatik" here
// means: one tap opens the modal AND immediately starts the stream —
// no separate "başlat" button inside — rather than truly zero-click.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'

export interface CameraScannerProps {
  /** Called once with the decoded barcode/QR text. The modal closes right after. */
  onDetected: (value: string) => void
  /** Called when the user closes the modal without a successful scan. */
  onClose: () => void
  /** Optional heading shown above the preview (defaults to a generic prompt). */
  title?: string
}

/**
 * Full-screen modal: opens the camera immediately on mount and keeps
 * decoding every frame until either a barcode is found or the user
 * cancels. Mount it conditionally (`{scanning && <CameraScanner ... />}`)
 * — mounting IS "start", unmounting IS "stop and release the camera".
 */
export function CameraScanner({ onDetected, onClose, title }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)

  const detectedRef = useRef(false)

  const start = useCallback(async (preferredDeviceId?: string) => {
    setError(null)
    setReady(false)
    detectedRef.current = false

    const reader = new BrowserMultiFormatReader()

    try {
      // No explicit deviceId yet → let the browser pick, preferring the
      // rear/environment camera (the only sane default on a phone; on a
      // PC with one webcam this constraint is simply ignored).
      const constraints: MediaStreamConstraints = preferredDeviceId
        ? { video: { deviceId: { exact: preferredDeviceId } } }
        : { video: { facingMode: { ideal: 'environment' } } }

      if (!videoRef.current) return

      controlsRef.current = await reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, err) => {
          if (result && !detectedRef.current) {
            detectedRef.current = true
            const text = result.getText()
            controlsRef.current?.stop()
            // Short delay so the user sees the frame that matched, not a
            // jarring instant-close.
            window.setTimeout(() => onDetected(text), 150)
            return
          }
          // NotFoundException fires on basically every frame that doesn't
          // contain a code yet — that's normal scanning, not an error.
          if (err && err.name !== 'NotFoundException') {
            // Keep scanning; only surface something if frames stop coming
            // entirely (handled by the catch block on start-up failures).
          }
        },
      )

      setReady(true)

      // Populate the device list once permission is granted (labels are
      // blank until then) so a PC with more than one webcam can switch.
      const inputs = await BrowserMultiFormatReader.listVideoInputDevices()
      setDevices(inputs)
      if (preferredDeviceId) setDeviceId(preferredDeviceId)
    } catch (e) {
      const name = e instanceof Error ? e.name : ''
      if (name === 'NotAllowedError') {
        setError('Kamera izni reddedildi. Tarayıcı ayarlarından bu site için kameraya izin verin.')
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('Kamera bulunamadı. Cihazda kullanılabilir bir kamera olduğundan emin olun.')
      } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        setError('Kamera yalnızca güvenli bağlantı (https) üzerinden çalışır.')
      } else {
        setError('Kamera açılamadı: ' + (e instanceof Error ? e.message : String(e)))
      }
    }
  }, [onDetected])

  useEffect(() => {
    void start()
    return () => {
      controlsRef.current?.stop()
      controlsRef.current = null
    }
    // Intentionally only on mount/unmount — switching cameras re-invokes
    // start() explicitly via handleSwitchCamera, not through this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSwitchCamera = useCallback((nextId: string) => {
    controlsRef.current?.stop()
    setDeviceId(nextId)
    void start(nextId)
  }, [start])

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-paper,#faf6ee)] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-[var(--font-display)] text-sm font-semibold text-[var(--color-petrol)]">
            {title ?? 'Kamerayla Barkod Tara'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-[var(--color-ink-soft)] hover:bg-black/5"
          >
            Kapat ✕
          </button>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

          {ready && !error && (
            <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-[var(--color-saffron)]/80" />
          )}

          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
              Kamera açılıyor…
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-[var(--color-copper)]/30 bg-[var(--color-copper-light)]/15 px-3 py-2 text-xs text-[var(--color-copper)]">
            {error}
          </div>
        )}

        {!error && (
          <p className="mt-3 text-center text-xs text-[var(--color-ink-soft)]">
            Barkodu çerçevenin içine hizalayın, otomatik algılanacaktır.
          </p>
        )}

        {devices.length > 1 && (
          <select
            value={deviceId ?? ''}
            onChange={e => handleSwitchCamera(e.target.value)}
            className="mt-3 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-2 py-1.5 text-xs"
          >
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Kamera'}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
