import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { useSaleStore, type Sale } from '@pazariopos/core'

export function SalesHistoryScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const [sales, setSales] = useState<Sale[]>([])
  const lastSubmittedSale = useSaleStore(s => s.lastSubmittedSale)

  useEffect(() => {
    loadSales()
  }, [])

  const loadSales = async () => {
    try {
      // For now, we show the last submitted sale as a placeholder
      // In a real implementation, this would fetch from a history API or local storage
      if (lastSubmittedSale) {
        setSales([lastSubmittedSale])
      } else {
        setSales([])
      }
    } catch (error) {
      console.error('Satış geçmişi yüklenemedi:', error)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadSales()
    setRefreshing(false)
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2) + ' TL'
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return '💵'
      case 'card':
        return '💳'
      case 'account':
        return '📝'
      default:
        return '💰'
    }
  }

  const renderSaleItem = ({ item }: { item: Sale }) => (
    <View style={styles.saleItem}>
      <View style={styles.saleHeader}>
        <Text style={styles.saleId}>#{item.id.slice(-6).toUpperCase()}</Text>
        <Text style={styles.saleDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.saleBody}>
        <View style={styles.saleItemsInfo}>
          <Text style={styles.itemCount}>
            {item.lines.length} ürün
          </Text>
          {item.customerId && (
            <Text style={styles.customerName}>👤 Müşteri: {item.customerId}</Text>
          )}
        </View>
        <View style={styles.paymentInfo}>
          {item.payments.map((payment, idx) => (
            <View key={idx} style={styles.paymentBadge}>
              <Text style={styles.paymentIcon}>{getPaymentMethodIcon(payment.method)}</Text>
              <Text style={styles.paymentAmount}>{formatAmount(payment.amount)}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.saleFooter}>
        <Text style={[styles.statusBadge, item.syncedAt ? styles.synced : styles.pending]}>
          {item.syncedAt ? '✓ Senkronize' : '⏳ Beklemede'}
        </Text>
        <Text style={styles.totalAmount}>{formatAmount(item.grandTotal)}</Text>
      </View>
    </View>
  )

  if (sales.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Henüz satış yok</Text>
          <Text style={styles.emptySubtitle}>
            İlk satışınızı yaptıktan sonra burada gözükecek
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sales}
        renderItem={renderSaleItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A3A4A" />
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  listContent: {
    padding: 16,
  },
  saleItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  saleId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3A4A',
  },
  saleDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  saleBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  saleItemsInfo: {
    gap: 4,
  },
  itemCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  customerName: {
    fontSize: 13,
    color: '#1A3A4A',
    fontWeight: '500',
  },
  paymentInfo: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  paymentIcon: {
    fontSize: 12,
  },
  paymentAmount: {
    fontSize: 12,
    color: '#1A3A4A',
    fontWeight: '600',
  },
  saleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  synced: {
    backgroundColor: '#D4EDDA',
    color: '#155724',
  },
  pending: {
    backgroundColor: '#FFF3CD',
    color: '#856404',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D97706',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A3A4A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
})
