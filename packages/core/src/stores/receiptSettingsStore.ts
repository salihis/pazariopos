import { create } from 'zustand'

export interface ReceiptSettings {
  id: string
  shopName: string
  shopPhone: string
  showTaxBreakdown: boolean
  showOrderNumber: boolean
  footerMessage: string
  createdAt: string
  updatedAt: string
}

interface ReceiptSettingsStore {
  settings: ReceiptSettings | null
  loading: boolean
  error: string | null
  
  // Ayarları sunucudan getir
  fetchSettings: () => Promise<void>
  
  // Ayarları güncelle
  updateSettings: (updates: Partial<ReceiptSettings>) => Promise<void>
}

export const useReceiptSettingsStore = create<ReceiptSettingsStore>((set) => ({
  settings: null,
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/receipt-settings')
      if (!response.ok) throw new Error('Failed to fetch receipt settings')
      const settings = await response.json()
      set({ settings, loading: false })
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      set({ error, loading: false })
    }
  },

  updateSettings: async (updates) => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/receipt-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update receipt settings')
      const settings = await response.json()
      set({ settings, loading: false })
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      set({ error, loading: false })
    }
  },
}))