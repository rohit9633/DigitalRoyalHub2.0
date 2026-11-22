import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Download,
  Lock,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  User as UserIcon,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../lib/api';
import { ProductImage } from './ProductImage';
import { UserAvatar } from './UserAvatar';

export const HomeView: React.FC = () => {
  const {
    settings,
    categories,
    products,
    globalSearch,
    setGlobalSearch,
    user,
    openAuthModal,
    navigate,
    addToCart,
    setCartOpen,
    myOrders
  } = useApp();

  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating'>('featured');

  const symbol = settings?.currencySymbol || '₹';
  const isSearching = globalSearch.trim().length > 0;

  const visibleProducts = useMemo(() => {
    const published = products.filter((p) => p.published);
    const filtered = published.filter((p) => {
      const matchesCat = selectedCategory === 'all' || p.category_id === selectedCategory;
      const q = globalSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        (p.category_name || '').toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'rating') return b.avg_rating - a.avg_rating || b.review_count - a.review_count;
      return Number(b.featured) - Number(a.featured) || b.sales_count - a.sales_count;
    });
  }, [products, selectedCategory, globalSearch, sortBy]);

  if (!settings) return null;

  const scrollToCatalog = () => {
    const el = document.getElementById('store-catalog');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div>
      {/* Slim Dismissible Announcement Banner (<= 40px) */}
      {settings.announcementEnabled && settings.announcementText && !announcementDismissed && (
        <div className="bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 text-xs">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 min-h-[36px] py-1.5 flex items-center justify-between gap-4">
            <span className="truncate font-medium">{settings.announcementText}</span>
            <button
              type="button"
              onClick={() => setAnnouncementDismissed(true)}
              aria-label="Dismiss announcement"
              className="p-1 opacity-75 hover:opacity-100 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Section 1: Asymmetric Split Hero + Quick Auth/Profile Access (hidden while actively searching so results appear immediately) */}
      {!isSearching && (
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tracking-normal">
                {settings.heroKicker}
              </p>
              <h1
                className="font-display font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.08] mt-4"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
              >
                {settings.heroHeadline}
              </h1>
              <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mt-5 max-w-xl">
                {settings.heroSubheadline}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={scrollToCatalog}
                  className="h-11 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  {settings.heroPrimaryCta}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'categories' })}
                  className="h-11 px-5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {settings.heroSecondaryCta}
                </button>
              </div>
            </div>

            {/* Quick Home Page Auth & Personal Profile Access Strip */}
            <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {user ? (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar gender={user.gender} name={user.name} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {myOrders.length} {myOrders.length === 1 ? 'order' : 'orders'} · Personal data &amp; downloads ready
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'dashboard', tab: 'library' })}
                      className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 whitespace-nowrap"
                    >
                      My Library
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'dashboard', tab: 'profile' })}
                      className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 whitespace-nowrap"
                    >
                      Profile Settings
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">Quick Account Access</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Sign in for instant downloads, order tracking, and profile settings.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openAuthModal('login')}
                      className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 whitespace-nowrap"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuthModal('register')}
                      className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Sign Up
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="w-full h-72 sm:h-96 lg:h-full min-h-[360px] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
              <ProductImage src={settings.heroImage} alt={settings.heroHeadline} />
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Quantitative Proof Strip */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 border-y border-zinc-200 dark:border-zinc-800 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
          {[
            { value: settings.stat1Value, label: settings.stat1Label },
            { value: settings.stat2Value, label: settings.stat2Label },
            { value: settings.stat3Value, label: settings.stat3Label },
            { value: settings.stat4Value, label: settings.stat4Label }
          ].map((stat, idx) => (
            <div key={idx} className="py-6 px-4 sm:px-6">
              <p className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
                {stat.value}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Section 2: Category System & Featured Digital Product Grid */}
      <section id="store-catalog" className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
              {isSearching ? `Search results for "${globalSearch.trim()}"` : settings.catalogTitle}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl">
              {isSearching
                ? `Showing ${visibleProducts.length} matching digital ${
                    visibleProducts.length === 1 ? 'product' : 'products'
                  } filtered by title and description.`
                : settings.catalogSubtitle}
            </p>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Filter by title or description..."
                className="w-full sm:w-64 h-10 pl-10 pr-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  aria-label="Clear search query"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <SlidersHorizontal className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
              <select
                aria-label="Sort products"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-10 pl-9 pr-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="featured">Featured First</option>
                <option value="rating">Highest Rated</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Interactive Category Segmented Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-8">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#141418] border border-zinc-200/70 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              All Releases
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* 3-Column Uniform Product Grid */}
        {visibleProducts.length === 0 ? (
          <div className="py-20 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418]">
            <p className="text-base font-semibold text-zinc-900 dark:text-white">No matching digital products</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Try clearing your search filter or choosing another category.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setGlobalSearch('');
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className="group flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => navigate({ page: 'product', productId: product.id })}
                  className="block w-full aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900 text-left"
                >
                  <ProductImage
                    src={product.image_url}
                    alt={product.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </button>

                <div className="p-5 flex-1 flex flex-col">
                  {/* Zero-Pill Clean Metadata Line */}
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                      {product.category_name || 'Digital Asset'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{product.file_format}</span>
                    {product.review_count > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums text-zinc-700 dark:text-zinc-300 shrink-0">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          {product.avg_rating.toFixed(1)}
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate({ page: 'product', productId: product.id })}
                    className="text-left mt-2.5"
                  >
                    <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {product.title}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {product.subtitle}
                    </p>
                  </button>

                  <div className="mt-auto pt-5 flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800/80 mt-5">
                    <div className="flex items-baseline gap-2 tabular-nums">
                      <span className="text-base font-bold text-zinc-900 dark:text-white">
                        {formatCurrency(product.price, symbol)}
                      </span>
                      {product.compare_at_price > product.price && (
                        <span className="text-xs text-zinc-400 line-through">
                          {formatCurrency(product.compare_at_price, symbol)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate({ page: 'product', productId: product.id })}
                        className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          addToCart(product.id, 'Personal');
                          setCartOpen(true);
                        }}
                        className="h-9 px-3.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-blue-600 dark:hover:bg-blue-500 text-white dark:text-zinc-900 dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Studio Craftsmanship & Delivery Assurance */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-14 grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white">
              01. Verified Razorpay Checkout
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Every payment is verified cryptographically on the server using Razorpay order signatures across UPI,
              cards, and net banking.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
              <Download className="w-4 h-4" />
            </div>
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white">
              02. Instant Library &amp; License Keys
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Purchased kits, release certificates, and license keys unlock automatically in your personal dashboard
              with lifetime version access.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
              <ArrowRight className="w-4 h-4" />
            </div>
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white">
              03. Live Order Tracking &amp; Alerts
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Track every purchase in real time and receive immediate in-app and browser push notifications whenever
              order fulfillment updates.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
