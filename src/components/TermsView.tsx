import React from 'react';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TermsView: React.FC = () => {
  const { settings, navigate } = useApp();

  if (!settings) return null;

  const sections = settings.termsContent
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <button
        type="button"
        onClick={() => navigate({ page: 'home' })}
        className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Storefront
      </button>

      <header className="pb-8 border-b border-zinc-200 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {settings.brandName} · Updated {settings.termsUpdatedAt}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mt-2">
          Terms &amp; Conditions
        </h1>
        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-3 leading-relaxed">
          Please read these licensing terms, Razorpay payment policies, and digital delivery conditions carefully before
          purchasing digital assets from {settings.brandName}.
        </p>
      </header>

      <article className="py-10 space-y-8">
        {sections.map((block, index) => {
          const lines = block.split('\n');
          const heading = lines[0];
          const body = lines.slice(1).join('\n');
          return (
            <section key={index} className="space-y-2.5">
              {body ? (
                <>
                  <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-white">{heading}</h2>
                  <p className="text-sm sm:text-[15px] text-zinc-600 dark:text-zinc-300 leading-7 whitespace-pre-line">
                    {body}
                  </p>
                </>
              ) : (
                <p className="text-sm sm:text-[15px] text-zinc-600 dark:text-zinc-300 leading-7">{heading}</p>
              )}
            </section>
          );
        })}
      </article>

      <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-zinc-600 dark:text-zinc-400">
        <span>Questions regarding licensing or invoicing?</span>
        <div className="flex flex-wrap items-center gap-5">
          {settings.contactEmail && (
            <a
              href={`mailto:${settings.contactEmail}`}
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <Mail className="w-4 h-4" />
              {settings.contactEmail}
            </a>
          )}
          {settings.contactPhone && (
            <a
              href={`tel:${settings.contactPhone}`}
              className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:underline tabular-nums"
            >
              <Phone className="w-4 h-4" />
              {settings.contactPhone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
