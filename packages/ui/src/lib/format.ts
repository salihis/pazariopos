// packages/ui/src/lib/format.ts
// ─────────────────────────────────────────────────────────────
// Shared formatting helpers for UI components. `money()` was
// previously a private helper inside PosScreen.tsx — pulled out here
// so BackOffice/* panels (and PosScreen) share one implementation.
// ─────────────────────────────────────────────────────────────

/** Formats a minor-currency-unit (kuruş) integer as a "1234.56"-style string. */
export function money(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** Parses a Turkish-locale-friendly decimal input ("50,00" or "50.00") into kuruş. Returns null if invalid or <= 0. */
export function parseMoneyInput(raw: string): number | null {
  const amountTl = Number(raw.replace(',', '.'))
  if (!Number.isFinite(amountTl) || amountTl <= 0) return null
  return Math.round(amountTl * 100)
}

/** Formats an ISO-8601 date/datetime string as Turkish dd.mm.yyyy. Returns '—' for null/undefined. */
export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR')
}
