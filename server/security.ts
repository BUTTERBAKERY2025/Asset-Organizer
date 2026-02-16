import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const loginAttempts = new Map<string, { count: number; lastAttempt: number; blockedUntil: number }>();

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "تم تجاوز عدد المحاولات المسموحة. يرجى الانتظار 15 دقيقة" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
});

export const biometricRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: { error: "تم تجاوز عدد محاولات البصمة. يرجى الانتظار 5 دقائق" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
});

export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: "تم تجاوز عدد الطلبات المسموحة. يرجى الانتظار" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { error: "تم تجاوز عدد عمليات الرفع المسموحة" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
});

const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, { token, expiresAt: Date.now() + 4 * 60 * 60 * 1000 });

  const keys = Array.from(csrfTokens.keys());
  for (const key of keys) {
    const val = csrfTokens.get(key);
    if (val && val.expiresAt < Date.now()) csrfTokens.delete(key);
  }
  return token;
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId);
  if (!stored) return false;
  if (stored.expiresAt < Date.now()) {
    csrfTokens.delete(sessionId);
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(stored.token, 'hex'),
    Buffer.from(token, 'hex')
  );
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;
  const host = req.headers.host;

  if (!origin) {
    console.warn(`[Security] CSRF blocked: no Origin/Referer header on ${req.method} ${req.path}`);
    return res.status(403).json({ error: "طلب غير مصرح - مصدر غير معروف" });
  }

  try {
    const originHost = new URL(origin).host;
    if (originHost !== host && !originHost.endsWith('.replit.dev') && !originHost.endsWith('.replit.app') && !originHost.endsWith('.onrender.com')) {
      console.warn(`[Security] CSRF blocked: origin ${origin} doesn't match host ${host}`);
      return res.status(403).json({ error: "طلب غير مصرح - مصدر غير معروف" });
    }
  } catch {
    return res.status(403).json({ error: "طلب غير مصرح" });
  }

  next();
}

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), publickey-credentials-create=(self), publickey-credentials-get=(self)');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  if (req.path.startsWith('/api/auth/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

export function isLoginBlocked(ip: string): { blocked: boolean; remainingMinutes?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { blocked: false };
  if (record.blockedUntil > now) {
    const remainingMinutes = Math.ceil((record.blockedUntil - now) / 60000);
    return { blocked: true, remainingMinutes };
  }
  return { blocked: false };
}

export function trackLoginAttempt(ip: string, success: boolean): { blocked: boolean; remainingMinutes?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lastAttempt: 0, blockedUntil: 0 };

  if (record.blockedUntil > now) {
    const remainingMinutes = Math.ceil((record.blockedUntil - now) / 60000);
    return { blocked: true, remainingMinutes };
  }

  if (success) {
    loginAttempts.delete(ip);
    return { blocked: false };
  }

  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= 10) {
    record.blockedUntil = now + 30 * 60 * 1000;
    loginAttempts.set(ip, record);
    return { blocked: true, remainingMinutes: 30 };
  } else if (record.count >= 5) {
    record.blockedUntil = now + 5 * 60 * 1000;
    loginAttempts.set(ip, record);
    return { blocked: true, remainingMinutes: 5 };
  }

  loginAttempts.set(ip, record);
  return { blocked: false };
}

setInterval(() => {
  const now = Date.now();
  Array.from(loginAttempts.keys()).forEach(key => {
    const val = loginAttempts.get(key);
    if (val && now - val.lastAttempt > 60 * 60 * 1000) loginAttempts.delete(key);
  });
  Array.from(csrfTokens.keys()).forEach(key => {
    const val = csrfTokens.get(key);
    if (val && val.expiresAt < now) csrfTokens.delete(key);
  });
}, 10 * 60 * 1000);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-rar-compressed',
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.vbs', '.vbe',
  '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.ps2', '.psc1',
  '.reg', '.inf', '.lnk', '.dll', '.sys', '.cpl', '.hta', '.sh', '.bash',
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function validateFileUpload(file: { originalname: string; mimetype: string; size: number; buffer?: Buffer }): { valid: boolean; error?: string } {
  if (!file.originalname || typeof file.originalname !== 'string') {
    return { valid: false, error: "اسم الملف غير صالح" };
  }

  const sanitizedName = file.originalname.replace(/[^\w\s\-\.\u0600-\u06FF]/g, '_');
  if (sanitizedName !== file.originalname) {
    file.originalname = sanitizedName;
  }

  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return { valid: false, error: "اسم الملف يحتوي على مسار غير مسموح" };
  }

  const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, error: `نوع الملف ${ext} غير مسموح لأسباب أمنية` };
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return { valid: false, error: `نوع الملف ${file.mimetype} غير مسموح` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `حجم الملف يتجاوز الحد المسموح (${MAX_FILE_SIZE / 1024 / 1024} ميجابايت)` };
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
  const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^\w\s\-\u0600-\u06FF]/g, '_').substring(0, 100);
  return `${baseName}_${timestamp}_${randomSuffix}.${ext}`;
}
