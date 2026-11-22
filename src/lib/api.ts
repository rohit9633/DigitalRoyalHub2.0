// In-memory Bearer token holder (never stored in localStorage/sessionStorage)
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function apiRequest<T = unknown>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: string }).error)
        : `Request failed (${response.status})`;
    throw new Error(errMsg);
  }

  if (url.startsWith('/api/') && !isJson) {
    throw new Error('Server returned an unexpected response while contacting the payment API. Please retry.');
  }

  return data as T;
}

export async function downloadAuthorizedAsset(orderId: string, itemId: string, fallbackName: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const resp = await fetch(`/api/orders/${encodeURIComponent(orderId)}/download/${encodeURIComponent(itemId)}`, {
    headers
  });
  if (!resp.ok) {
    const text = await resp.text();
    try {
      const json = JSON.parse(text) as { error?: string };
      throw new Error(json.error || 'Download failed.');
    } catch {
      throw new Error('Unable to download file right now.');
    }
  }
  const blob = await resp.blob();
  const disposition = resp.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `${fallbackName}.txt`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatCurrency(amount: number, symbol = '₹'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${symbol}${safe.toLocaleString('en-IN')}`;
}

export function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
    };
  }
}

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let inFlightRazorpayLoad: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (typeof window.Razorpay === 'function') return Promise.resolve(true);
  if (inFlightRazorpayLoad) return inFlightRazorpayLoad;

  inFlightRazorpayLoad = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      inFlightRazorpayLoad = null;
      resolve(ok);
    };

    // Remove any previously failed or stalled script tag so the browser makes a fresh attempt
    const existingScripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>(`script[src*="checkout.razorpay.com"]`)
    );
    for (const s of existingScripts) {
      if (s.dataset.rzpLoaded === 'error' || s.dataset.rzpLoaded === 'done') {
        s.remove();
      }
    }

    const activeExisting = document.querySelector<HTMLScriptElement>(`script[src*="checkout.razorpay.com"]`);
    const script = activeExisting || document.createElement('script');

    const timeout = window.setTimeout(() => {
      if (typeof window.Razorpay === 'function') {
        finish(true);
      } else {
        script.dataset.rzpLoaded = 'error';
        finish(false);
      }
    }, 9000);

    const poll = window.setInterval(() => {
      if (typeof window.Razorpay === 'function') {
        window.clearInterval(poll);
        window.clearTimeout(timeout);
        script.dataset.rzpLoaded = 'done';
        finish(true);
      }
    }, 120);

    const onLoad = () => {
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      script.dataset.rzpLoaded = typeof window.Razorpay === 'function' ? 'done' : 'error';
      finish(typeof window.Razorpay === 'function');
    };

    const onError = () => {
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      script.dataset.rzpLoaded = 'error';
      finish(false);
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!activeExisting) {
      script.src = RAZORPAY_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return inFlightRazorpayLoad;
}

