import { useEffect, useState } from 'react'
import { useReceiptSettingsStore } from '@pazariopos/core'

interface FormState {
  shopName: string
  shopPhone: string
  showTaxBreakdown: boolean
  showOrderNumber: boolean
  footerMessage: string
}

export function ReceiptSettingsPanel() {
  const { settings, loading, error, fetchSettings, updateSettings } = useReceiptSettingsStore()

  // Alanlar yerel state'te tutulur, her tuş vuruşunda sunucuya istek
  // ATILMAZ — sadece "Kaydet"e basınca tek bir istekle hepsi birden
  // gönderilir. settings sunucudan geldiğinde (ilk yükleme) form bir
  // kez bu değerlerle doldurulur.
  const [form, setForm] = useState<FormState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    if (settings && !form) {
      setForm({
        shopName: settings.shopName,
        shopPhone: settings.shopPhone,
        showTaxBreakdown: settings.showTaxBreakdown,
        showOrderNumber: settings.showOrderNumber,
        footerMessage: settings.footerMessage,
      })
    }
  }, [settings, form])

  if (loading && !form) {
    return <div className="text-center py-8">Yükleniyor...</div>
  }

  if (error) {
    return <div className="text-red-500 py-8">Hata: {error}</div>
  }

  if (!form) {
    return <div className="text-gray-500 py-8">Fiş ayarları yüklenemedi</div>
  }

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm(prev => (prev ? { ...prev, [field]: value } : prev))
    setSaveMessage(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      await updateSettings(form)
      setSaveMessage('Kaydedildi.')
    } catch (err) {
      setSaveMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6">Fiş Ayarları</h2>
        <p className="text-sm text-gray-600 mb-4">
          POS yazıcısından çıkacak fiş şablonunun görünümünü özelleştirin.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Dükkan Adı */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
            Dükkan Adı
          </label>
          <input
            type="text"
            value={form.shopName}
            onChange={(e) => handleChange('shopName', e.target.value)}
            placeholder="Örn: Pazario Market"
            className="w-full px-3 py-2 border border-[var(--color-paper-line)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-petrol)]"
          />
        </div>

        {/* Telefon */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
            Telefon
          </label>
          <input
            type="text"
            value={form.shopPhone}
            onChange={(e) => handleChange('shopPhone', e.target.value)}
            placeholder="Örn: 0224 1234567"
            className="w-full px-3 py-2 border border-[var(--color-paper-line)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-petrol)]"
          />
        </div>
      </div>

      {/* Checkbox'lar */}
      <div className="space-y-3 border-t pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.showTaxBreakdown}
            onChange={(e) => handleChange('showTaxBreakdown', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-[var(--color-ink)]">KDV detayı göster</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.showOrderNumber}
            onChange={(e) => handleChange('showOrderNumber', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-[var(--color-ink)]">Fiş numarası göster</span>
        </label>
      </div>

      {/* Footer Metni */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
          Footer Metni (İsteğe bağlı)
        </label>
        <textarea
          value={form.footerMessage}
          onChange={(e) => handleChange('footerMessage', e.target.value)}
          placeholder="Örn: Bizi tercih ettiğiniz için teşekkür ederiz"
          className="w-full px-3 py-2 border border-[var(--color-paper-line)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-petrol)]"
          rows={3}
        />
      </div>

      {/* Kaydet */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded-lg bg-[var(--color-petrol)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-petrol)]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {saveMessage && <span className="text-sm text-[var(--color-ink-soft)]">{saveMessage}</span>}
      </div>

      {/* Ön İzleme */}
      <div className="border-t pt-4 mt-6">
        <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-3">Fiş Ön İzlemesi</h3>
        <div className="bg-white border border-[var(--color-paper-line)] rounded-lg p-4 font-mono text-xs whitespace-pre-wrap max-w-xs mx-auto">
          {form.shopName && <div className="text-center font-bold mb-2">{form.shopName}</div>}
          {form.shopPhone && <div className="text-center text-[0.7rem] mb-2">{form.shopPhone}</div>}
          <div className="border-t border-dashed my-2"></div>
          {form.showOrderNumber && <div>Fiş No: 00123</div>}
          <div className="border-t border-dashed my-2"></div>
          <div>Toplam: 99,99 ₺</div>
          {form.showTaxBreakdown && <div>KDV: 15,29 ₺</div>}
          <div className="border-t border-dashed my-2"></div>
          {form.footerMessage && <div className="text-center text-[0.7rem] mt-2">{form.footerMessage}</div>}
        </div>
      </div>
    </div>
  )
}