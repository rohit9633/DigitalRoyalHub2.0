import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  LogOut,
  Menu,
  Moon,
  Package,
  Search,
  Shield,
  ShoppingBag,
  Sun,
  User as UserIcon,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDateTime } from '../lib/api';
import { ProductImage } from './ProductImage';
import { UserAvatar } from './UserAvatar';

export const Navbar: React.FC = () => {
  const {
    settings,
    products,
    globalSearch,
    setGlobalSearch,
    view,
    navigate,
    user,
    logout,
    openAuthModal,
    theme,
    toggleTheme,
    cartCount,
    setCartOpen,
    notifications,
    unreadNotificationCount,
    markAllNotificationsRead,
    browserPushPermission,
    requestBrowserPushPermission
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const symbol = settings?.currencySymbol || '₹';

  const searchMatches = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => {
        if (!p.published) return false;
        return (
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          (p.category_name || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [products, globalSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (
        desktopSearchRef.current &&
        !desktopSearchRef.current.contains(e.target as Node) &&
        (!mobileSearchRef.current || !mobileSearchRef.current.contains(e.target as Node))
      ) {
        setSearchFocused(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchFocused(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => mobileSearchInputRef.current?.focus(), 40);
    }
  }, [mobileSearchOpen]);

  const handleSearchChange = (value: string) => {
    setGlobalSearch(value);
    setSearchFocused(true);
    setNotifOpen(false);
    setProfileOpen(false);
    if (value.trim().length > 0 && view.page === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchFocused(false);
    setMobileSearchOpen(false);
    if (view.page !== 'home') {
      navigate({ page: 'home' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectProduct = (productId: string) => {
    setSearchFocused(false);
    setMobileSearchOpen(false);
    navigate({ page: 'product', productId });
  };

  const navItems: Array<{ label: string; active: boolean; onClick: () => void }> = [
    { label: 'Store', active: view.page === 'home', onClick: () => navigate({ page: 'home' }) },
    { label: 'Categories', active: view.page === 'categories', onClick: () => navigate({ page: 'categories' }) },
    {
      label: 'Dashboard',
      active: view.page === 'dashboard',
      onClick: () => {
        if (!user) {
          openAuthModal('login');
        } else {
          navigate({ page: 'dashboard', tab: 'library' });
        }
      }
    },
    { label: 'Terms', active: view.page === 'terms', onClick: () => navigate({ page: 'terms' }) }
  ];

  const handleNav = (fn: () => void) => {
    setMobileMenuOpen(false);
    fn();
  };

  const showDropdown = searchFocused && globalSearch.trim().length > 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0B0B0D]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-6">
        {/* Zone 1: Single wordmark */}
        <button
          type="button"
          onClick={() => navigate({ page: 'home' })}
          className="font-display text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          {settings?.brandName || 'KalaVault'}
        </button>

        {/* Zone 2: Concise single-line nav links */}
        <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-6 shrink-0">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm ${
                item.active
                  ? 'text-zinc-900 dark:text-white border-blue-600 dark:border-blue-500'
                  : 'text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Global Search Input (Desktop / Tablet) */}
        <div ref={desktopSearchRef} className="relative hidden md:block flex-1 max-w-xs lg:max-w-sm">
          <form onSubmit={handleSearchSubmit} role="search">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={globalSearch}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search products by title or keyword..."
              aria-label="Search products by title or description"
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#141418] text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-[#141418] focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => {
                  setGlobalSearch('');
                  setSearchFocused(false);
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {showDropdown && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden z-50">
              <div className="px-3.5 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="truncate">
                  Matches for &ldquo;{globalSearch.trim()}&rdquo;
                </span>
                <span className="tabular-nums font-medium shrink-0 ml-2">
                  {searchMatches.length} {searchMatches.length === 1 ? 'result' : 'results'}
                </span>
              </div>

              {searchMatches.length === 0 ? (
                <div className="px-4 py-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  No products match &ldquo;{globalSearch.trim()}&rdquo;.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-80 overflow-y-auto">
                  {searchMatches.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSelectProduct(product.id)}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/70 flex items-center gap-3 transition-colors"
                    >
                      <div className="w-11 h-9 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0">
                        <ProductImage src={product.image_url} alt={product.title} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {product.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {product.category_name || 'Digital Asset'} · {product.subtitle}
                        </p>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-white shrink-0">
                        {formatCurrency(product.price, symbol)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchFocused(false);
                    if (view.page !== 'home') {
                      navigate({ page: 'home' });
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/70 border-t border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {view.page === 'home' ? 'Showing live results in Store' : 'View all matching products in Store'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Zone 3: Utilities + Primary Account Action */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Search Toggle */}
          <button
            type="button"
            onClick={() => {
              setMobileSearchOpen((prev) => !prev);
              setMobileMenuOpen(false);
              setNotifOpen(false);
              setProfileOpen(false);
            }}
            aria-label="Search products"
            className="md:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
          >
            {mobileSearchOpen ? <X className="w-[18px] h-[18px]" /> : <Search className="w-[18px] h-[18px]" />}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          {/* Real-time Notification Center */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              aria-label="Order notifications"
              className="relative w-10 h-10 inline-flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-[10px] font-semibold text-white flex items-center justify-center tabular-nums">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 shadow-lg overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Order Alerts</span>
                  <div className="flex items-center gap-3">
                    {browserPushPermission !== 'granted' && browserPushPermission !== 'unsupported' && (
                      <button
                        type="button"
                        onClick={requestBrowserPushPermission}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                      >
                        Enable Push
                      </button>
                    )}
                    {unreadNotificationCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllNotificationsRead()}
                        className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 whitespace-nowrap"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {!user ? (
                    <div className="p-5 text-center">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                        Sign in to receive live order status alerts and push updates.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          openAuthModal('login');
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                      >
                        Sign In
                      </button>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No order notifications yet. Real-time updates will appear here automatically.
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          navigate({ page: 'dashboard', tab: 'tracking', highlightOrderId: item.order_id });
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors ${
                          !item.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                            {formatDateTime(item.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{item.message}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cart Button */}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label="Open shopping cart"
            className="relative h-10 px-3 inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs font-semibold tabular-nums">{cartCount}</span>
          </button>

          {/* Account / Quick Profile Access */}
          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                className="h-10 pl-1.5 pr-3 inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap shrink-0"
              >
                <UserAvatar gender={user.gender} name={user.name} size="xs" className="border-white/30 dark:border-zinc-900/20" />
                <span className="max-w-[96px] truncate hidden sm:inline">{user.name.split(' ')[0]}</span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 shadow-lg py-2 z-50">
                  <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                    <UserAvatar gender={user.gender} name={user.name} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{user.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {user.phone || user.email}
                      </p>
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate({ page: 'dashboard', tab: 'library' });
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2.5"
                    >
                      <Package className="w-4 h-4 text-zinc-400" />
                      My Library &amp; Orders
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate({ page: 'dashboard', tab: 'profile' });
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2.5"
                    >
                      <UserIcon className="w-4 h-4 text-zinc-400" />
                      Profile Settings
                    </button>
                    {user.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          navigate({ page: 'admin', tab: 'orders' });
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2.5 font-medium"
                      >
                        <Shield className="w-4 h-4" />
                        Admin Console
                      </button>
                    )}
                  </div>
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2.5"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((prev) => !prev);
              setMobileSearchOpen(false);
            }}
            aria-label="Toggle navigation menu"
            className="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Compact Search Overlay */}
      {mobileSearchOpen && (
        <div
          ref={mobileSearchRef}
          className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0B0B0D] px-4 py-3 space-y-2.5"
        >
          <form onSubmit={handleSearchSubmit} role="search" className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={mobileSearchInputRef}
              type="text"
              value={globalSearch}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search products by title or keyword..."
              aria-label="Search products"
              className="w-full h-10 pl-9 pr-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#141418] text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {globalSearch.trim().length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {searchMatches.length === 0 ? (
                <p className="px-3.5 py-4 text-xs text-center text-zinc-500 dark:text-zinc-400">
                  No products match &ldquo;{globalSearch.trim()}&rdquo;.
                </p>
              ) : (
                searchMatches.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectProduct(product.id)}
                    className="w-full px-3 py-2.5 text-left flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="w-10 h-8 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-900 shrink-0">
                      <ProductImage src={product.image_url} alt={product.title} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{product.title}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{product.subtitle}</p>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-white shrink-0">
                      {formatCurrency(product.price, symbol)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0B0B0D] px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleNav(item.onClick)}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                item.active
                  ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};
