import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest, getAuthToken, setAuthToken } from '../lib/api';
import type {
  AppView,
  CartItem,
  Category,
  EmailConfirmationLog,
  NotificationItem,
  Order,
  OtpChannel,
  Product,
  SiteSettings,
  UserGender,
  UserProfile
} from '../types';

export interface OtpRequestResult {
  challengeId: string;
  channel: OtpChannel;
  maskedIdentifier: string;
  expiresInSeconds: number;
  existingAccount: boolean;
  deliveryMode: string;
  previewOtp?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: 'default' | 'success' | 'error';
}

interface AdminStatus {
  claimed: boolean;
  envConfigured: boolean;
}

interface AppContextValue {
  loading: boolean;
  view: AppView;
  navigate: (next: AppView) => void;
  settings: SiteSettings | null;
  categories: Category[];
  products: Product[];
  user: UserProfile | null;
  adminStatus: AdminStatus;
  razorpayConfigured: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (productId: string, licenseType?: 'Personal' | 'Commercial') => void;
  removeFromCart: (productId: string, licenseType: 'Personal' | 'Commercial') => void;
  updateCartQuantity: (productId: string, licenseType: 'Personal' | 'Commercial', quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  authModalOpen: boolean;
  authModalMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  login: (email: string, password: string, asAdmin?: boolean) => Promise<UserProfile>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    gender?: UserGender;
  }) => Promise<UserProfile>;
  requestOtp: (payload: {
    channel: OtpChannel;
    identifier: string;
    mode?: 'login' | 'register';
    name?: string;
    gender?: UserGender;
  }) => Promise<OtpRequestResult>;
  verifyOtp: (payload: {
    challengeId: string;
    otp: string;
    name?: string;
    gender?: UserGender;
  }) => Promise<UserProfile>;
  claimAdmin: (payload: { name: string; email: string; password: string }) => Promise<UserProfile>;
  logout: () => void;
  updateProfile: (payload: Record<string, unknown>) => Promise<UserProfile>;
  myOrders: Order[];
  refreshMyOrders: () => Promise<void>;
  adminOrders: Order[];
  refreshAdminOrders: () => Promise<void>;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  markAllNotificationsRead: () => Promise<void>;
  browserPushPermission: NotificationPermission | 'unsupported';
  requestBrowserPushPermission: () => Promise<void>;
  refreshCatalog: () => Promise<Product[]>;
  globalSearch: string;
  setGlobalSearch: (query: string) => void;
  emailLogs: EmailConfirmationLog[];
  triggerPurchaseConfirmationEmail: (order: Order) => EmailConfirmationLog;
  toasts: ToastMessage[];
  pushToast: (title: string, description?: string, tone?: 'default' | 'success' | 'error') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function isAdminLocation(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
  const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  return hash === 'admin' || pathname === '/admin';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>(() =>
    isAdminLocation() ? { page: 'admin', tab: 'orders' } : { page: 'home' }
  );
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [adminStatus, setAdminStatus] = useState<AdminStatus>({ claimed: false, envConfigured: false });
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('kalavault_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [emailLogs, setEmailLogs] = useState<EmailConfirmationLog[]>([]);

  const [browserPushPermission, setBrowserPushPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification.permission;
    }
    return 'unsupported';
  });

  const userRef = useRef<UserProfile | null>(null);
  userRef.current = user;
  const settingsRef = useRef<SiteSettings | null>(null);
  settingsRef.current = settings;

  // Apply dark class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('kalavault_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const pushToast = useCallback(
    (title: string, description?: string, tone: 'default' | 'success' | 'error' = 'default') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const triggerPurchaseConfirmationEmail = useCallback(
    (order: Order): EmailConfirmationLog => {
      const currentSettings = settingsRef.current;
      const recipientEmail = order.customer_email || userRef.current?.email || 'customer@kalavault.studio';
      const recipientName = order.customer_name || userRef.current?.name || 'Customer';
      const brandName = currentSettings?.brandName || 'KalaVault';
      const senderEmail = currentSettings?.contactEmail || 'orders@kalavault.studio';
      const currencySymbol = currentSettings?.currencySymbol || '₹';
      const itemCount = order.items?.length || 0;

      const logEntry: EmailConfirmationLog = {
        id: `email-${order.id}-${Date.now()}`,
        orderId: order.id,
        orderNumber: order.order_number,
        recipientEmail,
        recipientName,
        senderEmail,
        subject: `${brandName} Order Confirmation ${order.order_number} — Downloads Ready`,
        previewText: `Hi ${recipientName}, your payment has been verified for ${itemCount} digital ${
          itemCount === 1 ? 'item' : 'items'
        }. Your license keys and package downloads are now active in your library.`,
        totalAmount: order.total,
        currencySymbol,
        paymentReference: order.razorpay_payment_id || 'Verified',
        sentAt: new Date().toISOString(),
        status: 'Sent',
        items: (order.items || []).map((item) => ({
          title: item.product_title,
          licenseType: item.license_type,
          quantity: item.quantity,
          licenseKey: item.license_key,
          unitPrice: item.unit_price
        }))
      };

      setEmailLogs((prev) => [logEntry, ...prev.filter((entry) => entry.orderId !== order.id)]);
      pushToast('Confirmation email sent', `Order receipt & license keys sent to ${recipientEmail}`, 'success');
      return logEntry;
    },
    [pushToast]
  );

  const navigate = useCallback((next: AppView) => {
    setView(next);
    if (typeof window !== 'undefined') {
      if (next.page === 'admin') {
        if (window.location.hash !== '#admin') {
          window.history.pushState(null, '', '/#admin');
        }
      } else if (isAdminLocation()) {
        window.history.replaceState(null, '', '/');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Listen to direct URL hash/path navigation for /#admin and /admin
  useEffect(() => {
    const syncFromUrl = () => {
      if (isAdminLocation()) {
        setView({ page: 'admin', tab: 'orders' });
      } else {
        setView((prev) => (prev.page === 'admin' ? { page: 'home' } : prev));
      }
    };
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  const refreshCatalog = useCallback(async () => {
    const data = await apiRequest<{
      settings: SiteSettings;
      categories: Category[];
      products: Product[];
      user: UserProfile | null;
      adminStatus: AdminStatus;
      razorpayConfigured: boolean;
    }>('/api/bootstrap');
    setSettings(data.settings);
    setCategories(data.categories);
    setProducts(data.products);
    setAdminStatus(data.adminStatus);
    setRazorpayConfigured(data.razorpayConfigured);
    if (data.user) {
      setUser(data.user);
    }
    if (data.settings?.brandName) {
      document.title = `${data.settings.brandName} — Digital Products Studio & Store`;
    }
    return data.products;
  }, []);

  const refreshMyOrders = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const data = await apiRequest<{ orders: Order[] }>('/api/orders/mine');
      setMyOrders(data.orders);
    } catch {
      // ignore
    }
  }, []);

  const refreshAdminOrders = useCallback(async () => {
    if (!getAuthToken() || userRef.current?.role !== 'admin') return;
    try {
      const data = await apiRequest<{ orders: Order[] }>('/api/admin/orders');
      setAdminOrders(data.orders);
    } catch {
      // ignore
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const data = await apiRequest<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(data.notifications);
    } catch {
      // ignore
    }
  }, []);

  // Initial bootstrap
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loadedProducts = await refreshCatalog();
        if (active && loadedProducts.length > 0) {
          const slug = new URLSearchParams(window.location.search).get('product');
          if (slug) {
            const match = loadedProducts.find((p) => p.slug === slug || p.id === slug);
            if (match) {
              setView({ page: 'product', productId: match.id });
            }
          }
        }
      } catch (err) {
        if (active) {
          pushToast('Connection issue', err instanceof Error ? err.message : 'Unable to load storefront', 'error');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshCatalog, pushToast]);

  // Load user-scoped orders & notifications when user signs in
  useEffect(() => {
    if (!user) {
      setMyOrders([]);
      setAdminOrders([]);
      setNotifications([]);
      setEmailLogs([]);
      return;
    }
    refreshMyOrders();
    refreshNotifications();
    if (user.role === 'admin') {
      refreshAdminOrders();
    }
  }, [user, refreshMyOrders, refreshAdminOrders, refreshNotifications]);

  // Real-time SSE connection for live order tracking, notifications, and CMS updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        let sseUrl = '/api/events';
        if (user && getAuthToken()) {
          const { ticket } = await apiRequest<{ ticket: string }>('/api/events/ticket', { method: 'POST' });
          if (cancelled) return;
          sseUrl = `/api/events?ticket=${encodeURIComponent(ticket)}`;
        }
        eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('settings_updated', (ev) => {
          try {
            const updated = JSON.parse((ev as MessageEvent).data) as SiteSettings;
            setSettings(updated);
            if (updated.brandName) {
              document.title = `${updated.brandName} — Digital Products Studio & Store`;
            }
          } catch {
            // ignore
          }
        });

        eventSource.addEventListener('catalog_updated', () => {
          refreshCatalog().catch(() => undefined);
        });

        eventSource.addEventListener('order_created', (ev) => {
          try {
            const order = JSON.parse((ev as MessageEvent).data) as Order;
            setAdminOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
            pushToast(`New Order ${order.order_number}`, `${order.customer_name} completed checkout`, 'success');
          } catch {
            // ignore
          }
        });

        eventSource.addEventListener('order_updated', (ev) => {
          try {
            const order = JSON.parse((ev as MessageEvent).data) as Order;
            setMyOrders((prev) => {
              const exists = prev.some((o) => o.id === order.id);
              return exists ? prev.map((o) => (o.id === order.id ? order : o)) : [order, ...prev];
            });
            setAdminOrders((prev) => {
              const exists = prev.some((o) => o.id === order.id);
              return exists ? prev.map((o) => (o.id === order.id ? order : o)) : prev;
            });
          } catch {
            // ignore
          }
        });

        eventSource.addEventListener('notification', (ev) => {
          try {
            const notif = JSON.parse((ev as MessageEvent).data) as NotificationItem;
            setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
            pushToast(notif.title, notif.message, 'success');

            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              window.Notification.permission === 'granted' &&
              userRef.current?.push_enabled
            ) {
              new window.Notification(notif.title, {
                body: notif.message
              });
            }
          } catch {
            // ignore
          }
        });
      } catch {
        // Fallback silently if SSE ticket request fails
      }
    };

    connect();

    return () => {
      cancelled = true;
      eventSource?.close();
    };
  }, [user?.id, user?.role, refreshCatalog, pushToast]);

  const requestBrowserPushPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      pushToast('Browser push unavailable', 'In-app live order alerts remain active.', 'default');
      return;
    }
    const result = await window.Notification.requestPermission();
    setBrowserPushPermission(result);
    if (result === 'granted') {
      pushToast('Push notifications enabled', 'You will receive real-time OS alerts for order status updates.', 'success');
      new window.Notification('Order Alerts Enabled', {
        body: 'You will now get instant notifications whenever your order status updates.'
      });
    } else {
      pushToast('Notifications blocked in browser', 'You will still see real-time in-app alerts.', 'default');
    }
  }, [pushToast]);

  const openAuthModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string, asAdmin = false) => {
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: { email, password, asAdmin }
      });
      setAuthToken(data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      await refreshCatalog();
      pushToast(`Welcome back, ${data.user.name}`, undefined, 'success');
      return data.user;
    },
    [refreshCatalog, pushToast]
  );

  const register = useCallback(
    async (payload: { name: string; email: string; password: string; phone?: string; gender?: UserGender }) => {
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: payload
      });
      setAuthToken(data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      await refreshCatalog();
      pushToast(`Account created`, `Signed in as ${data.user.name} with 3D anime avatar`, 'success');
      return data.user;
    },
    [refreshCatalog, pushToast]
  );

  const requestOtp = useCallback(
    async (payload: {
      channel: OtpChannel;
      identifier: string;
      mode?: 'login' | 'register';
      name?: string;
      gender?: UserGender;
    }) => {
      const data = await apiRequest<OtpRequestResult>('/api/auth/otp/request', {
        method: 'POST',
        body: payload
      });
      const channelLabel =
        payload.channel === 'whatsapp' ? 'WhatsApp' : payload.channel === 'gmail' ? 'Gmail' : 'Mobile SMS';
      pushToast('6-digit OTP sent', `Verification code ready via ${channelLabel} (${data.maskedIdentifier})`, 'success');
      return data;
    },
    [pushToast]
  );

  const verifyOtp = useCallback(
    async (payload: { challengeId: string; otp: string; name?: string; gender?: UserGender }) => {
      const data = await apiRequest<{ token: string; user: UserProfile; isNewUser: boolean }>('/api/auth/otp/verify', {
        method: 'POST',
        body: payload
      });
      setAuthToken(data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      await refreshCatalog();
      pushToast(
        data.isNewUser ? 'Account verified & created' : `Welcome back, ${data.user.name}`,
        `${data.user.gender === 'female' ? 'Female' : 'Male'} 3D anime avatar active on your profile`,
        'success'
      );
      return data.user;
    },
    [refreshCatalog, pushToast]
  );

  const claimAdmin = useCallback(
    async (payload: { name: string; email: string; password: string }) => {
      const data = await apiRequest<{ token: string; user: UserProfile; adminStatus: AdminStatus }>(
        '/api/auth/claim-admin',
        {
          method: 'POST',
          body: payload
        }
      );
      setAuthToken(data.token);
      setUser(data.user);
      setAdminStatus(data.adminStatus);
      await refreshCatalog();
      pushToast('Administrator workspace claimed', 'Full CMS & live order controls unlocked.', 'success');
      return data.user;
    },
    [refreshCatalog, pushToast]
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setMyOrders([]);
    setAdminOrders([]);
    setNotifications([]);
    setEmailLogs([]);
    pushToast('Signed out', 'Your session has been closed.');
    setView((prev) => (prev.page === 'dashboard' || prev.page === 'admin' ? { page: 'home' } : prev));
  }, [pushToast]);

  const updateProfile = useCallback(
    async (payload: Record<string, unknown>) => {
      const data = await apiRequest<{ user: UserProfile }>('/api/profile', {
        method: 'PUT',
        body: payload
      });
      setUser(data.user);
      pushToast('Profile saved', 'Your account details have been updated.', 'success');
      return data.user;
    },
    [pushToast]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!getAuthToken()) return;
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const addToCart = useCallback(
    (productId: string, licenseType: 'Personal' | 'Commercial' = 'Personal') => {
      const prod = products.find((p) => p.id === productId);
      setCart((prev) => {
        const idx = prev.findIndex((i) => i.productId === productId && i.licenseType === licenseType);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: Math.min(next[idx].quantity + 1, 10) };
          return next;
        }
        return [...prev, { productId, licenseType, quantity: 1 }];
      });
      pushToast('Added to cart', prod ? `${prod.title} (${licenseType})` : undefined, 'success');
    },
    [products, pushToast]
  );

  const removeFromCart = useCallback((productId: string, licenseType: 'Personal' | 'Commercial') => {
    setCart((prev) => prev.filter((i) => !(i.productId === productId && i.licenseType === licenseType)));
  }, []);

  const updateCartQuantity = useCallback(
    (productId: string, licenseType: 'Personal' | 'Commercial', quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId, licenseType);
        return;
      }
      setCart((prev) =>
        prev.map((i) =>
          i.productId === productId && i.licenseType === licenseType ? { ...i, quantity: Math.min(quantity, 10) } : i
        )
      );
    },
    [removeFromCart]
  );

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return sum;
      const unit = item.licenseType === 'Commercial' ? prod.commercial_price : prod.price;
      return sum + unit * item.quantity;
    }, 0);
  }, [cart, products]);

  const unreadNotificationCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value: AppContextValue = {
    loading,
    view,
    navigate,
    settings,
    categories,
    products,
    user,
    adminStatus,
    razorpayConfigured,
    theme,
    toggleTheme,
    cart,
    cartOpen,
    setCartOpen,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartCount,
    cartSubtotal,
    authModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    login,
    register,
    requestOtp,
    verifyOtp,
    claimAdmin,
    logout,
    updateProfile,
    myOrders,
    refreshMyOrders,
    adminOrders,
    refreshAdminOrders,
    notifications,
    unreadNotificationCount,
    markAllNotificationsRead,
    browserPushPermission,
    requestBrowserPushPermission,
    refreshCatalog,
    globalSearch,
    setGlobalSearch,
    emailLogs,
    triggerPurchaseConfirmationEmail,
    toasts,
    pushToast,
    dismissToast
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
