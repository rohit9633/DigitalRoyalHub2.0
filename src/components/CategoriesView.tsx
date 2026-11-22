import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, ShoppingBag, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../lib/api';
import { ProductImage } from './ProductImage';

interface CategoriesViewProps {
  initialCategoryId?: string;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({ initialCategoryId }) => {
  const { categories, products, settings, navigate, addToCart, setCartOpen } = useApp();
  const [activeCategoryId, setActiveCategoryId] = useState<string>(initialCategoryId || 'all');
  const [query, setQuery] = useState('');

  const symbol = settings?.currencySymbol || '₹';

  const publishedProducts = useMemo(() => products.filter((p) => p.published), [products]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of publishedProducts) {
      map.set(p.category_id, (map.get(p.category_id) || 0) + 1);
    }
    return map;
  }, [publishedProducts]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return publishedProducts.filter((p) => {
      const catMatch = activeCategoryId === 'all' || p.category_id === activeCategoryId;
      const textMatch = !q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [publishedProducts, activeCategoryId, query]);

  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Browse by Discipline</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mt-2">
            Product Categories
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl">
            Explore organized digital collections across UI systems, full-stack starters, Notion workspaces, monographs,
            and icon foundries.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter releases..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-8">
        <button
          type="button"
          onClick={() => setActiveCategoryId('all')}
          className={`text-left p-5 rounded-xl border transition-colors ${
            activeCategoryId === 'all'
              ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-white">All Categories</h2>
            <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
              {publishedProducts.length}
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
            Every active digital release available across the entire catalog.
          </p>
        </button>

        {categories.map((cat) => {
          const active = activeCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryId(cat.id)}
              className={`text-left p-5 rounded-xl border transition-colors ${
                active
                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-white">{cat.name}</h2>
                <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  {categoryCounts.get(cat.id) || 0}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed line-clamp-2">
                {cat.description || 'Curated digital products in this category.'}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filtered Collection Header */}
      <div className="flex items-center justify-between py-4 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
          {activeCategory ? activeCategory.name : 'All Digital Releases'}
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418]">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No products in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 pt-4">
          {filteredProducts.map((product) => (
            <article
              key={product.id}
              className="group flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => navigate({ page: 'product', productId: product.id })}
                className="block w-full aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900"
              >
                <ProductImage src={product.image_url} alt={product.title} />
              </button>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{product.category_name}</span>
                  <span aria-hidden="true">·</span>
                  <span>v{product.version}</span>
                  {product.review_count > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {product.avg_rating.toFixed(1)}
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'product', productId: product.id })}
                  className="text-left mt-2"
                >
                  <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {product.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">{product.subtitle}</p>
                </button>
                <div className="mt-auto pt-5 flex items-center justify-between gap-2">
                  <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-white">
                    {formatCurrency(product.price, symbol)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'product', productId: product.id })}
                      className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1"
                    >
                      View
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(product.id, 'Personal');
                        setCartOpen(true);
                      }}
                      className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
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
    </div>
  );
};
