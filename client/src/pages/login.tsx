import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useWelcomeSound } from "@/hooks/use-notification-sounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, User, Lock, Eye, EyeOff, HelpCircle, MessageCircle, Mail, Languages } from "lucide-react";
import logo from "@assets/logo_butter_bakery__1768502624540.png";

const REMEMBER_KEY = "__btr_ru";
const LANG_KEY = "__btr_lang";

type Lang = "ar" | "en";

const T = {
  ar: {
    systemTitle: "BUTTER BAKERY SYSTEM",
    subtitle: "تسجيل الدخول للمتابعة",
    username: "اسم المستخدم",
    usernamePh: "أدخل اسم المستخدم",
    password: "كلمة المرور",
    passwordPh: "أدخل كلمة المرور",
    remember: "تذكرني",
    needHelp: "تحتاج مساعدة؟",
    whatsapp: "مساعدة عبر واتساب",
    contactAdmin: "تواصل مع المسؤول",
    forgot: "نسيت كلمة المرور",
    submit: "متابعة",
    submitting: "جارٍ الدخول...",
    showPwd: "إظهار كلمة المرور",
    hidePwd: "إخفاء كلمة المرور",
    loginFailed: "فشل تسجيل الدخول",
    rights: "شركة الزبد الأفضل التجارية — جميع الحقوق محفوظة",
    switchLang: "English",
    switchLangShort: "EN",
    switchLangAria: "التبديل إلى الإنجليزية",
    otpTitle: "التحقق بخطوتين",
    otpSubtitle: "أدخل رمز التحقق المرسل إلى",
    otpCode: "رمز التحقق",
    otpCodePh: "••••••",
    otpVerify: "تأكيد الرمز",
    otpVerifying: "جارٍ التحقق...",
    otpResend: "إعادة إرسال الرمز",
    otpResending: "جارٍ الإرسال...",
    otpResent: "تم إرسال رمز جديد",
    otpBack: "العودة لتسجيل الدخول",
    otpChannelWhatsapp: "واتساب",
    otpChannelSms: "رسالة نصية",
  },
  en: {
    systemTitle: "BUTTER BAKERY SYSTEM",
    subtitle: "Log in to continue",
    username: "Username",
    usernamePh: "Enter your username",
    password: "Password",
    passwordPh: "Enter your password",
    remember: "Remember me",
    needHelp: "Need help?",
    whatsapp: "Help via WhatsApp",
    contactAdmin: "Contact administrator",
    forgot: "Forgot password",
    submit: "Continue",
    submitting: "Logging in...",
    showPwd: "Show password",
    hidePwd: "Hide password",
    loginFailed: "Login failed",
    rights: "Butter Bakery Trading Co. — All rights reserved",
    switchLang: "العربية",
    switchLangShort: "ع",
    switchLangAria: "Switch to Arabic",
    otpTitle: "Two-factor verification",
    otpSubtitle: "Enter the verification code sent to",
    otpCode: "Verification code",
    otpCodePh: "••••••",
    otpVerify: "Verify code",
    otpVerifying: "Verifying...",
    otpResend: "Resend code",
    otpResending: "Sending...",
    otpResent: "A new code was sent",
    otpBack: "Back to login",
    otpChannelWhatsapp: "WhatsApp",
    otpChannelSms: "SMS",
  },
} as const;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isLoggingIn, isAuthenticated, verifyOtp, resendOtp, isVerifyingOtp, isResendingOtp } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [formKey, setFormKey] = useState(0);
  // المرحلة 5: حالة التحقق بخطوتين (OTP)
  const [otpStep, setOtpStep] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");
  const [otpChannel, setOtpChannel] = useState<string>("whatsapp");
  const [otpCode, setOtpCode] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "ar" || saved === "en") return saved;
    } catch {}
    return "ar";
  });
  const t = T[lang];
  const isRTL = lang === "ar";
  const toggleLang = () => {
    const next: Lang = lang === "ar" ? "en" : "ar";
    setLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch {}
  };

  const { setupInteractionListener } = useWelcomeSound("systemWelcomeSound");

  useEffect(() => {
    const cleanup = setupInteractionListener();
    return cleanup;
  }, [setupInteractionListener]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.u && typeof parsed.u === "string" && parsed.u.length <= 100) {
          setUsername(parsed.u);
          setRememberMe(true);
        }
      }
    } catch {
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, []);

  if (isAuthenticated) {
    setLocation("/");
    return null;
  }

  const navigateAfterLogin = (userData: any) => {
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ u: username }));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

    // Restore intended path if present
    let next = "/";
    try {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("redirect");
      if (r && r.startsWith("/") && !r.startsWith("//")) next = r;
    } catch {}

    if (userData?.role === "attendance_clerk") {
      setLocation("/attendance-check");
    } else if (userData?.role === "shareholder") {
      setLocation(next !== "/" ? next : "/shareholder-portal");
    } else if (userData?.role === "external_auditor") {
      setLocation("/audit-portal");
    } else {
      setLocation(next);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (honeypot) {
      setError(t.loginFailed);
      return;
    }

    try {
      const userData = await login({ username, password, rememberMe });

      // المرحلة 5: المساهم يحتاج للتحقق بخطوتين قبل إنشاء الجلسة
      if (userData?.otpRequired) {
        setOtpPhone(userData.phone || "");
        setOtpChannel(userData.channel || "whatsapp");
        setOtpCode("");
        setOtpInfo("");
        setOtpStep(true);
        return;
      }

      navigateAfterLogin(userData);
    } catch (err: any) {
      setPassword("");
      setFormKey((prev) => prev + 1);
      setError(err.message || t.loginFailed);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOtpInfo("");
    try {
      const userData = await verifyOtp({ code: otpCode.trim() });
      navigateAfterLogin(userData);
    } catch (err: any) {
      setOtpCode("");
      setError(err.message || t.loginFailed);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setOtpInfo("");
    try {
      const res: any = await resendOtp();
      if (res?.phone) setOtpPhone(res.phone);
      if (res?.channel) setOtpChannel(res.channel);
      setOtpInfo(t.otpResent);
    } catch (err: any) {
      setError(err.message || t.loginFailed);
    }
  };

  const handleBackToLogin = () => {
    setOtpStep(false);
    setOtpCode("");
    setError("");
    setOtpInfo("");
    setPassword("");
    setFormKey((prev) => prev + 1);
  };

  const textAlignClass = isRTL ? "text-right" : "text-left";

  return (
    <main
      dir={isRTL ? "rtl" : "ltr"}
      lang={lang}
      className="min-h-screen min-h-[100dvh] flex flex-col relative overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_20%_10%,#fef6ec_0%,transparent_45%),radial-gradient(circle_at_85%_90%,#eaf5ee_0%,transparent_50%),linear-gradient(180deg,#f8fafc_0%,#f4f6fa_100%)]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Language toggle (top corner) — adapts to device */}
      <button
        type="button"
        onClick={toggleLang}
        className="fixed z-30 inline-flex items-center justify-center gap-1.5 sm:gap-2 h-10 sm:h-10 md:h-11 min-w-[44px] min-h-[44px] px-2.5 sm:px-3.5 md:px-4 rounded-full bg-white/95 backdrop-blur border border-slate-200 text-[13px] sm:text-[13px] md:text-sm font-semibold text-[#1a3a2f] hover:bg-white hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 active:scale-95 transition-all shadow-md hover:shadow-lg"
        style={{
          ...(isRTL ? { left: "max(12px, env(safe-area-inset-left))" } : { right: "max(12px, env(safe-area-inset-right))" }),
          top: "max(12px, env(safe-area-inset-top))",
        }}
        aria-label={t.switchLangAria}
        title={t.switchLang}
        data-testid="button-lang-toggle"
      >
        <Languages className="w-4 h-4 md:w-[18px] md:h-[18px] shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
        {/* Short label on mobile, full label on tablet+ */}
        <span className="sm:hidden">{t.switchLangShort}</span>
        <span className="hidden sm:inline">{t.switchLang}</span>
      </button>
      {/* Subtle dot pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Decorative bakery illustrations — only on large screens, pushed down so they never touch the card */}
      <BakeryIllustrationLeft />
      <BakeryIllustrationRight />

      {/* Centered card — adaptive to device */}
      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 md:px-6 py-14 sm:py-12 md:py-14 relative z-10">
        <div className="w-full max-w-[360px] sm:max-w-[400px] md:max-w-[440px] lg:max-w-[460px] animate-[fadeInUp_0.5s_ease-out]">
          <style>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @media (max-height: 700px) {
              .bb-logo { height: 5rem !important; }
              .bb-card-pad { padding: 1.25rem 1.25rem !important; }
              .bb-header-mb { margin-bottom: 0.75rem !important; }
            }
          `}</style>

          <div className="bb-card-pad bg-white rounded-2xl sm:rounded-3xl shadow-[0_8px_32px_rgba(15,23,42,0.08)] sm:shadow-[0_12px_40px_rgba(15,23,42,0.10)] border border-slate-200/60 p-5 sm:p-7 md:p-8 lg:p-9">
            {/* Header: adaptive logo + system title */}
            <div className="bb-header-mb flex flex-col items-center text-center mb-5 sm:mb-6">
              <img
                src={logo}
                alt="Butter Bakery"
                className="bb-logo h-24 sm:h-28 md:h-32 lg:h-36 xl:h-40 w-auto drop-shadow-md"
                data-testid="img-logo"
              />
              <h1 className="text-[15px] sm:text-base md:text-lg lg:text-xl font-extrabold text-[#1a3a2f] -mt-2 sm:-mt-3 md:-mt-4 leading-tight tracking-wide">
                {t.systemTitle}
              </h1>
              <p className="text-[11px] sm:text-[12px] md:text-[13px] text-slate-500 mt-1">
                {otpStep ? t.otpTitle : t.subtitle}
              </p>
              <div className="w-10 sm:w-12 h-[2.5px] sm:h-[3px] bg-primary rounded-full mt-2 sm:mt-3"></div>
            </div>

            {otpStep && (
              <form onSubmit={handleVerifyOtp} className="space-y-4" autoComplete="off">
                <p className={`text-[13px] text-slate-600 ${textAlignClass}`} data-testid="text-otp-subtitle">
                  {t.otpSubtitle}{" "}
                  <span className="font-semibold text-[#1a3a2f]" dir="ltr">{otpPhone}</span>
                  {" "}
                  <span className="text-slate-400">
                    ({otpChannel === "sms" ? t.otpChannelSms : otpChannel === "both" ? `${t.otpChannelWhatsapp}/${t.otpChannelSms}` : t.otpChannelWhatsapp})
                  </span>
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="otp" className={`text-[13px] font-semibold text-slate-700 block ${textAlignClass}`}>
                    {t.otpCode} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t.otpCodePh}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="h-12 sm:h-11 text-center text-2xl tracking-[0.5em] font-bold bg-white border-slate-300 text-slate-900 placeholder:text-slate-300 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 rounded-lg transition-all"
                    data-testid="input-otp"
                    autoFocus
                    required
                  />
                </div>

                {otpInfo && (
                  <div className="text-emerald-700 text-[13px] text-center px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg" data-testid="text-otp-info">
                    {otpInfo}
                  </div>
                )}

                {error && (
                  <div id="login-error" role="alert" className="text-red-700 text-[13px] text-center px-3 py-2 bg-red-50 border border-red-200 rounded-lg" data-testid="text-error">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 sm:h-11 text-base sm:text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm hover:shadow-md hover:shadow-primary/25 transition-all duration-200 active:scale-[0.99]"
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  data-testid="button-verify-otp"
                >
                  {isVerifyingOtp ? (
                    <>
                      <Loader2 className={`${isRTL ? "ml-2" : "mr-2"} h-4 w-4 animate-spin`} />
                      <span>{t.otpVerifying}</span>
                    </>
                  ) : (
                    t.otpVerify
                  )}
                </Button>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-[12px] text-slate-500 hover:text-[var(--color-primary)] transition-colors py-1 min-h-[32px]"
                    data-testid="button-otp-back"
                  >
                    {t.otpBack}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isResendingOtp}
                    className="text-[12px] text-[var(--color-primary)] hover:underline disabled:opacity-50 transition-colors py-1 min-h-[32px]"
                    data-testid="button-otp-resend"
                  >
                    {isResendingOtp ? t.otpResending : t.otpResend}
                  </button>
                </div>
              </form>
            )}

            {!otpStep && (
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              autoComplete="off"
              key={formKey}
            >
              {/* Honeypot */}
              <input
                type="text"
                name="website_url"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
              />

              {/* Username with icon */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="username"
                  className={`text-[13px] font-semibold text-slate-700 block ${textAlignClass}`}
                >
                  {t.username} <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User
                    className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 pointer-events-none ${isRTL ? "right-3" : "left-3"}`}
                  />
                  <Input
                    id="username"
                    name="btr_user_field"
                    type="text"
                    placeholder={t.usernamePh}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={(e) => e.target.removeAttribute("readonly")}
                    readOnly
                    autoComplete="off"
                    aria-describedby={error ? "login-error" : undefined}
                    className={`h-12 sm:h-11 text-base sm:text-sm ${isRTL ? "pr-10" : "pl-10"} bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 rounded-lg ${textAlignClass} transition-all`}
                    data-testid="input-username"
                    inputMode="text"
                    required
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                  />
                </div>
              </div>

              {/* Password with icon + show/hide */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className={`text-[13px] font-semibold text-slate-700 block ${textAlignClass}`}
                >
                  {t.password} <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Lock
                    className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 pointer-events-none ${isRTL ? "right-3" : "left-3"}`}
                  />
                  <Input
                    id="password"
                    name="btr_pass_field"
                    type={showPassword ? "text" : "password"}
                    placeholder={t.passwordPh}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={(e) => e.target.removeAttribute("readonly")}
                    readOnly
                    autoComplete="new-password"
                    aria-describedby={error ? "login-error" : undefined}
                    className={`h-12 sm:h-11 text-base sm:text-sm pr-10 pl-10 bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 rounded-lg ${textAlignClass} transition-all`}
                    data-testid="input-password"
                    required
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--color-primary)] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 ${isRTL ? "left-3" : "right-3"}`}
                    aria-label={showPassword ? t.hidePwd : t.showPwd}
                    tabIndex={-1}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me + Help */}
              <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    className="h-5 w-5 sm:h-4 sm:w-4 border-slate-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    data-testid="checkbox-remember-me"
                  />
                  <Label
                    htmlFor="rememberMe"
                    className="text-slate-600 cursor-pointer text-[13px] sm:text-[13px] select-none"
                  >
                    {t.remember}
                  </Label>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[12px] sm:text-[12px] text-slate-500 hover:text-[var(--color-primary)] transition-colors py-1 min-h-[32px]"
                      data-testid="button-help-menu"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {t.needHelp}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem asChild>
                      <a
                        href="https://wa.me/966531920222"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 cursor-pointer"
                        data-testid="link-whatsapp-help"
                      >
                        <MessageCircle className="w-4 h-4 text-[#25D366]" />
                        {t.whatsapp}
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a
                        href="mailto:info@butterbakery.co"
                        className="flex items-center gap-2 cursor-pointer"
                        data-testid="link-email-admin"
                      >
                        <Mail className="w-4 h-4 text-[#1a3a2f]" />
                        {t.contactAdmin}
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a
                        href="mailto:info@butterbakery.co?subject=Forgot%20password"
                        className="flex items-center gap-2 cursor-pointer"
                        data-testid="link-forgot-password"
                      >
                        <Lock className="w-4 h-4 text-slate-500" />
                        {t.forgot}
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {error && (
                <div
                  id="login-error"
                  role="alert"
                  className="text-red-700 text-[13px] text-center px-3 py-2 bg-red-50 border border-red-200 rounded-lg"
                  data-testid="text-error"
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 sm:h-11 text-base sm:text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm hover:shadow-md hover:shadow-primary/25 transition-all duration-200 active:scale-[0.99]"
                disabled={isLoggingIn}
                data-testid="button-login"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className={`${isRTL ? "ml-2" : "mr-2"} h-4 w-4 animate-spin`} />
                    <span>{t.submitting}</span>
                  </>
                ) : (
                  t.submit
                )}
              </Button>
            </form>
            )}
          </div>

          {/* Compact footer below card */}
          <div className="flex flex-col items-center gap-1 mt-4 sm:mt-5 text-center px-2">
            <a
              href="https://www.butterbakery.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] sm:text-[12px] text-slate-400 hover:text-[var(--color-primary)] transition-colors tracking-wider"
              data-testid="link-website"
            >
              www.butterbakery.co
            </a>
            <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed">
              © {new Date().getFullYear()} {t.rights}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─── Bakery-themed decorative SVGs (lg+ only, far from card) ─── */

/* ─── Atlassian-inspired isometric platform illustrations ─── */

function BakeryIllustrationLeft() {
  return (
    <div
      className="hidden lg:block absolute left-[-30px] bottom-[-20px] w-[300px] xl:w-[360px] 2xl:w-[420px] pointer-events-none select-none opacity-95 z-0"
      aria-hidden="true"
    >
      <svg viewBox="0 0 380 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* ─── Lower floating platform (isometric) ─── */}
        <g>
          {/* top face */}
          <polygon points="40,250 200,220 320,260 160,290" fill="#bfdbfe" />
          {/* front side */}
          <polygon points="40,250 160,290 160,310 40,270" fill="#3b82f6" />
          {/* right side */}
          <polygon points="160,290 320,260 320,280 160,310" fill="#1e40af" />
        </g>

        {/* ─── Upper floating platform (smaller, top-left) ─── */}
        <g>
          <polygon points="20,160 130,140 200,160 90,180" fill="#bfdbfe" />
          <polygon points="20,160 90,180 90,195 20,175" fill="#3b82f6" />
          <polygon points="90,180 200,160 200,175 90,195" fill="#1e40af" />
        </g>

        {/* ─── Whiteboard / wall of papers (on upper platform) ─── */}
        <g>
          {/* board frame */}
          <rect x="40" y="60" width="120" height="100" rx="2" fill="#ffffff" stroke="#1e40af" strokeOpacity="0.4" strokeWidth="1.5" />
          {/* sticky notes */}
          <rect x="50" y="72" width="22" height="22" fill="#fbbf24" />
          <rect x="78" y="72" width="22" height="22" fill="#fb923c" />
          <rect x="106" y="72" width="22" height="22" fill="#60a5fa" />
          <rect x="50" y="100" width="22" height="22" fill="#34d399" />
          <rect x="78" y="100" width="22" height="22" fill="#f472b6" />
          <rect x="106" y="100" width="22" height="22" fill="#fbbf24" />
          {/* lines under */}
          <line x1="50" y1="135" x2="150" y2="135" stroke="#cbd5e1" strokeWidth="2" />
          <line x1="50" y1="145" x2="130" y2="145" stroke="#cbd5e1" strokeWidth="2" />
          <line x1="50" y1="155" x2="140" y2="155" stroke="#cbd5e1" strokeWidth="2" />
        </g>

        {/* ─── Worker A on upper platform (left, reaching up) ─── */}
        <g>
          {/* legs */}
          <rect x="22" y="148" width="4" height="14" fill="#1e3a8a" />
          <rect x="28" y="148" width="4" height="14" fill="#1e3a8a" />
          {/* body — orange shirt */}
          <path d="M18 130 L36 130 L34 150 L20 150 Z" fill="#fb923c" />
          {/* arm reaching up */}
          <line x1="32" y1="135" x2="42" y2="115" stroke="#fdba74" strokeWidth="3" strokeLinecap="round" />
          {/* head */}
          <circle cx="27" cy="124" r="6" fill="#fde7d3" />
          <path d="M22 121 Q27 117 32 121" stroke="#1e3a8a" strokeWidth="1" fill="none" />
        </g>

        {/* ─── Worker B on upper platform (mid, arms out) ─── */}
        <g>
          <rect x="68" y="148" width="4" height="14" fill="#1e3a8a" />
          <rect x="74" y="148" width="4" height="14" fill="#1e3a8a" />
          <path d="M64 130 L82 130 L80 150 L66 150 Z" fill="#fb923c" />
          <line x1="65" y1="135" x2="55" y2="125" stroke="#fdba74" strokeWidth="3" strokeLinecap="round" />
          <line x1="81" y1="135" x2="92" y2="125" stroke="#fdba74" strokeWidth="3" strokeLinecap="round" />
          <circle cx="73" cy="124" r="6" fill="#fde7d3" />
        </g>

        {/* ─── Person on lower platform (with whiteboard / clipboard) ─── */}
        <g>
          {/* legs */}
          <rect x="155" y="240" width="5" height="20" fill="#1e3a8a" />
          <rect x="163" y="240" width="5" height="20" fill="#1e3a8a" />
          {/* body — blue dress / tunic */}
          <path d="M148 210 L172 210 L176 245 L144 245 Z" fill="#3b82f6" />
          {/* arms holding a small clipboard */}
          <line x1="150" y1="218" x2="138" y2="232" stroke="#fde7d3" strokeWidth="3" strokeLinecap="round" />
          <line x1="170" y1="218" x2="182" y2="232" stroke="#fde7d3" strokeWidth="3" strokeLinecap="round" />
          {/* clipboard */}
          <rect x="135" y="225" width="14" height="18" fill="#ffffff" stroke="#1e3a8a" strokeWidth="1" />
          <line x1="138" y1="230" x2="146" y2="230" stroke="#94a3b8" strokeWidth="0.8" />
          <line x1="138" y1="234" x2="146" y2="234" stroke="#94a3b8" strokeWidth="0.8" />
          {/* head with hair */}
          <circle cx="160" cy="202" r="8" fill="#fde7d3" />
          <path d="M152 200 Q160 188 168 200 Q170 195 165 192 Q160 188 155 192 Q150 195 152 200 Z" fill="#1e293b" />
        </g>

        {/* ─── Floating documents / cards behind ─── */}
        <g opacity="0.85">
          <rect x="180" y="170" width="50" height="60" fill="#ffffff" stroke="#1e40af" strokeOpacity="0.3" strokeWidth="1" />
          <rect x="184" y="178" width="32" height="6" fill="#3b82f6" opacity="0.6" />
          <line x1="184" y1="190" x2="220" y2="190" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="184" y1="198" x2="216" y2="198" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="184" y1="206" x2="220" y2="206" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="184" y1="214" x2="210" y2="214" stroke="#cbd5e1" strokeWidth="1.5" />
        </g>

        {/* ─── Decorative lines (data flow) ─── */}
        <g opacity="0.4">
          <line x1="220" y1="100" x2="280" y2="100" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
          <line x1="240" y1="115" x2="290" y2="115" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
          <line x1="225" y1="130" x2="270" y2="130" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

function BakeryIllustrationRight() {
  return (
    <div
      className="hidden lg:block absolute right-[-20px] bottom-[-10px] w-[280px] xl:w-[340px] 2xl:w-[400px] pointer-events-none select-none opacity-95 z-0"
      aria-hidden="true"
    >
      <svg viewBox="0 0 380 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* ─── Floating isometric platform (lower) ─── */}
        <g>
          <polygon points="60,260 220,225 350,265 200,300" fill="#bfdbfe" />
          <polygon points="60,260 200,300 200,318 60,278" fill="#3b82f6" />
          <polygon points="200,300 350,265 350,285 200,318" fill="#1e40af" />
        </g>

        {/* ─── Smaller floating platform (right top) ─── */}
        <g>
          <polygon points="240,150 340,135 380,150 280,170" fill="#bfdbfe" />
          <polygon points="240,150 280,170 280,182 240,162" fill="#3b82f6" />
          <polygon points="280,170 380,150 380,162 280,182" fill="#1e40af" />
        </g>

        {/* ─── Big magnifying glass (upper-right, like the Atlassian one) ─── */}
        <g>
          {/* handle */}
          <line x1="340" y1="115" x2="360" y2="135" stroke="#fb923c" strokeWidth="9" strokeLinecap="round" />
          {/* lens ring */}
          <circle cx="320" cy="90" r="34" fill="#dbeafe" stroke="#3b82f6" strokeWidth="6" />
          {/* small chart inside */}
          <rect x="305" y="90" width="6" height="14" fill="#fb923c" />
          <rect x="313" y="82" width="6" height="22" fill="#fbbf24" />
          <rect x="321" y="86" width="6" height="18" fill="#10b981" />
          <rect x="329" y="78" width="6" height="26" fill="#3b82f6" />
        </g>

        {/* ─── Picture frame on lower platform ─── */}
        <g>
          {/* frame */}
          <rect x="80" y="170" width="80" height="65" fill="#ffffff" stroke="#1e40af" strokeWidth="2" />
          {/* mountains */}
          <polygon points="84,230 100,200 115,215 130,190 150,225 156,230" fill="#bfdbfe" />
          <polygon points="100,230 120,205 135,225 156,230 84,230" fill="#60a5fa" opacity="0.85" />
          {/* sun */}
          <circle cx="140" cy="185" r="6" fill="#fbbf24" />
        </g>

        {/* ─── Worker holding the picture frame (left of frame) ─── */}
        <g>
          {/* legs */}
          <rect x="60" y="245" width="5" height="22" fill="#1e3a8a" />
          <rect x="68" y="245" width="5" height="22" fill="#1e3a8a" />
          {/* body */}
          <path d="M54 215 L78 215 L80 248 L52 248 Z" fill="#fb923c" />
          {/* arm holding frame */}
          <line x1="76" y1="220" x2="86" y2="200" stroke="#fde7d3" strokeWidth="3" strokeLinecap="round" />
          {/* head */}
          <circle cx="66" cy="208" r="7" fill="#fde7d3" />
          <path d="M59 205 Q66 198 73 205" stroke="#1e3a8a" strokeWidth="1.5" fill="none" />
        </g>

        {/* ─── Worker holding pencil (right of frame) ─── */}
        <g>
          {/* legs */}
          <rect x="170" y="248" width="5" height="22" fill="#1e3a8a" />
          <rect x="178" y="248" width="5" height="22" fill="#1e3a8a" />
          {/* body */}
          <path d="M164 218 L188 218 L190 250 L162 250 Z" fill="#fb923c" />
          {/* head */}
          <circle cx="176" cy="211" r="7" fill="#fde7d3" />
          {/* arms holding big pencil */}
          <line x1="166" y1="225" x2="155" y2="240" stroke="#fde7d3" strokeWidth="3" strokeLinecap="round" />
          <line x1="186" y1="225" x2="200" y2="195" stroke="#fde7d3" strokeWidth="3" strokeLinecap="round" />
          {/* pencil */}
          <line x1="155" y1="240" x2="220" y2="175" stroke="#fbbf24" strokeWidth="9" strokeLinecap="round" />
          <line x1="158" y1="237" x2="217" y2="178" stroke="#1e3a8a" strokeWidth="1.5" opacity="0.4" />
          {/* tip */}
          <polygon points="220,175 230,170 225,180" fill="#1e3a8a" />
          {/* eraser */}
          <rect x="148" y="240" width="10" height="6" rx="2" fill="#f472b6" transform="rotate(-45 153 243)" />
        </g>

        {/* ─── Document/cards floating between (back) ─── */}
        <g opacity="0.85">
          <rect x="220" y="195" width="55" height="65" fill="#ffffff" stroke="#1e40af" strokeOpacity="0.3" strokeWidth="1" />
          <rect x="226" y="203" width="35" height="6" fill="#3b82f6" opacity="0.6" />
          <line x1="226" y1="216" x2="268" y2="216" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="226" y1="225" x2="265" y2="225" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="226" y1="234" x2="268" y2="234" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="226" y1="243" x2="258" y2="243" stroke="#cbd5e1" strokeWidth="1.5" />
        </g>

        {/* ─── Worker on the smaller upper platform (with magnifier) ─── */}
        <g>
          <rect x="288" y="160" width="4" height="14" fill="#1e3a8a" />
          <rect x="294" y="160" width="4" height="14" fill="#1e3a8a" />
          <path d="M284 142 L302 142 L300 162 L286 162 Z" fill="#fb923c" />
          <circle cx="293" cy="136" r="6" fill="#fde7d3" />
        </g>

        {/* ─── Decorative dotted lines (right edge) ─── */}
        <g opacity="0.5">
          <line x1="345" y1="180" x2="375" y2="180" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
          <line x1="340" y1="195" x2="370" y2="195" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
          <line x1="350" y1="210" x2="378" y2="210" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          <line x1="345" y1="225" x2="372" y2="225" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* ─── Sparkle ─── */}
        <g opacity="0.7">
          <line x1="240" y1="80" x2="240" y2="92" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="234" y1="86" x2="246" y2="86" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
