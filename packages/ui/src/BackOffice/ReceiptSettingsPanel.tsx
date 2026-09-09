import { useEffect } from 'react'
import { useReceiptSettingsStore } from '@pazariopos/core'

export function ReceiptSettingsPanel() {
  const { settings, loading, error, fetchSettings, updateSettings } = useReceiptSettingsStore()

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  if (loading && !settings) {
    return <div className="text-center py-8">Yükleniyor...</div>
  }

  if (error) {
    return <div className="text-red-500 py-8">Hata: {error}</div>
  }

  if (!settings) {
    return <div className="text-gray-500 py-8">Fiş ayarları yüklenemedi</div>
  }

  const handleChange = (field: string, value: string | boolean) => {
    void updateSettings({ [field]: value } as any)
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
            value={settings.shopName}
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
            value={settings.shopPhone}
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
            checked={settings.showTaxBreakdown}
            onChange={(e) => handleChange('showTaxBreakdown', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-[var(--color-ink)]">KDV detayı göster</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showOrderNumber}
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
          value={settings.footerMessage}
          onChange={(e) => handleChange('footerMessage', e.target.value)}
          placeholder="Örn: Bizi tercih ettiğiniz için teşekkür ederiz"
          className="w-full px-3 py-2 border border-[var(--color-paper-line)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-petrol)]"
          rows={3}
        />
      </div>

      {/* Ön İzleme */}
      <div className="border-t pt-4 mt-6">
        <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-3">Fiş Ön İzlemesi</h3>
        <div className="bg-white border border-[var(--color-paper-line)] rounded-lg p-4 font-mono text-xs whitespace-pre-wrap max-w-xs mx-auto">
          {settings.shopName && <div className="text-center font-bold mb-2">{settings.shopName}</div>}
          {settings.shopPhone && <div className="text-center text-[0.7rem] mb-2">{settings.shopPhone}</div>}
          <div className="border-t border-dashed my-2"></div>
          {settings.showOrderNumber && <div>Fiş No: 00123</div>}
          <div className="border-t border-dashed my-2"></div>
          <div>Toplam: 99,99 ₺</div>
          {settings.showTaxBreakdown && <div>KDV: 15,29 ₺</div>}
          <div className="border-t border-dashed my-2"></div>
          {settings.footerMessage && <div className="text-center text-[0.7rem] mt-2">{settings.footerMessage}</div>}
        </div>
      </div>
    </div>
  )
}