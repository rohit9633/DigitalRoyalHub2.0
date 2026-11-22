import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, normalizeGender, resolveDefaultAvatar } from './db.ts';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const SANDBOX_PAYMENT_SECRET = crypto.randomBytes(32).toString('hex');

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  phone: string;
  gender: 'male' | 'female';
  avatar_url: string;
  company: string;
  billing_address: string;
  bio: string;
  push_enabled: number;
  created_at: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || stored.startsWith('locked:')) return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derivedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

export function createSessionToken(userId: string, role: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { uid: string; role: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid: string;
      role: string;
      exp: number;
    };
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return { uid: parsed.uid, role: parsed.role };
  } catch {
    return null;
  }
}

export function signSandboxPayment(orderId: string, paymentId: string): string {
  return crypto
    .createHmac('sha256', SANDBOX_PAYMENT_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

export function verifyHmacSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(signature || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifySandboxSignature(orderId: string, paymentId: string, signature: string): boolean {
  return verifyHmacSignature(orderId, paymentId, signature, SANDBOX_PAYMENT_SECRET);
}

// Single-use short-lived SSE ticket store so auth tokens never sit in URLs
interface SseTicket {
  userId: string;
  role: 'admin' | 'customer';
  expiresAt: number;
}
const sseTickets = new Map<string, SseTicket>();

export function issueSseTicket(userId: string, role: 'admin' | 'customer'): string {
  const now = Date.now();
  for (const [k, v] of sseTickets.entries()) {
    if (v.expiresAt < now) sseTickets.delete(k);
  }
  const ticket = crypto.randomBytes(24).toString('hex');
  sseTickets.set(ticket, { userId, role, expiresAt: now + 60_000 });
  return ticket;
}

export function consumeSseTicket(ticket: string): { userId: string; role: 'admin' | 'customer' } | null {
  const entry = sseTickets.get(ticket);
  if (!entry) return null;
  sseTickets.delete(ticket);
  if (entry.expiresAt < Date.now()) return null;
  return { userId: entry.userId, role: entry.role };
}

export function hashOtpCode(challengeId: string, code: string): string {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`otp:${challengeId}:${code}`)
    .digest('hex');
}

export function verifyOtpCode(challengeId: string, code: string, expectedHash: string): boolean {
  const actual = hashOtpCode(challengeId, code);
  const a = Buffer.from(actual);
  const b = Buffer.from(expectedHash || '');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getUserById(userId: string): AuthUser | null {
  const row = db
    .prepare(
      'SELECT id, name, email, role, phone, gender, avatar_url, company, billing_address, bio, push_enabled, created_at FROM users WHERE id = ?'
    )
    .get(userId) as AuthUser | undefined;
  if (!row) return null;
  const gender = normalizeGender(row.gender);
  return {
    ...row,
    gender,
    avatar_url: row.avatar_url || resolveDefaultAvatar(gender)
  };
}

export function extractBearerUser(req: Request): AuthUser | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  const decoded = verifySessionToken(token);
  if (!decoded) return null;
  return getUserById(decoded.uid);
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.user = user;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  req.user = user;
  next();
}
