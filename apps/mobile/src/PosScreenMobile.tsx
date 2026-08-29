import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

import {
  useSaleStore,
  useInventoryStore,
  useAccountStore,
  useAuthStore,
  getBarcodeService,
  type Product,
  type CartLine,
} from '@pazariopos/core'

function productToCartLine(product: Product, quantity = 1): CartLine {
  const discountAmount = 0
  const grossUnitPrice = product.price
  const netUnitPrice = Math.round(grossUnitPrice / (1 + product.taxRate))
  const taxAmount = grossUnitPrice - netUnitPrice

  return {
    product,
    quantity,
    unitPrice: netUnitPrice,
    discountAmount,
    taxAmount,
    total: (netUnitPrice - discountAmount + taxAmount) * quantity,
  }
}

interface PosScreenMobileProps {
  onNavigateToBackOffice?: () => void
}

export function PosScreenMobile({ onNavigateToBackOffice }: PosScreenMobileProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [showScanner, setShowScanner] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [scanFeedback, setScanFeedback] = useState<string | null>(null)

  const cart = useSaleStore(s => s.cart)
  const customerId = useSaleStore(s => s.customerId)
  const networkStatus = useSaleStore(s => s.networkStatus)
  const addLine = useSaleStore(s => s.addLine)
  const removeLine = useSaleStore(s => s.removeLine)
  const submitSale = useSaleStore(s => s.submitSale)
  const clearCart = useSaleStore(s => s.clearCart)

  const products = useInventoryStore(s => s.products)
  const loadProducts = useInventoryStore(s => s.loadProducts)
  const findByBarcode = useInventoryStore(s => s.findByBarcode)

  const loadAccounts = useAccountStore(s => s.loadAccounts)

  const currentUser = useAuthStore(s => s.currentUser)

  useEffect(() => {
    const teardown = useSaleStore.getState().init()
    return teardown
  }, [])

  useEffect(() => {
    if (!currentUser) return
    void loadProducts()
    void loadAccounts('customer')
  }, [loadProducts, loadAccounts, currentUser])

  useEffect(() => {
    const barcodeService = getBarcodeService()
    const unsubscribe = barcodeService.onScan(event => {
      const product = findByBarcode(event.value)
      if (!product) {
        setScanFeedback(`Bilinmeyen barkod: ${event.value}`)
        return
      }
      addLine(productToCartLine(product))
      setScanFeedback(`Eklendi: ${product.name}`)
      setTimeout(() => setScanFeedback(null), 2000)
    })
    return () => unsubscribe()
  }, [addLine, findByBarcode])

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    setShowScanner(false)
    const product = findByBarcode(data)
    if (!product) {
      setScanFeedback(`Bilinmeyen barkod: ${data}`)
      return
    }
    addLine(productToCartLine(product))
    setScanFeedback(`Eklendi: ${product.name}`)
    setTimeout(() => setScanFeedback(null), 2000)
  }

  const handleSelectProduct = (product: Product) => {
    addLine(productToCartLine(product))
    setScanFeedback(`Eklendi: ${product.name}`)
    setSearchQuery('')
    setTimeout(() => setScanFeedback(null), 2000)
  }

  const handleCheckout = async (method: 'cash' | 'card' | 'account') => {
    if (cart.length === 0) {
      Alert.alert('Boş Sepet', 'Sepette ürün yok.')
      return
    }
    if (method === 'account' && !customerId) {
      Alert.alert('Müşteri Seçilmedi', 'Veresiye satış için müşteri seçilmeli.')
      return
    }

    try {
      const grandTotal = cart.reduce((sum, l) => sum + l.total, 0)
      const outcome = await submitSale([{ method, amount: grandTotal }])
      const modeText = outcome.mode === 'online' ? 'çevrimiçi' : 'çevrimdışı (kuyruğa alındı)'
      Alert.alert('Satış Tamamlandı', `Satış ${modeText} gerçekleştirildi.`)
      clearCart()
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : String(err))
    }
  }

  const filteredProducts = searchQuery.trim().length >= 2
    ? products.filter(p =>
        p.name.toLocaleLowerCase('tr').includes(searchQuery.toLocaleLowerCase('tr'))
      ).slice(0, 10)
    : []

  const grandTotal = cart.reduce((sum, l) => sum + l.total, 0)

  if (!permission) {
    return <View style={styles.container}><Text>Kamera izni isteniyor...</Text></View>
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Kamera izni gerekli</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PazarioPOS — Mobil Satış</Text>
        <View style={styles.headerRight}>
          {onNavigateToBackOffice && (
            <TouchableOpacity onPress={onNavigateToBackOffice} style={styles.navButton}>
              <Text style={styles.navButtonText}>Yönetim</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.statusBadge, { borderColor: networkStatus === 'online' ? '#22c55e' : '#ef4444' }]}>
            <Text style={[styles.statusText, { color: networkStatus === 'online' ? '#22c55e' : '#ef4444' }]}>
              {networkStatus === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
            </Text>
          </View>
        </View>
      </View>

      {/* Scan Feedback */}
      {scanFeedback && (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>{scanFeedback}</Text>
        </View>
      )}

      {/* Search & Scanner */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün ara veya barkod gir..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => {
            const product = findByBarcode(searchQuery.trim())
            if (product) handleSelectProduct(product)
          }}
        />
        <TouchableOpacity style={styles.scanButton} onPress={() => setShowScanner(true)}>
          <Text style={styles.scanButtonText}>📷 Tara</Text>
        </TouchableOpacity>
      </View>

      {/* Search Suggestions */}
      {filteredProducts.length > 0 && (
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.suggestionItem} onPress={() => handleSelectProduct(item)}>
              <Text style={styles.suggestionName}>{item.name}</Text>
              <Text style={styles.suggestionPrice}>{(item.price / 100).toFixed(2)} TL</Text>
            </TouchableOpacity>
          )}
          style={styles.suggestionsList}
        />
      )}

      {/* Cart */}
      <View style={styles.cartSection}>
        <Text style={styles.sectionTitle}>Sepet ({cart.length})</Text>
        {cart.length === 0 ? (
          <Text style={styles.emptyCart}>Sepet boş</Text>
        ) : (
          <FlatList
            data={cart}
            keyExtractor={(item, index) => `${item.product.id}-${index}`}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <View style={styles.cartItemLeft}>
                  <Text style={styles.cartItemName}>{item.product.name}</Text>
                  <Text style={styles.cartItemQty}>Adet: {item.quantity}</Text>
                </View>
                <TouchableOpacity onPress={() => removeLine(item.product.id)}>
                  <Text style={styles.removeButton}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      {/* Total & Checkout */}
      <View style={styles.checkoutSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Toplam:</Text>
          <Text style={styles.totalAmount}>{(grandTotal / 100).toFixed(2)} TL</Text>
        </View>
        <View style={styles.checkoutButtons}>
          <TouchableOpacity
            style={[styles.checkoutButton, styles.cashButton]}
            onPress={() => handleCheckout('cash')}
          >
            <Text style={styles.checkoutButtonText}>Nakit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkoutButton, styles.cardButton]}
            onPress={() => handleCheckout('card')}
          >
            <Text style={styles.checkoutButtonText}>Kart</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkoutButton, styles.accountButton]}
            onPress={() => handleCheckout('account')}
            disabled={!customerId}
          >
            <Text style={[styles.checkoutButtonText, !customerId && styles.disabledText]}>Veresiye</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <View style={styles.scannerOverlay}>
          <CameraView
            style={styles.scanner}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_e', 'upc_a', 'code128', 'code39'],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <TouchableOpacity style={styles.closeScanner} onPress={() => setShowScanner(false)}>
            <Text style={styles.closeScannerText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A3A4A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF50',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  feedbackBanner: {
    backgroundColor: '#D4EDDA',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  feedbackText: {
    color: '#155724',
    fontSize: 13,
  },
  searchRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E0D8C8',
  },
  scanButton: {
    backgroundColor: '#1A3A4A',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionsList: {
    maxHeight: 200,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0D8C8',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionName: {
    fontSize: 14,
    color: '#1A3A4A',
  },
  suggestionPrice: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '600',
  },
  cartSection: {
    flex: 1,
    margin: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A3A4A',
    marginBottom: 8,
  },
  emptyCart: {
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cartItemLeft: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    color: '#1A3A4A',
    fontWeight: '500',
  },
  cartItemQty: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  removeButton: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  checkoutSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0D8C8',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A3A4A',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#D97706',
  },
  checkoutButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  checkoutButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cashButton: {
    backgroundColor: '#22c55e',
  },
  cardButton: {
    backgroundColor: '#3b82f6',
  },
  accountButton: {
    backgroundColor: '#D97706',
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledText: {
    opacity: 0.5,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000EE',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  scanner: {
    width: 300,
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
  },
  closeScanner: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
  },
  closeScannerText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionText: {
    fontSize: 16,
    color: '#1A3A4A',
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#1A3A4A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
})
