import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Product {
  id: string;
  sku: string;
  name: string;
  barcode: string[];
  price: number; // in TL (float)
  costPrice: number | null; // in TL (float)
  taxRate: number;
  stock: number;
  lowStockThreshold: number;
  unit: 'piece' | 'box' | 'kg' | 'lt';
  categoryId: string | null;
  warehouseId: string;
  isActive: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Account {
  id: string;
  name: string;
  type: 'customer' | 'supplier' | 'employee' | 'other';
  balance: number; // in TL (float)
  creditLimit: number;
  paymentTermDays: number;
  phone?: string;
}

export interface CashRegister {
  id: string;
  name: string;
  balance: number; // in TL (float)
}

export interface CashMovement {
  id: string;
  cashRegisterId: string;
  type: 'in' | 'out';
  amount: number; // in TL (float)
  description: string;
  createdAt: string;
}

export interface ProfitLossReport {
  salesRevenue: number; // in TL (float)
  totalExpense: number; // in TL (float)
  netProfit: number; // in TL (float)
}

export interface StockCountItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  previousStock: number;
  countedStock: number;
  countedAt: string;
}

export interface StockCount {
  id: string;
  warehouseId: string;
  status: 'draft' | 'completed';
  userId: string;
  items: StockCountItem[];
  startedAt: string;
  completedAt?: string | null;
}

interface StoreState {
  // Auth state
  token: string | null;
  username: string | null;
  role: string | null;
  isLoading: boolean;

  // POS state
  products: Product[];
  cart: CartItem[];
  isOnline: boolean;
  offlineSales: any[];

  // Cari state
  accounts: Account[];
  selectedCustomerId: string | null;

  // Finance state
  cashRegister: CashRegister | null;
  cashMovements: CashMovement[];
  profitLoss: ProfitLossReport | null;

  // Stock Count state
  activeStockCount: StockCount | null;

  // Actions
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchAccounts: () => Promise<void>;
  fetchFinanceData: () => Promise<void>;
  fetchActiveStockCount: () => Promise<void>;
  startStockCount: (warehouseId: string) => Promise<boolean>;
  submitStockCountItem: (productId: string, countedStock: number) => Promise<boolean>;
  removeStockCountItem: (productId: string) => Promise<boolean>;
  completeStockCount: () => Promise<boolean>;
  setSelectedCustomerId: (id: string | null) => void;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setOnlineStatus: (status: boolean) => void;
  getTotalPrice: () => number;
  checkout: (paymentMethod: 'cash' | 'card' | 'account') => Promise<{ success: boolean; offline: boolean; message: string }>;
  recordCariPayment: (accountId: string, amount: number, description: string) => Promise<boolean>;
  syncOfflineSales: () => Promise<{ successCount: number; failedCount: number }>;
}

const API_URL = 'https://erp.pazario.tr/api';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const useStore = create<StoreState>((set, get) => ({
  token: null,
  username: null,
  role: null,
  isLoading: true,
  products: [],
  cart: [],
  isOnline: true,
  offlineSales: [],
  accounts: [],
  selectedCustomerId: null,
  cashRegister: null,
  cashMovements: [],
  profitLoss: null,
  activeStockCount: null,

  init: async () => {
    try {
      set({ isLoading: true });
      const token = await AsyncStorage.getItem('@pazariopos_token');
      const username = await AsyncStorage.getItem('@pazariopos_username');
      const role = await AsyncStorage.getItem('@pazariopos_role');
      const cachedProductsJson = await AsyncStorage.getItem('@pazariopos_products');
      const cachedOfflineSalesJson = await AsyncStorage.getItem('@pazariopos_offline_sales');
      const cachedAccountsJson = await AsyncStorage.getItem('@pazariopos_accounts');

      const products = cachedProductsJson ? JSON.parse(cachedProductsJson) : [];
      const offlineSales = cachedOfflineSalesJson ? JSON.parse(cachedOfflineSalesJson) : [];
      const accounts = cachedAccountsJson ? JSON.parse(cachedAccountsJson) : [];

      set({ token, username, role, products, offlineSales, accounts });

      // Check online status
      try {
        const response = await fetch(`${API_URL}/health`, { method: 'GET', headers: { 'timeout': '3000' } });
        set({ isOnline: response.ok });
      } catch {
        set({ isOnline: false });
      }

      // If online and we have a token, fetch fresh data
      if (token && get().isOnline) {
        await Promise.all([
          get().fetchProducts(),
          get().fetchAccounts(),
          get().fetchFinanceData(),
          get().fetchActiveStockCount()
        ]);
      }
    } catch (e) {
      console.error('Store init error:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (username, password) => {
    try {
      set({ isLoading: true });
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const token = data.token;
      const user = data.user;

      await AsyncStorage.setItem('@pazariopos_token', token);
      await AsyncStorage.setItem('@pazariopos_username', user.username);
      await AsyncStorage.setItem('@pazariopos_role', user.role);

      set({ token, username: user.username, role: user.role });

      // Trigger full sync
      await Promise.all([
        get().fetchProducts(),
        get().fetchAccounts(),
        get().fetchFinanceData(),
        get().fetchActiveStockCount()
      ]);
      return true;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('@pazariopos_token');
    await AsyncStorage.removeItem('@pazariopos_username');
    await AsyncStorage.removeItem('@pazariopos_role');
    set({
      token: null,
      username: null,
      role: null,
      cart: [],
      selectedCustomerId: null,
      cashRegister: null,
      cashMovements: [],
      profitLoss: null,
      activeStockCount: null
    });
  },

  fetchProducts: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/products`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const serverProducts = await response.json();
        const mappedProducts: Product[] = serverProducts.map((p: any) => ({
          ...p,
          price: p.price / 100,
          costPrice: p.costPrice ? p.costPrice / 100 : null,
        }));

        await AsyncStorage.setItem('@pazariopos_products', JSON.stringify(mappedProducts));
        set({ products: mappedProducts, isOnline: true });
      }
    } catch (e) {
      console.error('Fetch products error:', e);
      set({ isOnline: false });
    }
  },

  fetchAccounts: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/accounts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const serverAccounts = await response.json();
        const mappedAccounts: Account[] = serverAccounts.map((a: any) => ({
          ...a,
          balance: a.balance / 100,
        }));

        await AsyncStorage.setItem('@pazariopos_accounts', JSON.stringify(mappedAccounts));
        set({ accounts: mappedAccounts });
      }
    } catch (e) {
      console.error('Fetch accounts error:', e);
    }
  },

  fetchFinanceData: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const registerRes = await fetch(`${API_URL}/cash-registers/default-cash-register`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (registerRes.ok) {
        const registerData = await registerRes.json();
        set({
          cashRegister: {
            id: registerData.id,
            name: registerData.name,
            balance: registerData.balance / 100,
          }
        });
      }

      const movementsRes = await fetch(`${API_URL}/cash-registers/default-cash-register/movements`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (movementsRes.ok) {
        const movementsData = await movementsRes.json();
        set({
          cashMovements: movementsData.map((m: any) => ({
            ...m,
            amount: m.amount / 100,
          }))
        });
      }

      const currentYear = new Date().getFullYear();
      const reportRes = await fetch(`${API_URL}/reports/profit-loss?from=${currentYear}-01-01&to=${currentYear}-12-31`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (reportRes.ok) {
        const reportData = await reportRes.json();
        set({
          profitLoss: {
            salesRevenue: reportData.salesRevenue / 100,
            totalExpense: reportData.totalExpense / 100,
            netProfit: reportData.netProfit / 100,
          }
        });
      }
    } catch (e) {
      console.error('Fetch finance data error:', e);
    }
  },

  fetchActiveStockCount: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/stock-counts/draft`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        set({ activeStockCount: data });
      } else if (response.status === 404) {
        set({ activeStockCount: null });
      }
    } catch (e) {
      console.error('Fetch active stock count error:', e);
    }
  },

  startStockCount: async (warehouseId) => {
    const { token } = get();
    if (!token) return false;

    try {
      const response = await fetch(`${API_URL}/stock-counts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ warehouseId }),
      });

      if (response.ok || response.status === 201) {
        const data = await response.json();
        set({ activeStockCount: data });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Start stock count error:', e);
      return false;
    }
  },

  submitStockCountItem: async (productId, countedStock) => {
    const { token, activeStockCount } = get();
    if (!token || !activeStockCount) return false;

    try {
      const response = await fetch(`${API_URL}/stock-counts/${activeStockCount.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId, countedStock }),
      });

      if (response.ok) {
        const data = await response.json();
        set({ activeStockCount: data });
        await get().fetchProducts(); // Refresh products stock locally
        return true;
      }
      return false;
    } catch (e) {
      console.error('Submit stock count item error:', e);
      return false;
    }
  },

  removeStockCountItem: async (productId) => {
    const { token, activeStockCount } = get();
    if (!token || !activeStockCount) return false;

    try {
      const response = await fetch(`${API_URL}/stock-counts/${activeStockCount.id}/items/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        const data = await response.json();
        set({ activeStockCount: data });
        await get().fetchProducts();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Remove stock count item error:', e);
      return false;
    }
  },

  completeStockCount: async () => {
    const { token, activeStockCount } = get();
    if (!token || !activeStockCount) return false;

    try {
      const response = await fetch(`${API_URL}/stock-counts/${activeStockCount.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        set({ activeStockCount: null });
        await get().fetchProducts();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Complete stock count error:', e);
      return false;
    }
  },

  setSelectedCustomerId: (id) => {
    set({ selectedCustomerId: id });
  },

  addToCart: (product) => {
    const { cart } = get();
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      set({
        cart: cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
      });
    } else {
      set({ cart: [...cart, { ...product, quantity: 1 }] });
    }
  },

  removeFromCart: (productId) => {
    set({ cart: get().cart.filter(item => item.id !== productId) });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }

    set({
      cart: get().cart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      ),
    });
  },

  clearCart: () => {
    set({ cart: [], selectedCustomerId: null });
  },

  setOnlineStatus: (status) => {
    set({ isOnline: status });
  },

  getTotalPrice: () => {
    return get().cart.reduce((total, item) => total + item.price * item.quantity, 0);
  },

  checkout: async (paymentMethod) => {
    const { cart, token, username, isOnline, offlineSales, selectedCustomerId } = get();
    if (cart.length === 0) {
      return { success: false, offline: false, message: 'Sepet boş.' };
    }

    if (paymentMethod === 'account' && !selectedCustomerId) {
      return { success: false, offline: false, message: 'Veresiye satışı için lütfen bir cari hesap (müşteri) seçin.' };
    }

    const localId = generateUUID();
    const grandTotalFloat = get().getTotalPrice();
    const grandTotalCents = Math.round(grandTotalFloat * 100);

    // Build CartLines for the server
    const lines = cart.map(item => {
      const unitPriceCents = Math.round(item.price * 100);
      const lineTotalCents = unitPriceCents * item.quantity;
      const taxAmountCents = lineTotalCents - Math.round(lineTotalCents / (1 + item.taxRate));

      return {
        product: {
          ...item,
          price: Math.round(item.price * 100),
          costPrice: item.costPrice ? Math.round(item.costPrice * 100) : null,
        },
        quantity: item.quantity,
        unitPrice: unitPriceCents,
        discountAmount: 0,
        taxAmount: taxAmountCents,
        total: lineTotalCents,
      };
    });

    const taxTotalCents = lines.reduce((sum, l) => sum + l.taxAmount, 0);
    const subtotalCents = grandTotalCents - taxTotalCents;

    const salePayload = {
      id: '',
      localId,
      branchId: 'default-branch',
      registerId: 'default-register',
      cashierId: username || 'kasiyer_mobil',
      customerId: selectedCustomerId || undefined,
      lines,
      payments: [
        {
          method: paymentMethod,
          amount: grandTotalCents,
        }
      ],
      subtotal: subtotalCents,
      discountTotal: 0,
      taxTotal: taxTotalCents,
      grandTotal: grandTotalCents,
      changeGiven: 0,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isOnline && token) {
      try {
        const response = await fetch(`${API_URL}/sales`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(salePayload),
        });

        if (response.ok) {
          get().clearCart();
          await Promise.all([
            get().fetchProducts(),
            get().fetchAccounts(),
            get().fetchFinanceData()
          ]);
          return { success: true, offline: false, message: 'Satış başarıyla tamamlandı.' };
        }
      } catch (e) {
        console.error('Online checkout failed, saving offline:', e);
      }
    }

    // Offline mode: queue it
    const updatedOfflineSales = [...offlineSales, salePayload];
    await AsyncStorage.setItem('@pazariopos_offline_sales', JSON.stringify(updatedOfflineSales));
    set({ offlineSales: updatedOfflineSales });
    get().clearCart();

    return {
      success: true,
      offline: true,
      message: 'Bağlantı yok. Satış çevrimdışı kaydedildi ve cihazınıza kuyruğa alındı.'
    };
  },

  recordCariPayment: async (accountId, amount, description) => {
    const { token, isOnline } = get();
    if (!isOnline || !token) return false;

    try {
      const response = await fetch(`${API_URL}/accounts/${accountId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          description: description || 'Mobil Cari Ödeme Tahsilatı'
        })
      });

      if (response.ok) {
        await Promise.all([
          get().fetchAccounts(),
          get().fetchFinanceData()
        ]);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Record payment error:', e);
      return false;
    }
  },

  syncOfflineSales: async () => {
    const { offlineSales, token, isOnline } = get();
    if (!isOnline || !token || offlineSales.length === 0) {
      return { successCount: 0, failedCount: offlineSales.length };
    }

    let successCount = 0;
    let failedCount = 0;
    const remainingSales: any[] = [];

    for (const sale of offlineSales) {
      try {
        const response = await fetch(`${API_URL}/sales/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(sale),
        });

        if (response.ok) {
          successCount++;
        } else {
          failedCount++;
          remainingSales.push(sale);
        }
      } catch (e) {
        console.error('Failed to sync offline sale:', e);
        failedCount++;
        remainingSales.push(sale);
      }
    }

    await AsyncStorage.setItem('@pazariopos_offline_sales', JSON.stringify(remainingSales));
    set({ offlineSales: remainingSales });

    if (successCount > 0) {
      await Promise.all([
        get().fetchProducts(),
        get().fetchAccounts(),
        get().fetchFinanceData()
      ]);
    }

    return { successCount, failedCount };
  },
}));