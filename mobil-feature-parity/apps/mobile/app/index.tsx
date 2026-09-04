import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useStore, Account, Product } from './store/useStore';
import SettingsScreen from './settings';

export default function Index() {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    token,
    username,
    role,
    isLoading,
    products,
    quickSaleGroups,
    cart,
    slots,
    activeSlotIndex,
    priceTier,
    isOnline,
    offlineSales,
    accounts,
    selectedCustomerId,
    cashRegister,
    cashMovements,
    profitLoss,
    activeStockCount,
    init,
    login,
    logout,
    addToCart,
    addMiscSaleItem,
    getTotalPrice,
    checkout,
    syncOfflineSales,
    fetchProducts,
    fetchAccounts,
    fetchFinanceData,
    fetchActiveStockCount,
    startStockCount,
    submitStockCountItem,
    removeStockCountItem,
    completeStockCount,
    setSelectedCustomerId,
    setActiveSlot,
    setPriceTier,
    recordCariPayment
  } = useStore();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [showScanner, setShowScanner] = useState(false);
  const [currentTab, setCurrentTab] = useState<'sales' | 'cari' | 'count' | 'finance' | 'settings'>('sales');

  // Login form state
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Cari selection Modal state
  const [showCariPicker, setShowCariPicker] = useState(false);
  
  // Cari payment Modal state
  const [selectedCariForPayment, setSelectedCariForPayment] = useState<Account | null>(null);
  const [showMiscSaleModal, setShowMiscSaleModal] = useState(false);
  const [miscSaleName, setMiscSaleName] = useState('');
  const [miscSalePrice, setMiscSalePrice] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Stock count Modal state
  const [selectedProductForCount, setSelectedProductForCount] = useState<Product | null>(null);
  const [countedAmount, setCountedAmount] = useState('');
  const [submittingCount, setSubmittingCount] = useState(false);
  const [showProductPickerForCount, setShowProductPickerForCount] = useState(false);

  useEffect(() => {
    init();
  }, []);

  // Sync data periodically when online
  useEffect(() => {
    if (token && isOnline) {
      if (currentTab === 'cari') fetchAccounts();
      if (currentTab === 'finance') fetchFinanceData();
      if (currentTab === 'count') fetchActiveStockCount();
    }
  }, [currentTab, isOnline]);

  const handleLogin = async () => {
    setLoginError('');
    if (!inputUsername || !inputPassword) {
      setLoginError('Lütfen tüm alanları doldurun.');
      return;
    }
    const success = await login(inputUsername, inputPassword);
    if (!success) {
      setLoginError('Kullanıcı adı veya şifre hatalı.');
    } else {
      setInputUsername('');
      setInputPassword('');
    }
  };

  const handleBarcodeScanned = (scanningResult: { data: string }) => {
    setShowScanner(false);
    const barcode = scanningResult.data;
    if (!barcode) {
      Alert.alert('Hata', 'Barkod okunamadı.');
      return;
    }

    const product = products.find((p) => {
      if (Array.isArray(p.barcode)) {
        return p.barcode.includes(barcode);
      }
      return p.barcode === barcode;
    });

    if (product) {
      if (currentTab === 'sales') {
        addToCart(product);
        Alert.alert('Ürün Eklendi', `${product.name} sepete eklendi.`);
      } else if (currentTab === 'count') {
        // Open counted input for this product
        setSelectedProductForCount(product);
        const existingItem = activeStockCount?.items.find(i => i.productId === product.id);
        setCountedAmount(existingItem ? existingItem.countedStock.toString() : '');
      }
    } else if (currentTab === 'sales') {
      Alert.alert(
        'Ürün Bulunamadı',
        `Barkod: ${barcode}\nBu barkoda sahip bir ürün bulunamadı.`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Muhtelif Satış',
            onPress: () => {
              setMiscSaleName('');
              setMiscSalePrice('');
              setShowMiscSaleModal(true);
            },
          },
        ],
      );
    } else {
      Alert.alert('Ürün Bulunamadı', `Barkod: ${barcode}\nBu barkoda sahip bir ürün bulunamadı.`);
    }
  };

  const handleConfirmMiscSale = () => {
    const name = miscSaleName.trim();
    const price = parseFloat(miscSalePrice.replace(',', '.'));
    if (!name || !Number.isFinite(price) || price <= 0) {
      Alert.alert('Hata', 'Geçerli bir ürün adı ve fiyat girin.');
      return;
    }
    addMiscSaleItem(name, price);
    setShowMiscSaleModal(false);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Sepet Boş', 'Lütfen sepete ürün ekleyin.');
      return;
    }

    const selectedCari = accounts.find(a => a.id === selectedCustomerId);

    const buttons = [
      {
        text: 'Nakit',
        onPress: () => performCheckout('cash'),
      },
      {
        text: 'Kredi Kartı',
        onPress: () => performCheckout('card'),
      }
    ];

    if (selectedCustomerId) {
      buttons.push({
        text: `Veresiye (${selectedCari?.name})`,
        onPress: () => performCheckout('account'),
      });
    }

    buttons.push({
      text: 'İptal',
      style: 'cancel',
    } as any);

    Alert.alert(
      'Ödeme Yöntemi Seçin',
      `Toplam Tutar: ${getTotalPrice().toFixed(2)} ₺${selectedCari ? `\nMüşteri: ${selectedCari.name}` : ''}`,
      buttons
    );
  };

  const performCheckout = async (method: 'cash' | 'card' | 'account') => {
    const result = await checkout(method);
    Alert.alert(result.success ? 'Başarılı' : 'Hata', result.message);
  };

  const handleSync = async () => {
    if (offlineSales.length === 0) return;
    const result = await syncOfflineSales();
    Alert.alert(
      'Senkronizasyon Raporu',
      `${result.successCount} adet satış başarıyla sunucuya aktarıldı. ${result.failedCount} adet başarısız.`
    );
  };

  const handleCariPaymentSubmit = async () => {
    if (!selectedCariForPayment) return;
    const amountFloat = parseFloat(paymentAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir tutar girin.');
      return;
    }

    setSubmittingPayment(true);
    const success = await recordCariPayment(selectedCariForPayment.id, amountFloat, paymentDescription);
    setSubmittingPayment(false);

    if (success) {
      Alert.alert('Başarılı', 'Ödeme başarıyla kaydedildi.');
      setSelectedCariForPayment(null);
      setPaymentAmount('');
      setPaymentDescription('');
    } else {
      Alert.alert('Hata', 'Ödeme sunucuya kaydedilemedi. Çevrimiçi olduğunuzdan emin olun.');
    }
  };

  const handleStartStockCount = async () => {
    const success = await startStockCount('default-warehouse');
    if (!success) {
      Alert.alert('Hata', 'Sayım oturumu başlatılamadı.');
    }
  };

  const handleStockCountItemSubmit = async () => {
    if (!selectedProductForCount) return;
    const stockInt = parseInt(countedAmount);
    if (isNaN(stockInt) || stockInt < 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir stok miktarı girin.');
      return;
    }

    setSubmittingCount(true);
    const success = await submitStockCountItem(selectedProductForCount.id, stockInt);
    setSubmittingCount(false);

    if (success) {
      setSelectedProductForCount(null);
      setCountedAmount('');
    } else {
      Alert.alert('Hata', 'Miktar kaydedilemedi.');
    }
  };

  const handleRemoveStockCountItem = (productId: string, productName: string) => {
    Alert.alert(
      'Kaydı Sil',
      `"${productName}" için yapılan sayım kaydını iptal etmek istediğinize emin misiniz?`,
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            const success = await removeStockCountItem(productId);
            if (!success) Alert.alert('Hata', 'Kayıt silinemedi.');
          },
        },
      ]
    );
  };

  const handleCompleteStockCount = () => {
    if (!activeStockCount || activeStockCount.items.length === 0) {
      Alert.alert('Boş Oturum', 'Sayımı aktarmak için en az bir ürün saymış olmalısınız.');
      return;
    }

    Alert.alert(
      'Sayımı Tamamla',
      `Toplam ${activeStockCount.items.length} çeşit ürün sayıldı. Bu miktarlar mevcut ürün stoklarının üzerine YAZILACAKTIR. Onaylıyor musunuz?`,
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: 'Evet, Stokları Güncelle',
          onPress: async () => {
            const success = await completeStockCount();
            if (success) {
              Alert.alert('Başarılı', 'Sayım başarıyla tamamlandı ve stoklar güncellendi.');
            } else {
              Alert.alert('Hata', 'Sayım tamamlanamadı.');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d99a2b" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  // 1. LOGIN SCREEN
  if (!token) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>PazarioPOS</Text>
          <Text style={styles.loginSubtitle}>Mobil Satış Terminali</Text>

          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Kullanıcı Adı"
            value={inputUsername}
            onChangeText={setInputUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Şifre"
            value={inputPassword}
            onChangeText={setInputPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Giriş Yap</Text>
          </TouchableOpacity>

          <View style={styles.connectionBadgeContainer}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }]} />
            <Text style={styles.statusText}>{isOnline ? 'Sunucu Bağlantısı Aktif' : 'Çevrimdışı Çalışıyor'}</Text>
          </View>

          <TouchableOpacity 
            style={styles.settingsLoginButton}
            onPress={() => setShowSettings(true)}
          >
            <Ionicons name="settings" size={18} color="#d99a2b" />
            <Text style={styles.settingsLoginButtonText}>Ayarlar</Text>
          </TouchableOpacity>
        </View>

        {showSettings && (
          <Modal visible={showSettings} animationType="slide" transparent={false}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity 
                style={styles.settingsCloseBtn}
                onPress={() => setShowSettings(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
                <Text style={styles.settingsCloseBtnText}>Geri Dön</Text>
              </TouchableOpacity>
              <SettingsScreen />
            </View>
          </Modal>
        )}
      </View>
    );
  }

  // 2. CAMERA/BARCODE SCANNER VIEW
  if (showScanner) {
    return (
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
        />
        <TouchableOpacity
          style={styles.closeScanner}
          onPress={() => setShowScanner(false)}
        >
          <Text style={styles.closeScannerText}>Kapat</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedCariObj = accounts.find(a => a.id === selectedCustomerId);

  // Settings Tab View
  if (currentTab === 'settings') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PazarioPOS</Text>
            <Text style={styles.cashierText}>{username} ({role})</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={logout} style={styles.iconButton}>
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={styles.tabButton} 
            onPress={() => setCurrentTab('sales')}
          >
            <Ionicons name="cart" size={20} color="#666" />
            <Text style={styles.tabButtonText}>Satış</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabButton} 
            onPress={() => setCurrentTab('cari')}
          >
            <Ionicons name="people" size={20} color="#666" />
            <Text style={styles.tabButtonText}>Cari</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabButton} 
            onPress={() => setCurrentTab('count')}
          >
            <Ionicons name="clipboard" size={20} color="#666" />
            <Text style={styles.tabButtonText}>Sayım</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabButton} 
            onPress={() => setCurrentTab('finance')}
          >
            <Ionicons name="stats-chart" size={20} color="#666" />
            <Text style={styles.tabButtonText}>Finans</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, styles.activeTabButton]} 
            onPress={() => setCurrentTab('settings')}
          >
            <Ionicons name="settings" size={20} color="#d99a2b" />
            <Text style={[styles.tabButtonText, styles.activeTabButtonText]}>Ayarlar</Text>
          </TouchableOpacity>
        </View>

        <SettingsScreen />
      </View>
    );
  }

  // 3. MAIN APP VIEW WITH TABS
  return (
    <View style={styles.container}>
      {/* Üst Başlık */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>PazarioPOS</Text>
          <Text style={styles.cashierText}>{username} ({role})</Text>
        </View>

        <View style={styles.headerActions}>
          {offlineSales.length > 0 && (
            <TouchableOpacity onPress={handleSync} style={styles.syncButton}>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.syncBadge}>{offlineSales.length}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => isOnline && fetchProducts()} style={styles.iconButton}>
            <Ionicons
              name={isOnline ? 'cloud-done' : 'cloud-offline'}
              size={24}
              color={isOnline ? '#4CAF50' : '#F44336'}
            />
          </TouchableOpacity>

          {(currentTab === 'sales' || (currentTab === 'count' && activeStockCount)) && (
            <TouchableOpacity onPress={() => setShowScanner(true)} style={styles.iconButton}>
              <Ionicons name="barcode-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={logout} style={styles.iconButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* TABS CONTAINER */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, currentTab === 'sales' && styles.activeTabButton]} 
          onPress={() => setCurrentTab('sales')}
        >
          <Ionicons name="cart" size={20} color={currentTab === 'sales' ? '#d99a2b' : '#666'} />
          <Text style={[styles.tabButtonText, currentTab === 'sales' && styles.activeTabButtonText]}>Satış</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, currentTab === 'cari' && styles.activeTabButton]} 
          onPress={() => setCurrentTab('cari')}
        >
          <Ionicons name="people" size={20} color={currentTab === 'cari' ? '#d99a2b' : '#666'} />
          <Text style={[styles.tabButtonText, currentTab === 'cari' && styles.activeTabButtonText]}>Cari</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, currentTab === 'count' && styles.activeTabButton]} 
          onPress={() => setCurrentTab('count')}
        >
          <Ionicons name="clipboard" size={20} color={currentTab === 'count' ? '#d99a2b' : '#666'} />
          <Text style={[styles.tabButtonText, currentTab === 'count' && styles.activeTabButtonText]}>Sayım</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, currentTab === 'finance' && styles.activeTabButton]} 
          onPress={() => setCurrentTab('finance')}
        >
          <Ionicons name="stats-chart" size={20} color={currentTab === 'finance' ? '#d99a2b' : '#666'} />
          <Text style={[styles.tabButtonText, currentTab === 'finance' && styles.activeTabButtonText]}>Finans</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => setCurrentTab('settings')}
        >
          <Ionicons name="settings" size={20} color="#666" />
          <Text style={styles.tabButtonText}>Ayarlar</Text>
        </TouchableOpacity>
      </View>

      {/* 3a. SALES TAB */}
      {currentTab === 'sales' && (
        <View style={{ flex: 1 }}>
          {/* Multi-customer tabs — up to 4 concurrent draft sales, so
              Müşteri 2 doesn't have to wait for Müşteri 1. */}
          <View style={styles.slotTabRow}>
            {slots.map((slot, i) => {
              const slotTotal = slot.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
              const isActive = i === activeSlotIndex;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.slotTabButton,
                    isActive && styles.slotTabButtonActive,
                    !isActive && slot.cart.length > 0 && styles.slotTabButtonFilled,
                  ]}
                  onPress={() => setActiveSlot(i)}
                >
                  <Text style={[styles.slotTabText, isActive && styles.slotTabTextActive]}>
                    Müşteri {i + 1} ({slotTotal.toFixed(2)})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.cariSelectorRow}>
            <TouchableOpacity style={styles.cariSelectorBtn} onPress={() => setShowCariPicker(true)}>
              <Ionicons name="person-outline" size={18} color="#123738" style={{ marginRight: 6 }} />
              <Text style={styles.cariSelectorText} numberOfLines={1}>
                {selectedCariObj ? `Cari: ${selectedCariObj.name}` : 'Veresiye için Müşteri Seç'}
              </Text>
            </TouchableOpacity>

            {selectedCustomerId && (
              <TouchableOpacity style={styles.clearCariBtn} onPress={() => setSelectedCustomerId(null)}>
                <Ionicons name="close-circle" size={20} color="#b5551f" />
              </TouchableOpacity>
            )}

            {/* Fiyat 1 / Fiyat 2 — which price to charge for items added
                from this point on (falls back to Fiyat 1 when a product
                has no Fiyat 2). */}
            <TouchableOpacity
              style={[styles.priceTierBtn, priceTier === 2 && styles.priceTierBtnActive]}
              onPress={() => setPriceTier(priceTier === 1 ? 2 : 1)}
            >
              <Text style={[styles.priceTierText, priceTier === 2 && styles.priceTierTextActive]}>
                Fiyat {priceTier}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hızlı Ürün Grubu filter chips — narrows the catalog list
              below to just one group (ör. "Çok Satanlar"). */}
          {quickSaleGroups.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupChipRow}>
              <TouchableOpacity
                style={[styles.groupChip, selectedGroupId === null && styles.groupChipActive]}
                onPress={() => setSelectedGroupId(null)}
              >
                <Text style={[styles.groupChipText, selectedGroupId === null && styles.groupChipTextActive]}>Tümü</Text>
              </TouchableOpacity>
              {quickSaleGroups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.groupChip, selectedGroupId === group.id && styles.groupChipActive]}
                  onPress={() => setSelectedGroupId(group.id)}
                >
                  <Text style={[styles.groupChipText, selectedGroupId === group.id && styles.groupChipTextActive]}>
                    {group.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <FlatList
            data={selectedGroupId === null ? products : products.filter(p => p.quickSaleGroupId === selectedGroupId)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const chargedPrice = (priceTier === 2 ? item.price2 : null) ?? item.price;
              return (
                <TouchableOpacity style={styles.productCard} onPress={() => addToCart(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{item.name}</Text>
                    {item.brand && <Text style={styles.productBrandText}>{item.brand}</Text>}
                    <Text style={styles.productPrice}>
                      {chargedPrice.toFixed(2)} ₺
                      {priceTier === 2 && item.price2 != null && <Text style={styles.priceTierBadge}> (F2)</Text>}
                    </Text>
                    {item.stock <= item.lowStockThreshold && (
                      <Text style={styles.lowStockText}>Düşük Stok: {item.stock} {item.unit}</Text>
                    )}
                  </View>
                  <Ionicons name="add-circle-outline" size={30} color="#d99a2b" />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="pricetags-outline" size={48} color="#999" />
                <Text style={styles.emptyText}>Ürün bulunamadı veya henüz yüklenmedi.</Text>
              </View>
            }
          />

          <View style={styles.cartSummary}>
            <Text style={styles.cartText}>Sepet: {cart.reduce((sum, item) => sum + item.quantity, 0)} ürün</Text>
            
            <View style={styles.registerDisplay}>
              <Text style={styles.totalText}>{getTotalPrice().toFixed(2)} ₺</Text>
            </View>

            <TouchableOpacity 
              style={styles.checkoutButton}
              onPress={handleCheckout}
            >
              <Text style={styles.checkoutButtonText}>Ödeme Al</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 3b. CARI ACCOUNTS TAB */}
      {currentTab === 'cari' && (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.productCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.cariTypeText}>Tip: {item.type === 'customer' ? 'Müşteri' : item.type === 'supplier' ? 'Tedarikçi' : 'Diğer'}</Text>
                <Text style={[styles.productPrice, { color: item.balance >= 0 ? '#4CAF50' : '#b5551f' }]}>
                  Bakiye: {item.balance.toFixed(2)} ₺ {item.balance > 0 ? '(Alacaklıyız)' : item.balance < 0 ? '(Borçluyuz)' : ''}
                </Text>
              </View>
              {isOnline && (
                <TouchableOpacity 
                  style={styles.tahsilatButton} 
                  onPress={() => {
                    setSelectedCariForPayment(item);
                    setPaymentAmount('');
                    setPaymentDescription('');
                  }}
                >
                  <Text style={styles.tahsilatButtonText}>İşlem Yap</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>Cari hesap bulunamadı.</Text>
            </View>
          }
        />
      )}

      {/* 3c. STOCK COUNT TAB */}
      {currentTab === 'count' && (
        <View style={{ flex: 1 }}>
          {!isOnline ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color="#b5551f" />
              <Text style={[styles.emptyText, { color: '#b5551f', fontWeight: 'bold' }]}>
                Stok sayımı sadece çevrimiçi (online) modda yapılabilir.
              </Text>
            </View>
          ) : !activeStockCount ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="clipboard-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>Aktif bir stok sayım oturumu yok.</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={handleStartStockCount}>
                <Text style={styles.refreshButtonText}>Yeni Sayım Başlat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Active Draft Header info */}
              <View style={styles.draftHeaderInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.draftInfoTitle}>Stok Sayım Oturumu Aktif</Text>
                  <Text style={styles.draftInfoSubtitle}>Başlangıç: {new Date(activeStockCount.startedAt).toLocaleString('tr-TR')}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.tahsilatButton} 
                  onPress={() => setShowProductPickerForCount(true)}
                >
                  <Text style={styles.tahsilatButtonText}>Ürün Seç</Text>
                </TouchableOpacity>
              </View>

              {/* Counted Items list */}
              <FlatList
                data={activeStockCount.items}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const diff = item.countedStock - item.previousStock;
                  return (
                    <View style={styles.productCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productName}>{item.productName}</Text>
                        <Text style={styles.cariTypeText}>Kod: {item.productSku}</Text>
                        <Text style={styles.stockItemDetails}>
                          Sistem: {item.previousStock} | Sayılan: {item.countedStock}
                        </Text>
                        <Text style={[styles.stockItemDiff, { color: diff === 0 ? '#666' : diff > 0 ? '#4CAF50' : '#b5551f' }]}>
                          Fark: {diff > 0 ? `+${diff}` : diff}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Edit quantity */}
                        <TouchableOpacity 
                          style={[styles.tahsilatButton, { marginRight: 8 }]} 
                          onPress={() => {
                            const prod = products.find(p => p.id === item.productId);
                            if (prod) {
                              setSelectedProductForCount(prod);
                              setCountedAmount(item.countedStock.toString());
                            }
                          }}
                        >
                          <Ionicons name="create" size={16} color="#fff" />
                        </TouchableOpacity>
                        
                        {/* Delete count item */}
                        <TouchableOpacity 
                          style={[styles.tahsilatButton, { backgroundColor: '#b5551f' }]} 
                          onPress={() => handleRemoveStockCountItem(item.productId, item.productName)}
                        >
                          <Ionicons name="trash" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="barcode" size={48} color="#999" />
                    <Text style={styles.emptyText}>Henüz ürün sayılmadı. Sağ üstteki barkod butonuna basarak tarayabilir veya Ürün Seç butonundan ekleyebilirsiniz.</Text>
                  </View>
                }
              />

              {/* Complete count actions */}
              <View style={styles.cartSummary}>
                <TouchableOpacity 
                  style={[styles.checkoutButton, { backgroundColor: '#4CAF50' }]}
                  onPress={handleCompleteStockCount}
                >
                  <Text style={styles.checkoutButtonText}>Sayımı Tamamla (Stokları Aktar)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 3d. FINANCE TAB */}
      {currentTab === 'finance' && (
        <ScrollView style={styles.scrollContainer}>
          {cashRegister && (
            <View style={styles.financeCard}>
              <Text style={styles.financeCardTitle}>Kasa Durumu</Text>
              <Text style={styles.financeRegisterName}>{cashRegister.name}</Text>
              <View style={styles.registerDisplay}>
                <Text style={styles.totalText}>{cashRegister.balance.toFixed(2)} ₺</Text>
              </View>
            </View>
          )}

          {profitLoss && (
            <View style={styles.financeCard}>
              <Text style={styles.financeCardTitle}>Yıllık Özet Rapor</Text>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Satış Geliri:</Text>
                <Text style={[styles.reportValue, { color: '#4CAF50' }]}>{profitLoss.salesRevenue.toFixed(2)} ₺</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Toplam Gider:</Text>
                <Text style={[styles.reportValue, { color: '#b5551f' }]}>{profitLoss.totalExpense.toFixed(2)} ₺</Text>
              </View>
              <View style={styles.reportDivider} />
              <View style={styles.reportRow}>
                <Text style={[styles.reportLabel, { fontWeight: 'bold' }]}>Net Kâr:</Text>
                <Text style={[styles.reportValue, { fontWeight: 'bold', color: profitLoss.netProfit >= 0 ? '#4CAF50' : '#b5551f' }]}>
                  {profitLoss.netProfit.toFixed(2)} ₺
                </Text>
              </View>
            </View>
          )}

          <View style={styles.movementsContainer}>
            <Text style={styles.movementsTitle}>Kasa Hareketi Geçmişi</Text>
            {cashMovements.length === 0 ? (
              <Text style={styles.emptyText}>Hareket bulunamadı.</Text>
            ) : (
              cashMovements.slice(0, 10).map((m) => (
                <View key={m.id} style={styles.movementItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.movementDesc}>{m.description}</Text>
                    <Text style={styles.movementDate}>{new Date(m.createdAt).toLocaleDateString('tr-TR')}</Text>
                  </View>
                  <Text style={[styles.movementAmount, { color: m.type === 'in' ? '#4CAF50' : '#b5551f' }]}>
                    {m.type === 'in' ? '+' : '-'}{m.amount.toFixed(2)} ₺
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* CARI PICKER MODAL */}
      <Modal visible={showCariPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cari Hesap Seçin</Text>
            <FlatList
              data={accounts.filter(a => a.type === 'customer')}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalCariItem} 
                  onPress={() => {
                    setSelectedCustomerId(item.id);
                    setShowCariPicker(false);
                  }}
                >
                  <Text style={styles.modalCariName}>{item.name}</Text>
                  <Text style={styles.modalCariBalance}>Bakiye: {item.balance.toFixed(2)} ₺</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Kayıtlı müşteri bulunamadı.</Text>
              }
            />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowCariPicker(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MUHTELİF SATIŞ MODAL — barcode scanned but no matching product;
          sells a one-off name+price line without touching the catalog. */}
      <Modal visible={showMiscSaleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Muhtelif Satış</Text>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              Kataloğa eklenmez, sadece bu satışa özel bir satır eklenir.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Ürün adı"
              value={miscSaleName}
              onChangeText={setMiscSaleName}
            />

            <TextInput
              style={styles.input}
              placeholder="Fiyat (₺)"
              keyboardType="numeric"
              value={miscSalePrice}
              onChangeText={setMiscSalePrice}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#4CAF50' }]}
                onPress={handleConfirmMiscSale}
              >
                <Text style={styles.modalActionText}>Sepete Ekle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#b5551f' }]}
                onPress={() => setShowMiscSaleModal(false)}
              >
                <Text style={styles.modalActionText}>Vazgeç</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CARI PAYMENT RECORD MODAL */}
      <Modal visible={selectedCariForPayment !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cari İşlem / Tahsilat</Text>
            {selectedCariForPayment && (
              <View style={{ marginBottom: 15 }}>
                <Text style={styles.paymentAccountName}>{selectedCariForPayment.name}</Text>
                <Text style={styles.paymentAccountBalance}>Mevcut Bakiye: {selectedCariForPayment.balance.toFixed(2)} ₺</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Tahsilat Tutarı (₺)"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Açıklama (örn: Nakit Tahsilat)"
              value={paymentDescription}
              onChangeText={setPaymentDescription}
            />

            {submittingPayment ? (
              <ActivityIndicator size="small" color="#d99a2b" style={{ marginVertical: 15 }} />
            ) : (
              <View style={styles.modalButtonRow}>
                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: '#4CAF50' }]} 
                  onPress={handleCariPaymentSubmit}
                >
                  <Text style={styles.modalActionText}>Kaydet</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: '#b5551f' }]} 
                  onPress={() => setSelectedCariForPayment(null)}
                >
                  <Text style={styles.modalActionText}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* PRODUCT PICKER FOR STOCK COUNT MODAL */}
      <Modal visible={showProductPickerForCount} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sayılacak Ürünü Seçin</Text>
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalCariItem} 
                  onPress={() => {
                    setShowProductPickerForCount(false);
                    setSelectedProductForCount(item);
                    const existingItem = activeStockCount?.items.find(i => i.productId === item.id);
                    setCountedAmount(existingItem ? existingItem.countedStock.toString() : '');
                  }}
                >
                  <Text style={styles.modalCariName}>{item.name}</Text>
                  <Text style={styles.modalCariBalance}>Mevcut Stok: {item.stock} {item.unit}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowProductPickerForCount(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* STOCK COUNT QUANTITY INPUT MODAL */}
      <Modal visible={selectedProductForCount !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Miktar Girin</Text>
            {selectedProductForCount && (
              <View style={{ marginBottom: 15 }}>
                <Text style={styles.paymentAccountName}>{selectedProductForCount.name}</Text>
                <Text style={styles.paymentAccountBalance}>Mevcut Stok: {selectedProductForCount.stock} {selectedProductForCount.unit}</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Sayılan Miktar"
              keyboardType="numeric"
              value={countedAmount}
              onChangeText={setCountedAmount}
            />

            {submittingCount ? (
              <ActivityIndicator size="small" color="#d99a2b" style={{ marginVertical: 15 }} />
            ) : (
              <View style={styles.modalButtonRow}>
                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: '#4CAF50' }]} 
                  onPress={handleStockCountItemSubmit}
                >
                  <Text style={styles.modalActionText}>Kaydet</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: '#b5551f' }]} 
                  onPress={() => setSelectedProductForCount(null)}
                >
                  <Text style={styles.modalActionText}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e4' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f1e4' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#123738', fontWeight: 'bold' },
  scrollContainer: { flex: 1, padding: 10 },
  
  // Login styles
  loginContainer: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#123738' },
  loginCard: { backgroundColor: '#f6f1e4', padding: 25, borderRadius: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  loginTitle: { fontSize: 28, fontWeight: 'bold', color: '#123738', textAlign: 'center', fontFamily: 'Fraunces' },
  loginSubtitle: { fontSize: 16, color: '#b5551f', textAlign: 'center', marginBottom: 20 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
  loginButton: { backgroundColor: '#d99a2b', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  settingsLoginButton: { flexDirection: 'row', backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 15, borderWidth: 1, borderColor: '#d99a2b' },
  settingsLoginButtonText: { color: '#d99a2b', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  settingsCloseBtn: { flexDirection: 'row', backgroundColor: '#123738', padding: 12, alignItems: 'center', paddingTop: 40 },
  settingsCloseBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  errorText: { color: 'red', marginBottom: 10, textAlign: 'center' },
  connectionBadgeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 14, color: '#666' },

  // Header styles
  header: { padding: 20, paddingTop: 60, backgroundColor: '#123738', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  cashierText: { fontSize: 12, color: '#d99a2b', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 8, marginLeft: 8 },
  syncButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#b5551f', padding: 6, borderRadius: 6, marginRight: 8 },
  syncBadge: { color: '#fff', fontWeight: 'bold', marginLeft: 4, fontSize: 14 },

  // TABS styling
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e6dfd0', paddingVertical: 8, overflow: 'hidden' },
  tabButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: '#d99a2b' },
  tabButtonText: { fontSize: 11, fontWeight: '600', color: '#666', marginLeft: 4 },
  activeTabButtonText: { color: '#d99a2b' },

  // Cari Selector Row (Satış sekmesinde)
  cariSelectorRow: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e6dfd0', alignItems: 'center' },
  slotTabRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e6dfd0' },
  slotTabButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e6dfd0', backgroundColor: '#fff' },
  slotTabButtonActive: { backgroundColor: '#123738', borderColor: '#123738' },
  slotTabButtonFilled: { borderColor: '#d99a2b', backgroundColor: '#fdf3e2' },
  slotTabText: { fontSize: 12, fontWeight: '600', color: '#666' },
  slotTabTextActive: { color: '#fff' },
  priceTierBtn: { marginLeft: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e6dfd0', backgroundColor: '#fff' },
  priceTierBtnActive: { backgroundColor: '#b5551f', borderColor: '#b5551f' },
  priceTierText: { fontSize: 12, fontWeight: '700', color: '#123738' },
  priceTierTextActive: { color: '#fff' },
  groupChipRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e6dfd0' },
  groupChip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e6dfd0', backgroundColor: '#fff', marginRight: 6 },
  groupChipActive: { backgroundColor: '#123738', borderColor: '#123738' },
  groupChipText: { fontSize: 12, color: '#666' },
  groupChipTextActive: { color: '#fff', fontWeight: '600' },
  productBrandText: { fontSize: 11, color: '#999' },
  priceTierBadge: { fontSize: 11, color: '#b5551f', fontWeight: '700' },
  cariSelectorBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#f6f1e4', borderRadius: 8 },
  cariSelectorText: { fontSize: 14, color: '#123738', fontWeight: 'bold' },
  clearCariBtn: { padding: 6, marginLeft: 8 },

  // Draft active count header
  draftHeaderInfo: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e6dfd0', alignItems: 'center', justifyContent: 'space-between' },
  draftInfoTitle: { fontSize: 16, fontWeight: 'bold', color: '#123738' },
  draftInfoSubtitle: { fontSize: 12, color: '#b5551f', marginTop: 4 },

  // Product Card styles
  productCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#fff', marginHorizontal: 10, marginVertical: 5, borderRadius: 10, elevation: 2 },
  productName: { fontSize: 16, fontWeight: '600', color: '#123738' },
  productPrice: { fontSize: 14, color: '#b5551f', marginTop: 4, fontWeight: 'bold' },
  lowStockText: { fontSize: 12, color: '#b5551f', marginTop: 4, fontWeight: 'bold' },
  cariTypeText: { fontSize: 12, color: '#666', marginTop: 2 },
  stockItemDetails: { fontSize: 13, color: '#123738', marginTop: 4 },
  stockItemDiff: { fontSize: 13, fontWeight: 'bold', marginTop: 2 },

  // Tahsilat button
  tahsilatButton: { backgroundColor: '#d99a2b', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  tahsilatButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // Cart summary
  cartSummary: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e6dfd0' },
  cartText: { fontSize: 16, color: '#666' },
  
  // Mechanical style total display
  registerDisplay: { backgroundColor: '#111', padding: 12, borderRadius: 8, marginVertical: 10, alignItems: 'flex-end', borderLeftWidth: 4, borderLeftColor: '#d99a2b' },
  totalText: { fontSize: 28, fontWeight: 'bold', color: '#ffb300', fontFamily: 'JetBrains Mono' },
  
  checkoutButton: { backgroundColor: '#d99a2b', padding: 15, borderRadius: 8, alignItems: 'center' },
  checkoutButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  // Scanner styles
  closeScanner: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: 'red', padding: 15, borderRadius: 30 },
  closeScannerText: { color: '#fff', fontWeight: 'bold' },
  text: { textAlign: 'center', marginTop: 50, fontSize: 18 },
  button: { marginTop: 20, backgroundColor: '#2196F3', padding: 15, borderRadius: 8, alignSelf: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },

  // Empty list styles
  emptyContainer: { alignItems: 'center', padding: 40, marginTop: 40 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 10, fontSize: 15, lineHeight: 22 },
  refreshButton: { marginTop: 20, backgroundColor: '#123738', padding: 12, borderRadius: 8 },
  refreshButtonText: { color: '#fff', fontWeight: 'bold' },

  // Finance styling
  financeCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginVertical: 8, borderWidth: 1, borderColor: '#e6dfd0' },
  financeCardTitle: { fontSize: 16, fontWeight: 'bold', color: '#123738', marginBottom: 10 },
  financeRegisterName: { fontSize: 14, color: '#666', marginBottom: 5 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  reportLabel: { fontSize: 14, color: '#666' },
  reportValue: { fontSize: 14, fontWeight: '600' },
  reportDivider: { height: 1, backgroundColor: '#e6dfd0', marginVertical: 8 },
  movementsContainer: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginVertical: 8, borderWidth: 1, borderColor: '#e6dfd0' },
  movementsTitle: { fontSize: 16, fontWeight: 'bold', color: '#123738', marginBottom: 10 },
  movementItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0ebd8' },
  movementDesc: { fontSize: 14, color: '#123738', fontWeight: '500' },
  movementDate: { fontSize: 12, color: '#999', marginTop: 2 },
  movementAmount: { fontSize: 14, fontWeight: 'bold' },

  // Modal styling
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#f6f1e4', padding: 20, borderRadius: 12, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#123738', marginBottom: 15, textAlign: 'center' },
  modalCariItem: { padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0ebd8', borderRadius: 8, marginVertical: 4 },
  modalCariName: { fontSize: 16, fontWeight: '600', color: '#123738' },
  modalCariBalance: { fontSize: 14, color: '#b5551f', marginTop: 4 },
  modalCloseBtn: { padding: 15, backgroundColor: '#123738', borderRadius: 8, alignItems: 'center', marginTop: 15 },
  modalCloseText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  // Payment Modal extra styles
  paymentAccountName: { fontSize: 18, fontWeight: 'bold', color: '#123738' },
  paymentAccountBalance: { fontSize: 14, color: '#b5551f', marginTop: 4 },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalActionBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  modalActionText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
