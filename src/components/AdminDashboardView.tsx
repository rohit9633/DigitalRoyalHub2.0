import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Edit3,
  FileText,
  FolderTree,
  Globe,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  Trash2,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest, formatCurrency, formatDateTime, formatShortDate } from '../lib/api';
import {
  STUDIO_IMAGE_PRESETS,
  type Category,
  type OrderStatus,
  type Product,
  type Review,
  type SiteSettings
} from '../types';
import { ProductImage } from './ProductImage';

interface AdminDashboardViewProps {
  initialTab?: 'orders' | 'products' | 'categories' | 'cms' | 'reviews' | 'footer';
}

const ALL_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Delivered', 'Cancelled', 'Refunded'];

function statusColorClass(status: OrderStatus): string {
  if (status === 'Delivered' || status === 'Confirmed') return 'text-emerald-700 dark:text-emerald-400';
  if (status === 'Cancelled' || status === 'Refunded') return 'text-red-700 dark:text-red-400';
  return 'text-amber-700 dark:text-amber-400';
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ initialTab = 'orders' }) => {
  const {
    user,
    adminStatus,
    claimAdmin,
    login,
    settings,
    categories,
    products,
    adminOrders,
    refreshAdminOrders,
    refreshCatalog,
    razorpayConfigured,
    pushToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'categories' | 'cms' | 'reviews' | 'footer'>(
    initialTab
  );

  // Admin Claim / Auth state
  const [adminName, setAdminName] = useState('Studio Admin');
  const [adminEmail, setAdminEmail] = useState('admin@kalavault.studio');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Orders filter & status note
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Products CRUD state
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [highlightsText, setHighlightsText] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

  // Categories CRUD state
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  // CMS & Footer settings form state
  const [draftSettings, setDraftSettings] = useState<SiteSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Reviews moderation state
  const [adminReviews, setAdminReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (settings) {
      setDraftSettings(settings);
    }
  }, [settings]);

  const loadAdminReviews = async () => {
    setLoadingReviews(true);
    try {
      const data = await apiRequest<{ reviews: Review[] }>('/api/admin/reviews');
      setAdminReviews(data.reviews);
    } catch {
      // ignore
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      refreshAdminOrders();
      if (activeTab === 'reviews') {
        loadAdminReviews();
      }
    }
  }, [user?.role, activeTab, refreshAdminOrders]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return adminOrders.filter((o) => {
      const matchStatus = orderFilter === 'all' || o.status === orderFilter;
      const matchSearch =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        (o.razorpay_payment_id || '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [adminOrders, orderSearch, orderFilter]);

  const orderMetrics = useMemo(() => {
    const verified = adminOrders.filter((o) => o.payment_verified);
    const revenue = verified.reduce((s, o) => s + o.total, 0);
    const delivered = adminOrders.filter((o) => o.status === 'Delivered').length;
    const active = adminOrders.filter((o) => o.status === 'Pending' || o.status === 'Confirmed' || o.status === 'Processing').length;
    return { revenue, total: adminOrders.length, delivered, active };
  }, [adminOrders]);

  // Gate: Non-admin sees First-Run Admin Claim Form OR Admin Sign-In Form
  if (!user || user.role !== 'admin') {
    const isClaimMode = !adminStatus.claimed && !adminStatus.envConfigured;

    const handleAdminAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError('');
      setAuthSubmitting(true);
      try {
        if (isClaimMode) {
          await claimAdmin({ name: adminName, email: adminEmail, password: adminPassword });
        } else {
          await login(adminEmail, adminPassword, true);
        }
        setAdminPassword('');
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Admin authentication failed.');
      } finally {
        setAuthSubmitting(false);
      }
    };

    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] p-7 space-y-6">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
              {isClaimMode ? 'Set Up Admin Panel' : 'Admin Console Sign In'}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
              {isClaimMode
                ? 'First-run setup: claim your administrator credentials to unlock full storefront CMS editing, product management, and live order tracking.'
                : 'Sign in with your administrator credentials to manage products, site content, and real-time orders.'}
            </p>
          </div>

          {authError && (
            <div className="px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
              {authError}
            </div>
          )}

          <form onSubmit={handleAdminAuth} className="space-y-4">
            {isClaimMode && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Admin Display Name
                </label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            {(!adminStatus.envConfigured || isClaimMode) && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                {isClaimMode ? 'Create Admin Password (min 8 chars)' : 'Admin Password'}
              </label>
              <input
                type="password"
                required
                minLength={isClaimMode ? 8 : 1}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {authSubmitting
                ? 'Verifying...'
                : isClaimMode
                  ? 'Claim Admin Workspace'
                  : 'Sign In to Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const symbol = settings?.currencySymbol || '₹';

  // ---- Handlers ----
  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await apiRequest(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        body: {
          status,
          status_note: statusNotes[orderId] || ''
        }
      });
      setStatusNotes((prev) => ({ ...prev, [orderId]: '' }));
      await refreshAdminOrders();
      pushToast('Order Updated', `Status set to ${status} and customer notified in real time.`, 'success');
    } catch (err) {
      pushToast('Update failed', err instanceof Error ? err.message : 'Could not update order', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const openNewProductForm = () => {
    setEditingProduct({
      title: '',
      subtitle: '',
      description: '',
      price: 1499,
      compare_at_price: 2499,
      commercial_price: 3499,
      category_id: categories[0]?.id || '',
      image_url: STUDIO_IMAGE_PRESETS[1].url,
      file_format: 'ZIP · Source Files',
      file_size: '40 MB',
      version: '1.0',
      preview_url: '',
      download_notes: '',
      featured: true,
      published: true
    });
    setHighlightsText('Complete organized source files\nLifetime free updates\nCommercial-ready licensing');
  };

  const openEditProductForm = (product: Product) => {
    setEditingProduct({ ...product });
    setHighlightsText((product.highlights || []).join('\n'));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      const payload = {
        ...editingProduct,
        highlights: highlightsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      };
      if (editingProduct.id) {
        await apiRequest(`/api/admin/products/${encodeURIComponent(editingProduct.id)}`, {
          method: 'PUT',
          body: payload
        });
        pushToast('Product updated', `${editingProduct.title} saved and synced live.`, 'success');
      } else {
        await apiRequest('/api/admin/products', {
          method: 'POST',
          body: payload
        });
        pushToast('Product published', `${editingProduct.title} added to catalog.`, 'success');
      }
      setEditingProduct(null);
      await refreshCatalog();
    } catch (err) {
      pushToast('Save failed', err instanceof Error ? err.message : 'Could not save product', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    try {
      await apiRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
      await refreshCatalog();
      pushToast('Product removed', `${product.title} deleted from store.`, 'default');
    } catch (err) {
      pushToast('Delete failed', err instanceof Error ? err.message : 'Could not delete product', 'error');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setSavingCategory(true);
    try {
      if (editingCategory.id) {
        await apiRequest(`/api/admin/categories/${encodeURIComponent(editingCategory.id)}`, {
          method: 'PUT',
          body: editingCategory
        });
        pushToast('Category updated', editingCategory.name, 'success');
      } else {
        await apiRequest('/api/admin/categories', {
          method: 'POST',
          body: editingCategory
        });
        pushToast('Category created', editingCategory.name, 'success');
      }
      setEditingCategory(null);
      await refreshCatalog();
    } catch (err) {
      pushToast('Save failed', err instanceof Error ? err.message : 'Could not save category', 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    try {
      await apiRequest(`/api/admin/categories/${encodeURIComponent(cat.id)}`, { method: 'DELETE' });
      await refreshCatalog();
      pushToast('Category deleted', cat.name, 'default');
    } catch (err) {
      pushToast('Cannot delete category', err instanceof Error ? err.message : 'Move products first', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftSettings) return;
    setSavingSettings(true);
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PUT',
        body: draftSettings
      });
      await refreshCatalog();
      pushToast('Storefront Updated', 'All changes are now live across the landing page and footer.', 'success');
    } catch (err) {
      pushToast('Save failed', err instanceof Error ? err.message : 'Could not save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await apiRequest(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, { method: 'DELETE' });
      setAdminReviews((prev) => prev.filter((r) => r.id !== reviewId));
      await refreshCatalog();
      pushToast('Review removed', undefined, 'default');
    } catch (err) {
      pushToast('Delete failed', err instanceof Error ? err.message : 'Could not remove review', 'error');
    }
  };

  const sidebarItems: Array<{ id: typeof activeTab; label: string; icon: React.ComponentType<{ className?: string }> }> =
    [
      { id: 'orders', label: 'Real-Time Orders', icon: ShoppingCart },
      { id: 'products', label: 'Products Manager', icon: Package },
      { id: 'categories', label: 'Categories', icon: FolderTree },
      { id: 'cms', label: 'Site & Hero CMS', icon: Globe },
      { id: 'reviews', label: 'Reviews', icon: MessageSquare },
      { id: 'footer', label: 'Footer, Social & Terms', icon: FileText }
    ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Admin Console · {razorpayConfigured ? 'Razorpay Live Connected' : 'Razorpay Sandbox Ready'}
          </p>
          <h1 className="font-display text-3xl font-bold text-zinc-900 dark:text-white mt-1">
            Store Operations &amp; CMS
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              refreshAdminOrders();
              refreshCatalog();
            }}
            className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Data
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('products');
              openNewProductForm();
            }}
            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Product
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-zinc-200 dark:border-zinc-800 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800 mb-8">
        <div className="py-5 px-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Verified Revenue</p>
          <p className="font-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
            {formatCurrency(orderMetrics.revenue, symbol)}
          </p>
        </div>
        <div className="py-5 px-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Orders</p>
          <p className="font-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
            {orderMetrics.total}
          </p>
        </div>
        <div className="py-5 px-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Delivered Orders</p>
          <p className="font-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
            {orderMetrics.delivered}
          </p>
        </div>
        <div className="py-5 px-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Catalog Products</p>
          <p className="font-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
            {products.length}
          </p>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0">
          {sidebarItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2.5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === id
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </aside>

        <div className="lg:col-span-9 min-w-0">
          {/* ==============================================================
              1. REAL-TIME ORDERS TRACKER
          ============================================================== */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                    Real-Time Order Stream
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Incoming Razorpay orders appear automatically. Updating status sends an instant push notification to
                    the buyer.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Order ID or email..."
                      className="h-9 pl-8 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <select
                    aria-label="Filter orders by status"
                    value={orderFilter}
                    onChange={(e) => setOrderFilter(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] text-xs text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="all">All Statuses</option>
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418]">
                  <ShoppingCart className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">No orders recorded yet</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    As soon as a customer completes Razorpay checkout, the order will stream in here live.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                              {order.order_number}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{formatDateTime(order.created_at)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{order.razorpay_payment_id || 'Unpaid'}</span>
                          </div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">
                            {order.customer_name}{' '}
                            <span className="font-normal text-zinc-500 dark:text-zinc-400">
                              ({order.customer_email})
                            </span>
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                            {order.items.map((i) => `${i.product_title} (${i.license_type}) × ${i.quantity}`).join(' · ')}
                          </p>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <p className="font-display text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                            {formatCurrency(order.total, symbol)}
                          </p>
                          <p className={`text-xs font-semibold ${statusColorClass(order.status)}`}>{order.status}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        <input
                          type="text"
                          value={statusNotes[order.id] || ''}
                          onChange={(e) => setStatusNotes((prev) => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="Optional notification message to buyer..."
                          className="flex-1 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <BellRing className="w-3.5 h-3.5 text-zinc-400 hidden sm:block" />
                          <select
                            aria-label={`Update status for ${order.order_number}`}
                            value={order.status}
                            disabled={updatingOrderId === order.id}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)}
                            className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            {ALL_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                Set: {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              2. PRODUCTS MANAGER (FULL CRUD)
          ============================================================== */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                    Digital Products Catalog
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Add, edit, price, publish, or remove digital products in real time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewProductForm}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Product
                </button>
              </div>

              {editingProduct && (
                <form
                  onSubmit={handleSaveProduct}
                  className="p-6 rounded-2xl border border-blue-600/40 bg-white dark:bg-[#141418] space-y-5"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white">
                      {editingProduct.id ? 'Edit Product' : 'Create New Digital Product'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingProduct(null)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                      <input
                        type="text"
                        required
                        value={editingProduct.title || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Category
                      </label>
                      <select
                        required
                        value={editingProduct.category_id || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Short Subtitle
                    </label>
                    <input
                      type="text"
                      value={editingProduct.subtitle || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, subtitle: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Full Description
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={editingProduct.description || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                      className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Personal Price ({symbol})
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={editingProduct.price || 0}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm tabular-nums text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Compare-at Price ({symbol})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editingProduct.compare_at_price || 0}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, compare_at_price: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm tabular-nums text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Commercial Price ({symbol})
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={editingProduct.commercial_price || 0}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, commercial_price: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm tabular-nums text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        File Format
                      </label>
                      <input
                        type="text"
                        value={editingProduct.file_format || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, file_format: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        File Size
                      </label>
                      <input
                        type="text"
                        value={editingProduct.file_size || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, file_size: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Version
                      </label>
                      <input
                        type="text"
                        value={editingProduct.version || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, version: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Cover Visual Preset
                      </label>
                      <select
                        value={editingProduct.image_url || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                      >
                        {STUDIO_IMAGE_PRESETS.map((preset) => (
                          <option key={preset.url} value={preset.url}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Or Custom HTTPS Image URL
                      </label>
                      <input
                        type="text"
                        value={editingProduct.image_url || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Highlights (One per line)
                    </label>
                    <textarea
                      rows={3}
                      value={highlightsText}
                      onChange={(e) => setHighlightsText(e.target.value)}
                      className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.featured)}
                        onChange={(e) => setEditingProduct({ ...editingProduct, featured: e.target.checked })}
                        className="w-4 h-4 accent-blue-600"
                      />
                      Featured on Homepage
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={editingProduct.published !== false}
                        onChange={(e) => setEditingProduct({ ...editingProduct, published: e.target.checked })}
                        className="w-4 h-4 accent-blue-600"
                      />
                      Published &amp; Visible
                    </label>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingProduct(null)}
                      className="h-10 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProduct}
                      className="h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingProduct ? 'Saving...' : 'Save Product'}
                    </button>
                  </div>
                </form>
              )}

              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] divide-y divide-zinc-200 dark:divide-zinc-800">
                {products.map((product) => (
                  <div key={product.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-20 h-15 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 shrink-0 border border-zinc-200 dark:border-zinc-800">
                      <ProductImage src={product.image_url} alt={product.title} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{product.category_name}</span>
                        <span aria-hidden="true">·</span>
                        <span>v{product.version}</span>
                        <span aria-hidden="true">·</span>
                        <span className={product.published ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
                          {product.published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate mt-0.5">
                        {product.title}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                        Personal {formatCurrency(product.price, symbol)} · Commercial{' '}
                        {formatCurrency(product.commercial_price, symbol)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditProductForm(product)}
                        className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 inline-flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(product)}
                        aria-label={`Delete ${product.title}`}
                        className="h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 hover:border-red-300 inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==============================================================
              3. CATEGORIES MANAGER
          ============================================================== */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                    Category Taxonomy
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Organize digital products into intuitive browsing categories.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCategory({ name: '', description: '', sort_order: categories.length + 1 })}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Category
                </button>
              </div>

              {editingCategory && (
                <form
                  onSubmit={handleSaveCategory}
                  className="p-5 rounded-2xl border border-blue-600/40 bg-white dark:bg-[#141418] space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Category Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editingCategory.name || ''}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Sort Order
                      </label>
                      <input
                        type="number"
                        value={editingCategory.sort_order ?? 0}
                        onChange={(e) => setEditingCategory({ ...editingCategory, sort_order: Number(e.target.value) })}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm tabular-nums text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editingCategory.description || ''}
                      onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(null)}
                      className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingCategory}
                      className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                    >
                      {savingCategory ? 'Saving...' : 'Save Category'}
                    </button>
                  </div>
                </form>
              )}

              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] divide-y divide-zinc-200 dark:divide-zinc-800">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{cat.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{cat.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingCategory({ ...cat })}
                        className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        aria-label={`Delete ${cat.name}`}
                        className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==============================================================
              4. SITE & HERO CMS (CHANGE EVERYTHING ON LANDING PAGE)
          ============================================================== */}
          {activeTab === 'cms' && draftSettings && (
            <form
              onSubmit={handleSaveSettings}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] p-6 sm:p-8 space-y-6"
            >
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                  Landing Page &amp; Brand CMS
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Customize branding, announcement banner, hero copy, visuals, proof metrics, and currency live.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={draftSettings.brandName}
                    onChange={(e) => setDraftSettings({ ...draftSettings, brandName: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Currency</label>
                  <select
                    value={draftSettings.currencyCode}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        currencyCode: e.target.value,
                        currencySymbol: e.target.value === 'USD' ? '$' : '₹'
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Brand Tagline (Footer)
                </label>
                <input
                  type="text"
                  value={draftSettings.tagline}
                  onChange={(e) => setDraftSettings({ ...draftSettings, tagline: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={draftSettings.announcementEnabled}
                    onChange={(e) => setDraftSettings({ ...draftSettings, announcementEnabled: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                  Show Top Announcement Banner
                </label>
                <input
                  type="text"
                  value={draftSettings.announcementText}
                  onChange={(e) => setDraftSettings({ ...draftSettings, announcementText: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Hero Section</h3>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Hero Kicker</label>
                  <input
                    type="text"
                    value={draftSettings.heroKicker}
                    onChange={(e) => setDraftSettings({ ...draftSettings, heroKicker: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Hero Headline
                  </label>
                  <input
                    type="text"
                    value={draftSettings.heroHeadline}
                    onChange={(e) => setDraftSettings({ ...draftSettings, heroHeadline: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Hero Subheadline
                  </label>
                  <textarea
                    rows={2}
                    value={draftSettings.heroSubheadline}
                    onChange={(e) => setDraftSettings({ ...draftSettings, heroSubheadline: e.target.value })}
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Primary CTA Label
                    </label>
                    <input
                      type="text"
                      value={draftSettings.heroPrimaryCta}
                      onChange={(e) => setDraftSettings({ ...draftSettings, heroPrimaryCta: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Hero Visual Preset
                    </label>
                    <select
                      value={draftSettings.heroImage}
                      onChange={(e) => setDraftSettings({ ...draftSettings, heroImage: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                    >
                      {STUDIO_IMAGE_PRESETS.map((p) => (
                        <option key={p.url} value={p.url}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Proof Metrics &amp; Catalog Copy</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={draftSettings.stat1Value}
                    onChange={(e) => setDraftSettings({ ...draftSettings, stat1Value: e.target.value })}
                    placeholder="Stat 1 Value"
                    className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="text"
                    value={draftSettings.stat1Label}
                    onChange={(e) => setDraftSettings({ ...draftSettings, stat1Label: e.target.value })}
                    placeholder="Stat 1 Label"
                    className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="text"
                    value={draftSettings.stat2Value}
                    onChange={(e) => setDraftSettings({ ...draftSettings, stat2Value: e.target.value })}
                    placeholder="Stat 2 Value"
                    className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="text"
                    value={draftSettings.stat2Label}
                    onChange={(e) => setDraftSettings({ ...draftSettings, stat2Label: e.target.value })}
                    placeholder="Stat 2 Label"
                    className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={draftSettings.catalogTitle}
                    onChange={(e) => setDraftSettings({ ...draftSettings, catalogTitle: e.target.value })}
                    placeholder="Catalog Heading"
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="text"
                    value={draftSettings.catalogSubtitle}
                    onChange={(e) => setDraftSettings({ ...draftSettings, catalogSubtitle: e.target.value })}
                    placeholder="Catalog Subtitle"
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {savingSettings ? 'Publishing...' : 'Save & Publish Live'}
                </button>
              </div>
            </form>
          )}

          {/* ==============================================================
              5. REVIEWS MODERATION
          ============================================================== */}
          {activeTab === 'reviews' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                  Customer Reviews Moderation
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Monitor product ratings and remove inappropriate comments.
                </p>
              </div>

              {loadingReviews ? (
                <div className="p-8 text-center text-sm text-zinc-500">Loading reviews...</div>
              ) : adminReviews.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418] text-sm text-zinc-500">
                  No reviews submitted yet.
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] divide-y divide-zinc-200 dark:divide-zinc-800">
                  {adminReviews.map((rev) => (
                    <div key={rev.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-900 dark:text-white">{rev.user_name}</span>
                          <span aria-hidden="true">·</span>
                          <span>{rev.product_title}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold tabular-nums">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {rev.rating}/5
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatShortDate(rev.created_at)}</span>
                        </div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{rev.title}</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{rev.comment}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(rev.id)}
                        aria-label="Delete review"
                        className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 inline-flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              6. FOOTER, SOCIAL LINKS & TERMS EDITOR
          ============================================================== */}
          {activeTab === 'footer' && draftSettings && (
            <form
              onSubmit={handleSaveSettings}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] p-6 sm:p-8 space-y-6"
            >
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                  Footer Contact, Social Links &amp; Terms
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Update footer contact details, social URLs, and legal Terms &amp; Conditions dynamically.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={draftSettings.contactEmail}
                    onChange={(e) => setDraftSettings({ ...draftSettings, contactEmail: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={draftSettings.contactPhone}
                    onChange={(e) => setDraftSettings({ ...draftSettings, contactPhone: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Studio Address
                </label>
                <input
                  type="text"
                  value={draftSettings.contactAddress}
                  onChange={(e) => setDraftSettings({ ...draftSettings, contactAddress: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Social Media Links</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="url"
                    placeholder="https://x.com/..."
                    value={draftSettings.socialTwitter}
                    onChange={(e) => setDraftSettings({ ...draftSettings, socialTwitter: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="url"
                    placeholder="https://instagram.com/..."
                    value={draftSettings.socialInstagram}
                    onChange={(e) => setDraftSettings({ ...draftSettings, socialInstagram: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="url"
                    placeholder="https://linkedin.com/..."
                    value={draftSettings.socialLinkedin}
                    onChange={(e) => setDraftSettings({ ...draftSettings, socialLinkedin: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="url"
                    placeholder="https://github.com/..."
                    value={draftSettings.socialGithub}
                    onChange={(e) => setDraftSettings({ ...draftSettings, socialGithub: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="url"
                    placeholder="https://youtube.com/..."
                    value={draftSettings.socialYoutube}
                    onChange={(e) => setDraftSettings({ ...draftSettings, socialYoutube: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="text"
                    placeholder="Copyright text"
                    value={draftSettings.copyrightText}
                    onChange={(e) => setDraftSettings({ ...draftSettings, copyrightText: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Terms &amp; Conditions Page</h3>
                  <input
                    type="text"
                    value={draftSettings.termsUpdatedAt}
                    onChange={(e) => setDraftSettings({ ...draftSettings, termsUpdatedAt: e.target.value })}
                    placeholder="Updated Month Year"
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <textarea
                  rows={10}
                  value={draftSettings.termsContent}
                  onChange={(e) => setDraftSettings({ ...draftSettings, termsContent: e.target.value })}
                  className="w-full p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs leading-relaxed font-mono text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {savingSettings ? 'Saving...' : 'Save Footer & Terms'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
