// packages/ui/src/BackOffice/UsersPanel.tsx
// ─────────────────────────────────────────────────────────────
// Kullanıcı Yönetimi — admin-only: list, create, edit (name/role),
// deactivate/reactivate, and reset another user's password. Mirrors
// ProductsPanel's soft-delete pattern (no hard DELETE — a deactivated
// user's historical Sale.cashierId/Purchase.userId references stay
// intact, they just can't log in anymore).
//
// Self-lockout is blocked both client-side (this file, for instant
// feedback) AND server-side (users.ts route, the real guarantee) —
// an admin can't deactivate their own account or demote themselves
// away from admin.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { usersApi, useAuthStore, type User, type UserRole, type CreateUserInput, type UpdateUserInput } from '@pazariopos/core'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Yönetici', accountant: 'Muhasebeci', cashier: 'Kasiyer', warehouse: 'Depo', viewer: 'İzleyici',
}
const ROLES = Object.keys(ROLE_LABELS) as UserRole[]

function emptyForm(): CreateUserInput {
  return { username: '', password: '', name: '', role: 'cashier' }
}

export function UsersPanel() {
  const currentUser = useAuthStore(s => s.currentUser)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<CreateUserInput>(emptyForm())

  const [resetTargetId, setResetTargetId] = useState<string | null>(null)
  const [resetPasswordInput, setResetPasswordInput] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setUsers(await usersApi.listUsers())
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const startCreate = useCallback(() => {
    setEditingUser(null)
    setForm(emptyForm())
    setShowForm(true)
    setMessage(null)
  }, [])

  const startEdit = useCallback((u: User) => {
    setEditingUser(u)
    setForm({ username: u.username, password: '', name: u.name, role: u.role })
    setShowForm(true)
    setMessage(null)
  }, [])

  const handleSave = useCallback(async () => {
    setMessage(null)
    if (!form.name.trim()) { setMessage('Ad Soyad zorunlu.'); return }

    try {
      if (editingUser) {
        const input: UpdateUserInput = { name: form.name, role: form.role }
        await usersApi.updateUser(editingUser.id, input)
      } else {
        if (!form.username.trim()) { setMessage('Kullanıcı adı zorunlu.'); return }
        if (form.password.length < 6) { setMessage('Şifre en az 6 karakter olmalı.'); return }
        await usersApi.createUser(form)
      }
      setShowForm(false)
      setEditingUser(null)
      await load()
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [form, editingUser, load])

  const handleToggleActive = useCallback(async (u: User) => {
    setMessage(null)
    try {
      if (u.active) await usersApi.deactivateUser(u.id)
      else await usersApi.activateUser(u.id)
      await load()
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [load])

  const handleResetPassword = useCallback(async () => {
    if (!resetTargetId) return
    if (resetPasswordInput.length < 6) { setMessage('Yeni şifre en az 6 karakter olmalı.'); return }
    try {
      await usersApi.resetPassword(resetTargetId, resetPasswordInput)
      setResetTargetId(null)
      setResetPasswordInput('')
      setMessage('Şifre sıfırlandı.')
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [resetTargetId, resetPasswordInput])

  const inputClass = 'w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]'
  const labelClass = 'mb-1 block text-xs font-medium text-[var(--color-ink-soft)]'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-petrol)]">Kullanıcı Yönetimi</h2>
        <button
          className="rounded-lg bg-[var(--color-saffron)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white"
          onClick={startCreate}
        >
          + Yeni Kullanıcı
        </button>
      </div>

      {message && <div className="text-sm text-[var(--color-copper)]">{message}</div>}

      {showForm && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--color-paper-line)] bg-[var(--color-paper-dim)] p-4 md:grid-cols-2">
          <h3 className="text-sm font-semibold text-[var(--color-ink-soft)] md:col-span-2">
            {editingUser ? `Kullanıcıyı Düzenle — ${editingUser.username}` : 'Yeni Kullanıcı'}
          </h3>
          <div>
            <label className={labelClass} htmlFor="uf-username">Kullanıcı Adı {editingUser && '(değiştirilemez)'}</label>
            <input id="uf-username" type="text" value={form.username} disabled={!!editingUser}
              onChange={e => setForm({ ...form, username: e.target.value })}
              className={`${inputClass} disabled:opacity-50`} />
          </div>
          <div>
            <label className={labelClass} htmlFor="uf-name">Ad Soyad</label>
            <input id="uf-name" type="text" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className={inputClass} />
          </div>
          {!editingUser && (
            <div>
              <label className={labelClass} htmlFor="uf-password">Şifre (en az 6 karakter)</label>
              <input id="uf-password" type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className={inputClass} />
            </div>
          )}
          <div>
            <label className={labelClass} htmlFor="uf-role">Rol</label>
            <select id="uf-role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })} className={inputClass}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button className="rounded-lg border border-[var(--color-paper-line)] bg-white px-6 py-2 text-sm font-medium" onClick={() => setShowForm(false)}>
              İptal
            </button>
            <button className="flex-1 rounded-lg bg-[var(--color-saffron)] py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white" onClick={handleSave}>
              Kaydet
            </button>
          </div>
        </div>
      )}

      {resetTargetId && (
        <div className="rounded-2xl border border-[var(--color-copper)]/40 bg-[var(--color-copper-light)]/10 p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-copper)]">
            Şifreyi Sıfırla — {users.find(u => u.id === resetTargetId)?.username}
          </h3>
          <div className="flex gap-2">
            <input type="password" placeholder="Yeni şifre (en az 6 karakter)" value={resetPasswordInput}
              onChange={e => setResetPasswordInput(e.target.value)}
              className={inputClass} />
            <button className="shrink-0 rounded-lg bg-[var(--color-copper)] px-4 py-2 text-sm font-semibold text-white" onClick={handleResetPassword}>
              Sıfırla
            </button>
            <button className="shrink-0 rounded-lg border border-[var(--color-paper-line)] bg-white px-4 py-2 text-sm" onClick={() => setResetTargetId(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Yükleniyor…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                <th className="pb-2 pt-1 text-left font-medium">Kullanıcı Adı</th>
                <th className="pb-2 pt-1 text-left font-medium">Ad Soyad</th>
                <th className="pb-2 pt-1 text-left font-medium">Rol</th>
                <th className="pb-2 pt-1 text-left font-medium">Durum</th>
                <th className="pb-2 pt-1 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id} className={`border-b border-[var(--color-paper-line)]/60 ${!u.active ? 'opacity-50' : ''}`}>
                    <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{u.username}{isSelf && <span className="ml-1 text-[var(--color-petrol)]">(sen)</span>}</td>
                    <td className="py-1.5">{u.name}</td>
                    <td className="py-1.5 text-xs">{ROLE_LABELS[u.role]}</td>
                    <td className="py-1.5 text-xs">{u.active ? 'Aktif' : 'Pasif'}</td>
                    <td className="py-1.5 text-right">
                      <button className="mr-2 text-xs font-medium text-[var(--color-petrol)] hover:underline" onClick={() => startEdit(u)}>
                        Düzenle
                      </button>
                      <button className="mr-2 text-xs font-medium text-[var(--color-ink-soft)] hover:underline" onClick={() => { setResetTargetId(u.id); setResetPasswordInput('') }}>
                        Şifre Sıfırla
                      </button>
                      <button
                        className="text-xs font-medium text-[var(--color-copper)] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => void handleToggleActive(u)}
                        disabled={isSelf && u.active}
                        title={isSelf && u.active ? 'Kendi hesabını pasife alamazsın' : undefined}
                      >
                        {u.active ? 'Pasife Al' : 'Aktifleştir'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
