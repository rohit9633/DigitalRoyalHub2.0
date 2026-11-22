import React from 'react';
import { Github, Instagram, Linkedin, Mail, MapPin, Phone, Twitter, Youtube } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Footer: React.FC = () => {
  const { settings, categories, navigate, user, openAuthModal } = useApp();

  if (!settings) return null;

  const socials = [
    { label: 'X / Twitter', url: settings.socialTwitter, icon: Twitter },
    { label: 'Instagram', url: settings.socialInstagram, icon: Instagram },
    { label: 'LinkedIn', url: settings.socialLinkedin, icon: Linkedin },
    { label: 'GitHub', url: settings.socialGithub, icon: Github },
    { label: 'YouTube', url: settings.socialYoutube, icon: Youtube }
  ].filter((s) => Boolean(s.url));

  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-[#F7F7F8] dark:bg-[#111114] text-zinc-700 dark:text-zinc-300 mt-20">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Brand & Socials */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => navigate({ page: 'home' })}
              className="font-display text-xl font-bold text-zinc-900 dark:text-white tracking-tight"
            >
              {settings.brandName}
            </button>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xs">
              {settings.tagline}
            </p>
            {socials.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                {socials.map(({ label, url, icon: Icon }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181D] inline-flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/40 transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Categories */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Categories</h3>
            <ul className="space-y-2.5 text-sm">
              {categories.slice(0, 6).map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ page: 'categories', categoryId: cat.id })}
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Account & Legal */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Account &amp; Legal</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => (user ? navigate({ page: 'dashboard', tab: 'library' }) : openAuthModal('login'))}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  My Digital Library
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => (user ? navigate({ page: 'dashboard', tab: 'tracking' }) : openAuthModal('login'))}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Order Tracking
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => (user ? navigate({ page: 'dashboard', tab: 'profile' }) : openAuthModal('login'))}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Profile Settings
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'terms' })}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Terms &amp; Conditions
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Details */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Contact Details</h3>
            <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              {settings.contactEmail && (
                <li className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="hover:text-zinc-900 dark:hover:text-white transition-colors break-all"
                  >
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings.contactPhone && (
                <li className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
                  <a
                    href={`tel:${settings.contactPhone}`}
                    className="hover:text-zinc-900 dark:hover:text-white transition-colors tabular-nums"
                  >
                    {settings.contactPhone}
                  </a>
                </li>
              )}
              {settings.contactAddress && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
                  <span className="leading-relaxed">{settings.contactAddress}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <p>{settings.copyrightText}</p>
          <div className="flex items-center gap-4">
            <span>Secured by Razorpay</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => navigate({ page: 'terms' })}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Terms &amp; Licensing
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
