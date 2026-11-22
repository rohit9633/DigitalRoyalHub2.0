import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest, formatCurrency, loadRazorpayScript } from '../lib/api';
import type { Order } from '../types';
import { ProductImage } from './ProductImage';

interface CreateOrderResponse {
  orderId: string;
  orderNumber: string;
  amount: number;
  displayTotal: number;
  currency: string;
  mode: 'live' | 'sandbox';
  keyId: string;
  razorpayOrderId: string;
  sandboxPayload?: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };
}

interface HostedFallbackState {
  orderId: string;
  orderNumber: string;
  paymentLinkId: string;
  shortUrl: string;
  createdOrder: CreateOrderResponse;
}

export const CartDrawer: React.FC = () => {
  const {
    cart,
    cartOpen,
    setCartOpen,
    products,
    settings,
    user,
    openAuthModal,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal,
    razorpayConfigured,
    refreshMyOrders,
    triggerPurchaseConfirmationEmail,
    navigate,
    pushToast
  } = useApp();

  const [step, setStep] = useState<'cart' | 'checkout' | 'hosted' | 'success'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [hostedFallback, setHostedFallback] = useState<HostedFallbackState | null>(null);

  useEffect(() => {
    if (user) {
      setCustomerName((prev) => prev || user.name || '');
      setCustomerPhone((prev) => prev || user.phone || '');
      setBillingAddress((prev) => prev || user.billing_address || '');
    }
  }, [user]);

  // Proactively preload Razorpay Checkout SDK as soon as cart opens
  useEffect(() => {
    if (cartOpen && razorpayConfigured) {
      loadRazorpayScript().catch(() => undefined);
    }
  }, [cartOpen, razorpayConfigured]);

  useEffect(() => {
    if (!cartOpen && (step === 'success' || step === 'hosted')) {
      setStep('cart');
      setCompletedOrder(null);
      setHostedFallback(null);
    }
  }, [cartOpen, step]);

  if (!cartOpen) return null;

  const symbol = settings?.currencySymbol || '₹';

  const resolvedItems = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return null;
      const unitPrice = item.licenseType === 'Commercial' ? product.commercial_price : product.price;
      return { ...item, product, unitPrice };
    })
    .filter(Boolean) as Array<{
    productId: string;
    licenseType: 'Personal' | 'Commercial';
    quantity: number;
    product: (typeof products)[number];
    unitPrice: number;
  }>;

  const handleProceedToCheckout = () => {
    setError('');
    if (!user) {
      openAuthModal('login');
      return;
    }
    setStep('checkout');
  };

  const finalizeOrderSuccess = async (order: Order) => {
    setCompletedOrder(order);
    setHostedFallback(null);
    clearCart();
    await refreshMyOrders();
    triggerPurchaseConfirmationEmail(order);
    setStep('success');
    pushToast('Payment Verified', `Order ${order.order_number} is now available in My Library.`, 'success');
  };

  const verifyPaymentOnServer = async (
    orderId: string,
    payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
  ) => {
    const verified = await apiRequest<{ order: Order }>('/api/payments/razorpay/verify', {
      method: 'POST',
      body: {
        orderId,
        ...payload
      }
    });
    await finalizeOrderSuccess(verified.order);
  };

  const launchInlineRazorpayModal = (created: CreateOrderResponse): boolean => {
    if (!window.Razorpay || !created.keyId) return false;
    const rzp = new window.Razorpay({
      key: created.keyId,
      amount: created.amount,
      currency: created.currency,
      name: settings?.brandName || 'KalaVault',
      description: `Order ${created.orderNumber}`,
      order_id: created.razorpayOrderId,
      prefill: {
        name: customerName,
        email: user?.email,
        contact: customerPhone
      },
      theme: {
        color: '#2563EB'
      },
      handler: async (response) => {
        try {
          await verifyPaymentOnServer(created.orderId, response);
        } catch (verifyErr) {
          setError(verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed.');
        } finally {
          setProcessing(false);
        }
      },
      modal: {
        ondismiss: () => {
          setProcessing(false);
          setError('Razorpay checkout was cancelled before completion.');
        }
      }
    });
    rzp.open();
    return true;
  };

  const handlePayWithRazorpay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    try {
      const [created, scriptReady] = await Promise.all([
        apiRequest<CreateOrderResponse>('/api/payments/razorpay/create-order', {
          method: 'POST',
          body: {
            items: resolvedItems.map((i) => ({
              productId: i.productId,
              licenseType: i.licenseType,
              quantity: i.quantity
            })),
            customerName,
            customerPhone,
            billingAddress
          }
        }),
        razorpayConfigured ? loadRazorpayScript() : Promise.resolve(false)
      ]);

      if (created.mode === 'live' && created.keyId) {
        const loaded = scriptReady || (await loadRazorpayScript());
        if (loaded && launchInlineRazorpayModal(created)) {
          return;
        }

        // If browser/iframe blocks checkout.razorpay.com/v1/checkout.js, fall back cleanly to Razorpay Hosted Payment Link
        const linkRes = await apiRequest<{ paymentLinkId: string; shortUrl: string; alreadyPaid?: boolean; order?: Order }>(
          '/api/payments/razorpay/create-payment-link',
          {
            method: 'POST',
            body: { orderId: created.orderId }
          }
        );

        if (linkRes.alreadyPaid && linkRes.order) {
          await finalizeOrderSuccess(linkRes.order);
          setProcessing(false);
          return;
        }

        setHostedFallback({
          orderId: created.orderId,
          orderNumber: created.orderNumber,
          paymentLinkId: linkRes.paymentLinkId,
          shortUrl: linkRes.shortUrl,
          createdOrder: created
        });
        setStep('hosted');
        setProcessing(false);
        return;
      }

      // Server-signed Razorpay Sandbox Verification Flow (when live Razorpay keys are not yet configured)
      if (created.sandboxPayload) {
        await new Promise((resolve) => setTimeout(resolve, 650));
        await verifyPaymentOnServer(created.orderId, created.sandboxPayload);
        setProcessing(false);
        return;
      }

      throw new Error('Could not initialize payment gateway. Please try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initiate Razorpay payment.');
      setProcessing(false);
    }
  };

  const handleVerifyHostedPayment = async () => {
    if (!hostedFallback) return;
    setError('');
    setProcessing(true);
    try {
      const res = await apiRequest<{ order: Order }>('/api/payments/razorpay/verify-payment-link', {
        method: 'POST',
        body: {
          orderId: hostedFallback.orderId,
          paymentLinkId: hostedFallback.paymentLinkId
        }
      });
      await finalizeOrderSuccess(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment has not been confirmed yet.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryInlineModal = async () => {
    if (!hostedFallback) return;
    setError('');
    setProcessing(true);
    const loaded = await loadRazorpayScript();
    if (loaded && launchInlineRazorpayModal(hostedFallback.createdOrder)) {
      return;
    }
    setProcessing(false);
    setError('Inline Razorpay modal is blocked in this browser/frame. Use the Hosted Razorpay Checkout link above.');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white dark:bg-[#111114] h-full flex flex-col border-l border-zinc-200 dark:border-zinc-800 shadow-2xl">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-zinc-900 dark:text-white" />
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-white">
              {step === 'cart'
                ? 'Your Cart'
                : step === 'checkout'
                  ? 'Checkout'
                  : step === 'hosted'
                    ? 'Complete Payment'
                    : 'Order Confirmed'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Close cart drawer"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'cart' && (
            <>
              {resolvedItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <ShoppingBag className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                  <p className="text-base font-semibold text-zinc-900 dark:text-white">Your cart is empty</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">
                    Explore digital UI systems, code starters, and workspace templates to add items here.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCartOpen(false);
                      navigate({ page: 'categories' });
                    }}
                    className="mt-5 px-5 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold"
                  >
                    Browse Products
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {resolvedItems.map((item) => (
                    <div key={`${item.productId}-${item.licenseType}`} className="py-4 flex gap-4">
                      <div className="w-20 h-16 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 shrink-0 border border-zinc-200 dark:border-zinc-800">
                        <ProductImage src={item.product.image_url} alt={item.product.title} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                            {item.product.title}
                          </h3>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.productId, item.licenseType)}
                            aria-label="Remove item"
                            className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {item.licenseType} License · v{item.product.version}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="inline-flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.productId, item.licenseType, item.quantity - 1)}
                              aria-label="Decrease quantity"
                              className="w-8 h-8 inline-flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l-lg"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-semibold tabular-nums text-zinc-900 dark:text-white">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.productId, item.licenseType, item.quantity + 1)}
                              aria-label="Increase quantity"
                              className="w-8 h-8 inline-flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r-lg"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">
                            {formatCurrency(item.unitPrice * item.quantity, symbol)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'checkout' && (
            <form id="razorpay-checkout-form" onSubmit={handlePayWithRazorpay} className="space-y-5">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Payment Gateway</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {razorpayConfigured ? 'Secure Online Checkout' : 'Verified Test Checkout'}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {razorpayConfigured
                    ? 'Complete your purchase securely via UPI, Credit/Debit Cards, or NetBanking.'
                    : 'Test checkout mode is active for order and instant download verification.'}
                </p>
              </div>

              {error && (
                <div className="px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Billing Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Phone Number (for UPI &amp; Receipt)
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Billing Address (for Invoice)
                  </label>
                  <textarea
                    rows={2}
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="City, State, Postal Code"
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-sm">
                {resolvedItems.map((item) => (
                  <div
                    key={`${item.productId}-${item.licenseType}`}
                    className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    <span className="truncate pr-3">
                      {item.product.title} ({item.licenseType}) × {item.quantity}
                    </span>
                    <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100 shrink-0">
                      {formatCurrency(item.unitPrice * item.quantity, symbol)}
                    </span>
                  </div>
                ))}
              </div>
            </form>
          )}

          {step === 'hosted' && hostedFallback && (
            <div className="py-4 space-y-5">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Order {hostedFallback.orderNumber} created
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The inline Razorpay popup script was blocked in this browser view. Complete your payment securely on
                  Razorpay&apos;s official hosted checkout page below, then click Verify Payment to unlock your digital
                  downloads immediately.
                </p>
              </div>

              {error && (
                <div className="px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                <div className="p-3.5 flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Order Reference</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                    {hostedFallback.orderNumber}
                  </span>
                </div>
                <div className="p-3.5 flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Payable Amount</span>
                  <span className="font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {formatCurrency(hostedFallback.createdOrder.displayTotal, symbol)}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <a
                  href={hostedFallback.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  Open Razorpay Hosted Checkout
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  disabled={processing}
                  onClick={handleVerifyHostedPayment}
                  className="w-full h-11 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60 text-white dark:text-zinc-900 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {processing ? 'Checking with Razorpay...' : "I've Paid — Verify & Unlock Downloads"}
                </button>

                <button
                  type="button"
                  disabled={processing}
                  onClick={handleRetryInlineModal}
                  className="w-full h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Inline Razorpay Popup
                </button>
              </div>
            </div>
          )}

          {step === 'success' && completedOrder && (
            <div className="py-6 space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
                  Order {completedOrder.order_number} Confirmed
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  Your payment has been verified and your digital license keys are unlocked.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                <div className="p-3.5 flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Payment Reference</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">{completedOrder.razorpay_payment_id}</span>
                </div>
                <div className="p-3.5 flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Amount Paid</span>
                  <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(completedOrder.total, symbol)}
                  </span>
                </div>
                <div className="p-3.5 flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Order Status</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{completedOrder.status}</span>
                </div>
                <div className="p-3.5 flex justify-between gap-4">
                  <span className="text-zinc-500 dark:text-zinc-400 shrink-0">Confirmation Email</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    Sent to {completedOrder.customer_email || user?.email}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    navigate({ page: 'dashboard', tab: 'library' });
                  }}
                  className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  Open My Digital Library
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    navigate({ page: 'dashboard', tab: 'tracking', highlightOrderId: completedOrder.id });
                  }}
                  className="w-full h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  View Order Tracking
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {step !== 'success' && step !== 'hosted' && resolvedItems.length > 0 && (
          <div className="px-6 py-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#141418] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Total (Instant Delivery)</span>
              <span className="font-display text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
                {formatCurrency(cartSubtotal, symbol)}
              </span>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                {user ? 'Buy Now' : 'Sign In to Buy Now'}
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  disabled={processing}
                  className="h-11 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="razorpay-checkout-form"
                  disabled={processing}
                  className="flex-1 h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {processing ? 'Processing...' : `Buy Now · ${formatCurrency(cartSubtotal, symbol)}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
