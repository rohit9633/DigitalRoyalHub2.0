import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
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
  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    login,
    register,
    requestOtp,
    verifyOtp,
    requestPasswordReset,
    confirmPasswordReset,
    settings
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(authModalMode);
  const [authMethod, setAuthMethod] = useState<'otp' | 'password'>('password');

  // OTP state (for Login/Sign Up OTP & Forgot Password OTP)
  const [channel, setChannel] = useState<OtpChannel>('whatsapp');
  const [identifier, setIdentifier] = useState('');
  const [otpChallenge, setOtpChallenge] = useState<OtpRequestResult | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password state
  const [forgotChannel, setForgotChannel] = useState<OtpChannel>('gmail');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotChallenge, setForgotChallenge] = useState<OtpRequestResult | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Shared / Password profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<UserGender>('male');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successNote, setSuccessNote] = useState('');

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setMode(authModalMode);
    setError('');
    setSuccessNote('');
    setOtpChallenge(null);
    setForgotChallenge(null);
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
  const activeForgotChannel = OTP_CHANNELS.find((c) => c.id === forgotChannel) || OTP_CHANNELS[1];
  const otpValue = otpDigits.join('');

  const resetTransientStates = () => {
    setError('');
    setSuccessNote('');
    setOtpChallenge(null);
    setForgotChallenge(null);
    setOtpDigits(['', '', '', '', '', '']);
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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessNote('');
    setSubmitting(true);
    try {
      const result = await requestOtp({
        channel,
        identifier,
        mode: mode === 'register' ? 'register' : 'login',
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
        mode: mode === 'register' ? 'register' : 'login',
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
    setSuccessNote('');
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

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessNote('');
    setSubmitting(true);
    try {
      const result = await requestPasswordReset({
        channel: forgotChannel,
        identifier: forgotIdentifier
      });
      setForgotChallenge(result);
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(15);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotResend = async () => {
    if (resendCooldown > 0 || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await requestPasswordReset({
        channel: forgotChannel,
        identifier: forgotIdentifier
      });
      setForgotChallenge(result);
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(15);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend reset OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotChallenge) return;
    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits of your reset OTP.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const res = await confirmPasswordReset({
        challengeId: forgotChallenge.challengeId,
        otp: otpValue,
        newPassword
      });
      setForgotChallenge(null);
      setForgotIdentifier('');
      setNewPassword('');
      setConfirmNewPassword('');
      setOtpDigits(['', '', '', '', '', '']);
      if (res.email && !res.email.endsWith('@kalavault.member')) {
        setEmail(res.email);
      }
      setMode('login');
      setAuthMethod('password');
      setSuccessNote('Password reset successfully. You can now log in with your new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderGenderPicker = () => (
    <div>
      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Gender</label>
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
                alt={item.label}
                className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
              />
              <span className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                {item.label}
                {selected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderOtpDigitInputs = () => (
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
              {mode === 'forgot'
                ? 'Reset Password'
                : mode === 'register'
                  ? 'Create your account'
                  : `Login to ${settings?.brandName || 'KalaVault'}`}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {mode === 'forgot'
                ? 'Verify your account with a 6-digit OTP to set a new password.'
                : mode === 'register'
                  ? 'Sign up via Password or 6-digit OTP to track orders and downloads.'
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
          {/* Primary Top Tabs: Login vs Sign Up */}
          {mode !== 'forgot' && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  resetTransientStates();
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                  mode === 'login'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  resetTransientStates();
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                  mode === 'register'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Method Switcher: Password vs 6-Digit OTP */}
          {mode !== 'forgot' && (
            <div className="flex items-center gap-5 border-b border-zinc-200 dark:border-zinc-800 mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('password');
                  setOtpChallenge(null);
                  setError('');
                }}
                className={`pb-2.5 text-xs font-semibold border-b-2 inline-flex items-center gap-1.5 transition-colors ${
                  authMethod === 'password'
                    ? 'border-blue-600 text-zinc-900 dark:text-white'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Email &amp; Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('otp');
                  setError('');
                }}
                className={`pb-2.5 text-xs font-semibold border-b-2 inline-flex items-center gap-1.5 transition-colors ${
                  authMethod === 'otp'
                    ? 'border-blue-600 text-zinc-900 dark:text-white'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                6-Digit OTP
              </button>
            </div>
          )}

          {successNote && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successNote}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* FORGOT PASSWORD FLOW */}
          {mode === 'forgot' && !forgotChallenge && (
            <form onSubmit={handleForgotRequest} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setAuthMethod('password');
                  resetTransientStates();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Login
              </button>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Send Reset OTP Via
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {OTP_CHANNELS.map(({ id, label, icon: Icon }) => {
                    const active = forgotChannel === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setForgotChannel(id);
                          setForgotIdentifier('');
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
                  Registered {activeForgotChannel.inputLabel}
                </label>
                <input
                  type={activeForgotChannel.inputType}
                  required
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder={activeForgotChannel.placeholder}
                  className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? 'Sending Reset OTP...' : 'Send 6-Digit Reset OTP'}
              </button>
            </form>
          )}

          {mode === 'forgot' && forgotChallenge && (
            <form onSubmit={handleForgotResetSubmit} className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setForgotChallenge(null);
                    setError('');
                  }}
                  className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change {activeForgotChannel.label}
                </button>
                <span className="font-mono text-zinc-500 dark:text-zinc-400">{forgotChallenge.maskedIdentifier}</span>
              </div>

              {forgotChallenge.previewOtp && (
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Instant Reset OTP Preview
                    </p>
                    <p className="font-mono text-lg font-bold tracking-[0.25em] text-zinc-900 dark:text-white tabular-nums mt-0.5">
                      {forgotChallenge.previewOtp}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const code = forgotChallenge.previewOtp || '';
                      setOtpDigits(code.split('').slice(0, 6));
                    }}
                    className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 whitespace-nowrap shrink-0"
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              {renderOtpDigitInputs()}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || otpValue.length !== 6}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? 'Updating Password...' : 'Reset Password'}
              </button>

              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                <span>Valid for 5 minutes</span>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || submitting}
                  onClick={handleForgotResend}
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 disabled:text-zinc-400 hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {/* FLOW 1: 6-DIGIT OTP (WHATSAPP / GMAIL / MOBILE) */}
          {mode !== 'forgot' && authMethod === 'otp' && !otpChallenge && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Verify Via</label>
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

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Riya Sharma / Aarav Verma"
                    className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

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

              {mode === 'register' && renderGenderPicker()}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? 'Sending 6-Digit OTP...' : `Send 6-Digit OTP via ${activeChannel.label}`}
              </button>
            </form>
          )}

          {mode !== 'forgot' && authMethod === 'otp' && otpChallenge && (
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

              {renderOtpDigitInputs()}

              {!otpChallenge.existingAccount && renderGenderPicker()}

              <button
                type="submit"
                disabled={submitting || otpValue.length !== 6}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? 'Verifying OTP...' : mode === 'register' ? 'Verify & Sign Up' : 'Verify & Login'}
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

          {/* FLOW 2: EMAIL & PASSWORD */}
          {mode !== 'forgot' && authMethod === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Full Name</label>
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setForgotChannel('gmail');
                        setForgotIdentifier(email);
                        resetTransientStates();
                      }}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
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

              {mode === 'register' && renderGenderPicker()}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </form>
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
