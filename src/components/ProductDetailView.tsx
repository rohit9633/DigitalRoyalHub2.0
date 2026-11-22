import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Facebook,
  Linkedin,
  MessageCircle,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
  Twitter
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest, formatCurrency, formatShortDate } from '../lib/api';
import type { Review } from '../types';
import { ProductImage } from './ProductImage';

interface ProductDetailViewProps {
  productId: string;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ productId }) => {
  const { products, settings, navigate, addToCart, setCartOpen, user, openAuthModal, pushToast, refreshCatalog } =
    useApp();

  const product = products.find((p) => p.id === productId);
  const [licenseType, setLicenseType] = useState<'Personal' | 'Commercial'>('Personal');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Review composer state
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingReviews(true);
    apiRequest<{ reviews: Review[] }>(`/api/products/${encodeURIComponent(productId)}/reviews`)
      .then((res) => {
        if (active) setReviews(res.reviews);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingReviews(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  const ratingBreakdown = useMemo(() => {
    const counts = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((r) => r.rating === stars).length
    }));
    const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    return { counts, avg, total: reviews.length };
  }, [reviews]);

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">Product not found</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          This digital product may have been removed or unpublished.
        </p>
        <button
          type="button"
          onClick={() => navigate({ page: 'home' })}
          className="mt-6 px-5 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold"
        >
          Back to Storefront
        </button>
      </div>
    );
  }

  const symbol = settings?.currencySymbol || '₹';
  const activePrice = licenseType === 'Commercial' ? product.commercial_price : product.price;
  const shareUrl = `${window.location.origin}/?product=${encodeURIComponent(product.slug)}`;
  const shareText = `Check out ${product.title} on ${settings?.brandName || 'KalaVault'}`;

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      pushToast('Link copied', 'Product link copied to clipboard.', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      pushToast('Copy failed', 'Unable to copy link automatically.', 'error');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: product.title, text: shareText, url: shareUrl });
      } catch {
        // user dismissed
      }
    } else {
      handleCopyShareLink();
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    setReviewError('');
    setSubmittingReview(true);
    try {
      const res = await apiRequest<{ review: Review }>(`/api/products/${encodeURIComponent(product.id)}/reviews`, {
        method: 'POST',
        body: {
          rating,
          title: reviewTitle,
          comment: reviewComment
        }
      });
      setReviews((prev) => [res.review, ...prev]);
      setReviewTitle('');
      setReviewComment('');
      setRating(5);
      await refreshCatalog();
      pushToast('Review published', 'Thank you for rating this digital release.', 'success');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Unable to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 lg:pb-16">
      <button
        type="button"
        onClick={() => navigate({ page: 'home' })}
        className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Catalog
      </button>

      {/* Main Contiguous Purchase Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Sticky Media & Description */}
        <div className="lg:col-span-7 space-y-8">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
            <ProductImage src={product.image_url} alt={product.title} />
          </div>

          {/* Detailed Overview */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">About this Release</h2>
            <p className="text-sm sm:text-[15px] text-zinc-600 dark:text-zinc-300 leading-7 whitespace-pre-line">
              {product.description}
            </p>
          </div>

          {/* What's Included */}
          {product.highlights.length > 0 && (
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">What is Included</h2>
              <ul className="space-y-3">
                {product.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical Specifications */}
          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white mb-4">
              Package Specifications
            </h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-[#F7F7F8] dark:bg-[#141418]">
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Format</dt>
                <dd className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">{product.file_format}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Version</dt>
                <dd className="text-sm font-semibold font-mono text-zinc-900 dark:text-white mt-1">
                  v{product.version}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Archive Size</dt>
                <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-white mt-1">
                  {product.file_size}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Verified Sales</dt>
                <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-white mt-1">
                  {product.sales_count.toLocaleString('en-IN')}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right: Sticky Contiguous Purchase Module */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] p-6 sm:p-7 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{product.category_name || 'Digital Release'}</span>
              <span aria-hidden="true">·</span>
              <span>Version {product.version}</span>
              {ratingBreakdown.total > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {ratingBreakdown.avg.toFixed(1)} ({ratingBreakdown.total})
                  </span>
                </>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mt-2">
              {product.title}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">{product.subtitle}</p>
          </div>

          {/* License Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Choose License Tier</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLicenseType('Personal')}
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  licenseType === 'Personal'
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <span className="block text-xs font-semibold text-zinc-900 dark:text-white">Personal</span>
                <span className="block font-display text-lg font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
                  {formatCurrency(product.price, symbol)}
                </span>
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">1 creator · Personal use</span>
              </button>

              <button
                type="button"
                onClick={() => setLicenseType('Commercial')}
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  licenseType === 'Commercial'
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <span className="block text-xs font-semibold text-zinc-900 dark:text-white">Commercial</span>
                <span className="block font-display text-lg font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
                  {formatCurrency(product.commercial_price, symbol)}
                </span>
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Client projects · Up to 15 seats
                </span>
              </button>
            </div>
          </div>

          {/* Price & Primary Purchase Actions */}
          <div className="pt-2 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">One-time payment · Lifetime updates</span>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="font-display text-3xl font-bold text-zinc-900 dark:text-white">
                  {formatCurrency(activePrice, symbol)}
                </span>
                {licenseType === 'Personal' && product.compare_at_price > product.price && (
                  <span className="text-sm text-zinc-400 line-through">
                    {formatCurrency(product.compare_at_price, symbol)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                addToCart(product.id, licenseType);
                setCartOpen(true);
              }}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Buy Now
            </button>

            <button
              type="button"
              onClick={() => addToCart(product.id, licenseType)}
              className="w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              Add to Cart
            </button>

            {product.preview_url && (
              <a
                href={product.preview_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-10 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                Live Documentation Preview
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Instant digital download + verified license key upon Razorpay confirmation.</span>
          </div>

          {/* Social Media Sharing Buttons */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Share this product</span>
              <button
                type="button"
                onClick={handleNativeShare}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X"
                className="h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 inline-flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on LinkedIn"
                className="h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 inline-flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on WhatsApp"
                className="h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 inline-flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Facebook"
                className="h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 inline-flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={handleCopyShareLink}
                aria-label="Copy product link"
                className="h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 inline-flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Comprehensive User Review & Rating System */}
      <section className="mt-16 pt-12 border-t border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: Rating Summary & Review Form */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
                Customer Reviews &amp; Ratings
              </h2>
              <div className="mt-4 flex items-center gap-5">
                <div>
                  <p className="font-display text-4xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {ratingBreakdown.total > 0 ? ratingBreakdown.avg.toFixed(1) : '—'}
                  </p>
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= Math.round(ratingBreakdown.avg)
                            ? 'fill-amber-500 text-amber-500'
                            : 'text-zinc-300 dark:text-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
                    {ratingBreakdown.total} {ratingBreakdown.total === 1 ? 'review' : 'reviews'}
                  </p>
                </div>

                <div className="flex-1 space-y-1.5">
                  {ratingBreakdown.counts.map(({ stars, count }) => {
                    const pct = ratingBreakdown.total > 0 ? (count / ratingBreakdown.total) * 100 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-2.5 text-xs">
                        <span className="w-8 tabular-nums text-zinc-600 dark:text-zinc-400">{stars} ★</span>
                        <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Write a Review Form */}
            <form
              onSubmit={handleSubmitReview}
              className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418] space-y-4"
            >
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white">Write a Review</h3>

              {reviewError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
                  {reviewError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Your Rating</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setRating(starVal)}
                      aria-label={`Rate ${starVal} stars`}
                      className="p-1.5 rounded-md hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          starVal <= rating ? 'fill-amber-500 text-amber-500' : 'text-zinc-300 dark:text-zinc-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 tabular-nums">
                    {rating} / 5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Headline
                </label>
                <input
                  type="text"
                  required
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Summarize your experience"
                  className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Review Details
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share what worked well for your workflow or project..."
                  className="w-full p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full h-10 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-blue-600 dark:hover:bg-blue-500 text-white dark:text-zinc-900 dark:hover:text-white text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {user ? (submittingReview ? 'Submitting...' : 'Submit Review') : 'Sign In to Write a Review'}
              </button>
            </form>
          </div>

          {/* Right: Reviews Feed */}
          <div className="lg:col-span-7">
            {loadingReviews ? (
              <div className="space-y-4">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-28 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse border border-zinc-200 dark:border-zinc-800"
                  />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#141418]">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">No reviews yet</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Be the first customer to review this digital product.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {reviews.map((rev) => (
                  <article key={rev.id} className="py-6 first:pt-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-900 dark:text-white">{rev.user_name}</span>
                        {rev.verified_purchase && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Verified Buyer</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatShortDate(rev.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating ? 'fill-amber-500 text-amber-500' : 'text-zinc-300 dark:text-zinc-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mt-2">{rev.title}</h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1.5 leading-relaxed">{rev.comment}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
