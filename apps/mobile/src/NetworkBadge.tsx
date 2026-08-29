import { View, Text, StyleSheet } from 'react-native'

interface NetworkBadgeProps {
  status: 'online' | 'offline' | 'degraded' | string
  pendingCount: number
  isSyncing: boolean
}

export function NetworkBadge({ status, pendingCount, isSyncing }: NetworkBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return '#22c55e'
      case 'offline':
        return '#ef4444'
      case 'degraded':
        return '#f59e0b'
      default:
        return '#9ca3af'
    }
  }

  const getStatusText = () => {
    if (isSyncing) return 'Senkronize ediliyor...'
    if (pendingCount > 0) return `${pendingCount} bekleyen`
    return status === 'online' ? 'Çevrimiçi' : status === 'offline' ? 'Çevrimdışı' : 'Durum bilinmiyor'
  }

  return (
    <View style={[styles.badge, { backgroundColor: getStatusColor() + '20', borderColor: getStatusColor() }]}>
      <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
      <Text style={[styles.text, { color: getStatusColor() }]}>{getStatusText()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
})
