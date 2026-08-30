import { useState, useEffect } from 'react'
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'

export default function SettingsScreen() {
  const [apiUrl, setApiUrl] = useState('http://localhost:3000')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Kaydedilen endpoint'i yükle
    loadApiUrl()
  }, [])

  const loadApiUrl = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('apiUrl')
      if (savedUrl) {
        setApiUrl(savedUrl)
      }
    } catch (error) {
      console.error('Error loading API URL:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveApiUrl = async () => {
    try {
      // URL validasyonu
      if (!apiUrl.trim()) {
        Alert.alert('Hata', 'Lütfen geçerli bir URL girin')
        return
      }

      if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
        Alert.alert('Hata', 'URL "http://" veya "https://" ile başlamalıdır')
        return
      }

      await AsyncStorage.setItem('apiUrl', apiUrl.trim())
      setSaved(true)
      
      // 2 saniye sonra saved indicator'ü kapat
      setTimeout(() => setSaved(false), 2000)
      
      Alert.alert('Başarılı', 'API endpoint kaydedildi. Uygulamayı yeniden başlatın.')
    } catch (error) {
      Alert.alert('Hata', 'Endpoint kaydedilirken hata oluştu')
      console.error('Error saving API URL:', error)
    }
  }

  const handleTestConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        timeout: 5000
      })
      
      if (response.ok) {
        Alert.alert('Başarılı', 'Sunucuya bağlantı sağlandı!')
      } else {
        Alert.alert('Uyarı', `Sunucu yanıt verdi: ${response.status}`)
      }
    } catch (error) {
      Alert.alert('Bağlantı Hatası', 'Sunucuya ulaşılamadı. Lütfen URL'yi kontrol edin.')
      console.error('Connection test failed:', error)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Yükleniyor...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="settings" size={32} color="#2563eb" />
        <Text style={styles.title}>Ayarlar</Text>
      </View>

      {/* API Endpoint Bölümü */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Sunucusu</Text>
        
        <Text style={styles.label}>API Endpoint Adresi:</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="https://your-aws-api.example.com"
          placeholderTextColor="#999"
          editable={!loading}
        />
        <Text style={styles.hint}>
          Örnek: https://api.pazariopos.com veya http://192.168.1.100:3000
        </Text>
      </View>

      {/* Mevcut Endpoint Bilgisi */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#0ea5e9" />
        <Text style={styles.infoText}>
          Mevcut endpoint: {apiUrl}
        </Text>
      </View>

      {/* Butonlar */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.testButton]}
          onPress={handleTestConnection}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.buttonText}>Bağlantıyı Test Et</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.saveButton, saved && styles.savedButton]}
          onPress={handleSaveApiUrl}
        >
          <Ionicons 
            name={saved ? "checkmark-done" : "save"} 
            size={20} 
            color="#fff" 
          />
          <Text style={styles.buttonText}>
            {saved ? 'Kaydedildi!' : 'Kaydet'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Yardım Bölümü */}
      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>💡 Yardım</Text>
        <Text style={styles.helpText}>
          • AWS'de barındırılan uygulamaya farklı ağlardan erişmek için burada endpoint adresini ayarlayın.
        </Text>
        <Text style={styles.helpText}>
          • HTTPS kullanmanız önerilir (güvenlik için).
        </Text>
        <Text style={styles.helpText}>
          • Değişiklikleri kaydettiğiniz sonra uygulamayı tamamen kapatıp açın.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
    color: '#1e293b'
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#475569'
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f1f5f9'
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic'
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ecf0ff',
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center'
  },
  infoText: {
    fontSize: 13,
    color: '#0c4a6e',
    marginLeft: 10,
    flex: 1
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24
  },
  button: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  testButton: {
    backgroundColor: '#06b6d4',
  },
  saveButton: {
    backgroundColor: '#2563eb'
  },
  savedButton: {
    backgroundColor: '#16a34a'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  helpSection: {
    backgroundColor: '#fffaed',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 10
  },
  helpText: {
    fontSize: 13,
    color: '#b45309',
    marginBottom: 8,
    lineHeight: 18
  }
})
