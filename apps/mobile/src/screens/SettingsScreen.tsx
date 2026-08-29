import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { useAuthStore } from '@pazariopos/core'

export function SettingsScreen() {
  const currentUser = useAuthStore(s => s.currentUser)
  const logout = useAuthStore(s => s.logout)
  const [activeTab, setActiveTab] = useState<'profile' | 'store' | 'about'>('profile')

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: () => {
            logout()
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'profile' && styles.activeTab]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>
            Profil
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'store' && styles.activeTab]}
          onPress={() => setActiveTab('store')}
        >
          <Text style={[styles.tabText, activeTab === 'store' && styles.activeTabText]}>
            Mağaza
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'about' && styles.activeTab]}
          onPress={() => setActiveTab('about')}
        >
          <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>
            Hakkında
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'profile' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kullanıcı Bilgileri</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>👤 Kullanıcı Adı:</Text>
                <Text style={styles.infoValue}>{currentUser?.username || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📛 İsim:</Text>
                <Text style={styles.infoValue}>{currentUser?.name || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>🔑 Rol:</Text>
                <Text style={styles.infoValue}>
                  {currentUser?.role === 'admin' ? 'Yönetici' : 'Personel'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>🚪 Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'store' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mağaza Ayarları</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>🏪 Mağaza Adı:</Text>
                <Text style={styles.infoValue}>PazarioPOS Demo</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📍 Adres:</Text>
                <Text style={styles.infoValue}>İstanbul, Türkiye</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📞 Telefon:</Text>
                <Text style={styles.infoValue}>+90 555 123 45 67</Text>
              </View>
            </View>
            <Text style={styles.comingSoonText}>Detaylı ayarlar yakında eklenecek...</Text>
          </View>
        )}

        {activeTab === 'about' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uygulama Bilgisi</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📱 Uygulama:</Text>
                <Text style={styles.infoValue}>PazarioPOS Mobile</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>🔖 Versiyon:</Text>
                <Text style={styles.infoValue}>0.1.0</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>🏗️ Platform:</Text>
                <Text style={styles.infoValue}>Expo SDK 53</Text>
              </View>
            </View>
            <View style={styles.aboutText}>
              <Text style={styles.aboutDescription}>
                PazarioPOS, modern işletmeler için geliştirilmiş açık kaynaklı bir POS sistemidir.
              </Text>
              <Text style={styles.aboutDescription}>
                Offline-first mimarisi sayesinde internet bağlantısı olmasa bile satış yapmaya devam
                edebilirsiniz.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  header: {
    backgroundColor: '#1A3A4A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8C8',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F2EB',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#1A3A4A',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3A4A',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1A3A4A',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  comingSoonText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
  },
  aboutText: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  aboutDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 12,
  },
})
