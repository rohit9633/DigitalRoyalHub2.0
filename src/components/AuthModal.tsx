import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  KeyRound,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  Smartphone,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { OtpRequestResult } from '../context/AppContext';
import type { OtpChannel, UserGender } from '../types';
import { ANIME_AVATARS } from './UserAvatar';

const OTP_CHANNELS: Array<{
  id: OtpChannel;
  label: string;
  placeholder: string;
  inputLabel: string;
  inputType: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    inputLabel: 'WhatsApp Number',
    placeholder: '+91 98765 43210',
    inputType: 'tel',
    icon: MessageCircle
  },
  {
    id: 'gmail',
    label: 'Gmail',
    inputLabel: 'Gmail / Email Address',
    placeholder: 'you@gmail.com',
    inputType: 'email',
    icon: Mail
  },
  {
    id: 'mobile',
    label: 'Mobile',
    inputLabel: 'Mobile Number (SMS)',
    placeholder: '+91 98765 43210',
    inputType: 'tel',
    icon: Smartphone
  }
];

export const AuthModal: React.FC = () => {
  const { authModalOpen, authModalMode, closeAuthModal, login, register, requestOtp, verifyOtp, settings } = useApp();

  const [authMethod, setAuthMethod] = useState<'otp' | 'password'>('otp');
  const [mode, setMode] = useState<'login' | 'register'>(authModalMode);

  // OTP state
  const [channel, setChannel] = useState<OtpChannel>('whatsapp');
  const [identifier, setIdentifier] = useState('');
  const [otpChallenge, setOtpChallenge] = useState<OtpRequestResult | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Shared / Password profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<UserGender>('male');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setMode(authModalMode);
    setError('');
    setOtpChallenge(null);
    setOtpDigits(['', '', '', '', '', '']);
    setResendCooldown(0);
  }, [authModalMode, authModalOpen]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!authModalOpen) return null;

  const activeChannel = OTP_CHANNELS.find((c) => c.id === channel) || OTP_CHANNELS[0];
  const otpValue = otpDigits.join('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await requestOtp({
        channel,
        identifier,
        mode,
        name: name.trim() || undefined,
        gender
      });
      setOtpChallenge(result);
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(15);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send 6-digit OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await requestOtp({
        channel,
        identifier,
        mode,
        name: name.trim() || undefined,
        gender
      });
      setOtpChallenge(result);
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(15);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split('');
      setOtpDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < 6; i++) {
          next[i] = pasted[i] || '';
        }
        return next;
      });
      const focusIdx = Math.min(pasted.length, 5);
      otpRefs.current[focusIdx]?.focus();
      return;
    }

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });
    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpChallenge) return;
    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits of your OTP code.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await verifyOtp({
        challengeId: otpChallenge.challengeId,
        otp: otpValue,
        name: !otpChallenge.existingAccount ? name.trim() || undefined : undefined,
        gender: !otpChallenge.existingAccount ? gender : undefined
      });
      setIdentifier('');
      setName('');
      setOtpChallenge(null);
      setOtpDigits(['', '', '', '', '', '']);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ name, email, password, phone, gender });
      }
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderGenderAvatarPicker = () => (
    <div>
      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        Select Gender &amp; 3D Anime Profile Avatar
      </label>
      <div className="grid grid-cols-2 gap-3">
        {(['male', 'female'] as UserGender[]).map((g) => {
          const item = ANIME_AVATARS[g];
          const selected = gender === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`p-2.5 rounded-xl border text-left flex items-center gap-3 transition-colors ${
                selected
                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/25'
                  : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
              }`}
            >
              <img
                src={item.src}
                alt={`${item.label} 3D Anime Avatar`}
                className="w-11 h-11 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  {item.label}
                  {selected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{item.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Account Authentication"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white">
              {authMethod === 'otp'
                ? otpChallenge
                  ? 'Verify 6-Digit OTP'
                  : `Sign in to ${settings?.brandName || 'KalaVault'}`
                : mode === 'login'
                  ? `Sign in to ${settings?.brandName || 'KalaVault'}`
                  : 'Create your account'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {authMethod === 'otp'
                ? 'Fast 6-digit OTP via WhatsApp, Gmail, or Mobile with 3D anime avatar.'
                : 'Access your purchased digital downloads, licenses, and order history.'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Close modal"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Method Switcher: 6-Digit OTP vs Email & Password */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('otp');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-1.5 ${
                authMethod === 'otp'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              6-Digit OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('password');
                setOtpChallenge(null);
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-1.5 ${
                authMethod === 'password'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Password
            </button>
          </div>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* FLOW 1: 6-DIGIT OTP (WHATSAPP / GMAIL / MOBILE) */}
          {authMethod === 'otp' && !otpChallenge && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              {/* Channel Selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Verify Via
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {OTP_CHANNELS.map(({ id, label, icon: Icon }) => {
                    const active = channel === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setChannel(id);
                          setIdentifier('');
                          setError('');
                        }}
                        className={`h-10 px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                          active
                            ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {activeChannel.inputLabel}
                </label>
                <input
                  type={activeChannel.inputType}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={activeChannel.placeholder}
                  className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Your Name (for new accounts)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Riya Sharma / Aarav Verma"
                  className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {renderGenderAvatarPicker()}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? 'Sending 6-Digit OTP...' : `Send 6-Digit OTP via ${activeChannel.label}`}
              </button>
            </form>
          )}

          {/* FLOW 1 STEP 2: ENTER 6-DIGIT OTP */}
          {authMethod === 'otp' && otpChallenge && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOtpChallenge(null);
                    setError('');
                  }}
                  className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change {activeChannel.label}
                </button>
                <span className="font-mono text-zinc-500 dark:text-zinc-400">{otpChallenge.maskedIdentifier}</span>
              </div>

              {/* Instant Preview OTP Display Box */}
              {otpChallenge.previewOtp && (
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Instant {activeChannel.label} OTP Preview
                    </p>
                    <p className="font-mono text-lg font-bold tracking-[0.25em] text-zinc-900 dark:text-white tabular-nums mt-0.5">
                      {otpChallenge.previewOtp}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const code = otpChallenge.previewOtp || '';
                      setOtpDigits(code.split('').slice(0, 6));
                    }}
                    className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 whitespace-nowrap shrink-0"
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Enter 6-Digit Verification Code
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      aria-label={`OTP digit ${idx + 1}`}
                      className="h-12 text-center font-mono text-lg font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
                    />
                  ))}
                </div>
              </div>

              {!otpChallenge.existingAccount && renderGenderAvatarPicker()}

              <button
                type="submit"
                disabled={submitting || otpValue.length !== 6}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? 'Verifying OTP...' : 'Verify 6-Digit OTP & Continue'}
              </button>

              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                <span>Valid for 5 minutes</span>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || submitting}
                  onClick={handleResendOtp}
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 disabled:text-zinc-400 hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {/* FLOW 2: CLASSIC EMAIL & PASSWORD */}
          {authMethod === 'password' && (
            <>
              <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    mode === 'login'
                      ? 'border-blue-600 text-zinc-900 dark:text-white'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    mode === 'register'
                      ? 'border-blue-600 text-zinc-900 dark:text-white'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Riya Sharma"
                      className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@studio.com"
                    className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Phone / WhatsApp Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {mode === 'register' && renderGenderAvatarPicker()}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            </>
          )}

          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Server-verified encrypted session
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
