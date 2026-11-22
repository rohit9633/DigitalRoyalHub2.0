import React from 'react';
import { X } from 'lucide-react';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AuthModal } from './components/AuthModal';
import { CartDrawer } from './components/CartDrawer';
import { CategoriesView } from './components/CategoriesView';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { Navbar } from './components/Navbar';
import { ProductDetailView } from './components/ProductDetailView';
import { TermsView } from './components/TermsView';
import { UserDashboardView } from './components/UserDashboardView';
import { AppProvider, useApp } from './context/AppContext';

const ToastStack: React.FC = () => {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)]"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-xl border shadow-lg flex items-start justify-between gap-3 bg-white dark:bg-[#141418] ${
            toast.tone === 'error'
              ? 'border-red-300 dark:border-red-900/70'
              : toast.tone === 'success'
                ? 'border-emerald-300 dark:border-emerald-900/70'
                : 'border-zinc-200 dark:border-zinc-800'
          }`}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-900 dark:text-white">{toast.title}</p>
            {toast.description && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

const MainShell: React.FC = () => {
  const { loading, view } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B0B0D]">
        <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between">
          <div className="w-28 h-5 rounded bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
          <div className="w-40 h-5 rounded bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        </div>
        <div className="max-w-[1280px] w-full mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="w-3/4 h-12 rounded bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
            <div className="w-full h-20 rounded bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
          </div>
          <div className="h-80 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B0B0D] text-zinc-900 dark:text-zinc-100 transition-colors duration-150">
      <Navbar />
      <main className="flex-1">
        {view.page === 'home' && <HomeView />}
        {view.page === 'categories' && <CategoriesView initialCategoryId={view.categoryId} />}
        {view.page === 'product' && <ProductDetailView productId={view.productId} />}
        {view.page === 'dashboard' && (
          <UserDashboardView initialTab={view.tab} highlightOrderId={view.highlightOrderId} />
        )}
        {view.page === 'admin' && <AdminDashboardView initialTab={view.tab} />}
        {view.page === 'terms' && <TermsView />}
      </main>
      <Footer />
      <CartDrawer />
      <AuthModal />
      <ToastStack />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}
