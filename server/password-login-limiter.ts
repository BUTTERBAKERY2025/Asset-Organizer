import rateLimit from "express-rate-limit";

/** Branch staff share public IPs. Successful password logins must not consume
 * the failed-login budget. OTP send/verify retain their separate strict budget. */
export function createPasswordLoginRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: "تم تجاوز عدد محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    validate: { trustProxy: false, xForwardedForHeader: false },
  });
}