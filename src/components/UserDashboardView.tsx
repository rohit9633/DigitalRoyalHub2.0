import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  History,
  KeyRound,
  MailCheck,
  Package,
  RefreshCw,
  Truck,
  User as UserIcon
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { downloadAuthorizedAsset, formatCurrency, formatDateTime, formatShortDate } from '../lib/api';
import type { Order, OrderItem, OrderStatus, UserGender } from '../types';
import { ProductImage } from './ProductImage';
import { ANIME_AVATARS, UserAvatar } from './UserAvatar';

interface UserDashboardViewProps {
  initialTab?: 'library' | 'tracking' | 'history' | 'profile';
  highlightOrderId?: string;
}

const ORDER_STEPS: Array<{ key: OrderStatus; label: string }> = [
  { key: 'Pending', label: 'Order Placed' },
  { key: 'Confirmed', label: 'Payment Verified' },
  { key: 'Processing', label: 'Preparing Assets' },
  { key: 'Delivered', label: 'Delivered' }
];

function getStepIndex(status: OrderStatus): number {
  if (status === 'Delivered') return 3;
  if (status === 'Processing') return 2;
  if (status === 'Confirmed') return 1;
  return 0;
}

function getStatusTone(status: OrderStatus): string {
  switch (status) {
    case 'Delivered':
    case 'Confirmed':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'Processing':
    case 'Pending':
      return 'text-amber-700 dark:text-amber-400';
    case 'Cancelled':
    case 'Refunded':
      return 'text-red-700 dark:text-red-400';
    default:
      return 'text-zinc-700 dark:text-zinc-300';
  }
}

export const UserDashboardView: React.FC<UserDashboardViewProps> = ({ initialTab = 'library', highlightOrderId }) => {
  const {
    user,
    openAuthModal,
    settings,
    myOrders,
    refreshMyOrders,
    emailLogs,
    updateProfile,
    browserPushPermission,
    requestBrowserPushPermission,
    navigate,
    pushToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'library' | 'tracking' | 'history' | 'profile'>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(highlightOrderId || null);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  // Profile form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [company, setCompany] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [bio, setBio] = useState('');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (highlightOrderId) {
      setExpandedReceiptId(highlightOrderId);
    }
  }, [highlightOrderId]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setGender(user.gender === 'female' ? 'female' : 'male');
      setCompany(user.company || '');
      setBillingAddress(user.billing_address || '');
      setBio(user.bio || '');
      setPushEnabled(Boolean(user.push_enabled));
    }
  }, [user]);

  const purchasedItems = useMemo(() => {
    const list: Array<{ order: Order; item: OrderItem }> = [];
    for (const order of myOrders) {
      if (!order.payment_verified) continue;
      for (const item of order.items || []) {
        list.push({ order, item });
      }
    }
    return list;
  }, [myOrders]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] space-y-4">
          <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">Customer Dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to download your purchased digital products, track live order progress, view account history, and
            manage your profile.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="h-10 px-5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const symbol = settings?.currencySymbol || '₹';
  const totalSpent = myOrders.filter((o) => o.payment_verified).reduce((sum, o) => sum + o.total, 0);

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      pushToast('License key copied', key, 'success');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      pushToast('Unable to copy key', undefined, 'error');
    }
  };

  const handleDownload = async (orderId: string, item: OrderItem) => {
    setDownloadingId(item.id);
    try {
      await downloadAuthorizedAsset(orderId, item.id, item.product_title);
      pushToast('Download started', `${item.product_title} v${item.version} package & license`, 'success');
    } catch (err) {
      pushToast('Download failed', err instanceof Error ? err.message : 'Please try again', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({
        name,
        phone,
        gender,
        company,
        billing_address: billingAddress,
        bio,
        push_enabled: pushEnabled,
        ...(newPassword ? { currentPassword, newPassword } : {})
      });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      pushToast('Update failed', err instanceof Error ? err.message : 'Could not save profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const tabs: Array<{ id: typeof activeTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'library', label: 'My Library', icon: Package },
    { id: 'tracking', label: 'Order Tracking', icon: Truck },
    { id: 'history', label: 'Account History', icon: History },
    { id: 'profile', label: 'Profile Settings', icon: UserIcon }
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <UserAvatar gender={user.gender} name={user.name} size="lg" />
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Account Workspace · {user.gender === 'female' ? 'Female' : 'Male'} 3D Anime Avatar
            </p>
            <h1 className="font-display text-3xl font-bold text-zinc-900 dark:text-white mt-0.5">
              Welcome, {user.name}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              {user.email}
              {user.phone ? ` · ${user.phone}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {browserPushPermission !== 'granted' && browserPushPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={requestBrowserPushPermission}
              className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Enable Push Alerts
            </button>
          )}
          <button
            type="button"
            onClick={() => refreshMyOrders()}
            className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Orders
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-zinc-200 dark:border-zinc-800 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800 mb-8">
        <div className="py-5 px-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Owned Products</p>
          <p className="font-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
            {purchasedItems.length}
          </p>
        </div>
        <div className="py-5 px-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Orders</p>
          <p className="font-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
            {myOrders.length}
          </p>
        </div>
        <div className="py-5 px-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Spent</p>
          <p className="font-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
            {formatCurrency(totalSpent, symbol)}
          </p>
        </div>
        <div className="py-5 px-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Push Alerts</p>
          <p className="font-display text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {browserPushPermission === 'granted' ? 'Active' : 'In-App'}
          </p>
        </div>
      </div>

      {/* Workspace Shell: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0">
          {tabs.map(({ id, label, icon: Icon }) => (
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
          {/* TAB 1: MY DIGITAL LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                  My Digital Library
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Download source packages, release guides, and copy your verified license keys anytime.
                </p>
              </div>

              {purchasedItems.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418]">
                  <Package className="w-9 h-9 text-zinc-400 mx-auto mb-3" />
                  <p className="text-base font-semibold text-zinc-900 dark:text-white">No purchased products yet</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                    Products you purchase through Razorpay appear here immediately with instant downloads and license
                    keys.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate({ page: 'home' })}
                    className="mt-5 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                  >
                    Explore Digital Store
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {purchasedItems.map(({ order, item }) => (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] flex flex-col sm:flex-row gap-5"
                    >
                      <div className="w-full sm:w-40 aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 shrink-0 border border-zinc-200 dark:border-zinc-800">
                        <ProductImage src={item.product_image} alt={item.product_title} />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>{item.license_type} License</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.file_format}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">v{item.version}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">Purchased {formatShortDate(order.created_at)}</span>
                          </div>
                          <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-white mt-1">
                            {item.product_title}
                          </h3>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-2 text-xs">
                            <KeyRound className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <code className="font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded">
                              {item.license_key}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyKey(item.license_key)}
                              aria-label="Copy license key"
                              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              {copiedKey === item.license_key ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => navigate({ page: 'product', productId: item.product_id })}
                              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            >
                              Write Review
                            </button>
                            <button
                              type="button"
                              disabled={downloadingId === item.id}
                              onClick={() => handleDownload(order.id, item)}
                              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {downloadingId === item.id ? 'Preparing...' : 'Download Package'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REAL-TIME ORDER TRACKING */}
          {activeTab === 'tracking' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                  Real-Time Order Tracking
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Order status updates stream automatically as the studio verifies or updates your order.
                </p>
              </div>

              {myOrders.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418]">
                  <Truck className="w-9 h-9 text-zinc-400 mx-auto mb-3" />
                  <p className="text-base font-semibold text-zinc-900 dark:text-white">No active orders to track</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Place an order to watch live fulfillment stages here.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {myOrders.map((order) => {
                    const stepIdx = getStepIndex(order.status);
                    const isStopped = order.status === 'Cancelled' || order.status === 'Refunded';
                    return (
                      <div
                        key={order.id}
                        className={`p-6 rounded-2xl border bg-white dark:bg-[#141418] space-y-5 ${
                          highlightOrderId === order.id
                            ? 'border-blue-600 dark:border-blue-500'
                            : 'border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                          <div>
                            <div className="flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                                {order.order_number}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{formatDateTime(order.updated_at)}</span>
                            </div>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                              {order.status_note || `Current status: ${order.status}`}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <span className={`text-sm font-semibold ${getStatusTone(order.status)}`}>
                              {order.status}
                            </span>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                              {formatCurrency(order.total, symbol)}
                            </p>
                          </div>
                        </div>

                        {/* Visual 4-Step Progress Pipeline */}
                        {!isStopped ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {ORDER_STEPS.map((step, i) => {
                              const done = i <= stepIdx;
                              return (
                                <div key={step.key} className="space-y-2">
                                  <div
                                    className={`h-1.5 rounded-full transition-colors ${
                                      done ? 'bg-blue-600 dark:bg-blue-500' : 'bg-zinc-200 dark:bg-zinc-800'
                                    }`}
                                  />
                                  <div className="flex items-center gap-1.5 text-xs">
                                    {done ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                    ) : (
                                      <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                    )}
                                    <span
                                      className={
                                        done
                                          ? 'font-semibold text-zinc-900 dark:text-white'
                                          : 'text-zinc-500 dark:text-zinc-400'
                                      }
                                    >
                                      {step.label}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                            This order was marked as {order.status}. Contact support if you need assistance.
                          </p>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>
                            Items: {order.items.map((i) => `${i.product_title} (${i.license_type})`).join(', ')}
                          </span>
                          {order.payment_verified && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('library')}
                              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                            >
                              Go to Downloads
                            </button>
                          )}
                        </div>

                        {(() => {
                          const matchedEmail = emailLogs.find((entry) => entry.orderId === order.id);
                          if (!matchedEmail) return null;
                          return (
                            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 min-w-0">
                                <MailCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="truncate">
                                  Confirmation email sent to{' '}
                                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                    {matchedEmail.recipientEmail}
                                  </span>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums shrink-0">{formatDateTime(matchedEmail.sentAt)}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedEmailId(matchedEmail.id);
                                  document
                                    .getElementById('email-confirmation-log')
                                    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }}
                                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline whitespace-nowrap"
                              >
                                View Email Log
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Simulated Email Confirmation Log */}
              <div
                id="email-confirmation-log"
                className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4"
              >
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-white">
                      Email Confirmation Log
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Automated order confirmation receipts triggered after each verified purchase.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                    {emailLogs.length} {emailLogs.length === 1 ? 'email sent' : 'emails sent'}
                  </span>
                </div>

                {emailLogs.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418]">
                    <MailCheck className="w-7 h-7 text-zinc-400 mx-auto mb-2.5" />
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      No confirmation emails logged in this session
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      When a purchase is processed, a confirmation email entry with receipt details and license keys is
                      logged here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emailLogs.map((log) => {
                      const isExpanded = expandedEmailId === log.id;
                      return (
                        <div
                          key={log.id}
                          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] overflow-hidden"
                        >
                          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                                  <MailCheck className="w-3.5 h-3.5" />
                                  {log.status}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                                  {log.orderNumber}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">To: {log.recipientEmail}</span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">{formatDateTime(log.sentAt)}</span>
                              </div>
                              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{log.subject}</p>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                {log.previewText}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => setExpandedEmailId(isExpanded ? null : log.id)}
                              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 inline-flex items-center gap-1.5 self-start sm:self-center whitespace-nowrap shrink-0"
                            >
                              {isExpanded ? (
                                <>
                                  Hide Message
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </>
                              ) : (
                                <>
                                  View Message
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-3 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-400">
                                <p>
                                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">From:</span>{' '}
                                  {log.senderEmail}
                                </p>
                                <p>
                                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">To:</span>{' '}
                                  {log.recipientName} &lt;{log.recipientEmail}&gt;
                                </p>
                                <p>
                                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Payment Ref:</span>{' '}
                                  <span className="font-mono">{log.paymentReference}</span>
                                </p>
                                <p>
                                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Total Paid:</span>{' '}
                                  <span className="font-semibold tabular-nums text-zinc-900 dark:text-white">
                                    {formatCurrency(log.totalAmount, log.currencySymbol)}
                                  </span>
                                </p>
                              </div>

                              <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2">
                                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                  Unlocked Items &amp; License Keys
                                </p>
                                {log.items.map((item, idx) => (
                                  <div
                                    key={`${log.id}-item-${idx}`}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5"
                                  >
                                    <span className="text-zinc-700 dark:text-zinc-300">
                                      {item.title} ({item.licenseType}) × {item.quantity}
                                    </span>
                                    <code className="font-mono text-[11px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded text-zinc-800 dark:text-zinc-200 self-start sm:self-auto">
                                      {item.licenseKey}
                                    </code>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT HISTORY & INVOICES */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                  Account &amp; Billing History
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Complete ledger of all Razorpay transactions and downloadable order receipts.
                </p>
              </div>

              {myOrders.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418]">
                  <History className="w-9 h-9 text-zinc-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No transaction history yet.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-500 dark:text-zinc-400">
                          <th className="py-3 px-4 font-semibold">Order</th>
                          <th className="py-3 px-4 font-semibold">Date</th>
                          <th className="py-3 px-4 font-semibold">Payment Ref</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Amount</th>
                          <th className="py-3 px-4 font-semibold text-right">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                        {myOrders.map((order) => {
                          const expanded = expandedReceiptId === order.id;
                          return (
                            <React.Fragment key={order.id}>
                              <tr className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                                <td className="py-3.5 px-4 font-mono text-xs font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                                  {order.order_number}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                                  {formatShortDate(order.created_at)}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                  {order.razorpay_payment_id || 'Pending'}
                                </td>
                                <td className={`py-3.5 px-4 text-xs font-semibold whitespace-nowrap ${getStatusTone(order.status)}`}>
                                  {order.status}
                                </td>
                                <td className="py-3.5 px-4 text-right font-semibold tabular-nums text-zinc-900 dark:text-white whitespace-nowrap">
                                  {formatCurrency(order.total, symbol)}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedReceiptId(expanded ? null : order.id)}
                                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    {expanded ? 'Hide' : 'Details'}
                                  </button>
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="bg-zinc-50/60 dark:bg-zinc-900/40">
                                  <td colSpan={6} className="p-4">
                                    <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                                      <p className="font-semibold text-zinc-900 dark:text-white">
                                        Billing: {order.customer_name} · {order.customer_email}
                                        {order.customer_phone ? ` · ${order.customer_phone}` : ''}
                                      </p>
                                      {order.billing_address && <p>Address: {order.billing_address}</p>}
                                      <div className="pt-2 space-y-1">
                                        {order.items.map((item) => (
                                          <div key={item.id} className="flex justify-between">
                                            <span>
                                              {item.product_title} ({item.license_type}) × {item.quantity}
                                            </span>
                                            <span className="font-mono tabular-nums">
                                              {formatCurrency(item.unit_price * item.quantity, symbol)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <form
              onSubmit={handleSaveProfile}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] p-6 sm:p-8 space-y-6"
            >
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">Profile Settings</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Manage your personal information, gender 3D anime avatar, invoicing details, and notification
                  preferences.
                </p>
              </div>

              {/* Gender & 3D Anime Avatar Selector */}
              <div className="p-4 sm:p-5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-4">
                <div className="flex items-center gap-4">
                  <UserAvatar gender={gender} name={name || user.name} size="xl" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      3D Anime Profile Avatar ({gender === 'female' ? 'Female' : 'Male'})
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Choose your gender below to automatically set the matching 3D anime avatar across your profile.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['male', 'female'] as UserGender[]).map((g) => {
                    const item = ANIME_AVATARS[g];
                    const selected = gender === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3.5 transition-colors ${
                          selected
                            ? 'border-blue-600 dark:border-blue-500 bg-white dark:bg-[#141418]'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 hover:bg-white dark:hover:bg-zinc-900'
                        }`}
                      >
                        <img
                          src={item.src}
                          alt={`${item.label} 3D Anime Avatar`}
                          className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                            {item.label}
                            {selected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-sm text-zinc-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Studio / Company
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Optional"
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Street, City, State, PIN Code"
                  className="w-full p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Short Bio</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Product designer, founder, full-stack engineer..."
                  className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Order Status Push Alerts</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Receive real-time browser notifications when your order status changes.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushEnabled}
                    onChange={(e) => setPushEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Enabled</span>
                </label>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Change Password (Optional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
