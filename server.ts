import crypto from 'crypto';
import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  consumeSseTicket,
  createSessionToken,
  extractBearerUser,
  getUserById,
  hashOtpCode,
  hashPassword,
  issueSseTicket,
  requireAdmin,
  requireAuth,
  signSandboxPayment,
  verifyHmacSignature,
  verifyOtpCode,
  verifyPassword,
  verifySandboxSignature
} from './server/auth.ts';
import type { AuthedRequest } from './server/auth.ts';
import {
  db,
  generateLicenseKey,
  getSiteSettings,
  initDatabase,
  normalizeGender,
  resolveDefaultAvatar,
  sanitizeUrl,
  saveSiteSettings
} from './server/db.ts';
import {
  broadcastPublicEvent,
  notifyAdmins,
  notifyUser,
  registerSseClient,
  removeSseClient
} from './server/sse.ts';

initDatabase();

const app = express();
app.use(express.json({ limit: '1mb' }));

const ALLOWED_ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Delivered', 'Cancelled', 'Refunded'] as const;
type OrderStatus = (typeof ALLOWED_ORDER_STATUSES)[number];

function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_ID.trim().length > 4 &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_KEY_SECRET.trim().length > 4
  );
}

function getAdminStatus(): { claimed: boolean; envConfigured: boolean } {
  const envConfigured = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
  const adminRow = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  return {
    claimed: Boolean(adminRow),
    envConfigured
  };
}

function hydrateProducts() {
  const products = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.featured DESC, p.created_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const reviewStats = db
    .prepare(
      `SELECT product_id, COUNT(*) as review_count, ROUND(AVG(rating), 2) as avg_rating
       FROM reviews
       GROUP BY product_id`
    )
    .all() as Array<{ product_id: string; review_count: number; avg_rating: number }>;

  const statsMap = new Map(reviewStats.map((r) => [r.product_id, r]));

  return products.map((p) => {
    const stat = statsMap.get(String(p.id));
    let highlights: string[] = [];
    try {
      highlights = JSON.parse(String(p.highlights_json || '[]'));
    } catch {
      highlights = [];
    }
    return {
      ...p,
      id: String(p.id),
      featured: Boolean(p.featured),
      published: Boolean(p.published),
      highlights,
      review_count: stat ? stat.review_count : 0,
      avg_rating: stat ? stat.avg_rating : 0
    };
  });
}

function hydrateOrderWithItems(orderId: string) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  return {
    ...order,
    payment_verified: Boolean(order.payment_verified),
    items
  };
}

function createOrderNotification(userId: string, title: string, message: string, orderId: string) {
  const id = `notif-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO notifications (id, user_id, title, message, order_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(id, userId, title, message, orderId, createdAt);
  const notif = { id, user_id: userId, title, message, order_id: orderId, read: false, created_at: createdAt };
  notifyUser(userId, 'notification', notif);
  return notif;
}

// ============================================================================
// PUBLIC BOOTSTRAP & CATALOG ROUTES
// ============================================================================

app.get('/api/bootstrap', (req: Request, res: Response) => {
  const user = extractBearerUser(req);
  const settings = getSiteSettings();
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
  const allProducts = hydrateProducts();
  const products = user?.role === 'admin' ? allProducts : allProducts.filter((p) => p.published);
  const adminStatus = getAdminStatus();

  res.json({
    settings,
    categories,
    products,
    user,
    adminStatus,
    razorpayConfigured: isRazorpayConfigured()
  });
});

app.get('/api/products/:id/reviews', (req: Request, res: Response) => {
  const productId = String(req.params.id || '');
  const reviews = db
    .prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC')
    .all(productId) as Array<Record<string, unknown>>;
  res.json({
    reviews: reviews.map((r) => ({ ...r, verified_purchase: Boolean(r.verified_purchase) }))
  });
});

// ============================================================================
// AUTHENTICATION & ADMIN CLAIM ROUTES
// ============================================================================

app.get('/api/auth/admin-status', (_req: Request, res: Response) => {
  res.json(getAdminStatus());
});

app.post('/api/auth/claim-admin', (req: Request, res: Response) => {
  const status = getAdminStatus();
  if (status.envConfigured) {
    res.status(409).json({ error: 'Admin password is already managed by server environment configuration.' });
    return;
  }
  if (status.claimed) {
    res.status(409).json({ error: 'Administrator account has already been claimed. Please sign in.' });
    return;
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : 'Studio Admin';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 120) : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Please provide a valid administrator email address.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Admin password must be at least 8 characters long.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  let adminId: string;
  if (existing) {
    adminId = existing.id;
    db.prepare("UPDATE users SET name = ?, password_hash = ?, role = 'admin' WHERE id = ?").run(
      name || 'Studio Admin',
      passwordHash,
      adminId
    );
  } else {
    adminId = `usr-admin-${crypto.randomUUID()}`;
    db.prepare(
      "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)"
    ).run(adminId, name || 'Studio Admin', email, passwordHash, now);
  }

  const user = getUserById(adminId)!;
  const token = createSessionToken(user.id, user.role);
  res.status(201).json({ token, user, adminStatus: getAdminStatus() });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 120) : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 30) : '';
  const gender = normalizeGender(req.body?.gender);
  const avatarUrl = resolveDefaultAvatar(gender);

  if (!name || name.length < 2) {
    res.status(400).json({ error: 'Please enter your full name.' });
    return;
  }
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) {
    res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    return;
  }

  const id = `usr-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, role, phone, gender, avatar_url, created_at) VALUES (?, ?, ?, ?, 'customer', ?, ?, ?, ?)"
  ).run(id, name, email, hashPassword(password), phone, gender, avatarUrl, now);

  const user = getUserById(id)!;
  const token = createSessionToken(user.id, user.role);
  res.status(201).json({ token, user });
});

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function formatCanonicalPhone(digits: string): string {
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function maskIdentifier(channel: 'whatsapp' | 'gmail' | 'mobile', identifier: string): string {
  if (channel === 'gmail') {
    const [local, domain] = identifier.split('@');
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
  }
  const visibleEnd = identifier.slice(-4);
  return `${identifier.slice(0, 3)}••••${visibleEnd}`;
}

function findUserByOtpIdentifier(
  channel: 'whatsapp' | 'gmail' | 'mobile',
  canonicalIdentifier: string
): { id: string; role: string } | undefined {
  if (channel === 'gmail') {
    return db.prepare('SELECT id, role FROM users WHERE LOWER(email) = ?').get(canonicalIdentifier) as
      | { id: string; role: string }
      | undefined;
  }
  const targetDigits = normalizePhoneDigits(canonicalIdentifier);
  const last10 = targetDigits.slice(-10);
  const rows = db.prepare("SELECT id, role, phone FROM users WHERE phone != ''").all() as Array<{
    id: string;
    role: string;
    phone: string;
  }>;
  return rows.find((r) => {
    const d = normalizePhoneDigits(r.phone);
    return d === targetDigits || (last10.length === 10 && d.endsWith(last10));
  });
}

app.post('/api/auth/otp/request', (req: Request, res: Response) => {
  const rawChannel = typeof req.body?.channel === 'string' ? req.body.channel.trim().toLowerCase() : '';
  if (rawChannel !== 'whatsapp' && rawChannel !== 'gmail' && rawChannel !== 'mobile') {
    res.status(400).json({ error: 'Choose WhatsApp, Gmail, or Mobile for 6-digit OTP verification.' });
    return;
  }
  const channel = rawChannel as 'whatsapp' | 'gmail' | 'mobile';
  const rawIdentifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().slice(0, 120) : '';
  const pendingName = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  const pendingGender = normalizeGender(req.body?.gender);
  const mode = req.body?.mode === 'register' ? 'register' : 'login';

  let canonicalIdentifier = '';
  if (channel === 'gmail') {
    canonicalIdentifier = rawIdentifier.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonicalIdentifier)) {
      res.status(400).json({ error: 'Please enter a valid Gmail or email address.' });
      return;
    }
  } else {
    const digits = normalizePhoneDigits(rawIdentifier);
    if (digits.length < 10 || digits.length > 15) {
      res.status(400).json({
        error:
          channel === 'whatsapp'
            ? 'Please enter a valid 10-digit WhatsApp number.'
            : 'Please enter a valid 10-digit mobile number.'
      });
      return;
    }
    canonicalIdentifier = formatCanonicalPhone(digits);
  }

  const existing = findUserByOtpIdentifier(channel, canonicalIdentifier);
  if (existing && existing.role === 'admin') {
    res.status(403).json({ error: 'Administrator accounts must sign in via the dedicated admin portal.' });
    return;
  }

  // Per-identifier rate limiting (max 5 OTPs per 10 minutes, 15s cooldown)
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recentCount = (
    db
      .prepare('SELECT COUNT(*) as c FROM otp_challenges WHERE identifier = ? AND created_at >= ?')
      .get(canonicalIdentifier, tenMinAgo) as { c: number }
  ).c;
  if (recentCount >= 5) {
    res.status(429).json({ error: 'Too many OTP requests. Please wait a few minutes before retrying.' });
    return;
  }

  const latestChallenge = db
    .prepare('SELECT created_at FROM otp_challenges WHERE identifier = ? ORDER BY created_at DESC LIMIT 1')
    .get(canonicalIdentifier) as { created_at: string } | undefined;
  if (latestChallenge && Date.now() - new Date(latestChallenge.created_at).getTime() < 15_000) {
    res.status(429).json({ error: 'Please wait 15 seconds before requesting another 6-digit OTP.' });
    return;
  }

  // Invalidate any previous unconsumed challenges for this identifier
  db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE identifier = ? AND consumed = 0').run(canonicalIdentifier);

  const challengeId = `otp-${crypto.randomUUID()}`;
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashOtpCode(challengeId, otpCode);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  db.prepare(
    `INSERT INTO otp_challenges (
      id, channel, identifier, code_hash, mode, pending_name, pending_gender, attempts, consumed, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
  ).run(
    challengeId,
    channel,
    canonicalIdentifier,
    codeHash,
    mode,
    pendingName,
    pendingGender,
    expiresAt.toISOString(),
    now.toISOString()
  );

  res.status(201).json({
    challengeId,
    channel,
    maskedIdentifier: maskIdentifier(channel, canonicalIdentifier),
    expiresInSeconds: 300,
    existingAccount: Boolean(existing),
    deliveryMode: 'instant_preview',
    previewOtp: otpCode
  });
});

app.post('/api/auth/otp/verify', (req: Request, res: Response) => {
  const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.replace(/\D/g, '') : '';
  const overrideName = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  const overrideGender = req.body?.gender ? normalizeGender(req.body.gender) : null;

  if (!challengeId || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ error: 'Please enter a valid 6-digit OTP code.' });
    return;
  }

  const challenge = db.prepare('SELECT * FROM otp_challenges WHERE id = ?').get(challengeId) as
    | {
        id: string;
        channel: 'whatsapp' | 'gmail' | 'mobile';
        identifier: string;
        code_hash: string;
        mode: string;
        pending_name: string;
        pending_gender: string;
        attempts: number;
        consumed: number;
        expires_at: string;
      }
    | undefined;

  if (!challenge || challenge.consumed || challenge.mode === 'reset') {
    res.status(400).json({ error: 'This OTP session has expired or was already used. Please request a new OTP.' });
    return;
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);
    res.status(400).json({ error: 'This 6-digit OTP has expired. Please request a fresh code.' });
    return;
  }
  if (challenge.attempts >= 5) {
    db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);
    res.status(429).json({ error: 'Too many incorrect OTP attempts. Please request a new 6-digit code.' });
    return;
  }

  const valid = verifyOtpCode(challenge.id, otp, challenge.code_hash);
  if (!valid) {
    const nextAttempts = challenge.attempts + 1;
    db.prepare('UPDATE otp_challenges SET attempts = ? WHERE id = ?').run(nextAttempts, challenge.id);
    const remaining = Math.max(0, 5 - nextAttempts);
    res.status(401).json({
      error:
        remaining > 0
          ? `Incorrect 6-digit OTP. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`
          : 'Too many incorrect attempts. Please request a new OTP.'
    });
    return;
  }

  db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);

  const existing = findUserByOtpIdentifier(challenge.channel, challenge.identifier);
  if (existing) {
    if (existing.role === 'admin') {
      res.status(403).json({ error: 'Administrator accounts must sign in via the dedicated admin portal.' });
      return;
    }
    if (overrideGender) {
      db.prepare('UPDATE users SET gender = ?, avatar_url = ? WHERE id = ?').run(
        overrideGender,
        resolveDefaultAvatar(overrideGender),
        existing.id
      );
    }
    const user = getUserById(existing.id)!;
    const token = createSessionToken(user.id, user.role);
    res.json({ token, user, isNewUser: false });
    return;
  }

  // Auto-create verified customer account with chosen gender & 3D anime avatar
  const gender = overrideGender || normalizeGender(challenge.pending_gender);
  const avatarUrl = resolveDefaultAvatar(gender);
  const finalName =
    overrideName ||
    challenge.pending_name ||
    (challenge.channel === 'gmail'
      ? challenge.identifier.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : `Member ${challenge.identifier.slice(-4)}`);

  const email =
    challenge.channel === 'gmail'
      ? challenge.identifier
      : `user.${normalizePhoneDigits(challenge.identifier)}@kalavault.member`;
  const phone = challenge.channel === 'gmail' ? '' : challenge.identifier;

  const id = `usr-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const otpOnlyHash = `locked:otp:${crypto.randomBytes(16).toString('hex')}`;

  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, role, phone, gender, avatar_url, created_at) VALUES (?, ?, ?, ?, 'customer', ?, ?, ?, ?)"
  ).run(id, finalName, email, otpOnlyHash, phone, gender, avatarUrl, now);

  const user = getUserById(id)!;
  const token = createSessionToken(user.id, user.role);
  res.status(201).json({ token, user, isNewUser: true });
});

app.post('/api/auth/forgot-password/request', (req: Request, res: Response) => {
  const rawChannel = typeof req.body?.channel === 'string' ? req.body.channel.trim().toLowerCase() : 'gmail';
  if (rawChannel !== 'whatsapp' && rawChannel !== 'gmail' && rawChannel !== 'mobile') {
    res.status(400).json({ error: 'Choose Email/Gmail, WhatsApp, or Mobile to receive your reset OTP.' });
    return;
  }
  const channel = rawChannel as 'whatsapp' | 'gmail' | 'mobile';
  const rawIdentifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().slice(0, 120) : '';

  let canonicalIdentifier = '';
  if (channel === 'gmail') {
    canonicalIdentifier = rawIdentifier.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonicalIdentifier)) {
      res.status(400).json({ error: 'Please enter a valid registered email address.' });
      return;
    }
  } else {
    const digits = normalizePhoneDigits(rawIdentifier);
    if (digits.length < 10 || digits.length > 15) {
      res.status(400).json({ error: 'Please enter a valid 10-digit registered number.' });
      return;
    }
    canonicalIdentifier = formatCanonicalPhone(digits);
  }

  const existing = findUserByOtpIdentifier(channel, canonicalIdentifier);
  if (!existing) {
    res.status(404).json({ error: 'No account found with those details. Please check or create a new account.' });
    return;
  }
  if (existing.role === 'admin') {
    res.status(403).json({ error: 'Administrator passwords cannot be reset here.' });
    return;
  }

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recentCount = (
    db
      .prepare('SELECT COUNT(*) as c FROM otp_challenges WHERE identifier = ? AND created_at >= ?')
      .get(canonicalIdentifier, tenMinAgo) as { c: number }
  ).c;
  if (recentCount >= 5) {
    res.status(429).json({ error: 'Too many reset requests. Please wait a few minutes before retrying.' });
    return;
  }

  const latestChallenge = db
    .prepare('SELECT created_at FROM otp_challenges WHERE identifier = ? ORDER BY created_at DESC LIMIT 1')
    .get(canonicalIdentifier) as { created_at: string } | undefined;
  if (latestChallenge && Date.now() - new Date(latestChallenge.created_at).getTime() < 15_000) {
    res.status(429).json({ error: 'Please wait 15 seconds before requesting another reset OTP.' });
    return;
  }

  db.prepare("UPDATE otp_challenges SET consumed = 1 WHERE identifier = ? AND mode = 'reset' AND consumed = 0").run(
    canonicalIdentifier
  );

  const challengeId = `rst-${crypto.randomUUID()}`;
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashOtpCode(challengeId, otpCode);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  db.prepare(
    `INSERT INTO otp_challenges (
      id, channel, identifier, code_hash, mode, pending_name, pending_gender, attempts, consumed, expires_at, created_at
    ) VALUES (?, ?, ?, ?, 'reset', '', 'male', 0, 0, ?, ?)`
  ).run(challengeId, channel, canonicalIdentifier, codeHash, expiresAt.toISOString(), now.toISOString());

  res.status(201).json({
    challengeId,
    channel,
    maskedIdentifier: maskIdentifier(channel, canonicalIdentifier),
    expiresInSeconds: 300,
    deliveryMode: 'instant_preview',
    previewOtp: otpCode
  });
});

app.post('/api/auth/forgot-password/reset', (req: Request, res: Response) => {
  const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.replace(/\D/g, '') : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!challengeId || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ error: 'Please enter a valid 6-digit reset OTP.' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    return;
  }

  const challenge = db.prepare('SELECT * FROM otp_challenges WHERE id = ?').get(challengeId) as
    | {
        id: string;
        channel: 'whatsapp' | 'gmail' | 'mobile';
        identifier: string;
        code_hash: string;
        mode: string;
        attempts: number;
        consumed: number;
        expires_at: string;
      }
    | undefined;

  if (!challenge || challenge.consumed || challenge.mode !== 'reset') {
    res.status(400).json({ error: 'This reset session has expired or was already used. Please request a new OTP.' });
    return;
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);
    res.status(400).json({ error: 'This reset OTP has expired. Please request a fresh code.' });
    return;
  }
  if (challenge.attempts >= 5) {
    db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);
    res.status(429).json({ error: 'Too many incorrect OTP attempts. Please request a new code.' });
    return;
  }

  if (!verifyOtpCode(challenge.id, otp, challenge.code_hash)) {
    const nextAttempts = challenge.attempts + 1;
    db.prepare('UPDATE otp_challenges SET attempts = ? WHERE id = ?').run(nextAttempts, challenge.id);
    const remaining = Math.max(0, 5 - nextAttempts);
    res.status(401).json({
      error:
        remaining > 0
          ? `Incorrect 6-digit OTP. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`
          : 'Too many incorrect attempts. Please request a new reset OTP.'
    });
    return;
  }

  db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);

  const existing = findUserByOtpIdentifier(challenge.channel, challenge.identifier);
  if (!existing || existing.role === 'admin') {
    res.status(404).json({ error: 'Account could not be updated.' });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), existing.id);
  const updatedUser = getUserById(existing.id);

  res.json({
    ok: true,
    email: updatedUser?.email || ''
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 120) : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const asAdmin = Boolean(req.body?.asAdmin);

  const envAdminPass = process.env.ADMIN_PASSWORD?.trim() || '';

  // Support env ADMIN_PASSWORD override for admin sign-in
  if (asAdmin && envAdminPass.length > 0) {
    const a = Buffer.from(password);
    const b = Buffer.from(envAdminPass);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      let adminRow = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as
        | { id: string }
        | undefined;
      if (!adminRow) {
        const adminId = `usr-admin-${crypto.randomUUID()}`;
        const adminEmail = email && email.includes('@') ? email : 'admin@kalavault.studio';
        db.prepare(
          "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)"
        ).run(adminId, 'Studio Admin', adminEmail, hashPassword(envAdminPass), new Date().toISOString());
        adminRow = { id: adminId };
      }
      const user = getUserById(adminRow.id)!;
      const token = createSessionToken(user.id, user.role);
      res.json({ token, user });
      return;
    }
    res.status(401).json({ error: 'Invalid administrator credentials.' });
    return;
  }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = db.prepare('SELECT id, password_hash, role FROM users WHERE email = ?').get(email) as
    | { id: string; password_hash: string; role: string }
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (asAdmin && row.role !== 'admin') {
    res.status(403).json({ error: 'This account does not have administrator permissions.' });
    return;
  }

  const user = getUserById(row.id)!;
  const token = createSessionToken(user.id, user.role);
  res.json({ token, user });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
  res.json({ user: req.user });
});

// ============================================================================
// USER PROFILE & NOTIFICATIONS ROUTES
// ============================================================================

app.put('/api/profile', requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : user.name;
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 30) : user.phone;
  const gender = req.body?.gender !== undefined ? normalizeGender(req.body.gender) : user.gender;
  const avatarUrl = resolveDefaultAvatar(gender);
  const company = typeof req.body?.company === 'string' ? req.body.company.trim().slice(0, 100) : user.company;
  const billingAddress =
    typeof req.body?.billing_address === 'string'
      ? req.body.billing_address.trim().slice(0, 300)
      : user.billing_address;
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim().slice(0, 280) : user.bio;
  const pushEnabled = typeof req.body?.push_enabled === 'boolean' ? (req.body.push_enabled ? 1 : 0) : user.push_enabled;

  if (!name || name.length < 2) {
    res.status(400).json({ error: 'Display name must be at least 2 characters.' });
    return;
  }

  db.prepare(
    'UPDATE users SET name = ?, phone = ?, gender = ?, avatar_url = ?, company = ?, billing_address = ?, bio = ?, push_enabled = ? WHERE id = ?'
  ).run(name, phone, gender, avatarUrl, company, billingAddress, bio, pushEnabled, user.id);

  // Optional password update
  if (typeof req.body?.newPassword === 'string' && req.body.newPassword.length > 0) {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const stored = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as {
      password_hash: string;
    };
    if (!stored.password_hash.startsWith('locked:otp:') && !verifyPassword(currentPassword, stored.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (req.body.newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(req.body.newPassword), user.id);
  }

  res.json({ user: getUserById(user.id) });
});

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40')
    .all(req.user!.id) as Array<Record<string, unknown>>;
  res.json({
    notifications: rows.map((r) => ({ ...r, read: Boolean(r.read) }))
  });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res: Response) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true });
});

// ============================================================================
// REAL-TIME SSE STREAM (LIVE ORDERS & PUSH NOTIFICATIONS)
// ============================================================================

app.post('/api/events/ticket', requireAuth, (req: AuthedRequest, res: Response) => {
  const ticket = issueSseTicket(req.user!.id, req.user!.role);
  res.json({ ticket });
});

app.get('/api/events', (req: Request, res: Response) => {
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';
  let userId: string | null = null;
  let role: 'admin' | 'customer' | 'guest' = 'guest';

  if (ticket) {
    const parsed = consumeSseTicket(ticket);
    if (parsed) {
      userId = parsed.userId;
      role = parsed.role;
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = crypto.randomUUID();
  registerSseClient(clientId, userId, role, res);

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, role })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeSseClient(clientId);
  });
});

// ============================================================================
// REVIEWS ROUTES
// ============================================================================

app.post('/api/products/:id/reviews', requireAuth, (req: AuthedRequest, res: Response) => {
  const productId = String(req.params.id || '');
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const rating = Number(req.body?.rating);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 1200) : '';

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    return;
  }
  if (!title || title.length < 3) {
    res.status(400).json({ error: 'Please add a short review headline.' });
    return;
  }
  if (!comment || comment.length < 8) {
    res.status(400).json({ error: 'Please write at least a brief review comment.' });
    return;
  }

  const purchased = db
    .prepare(
      `SELECT oi.id FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.product_id = ? AND o.payment_verified = 1
       LIMIT 1`
    )
    .get(req.user!.id, productId);

  const id = `rev-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO reviews (id, product_id, user_id, user_name, rating, title, comment, verified_purchase, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, productId, req.user!.id, req.user!.name, rating, title, comment, purchased ? 1 : 0, now);

  broadcastPublicEvent('catalog_updated', { productId });

  res.status(201).json({
    review: {
      id,
      product_id: productId,
      user_id: req.user!.id,
      user_name: req.user!.name,
      rating,
      title,
      comment,
      verified_purchase: Boolean(purchased),
      created_at: now
    }
  });
});

// ============================================================================
// RAZORPAY CHECKOUT & ORDER MANAGEMENT ROUTES
// ============================================================================

app.post('/api/payments/razorpay/create-order', requireAuth, async (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  if (rawItems.length === 0 || rawItems.length > 25) {
    res.status(400).json({ error: 'Your cart is empty or exceeds the item limit.' });
    return;
  }

  const customerName =
    typeof req.body?.customerName === 'string' && req.body.customerName.trim()
      ? req.body.customerName.trim().slice(0, 100)
      : user.name;
  const customerPhone =
    typeof req.body?.customerPhone === 'string' ? req.body.customerPhone.trim().slice(0, 30) : user.phone;
  const billingAddress =
    typeof req.body?.billingAddress === 'string'
      ? req.body.billingAddress.trim().slice(0, 300)
      : user.billing_address;

  const validatedItems: Array<{
    productId: string;
    title: string;
    imageUrl: string;
    fileFormat: string;
    version: string;
    licenseType: 'Personal' | 'Commercial';
    unitPrice: number;
    quantity: number;
  }> = [];

  for (const item of rawItems) {
    const productId = typeof item?.productId === 'string' ? item.productId : '';
    const licenseType = item?.licenseType === 'Commercial' ? 'Commercial' : 'Personal';
    const quantity = Math.min(Math.max(Number(item?.quantity) || 1, 1), 10);
    const prod = db.prepare('SELECT * FROM products WHERE id = ? AND published = 1').get(productId) as
      | Record<string, unknown>
      | undefined;
    if (!prod) {
      res.status(400).json({ error: 'One or more products in your cart are no longer available.' });
      return;
    }
    const unitPrice = licenseType === 'Commercial' ? Number(prod.commercial_price) : Number(prod.price);
    validatedItems.push({
      productId: String(prod.id),
      title: String(prod.title),
      imageUrl: String(prod.image_url),
      fileFormat: String(prod.file_format),
      version: String(prod.version),
      licenseType,
      unitPrice,
      quantity
    });
  }

  const subtotal = validatedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const tax = 0; // Digital price inclusive
  const total = subtotal + tax;
  const settings = getSiteSettings();
  const currency = settings.currencyCode === 'USD' ? 'USD' : 'INR';

  const orderId = `ord-${crypto.randomUUID()}`;
  const orderNumber = `KV-${Date.now().toString().slice(-6)}-${crypto.randomInt(100, 999)}`;
  const now = new Date().toISOString();

  let razorpayOrderId = `order_sandbox_${crypto.randomBytes(6).toString('hex')}`;
  let mode: 'live' | 'sandbox' = 'sandbox';
  let keyId = '';

  if (isRazorpayConfigured()) {
    try {
      const rzpKeyId = process.env.RAZORPAY_KEY_ID!.trim();
      const rzpSecret = process.env.RAZORPAY_KEY_SECRET!.trim();
      const authHeader = Buffer.from(`${rzpKeyId}:${rzpSecret}`).toString('base64');

      const rzpResp = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: total * 100, // Razorpay expects smallest currency unit (paise/cents)
          currency,
          receipt: orderNumber,
          notes: {
            appOrderId: orderId,
            customerEmail: user.email
          }
        })
      });

      if (!rzpResp.ok) {
        const errBody = await rzpResp.text();
        console.error('Razorpay order creation failed:', errBody);
        res.status(502).json({ error: 'Razorpay rejected the order creation request. Please verify API keys.' });
        return;
      }

      const rzpData = (await rzpResp.json()) as { id: string };
      razorpayOrderId = rzpData.id;
      mode = 'live';
      keyId = rzpKeyId;
    } catch (err) {
      console.error('Razorpay network error:', err);
      res.status(502).json({ error: 'Could not reach Razorpay payment gateway. Please try again.' });
      return;
    }
  }

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, order_number, user_id, customer_name, customer_email, customer_phone, billing_address,
      subtotal, tax, total, currency, status, status_note, payment_method, payment_mode,
      razorpay_order_id, razorpay_payment_id, payment_verified, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Awaiting Razorpay confirmation', 'Razorpay', ?, ?, '', 0, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (
      id, order_id, product_id, product_title, product_image, file_format, version,
      license_type, unit_price, quantity, license_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    insertOrder.run(
      orderId,
      orderNumber,
      user.id,
      customerName,
      user.email,
      customerPhone,
      billingAddress,
      subtotal,
      tax,
      total,
      currency,
      mode,
      razorpayOrderId,
      now,
      now
    );
    for (const item of validatedItems) {
      insertItem.run(
        `oi-${crypto.randomUUID()}`,
        orderId,
        item.productId,
        item.title,
        item.imageUrl,
        item.fileFormat,
        item.version,
        item.licenseType,
        item.unitPrice,
        item.quantity,
        generateLicenseKey(item.licenseType === 'Commercial' ? 'KVC' : 'KVP')
      );
    }
  });
  tx();

  // Save updated contact details back to profile if empty
  if (customerPhone || billingAddress) {
    try {
      db.prepare(
        "UPDATE users SET phone = COALESCE(NULLIF(phone, ''), ?), billing_address = COALESCE(NULLIF(billing_address, ''), ?) WHERE id = ?"
      ).run(customerPhone, billingAddress, user.id);
    } catch (profileErr) {
      console.error('Non-fatal profile contact update error:', profileErr);
    }
  }

  const sandboxPaymentId = mode === 'sandbox' ? `pay_sandbox_${crypto.randomBytes(6).toString('hex')}` : '';
  const sandboxSignature = mode === 'sandbox' ? signSandboxPayment(razorpayOrderId, sandboxPaymentId) : '';

  res.status(201).json({
    orderId,
    orderNumber,
    amount: total * 100,
    displayTotal: total,
    currency,
    mode,
    keyId,
    razorpayOrderId,
    sandboxPayload:
      mode === 'sandbox'
        ? {
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: sandboxPaymentId,
            razorpay_signature: sandboxSignature
          }
        : undefined
  });
});

app.post('/api/payments/razorpay/verify', requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : '';
  const razorpayOrderId = typeof req.body?.razorpay_order_id === 'string' ? req.body.razorpay_order_id : '';
  const razorpayPaymentId = typeof req.body?.razorpay_payment_id === 'string' ? req.body.razorpay_payment_id : '';
  const razorpaySignature = typeof req.body?.razorpay_signature === 'string' ? req.body.razorpay_signature : '';

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, user.id) as
    | Record<string, unknown>
    | undefined;

  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  if (String(order.razorpay_order_id) !== razorpayOrderId) {
    res.status(400).json({ error: 'Razorpay order mismatch.' });
    return;
  }

  let valid = false;
  if (order.payment_mode === 'live' && isRazorpayConfigured()) {
    valid = verifyHmacSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      process.env.RAZORPAY_KEY_SECRET!.trim()
    );
  } else if (order.payment_mode === 'sandbox') {
    valid = verifySandboxSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  }

  if (!valid) {
    res.status(400).json({ error: 'Payment signature verification failed.' });
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE orders
       SET status = 'Delivered',
           status_note = 'Payment verified via Razorpay · Digital license & downloads unlocked',
           razorpay_payment_id = ?,
           payment_verified = 1,
           updated_at = ?
       WHERE id = ?`
    ).run(razorpayPaymentId, now, orderId);

    const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId) as Array<{
      product_id: string;
      quantity: number;
    }>;
    for (const item of items) {
      db.prepare('UPDATE products SET sales_count = sales_count + ? WHERE id = ?').run(item.quantity, item.product_id);
    }
  });
  tx();

  const hydrated = hydrateOrderWithItems(orderId)!;

  createOrderNotification(
    user.id,
    `Order ${String(order.order_number)} Confirmed`,
    'Your Razorpay payment was verified and your digital files & license keys are ready in My Library.',
    orderId
  );

  notifyAdmins('order_created', hydrated);
  notifyUser(user.id, 'order_updated', hydrated);

  res.json({ order: hydrated });
});

app.post('/api/payments/razorpay/create-payment-link', requireAuth, async (req: AuthedRequest, res: Response) => {
  if (!isRazorpayConfigured()) {
    res.status(400).json({ error: 'Razorpay live credentials are not configured on the server.' });
    return;
  }

  const user = req.user!;
  const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : '';
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, user.id) as
    | Record<string, unknown>
    | undefined;

  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  if (order.payment_verified) {
    res.json({ alreadyPaid: true, order: hydrateOrderWithItems(orderId) });
    return;
  }

  try {
    const rzpKeyId = process.env.RAZORPAY_KEY_ID!.trim();
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET!.trim();
    const authHeader = Buffer.from(`${rzpKeyId}:${rzpSecret}`).toString('base64');
    const settings = getSiteSettings();

    const rzpResp = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Number(order.total) * 100,
        currency: String(order.currency || 'INR'),
        reference_id: String(order.order_number),
        description: `${settings.brandName} Order ${String(order.order_number)}`,
        customer: {
          name: String(order.customer_name || user.name),
          email: String(order.customer_email || user.email),
          ...(order.customer_phone ? { contact: String(order.customer_phone) } : {})
        },
        notify: {
          sms: false,
          email: true
        },
        reminder_enable: false,
        notes: {
          appOrderId: orderId,
          orderNumber: String(order.order_number)
        }
      })
    });

    if (!rzpResp.ok) {
      const errText = await rzpResp.text();
      console.error('Razorpay payment link creation failed:', errText);
      res.status(502).json({ error: 'Could not create Razorpay hosted payment link. Please retry checkout.' });
      return;
    }

    const linkData = (await rzpResp.json()) as { id: string; short_url: string };
    const safeUrl = sanitizeUrl(linkData.short_url);
    if (!safeUrl) {
      res.status(502).json({ error: 'Invalid hosted checkout URL returned by Razorpay.' });
      return;
    }

    res.json({
      paymentLinkId: linkData.id,
      shortUrl: safeUrl
    });
  } catch (err) {
    console.error('Razorpay payment link network error:', err);
    res.status(502).json({ error: 'Unable to reach Razorpay hosted checkout right now.' });
  }
});

app.post('/api/payments/razorpay/verify-payment-link', requireAuth, async (req: AuthedRequest, res: Response) => {
  if (!isRazorpayConfigured()) {
    res.status(400).json({ error: 'Razorpay live credentials are not configured.' });
    return;
  }

  const user = req.user!;
  const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : '';
  const paymentLinkId = typeof req.body?.paymentLinkId === 'string' ? req.body.paymentLinkId.trim() : '';

  if (!/^plink_[A-Za-z0-9]+$/.test(paymentLinkId)) {
    res.status(400).json({ error: 'Invalid Razorpay payment link reference.' });
    return;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, user.id) as
    | Record<string, unknown>
    | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  if (order.payment_verified) {
    res.json({ order: hydrateOrderWithItems(orderId) });
    return;
  }

  try {
    const rzpKeyId = process.env.RAZORPAY_KEY_ID!.trim();
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET!.trim();
    const authHeader = Buffer.from(`${rzpKeyId}:${rzpSecret}`).toString('base64');

    const rzpResp = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(paymentLinkId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authHeader}`
      }
    });

    if (!rzpResp.ok) {
      res.status(502).json({ error: 'Unable to verify payment status with Razorpay. Please try again.' });
      return;
    }

    const linkData = (await rzpResp.json()) as {
      id: string;
      status: string;
      reference_id?: string;
      amount?: number;
      amount_paid?: number;
      payments?: Array<{ payment_id?: string }>;
    };

    if (linkData.reference_id !== String(order.order_number)) {
      res.status(400).json({ error: 'Payment link does not match this order.' });
      return;
    }

    const paidAmount = Number(linkData.amount_paid ?? 0);
    const expectedAmount = Number(order.total) * 100;
    if (linkData.status !== 'paid' || paidAmount < expectedAmount) {
      res.status(400).json({
        error: `Payment is currently "${linkData.status || 'created'}". Complete payment in Razorpay first, then click Verify.`
      });
      return;
    }

    const paymentRef = linkData.payments?.[0]?.payment_id || linkData.id;
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE orders
         SET status = 'Delivered',
             status_note = 'Payment verified via Razorpay Hosted Checkout · Digital license & downloads unlocked',
             razorpay_payment_id = ?,
             payment_verified = 1,
             updated_at = ?
         WHERE id = ?`
      ).run(paymentRef, now, orderId);

      const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId) as Array<{
        product_id: string;
        quantity: number;
      }>;
      for (const item of items) {
        db.prepare('UPDATE products SET sales_count = sales_count + ? WHERE id = ?').run(item.quantity, item.product_id);
      }
    });
    tx();

    const hydrated = hydrateOrderWithItems(orderId)!;
    createOrderNotification(
      user.id,
      `Order ${String(order.order_number)} Confirmed`,
      'Your Razorpay payment was verified and your digital files & license keys are ready in My Library.',
      orderId
    );
    notifyAdmins('order_created', hydrated);
    notifyUser(user.id, 'order_updated', hydrated);

    res.json({ order: hydrated });
  } catch (err) {
    console.error('Razorpay payment link verify error:', err);
    res.status(502).json({ error: 'Could not reach Razorpay to verify payment status.' });
  }
});

app.get('/api/orders/mine', requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user!.id) as Array<{ id: string }>;
  const orders = rows.map((r) => hydrateOrderWithItems(r.id)).filter(Boolean);
  res.json({ orders });
});

app.get('/api/orders/:orderId/download/:itemId', requireAuth, (req: AuthedRequest, res: Response) => {
  const orderId = String(req.params.orderId || '');
  const itemId = String(req.params.itemId || '');
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  if (String(order.user_id) !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Unauthorized download access.' });
    return;
  }
  if (!order.payment_verified) {
    res.status(403).json({ error: 'Downloads unlock once payment is verified.' });
    return;
  }

  const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(itemId, orderId) as
    | Record<string, unknown>
    | undefined;
  if (!item) {
    res.status(404).json({ error: 'Purchased item not found.' });
    return;
  }

  const product = db.prepare('SELECT download_notes, preview_url, description FROM products WHERE id = ?').get(
    String(item.product_id)
  ) as { download_notes?: string; preview_url?: string; description?: string } | undefined;

  const settings = getSiteSettings();
  const safeSlug = String(item.product_title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const bundleManifest = [
    `================================================================`,
    `${settings.brandName.toUpperCase()} — DIGITAL LICENSE & RELEASE PACKAGE`,
    `================================================================`,
    ``,
    `Product:          ${String(item.product_title)}`,
    `Release Version:  v${String(item.version)}`,
    `Package Format:   ${String(item.file_format)}`,
    `License Tier:     ${String(item.license_type)} License`,
    `License Key:      ${String(item.license_key)}`,
    ``,
    `Order Number:     ${String(order.order_number)}`,
    `Licensed To:      ${String(order.customer_name)} <${String(order.customer_email)}>`,
    `Payment Ref:      ${String(order.razorpay_payment_id)}`,
    `Issued At:        ${String(order.updated_at)}`,
    ``,
    `PACKAGE NOTES`,
    `-------------`,
    `${product?.download_notes || 'Includes complete source package, assets, and documentation.'}`,
    ``,
    `OVERVIEW`,
    `--------`,
    `${product?.description || ''}`,
    ``,
    `SUPPORT`,
    `-------`,
    `Email: ${settings.contactEmail}`,
    `Phone: ${settings.contactPhone}`,
    `================================================================`
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeSlug || 'digital-asset'}-v${String(item.version)}-license.txt"`);
  res.send(bundleManifest);
});

// ============================================================================
// ADMIN CMS & REAL-TIME OPERATIONS ROUTES
// ============================================================================

app.put('/api/admin/settings', requireAdmin, (req: AuthedRequest, res: Response) => {
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const updated = saveSiteSettings(payload);
  broadcastPublicEvent('settings_updated', updated);
  res.json({ settings: updated });
});

app.post('/api/admin/categories', requireAdmin, (req: AuthedRequest, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 220) : '';
  const sortOrder = Number.isFinite(Number(req.body?.sort_order)) ? Number(req.body.sort_order) : 10;

  if (!name || name.length < 2) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    crypto.randomBytes(2).toString('hex');
  const id = `cat-${crypto.randomUUID()}`;
  db.prepare('INSERT INTO categories (id, name, slug, description, sort_order) VALUES (?, ?, ?, ?, ?)').run(
    id,
    name,
    slug,
    description,
    sortOrder
  );
  broadcastPublicEvent('catalog_updated', { categoryId: id });
  res.status(201).json({ category: { id, name, slug, description, sort_order: sortOrder } });
});

app.put('/api/admin/categories/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id || '');
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 220) : '';
  const sortOrder = Number.isFinite(Number(req.body?.sort_order)) ? Number(req.body.sort_order) : 0;

  if (!name) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  db.prepare('UPDATE categories SET name = ?, description = ?, sort_order = ? WHERE id = ?').run(
    name,
    description,
    sortOrder,
    id
  );
  broadcastPublicEvent('catalog_updated', { categoryId: id });
  res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(id) });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id || '');
  const count = (db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ?').get(id) as { c: number }).c;
  if (count > 0) {
    res.status(400).json({ error: 'Move or delete products in this category before deleting it.' });
    return;
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  broadcastPublicEvent('catalog_updated', { categoryId: id });
  res.json({ ok: true });
});

app.post('/api/admin/products', requireAdmin, (req: AuthedRequest, res: Response) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
  const subtitle = typeof req.body?.subtitle === 'string' ? req.body.subtitle.trim().slice(0, 180) : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 2500) : '';
  const price = Math.max(1, Math.round(Number(req.body?.price) || 0));
  const compareAtPrice = Math.max(0, Math.round(Number(req.body?.compare_at_price) || 0));
  const commercialPrice = Math.max(price, Math.round(Number(req.body?.commercial_price) || price * 2));
  const categoryId = typeof req.body?.category_id === 'string' ? req.body.category_id : '';
  const imageUrl =
    sanitizeUrl(req.body?.image_url, true) || '/src/assets/images/product_ui_system_1795268973060.jpg';
  const fileFormat = typeof req.body?.file_format === 'string' ? req.body.file_format.trim().slice(0, 80) : 'ZIP Archive';
  const fileSize = typeof req.body?.file_size === 'string' ? req.body.file_size.trim().slice(0, 30) : '25 MB';
  const version = typeof req.body?.version === 'string' ? req.body.version.trim().slice(0, 20) : '1.0';
  const previewUrl = sanitizeUrl(req.body?.preview_url);
  const downloadNotes = typeof req.body?.download_notes === 'string' ? req.body.download_notes.trim().slice(0, 600) : '';
  const highlights = Array.isArray(req.body?.highlights)
    ? req.body.highlights.filter((h: unknown) => typeof h === 'string' && h.trim()).map((h: string) => h.trim().slice(0, 160))
    : [];
  const featured = req.body?.featured ? 1 : 0;
  const published = req.body?.published === false ? 0 : 1;

  if (!title || !description || !categoryId) {
    res.status(400).json({ error: 'Title, description, and category are required.' });
    return;
  }

  const catExists = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!catExists) {
    res.status(400).json({ error: 'Selected category does not exist.' });
    return;
  }

  const id = `prod-${crypto.randomUUID()}`;
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    crypto.randomBytes(2).toString('hex');
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO products (
      id, title, slug, subtitle, description, price, compare_at_price, commercial_price,
      category_id, image_url, file_format, file_size, version, preview_url, download_notes,
      highlights_json, featured, published, sales_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    title,
    slug,
    subtitle,
    description,
    price,
    compareAtPrice,
    commercialPrice,
    categoryId,
    imageUrl,
    fileFormat,
    fileSize,
    version,
    previewUrl,
    downloadNotes,
    JSON.stringify(highlights),
    featured,
    published,
    now
  );

  broadcastPublicEvent('catalog_updated', { productId: id });
  res.status(201).json({ product: hydrateProducts().find((p) => p.id === id) });
});

app.put('/api/admin/products/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id || '');
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim().slice(0, 120) : String(existing.title);
  const subtitle = typeof req.body?.subtitle === 'string' ? req.body.subtitle.trim().slice(0, 180) : String(existing.subtitle);
  const description = typeof req.body?.description === 'string' && req.body.description.trim() ? req.body.description.trim().slice(0, 2500) : String(existing.description);
  const price = req.body?.price !== undefined ? Math.max(1, Math.round(Number(req.body.price))) : Number(existing.price);
  const compareAtPrice = req.body?.compare_at_price !== undefined ? Math.max(0, Math.round(Number(req.body.compare_at_price))) : Number(existing.compare_at_price);
  const commercialPrice = req.body?.commercial_price !== undefined ? Math.max(price, Math.round(Number(req.body.commercial_price))) : Number(existing.commercial_price);
  const categoryId = typeof req.body?.category_id === 'string' ? req.body.category_id : String(existing.category_id);
  const imageUrl = req.body?.image_url !== undefined ? sanitizeUrl(req.body.image_url, true) || String(existing.image_url) : String(existing.image_url);
  const fileFormat = typeof req.body?.file_format === 'string' ? req.body.file_format.trim().slice(0, 80) : String(existing.file_format);
  const fileSize = typeof req.body?.file_size === 'string' ? req.body.file_size.trim().slice(0, 30) : String(existing.file_size);
  const version = typeof req.body?.version === 'string' ? req.body.version.trim().slice(0, 20) : String(existing.version);
  const previewUrl = req.body?.preview_url !== undefined ? sanitizeUrl(req.body.preview_url) : String(existing.preview_url);
  const downloadNotes = typeof req.body?.download_notes === 'string' ? req.body.download_notes.trim().slice(0, 600) : String(existing.download_notes);
  const highlightsJson = Array.isArray(req.body?.highlights)
    ? JSON.stringify(
        req.body.highlights
          .filter((h: unknown) => typeof h === 'string' && h.trim())
          .map((h: string) => h.trim().slice(0, 160))
      )
    : String(existing.highlights_json);
  const featured = req.body?.featured !== undefined ? (req.body.featured ? 1 : 0) : Number(existing.featured);
  const published = req.body?.published !== undefined ? (req.body.published ? 1 : 0) : Number(existing.published);

  db.prepare(
    `UPDATE products
     SET title = ?, subtitle = ?, description = ?, price = ?, compare_at_price = ?, commercial_price = ?,
         category_id = ?, image_url = ?, file_format = ?, file_size = ?, version = ?, preview_url = ?,
         download_notes = ?, highlights_json = ?, featured = ?, published = ?
     WHERE id = ?`
  ).run(
    title,
    subtitle,
    description,
    price,
    compareAtPrice,
    commercialPrice,
    categoryId,
    imageUrl,
    fileFormat,
    fileSize,
    version,
    previewUrl,
    downloadNotes,
    highlightsJson,
    featured,
    published,
    id
  );

  broadcastPublicEvent('catalog_updated', { productId: id });
  res.json({ product: hydrateProducts().find((p) => p.id === id) });
});

app.delete('/api/admin/products/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id || '');
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  broadcastPublicEvent('catalog_updated', { productId: id });
  res.json({ ok: true });
});

app.get('/api/admin/orders', requireAdmin, (_req: AuthedRequest, res: Response) => {
  const rows = db.prepare('SELECT id FROM orders ORDER BY created_at DESC').all() as Array<{ id: string }>;
  const orders = rows.map((r) => hydrateOrderWithItems(r.id)).filter(Boolean);
  res.json({ orders });
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req: AuthedRequest, res: Response) => {
  const orderId = String(req.params.id || '');
  const status = String(req.body?.status || '') as OrderStatus;
  const statusNote = typeof req.body?.status_note === 'string' ? req.body.status_note.trim().slice(0, 240) : '';

  if (!ALLOWED_ORDER_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid order status.' });
    return;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  const now = new Date().toISOString();
  const verified = status === 'Confirmed' || status === 'Processing' || status === 'Delivered' ? 1 : Number(order.payment_verified);

  db.prepare('UPDATE orders SET status = ?, status_note = ?, payment_verified = ?, updated_at = ? WHERE id = ?').run(
    status,
    statusNote || `Order status updated to ${status}`,
    verified,
    now,
    orderId
  );

  const hydrated = hydrateOrderWithItems(orderId)!;

  createOrderNotification(
    String(order.user_id),
    `Order ${String(order.order_number)} — ${status}`,
    statusNote || `Your order status is now ${status}. Open Order Tracking for details.`,
    orderId
  );

  notifyUser(String(order.user_id), 'order_updated', hydrated);
  notifyAdmins('order_updated', hydrated);

  res.json({ order: hydrated });
});

app.get('/api/admin/reviews', requireAdmin, (_req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT r.*, p.title as product_title
       FROM reviews r
       LEFT JOIN products p ON p.id = r.product_id
       ORDER BY r.created_at DESC`
    )
    .all() as Array<Record<string, unknown>>;
  res.json({
    reviews: rows.map((r) => ({ ...r, verified_purchase: Boolean(r.verified_purchase) }))
  });
});

app.delete('/api/admin/reviews/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id || '');
  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  broadcastPublicEvent('catalog_updated', { reviewId: id });
  res.json({ ok: true });
});

app.get('/api/admin/customers', requireAdmin, (_req: AuthedRequest, res: Response) => {
  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.company, u.created_at,
              COUNT(o.id) as order_count,
              COALESCE(SUM(CASE WHEN o.payment_verified = 1 THEN o.total ELSE 0 END), 0) as total_spent
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       WHERE u.password_hash NOT LIKE 'locked:%'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    )
    .all();
  res.json({ customers: users });
});

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC SERVING
// ============================================================================

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error. Please try again.' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KalaVault server running at http://localhost:${PORT}`);
  });
}

startServer();
