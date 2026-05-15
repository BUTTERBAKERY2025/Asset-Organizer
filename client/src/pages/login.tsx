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
  },
} as const;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isLoggingIn, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [formKey, setFormKey] = useState(0);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (honeypot) {
      setError(t.loginFailed);
      return;
    }

    try {
      const userData = await login({ username, password, rememberMe });

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
      } else {
        setLocation(next);
      }
    } catch (err: any) {
      setPassword("");
      setFormKey((prev) => prev + 1);
      setError(err.message || t.loginFailed);
    }
  };

  const textAlignClass = isRTL ? "text-right" : "text-left";

  return (
    <main
      dir={isRTL ? "rtl" : "ltr"}
      lang={lang}
      className="min-h-screen min-h-[100dvh] flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_20%_10%,#fef6ec_0%,transparent_45%),radial-gradient(circle_at_85%_90%,#eaf5ee_0%,transparent_50%),linear-gradient(180deg,#f8fafc_0%,#f4f6fa_100%)]"
    >
      {/* Language toggle (top corner) */}
      <button
        type="button"
        onClick={toggleLang}
        className="absolute top-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-slate-200 text-[12px] font-semibold text-[#1a3a2f] hover:bg-white hover:border-[#e67e22] hover:text-[#e67e22] transition-all shadow-sm"
        style={isRTL ? { left: 16 } : { right: 16 }}
        aria-label="Switch language"
        data-testid="button-lang-toggle"
      >
        <Languages className="w-3.5 h-3.5" />
        {t.switchLang}
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

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 relative z-10">
        <div className="w-full max-w-[420px] animate-[fadeInUp_0.5s_ease-out]">
          <style>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.08)] border border-slate-200/60 p-7 sm:p-9">
            {/* Header: large logo + system title */}
            <div className="flex flex-col items-center text-center mb-6">
              <img
                src={logo}
                alt="Butter Bakery"
                className="h-32 sm:h-36 md:h-40 w-auto drop-shadow-md"
                data-testid="img-logo"
              />
              <h1 className="text-[17px] sm:text-lg md:text-xl font-extrabold text-[#1a3a2f] mt-3 leading-tight tracking-wide">
                {t.systemTitle}
              </h1>
              <p className="text-[12px] sm:text-[13px] text-slate-500 mt-1">
                {t.subtitle}
              </p>
              <div className="w-12 h-[3px] bg-[#e67e22] rounded-full mt-3"></div>
            </div>

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
                    className={`h-11 ${isRTL ? "pr-10" : "pl-10"} bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#e67e22] focus:ring-2 focus:ring-[#e67e22]/20 rounded-lg ${textAlignClass} text-sm transition-all`}
                    data-testid="input-username"
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
                    className={`h-11 pr-10 pl-10 bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#e67e22] focus:ring-2 focus:ring-[#e67e22]/20 rounded-lg ${textAlignClass} text-sm transition-all`}
                    data-testid="input-password"
                    required
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#e67e22] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30 ${isRTL ? "left-3" : "right-3"}`}
                    aria-label={showPassword ? t.hidePwd : t.showPwd}
                    tabIndex={-1}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me + Help */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    className="h-4 w-4 border-slate-400 data-[state=checked]:bg-[#e67e22] data-[state=checked]:border-[#e67e22]"
                    data-testid="checkbox-remember-me"
                  />
                  <Label
                    htmlFor="rememberMe"
                    className="text-slate-600 cursor-pointer text-[13px] select-none"
                  >
                    {t.remember}
                  </Label>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-[#e67e22] transition-colors"
                      data-testid="button-help-menu"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {t.needHelp}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem asChild>
                      <a
                        href="https://wa.me/966500000000"
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
                        href="mailto:admin@butterbakery.co"
                        className="flex items-center gap-2 cursor-pointer"
                        data-testid="link-email-admin"
                      >
                        <Mail className="w-4 h-4 text-[#1a3a2f]" />
                        {t.contactAdmin}
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a
                        href="mailto:admin@butterbakery.co?subject=Forgot%20password"
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
                className="w-full h-11 text-sm font-semibold bg-[#e67e22] hover:bg-[#d35400] text-white rounded-lg shadow-sm hover:shadow-md hover:shadow-[#e67e22]/25 transition-all duration-200 active:scale-[0.99]"
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
          </div>

          {/* Compact footer below card */}
          <div className="flex flex-col items-center gap-1 mt-5 text-center">
            <a
              href="https://www.butterbakery.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-slate-400 hover:text-[#e67e22] transition-colors tracking-wider"
              data-testid="link-website"
            >
              www.butterbakery.co
            </a>
            <p className="text-[10px] text-slate-400">
              © {new Date().getFullYear()} {t.rights}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─── Bakery-themed decorative SVGs (lg+ only, far from card) ─── */

function BakeryIllustrationLeft() {
  return (
    <div
      className="hidden lg:block absolute left-[-30px] bottom-[-20px] w-[300px] xl:w-[360px] pointer-events-none select-none opacity-95 z-0"
      aria-hidden="true"
    >
      <svg viewBox="0 0 360 260" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* shadow */}
        <ellipse cx="170" cy="240" rx="160" ry="10" fill="#1a3a2f" opacity="0.06" />

        {/* wooden table */}
        <rect x="20" y="200" width="320" height="14" rx="2" fill="#a16207" />
        <rect x="20" y="214" width="320" height="6" fill="#854d0e" />

        {/* flour sack */}
        <path d="M50 200 L50 140 Q50 120 70 115 L100 110 Q120 108 122 130 L130 200 Z" fill="#fef3c7" stroke="#1a3a2f" strokeOpacity="0.25" strokeWidth="1.5" />
        <path d="M70 115 Q90 100 100 115" stroke="#1a3a2f" strokeOpacity="0.3" strokeWidth="1.5" fill="none" />
        <text x="72" y="170" fontSize="11" fill="#1a3a2f" opacity="0.55" fontFamily="Arial" fontWeight="bold">FLOUR</text>
        {/* flour spill */}
        <ellipse cx="55" cy="200" rx="22" ry="3" fill="#ffffff" opacity="0.85" />

        {/* baguette / bread loaf */}
        <ellipse cx="200" cy="190" rx="70" ry="16" fill="#d97706" />
        <ellipse cx="200" cy="186" rx="68" ry="14" fill="#f59e0b" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={155 + i * 22}
            y1={178}
            x2={165 + i * 22}
            y2={194}
            stroke="#92400e"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}

        {/* coffee cup with steam */}
        <path d="M270 180 L268 200 Q268 210 280 210 L300 210 Q312 210 312 200 L310 180 Z" fill="#1a3a2f" />
        <ellipse cx="290" cy="180" rx="20" ry="4" fill="#7c3a13" />
        <path d="M310 188 Q322 188 322 195 Q322 202 312 202" stroke="#1a3a2f" strokeWidth="2" fill="none" />
        {/* steam */}
        <path d="M280 170 Q283 162 280 155 Q277 148 280 142" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
        <path d="M295 170 Q298 162 295 155 Q292 148 295 142" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />

        {/* small croissant */}
        <path d="M150 195 Q140 175 155 170 Q175 168 180 185 Q175 195 165 195 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
        <line x1="155" y1="180" x2="170" y2="190" stroke="#92400e" strokeWidth="1" />

        {/* wheat decoration */}
        <line x1="60" y1="105" x2="50" y2="60" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
        {[0, 1, 2, 3].map((i) => (
          <ellipse key={i} cx={56 - i * 2} cy={95 - i * 10} rx="3" ry="6" fill="#fbbf24" stroke="#92400e" strokeWidth="0.8" transform={`rotate(${-15 + i * 3} ${56 - i * 2} ${95 - i * 10})`} />
        ))}
      </svg>
    </div>
  );
}

function BakeryIllustrationRight() {
  return (
    <div
      className="hidden lg:block absolute right-[-20px] bottom-[-10px] w-[280px] xl:w-[340px] pointer-events-none select-none opacity-95 z-0"
      aria-hidden="true"
    >
      <svg viewBox="0 0 340 260" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* shadow */}
        <ellipse cx="170" cy="240" rx="150" ry="10" fill="#1a3a2f" opacity="0.06" />

        {/* dashboard / report tablet */}
        <rect x="40" y="80" width="180" height="130" rx="10" fill="#ffffff" stroke="#1a3a2f" strokeOpacity="0.25" strokeWidth="2" />
        <rect x="40" y="80" width="180" height="22" rx="10" fill="#1a3a2f" />
        <rect x="40" y="98" width="180" height="4" fill="#1a3a2f" />
        <circle cx="52" cy="91" r="3" fill="#e67e22" />
        <circle cx="62" cy="91" r="3" fill="#fbbf24" />
        <circle cx="72" cy="91" r="3" fill="#10b981" />
        {/* mini bar chart */}
        <rect x="55" y="160" width="14" height="40" fill="#e67e22" rx="2" />
        <rect x="75" y="140" width="14" height="60" fill="#fbbf24" rx="2" />
        <rect x="95" y="170" width="14" height="30" fill="#10b981" rx="2" />
        <rect x="115" y="150" width="14" height="50" fill="#3b82f6" rx="2" />
        <rect x="135" y="155" width="14" height="45" fill="#8b5cf6" rx="2" />
        <rect x="155" y="135" width="14" height="65" fill="#e67e22" rx="2" />
        {/* line */}
        <polyline points="50,130 80,118 110,125 140,108 170,115 200,100" stroke="#1a3a2f" strokeWidth="2" fill="none" strokeOpacity="0.5" />
        {[
          [50, 130],
          [80, 118],
          [110, 125],
          [140, 108],
          [170, 115],
          [200, 100],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#e67e22" />
        ))}

        {/* cupcake on the right */}
        <path d="M250 200 L240 160 L290 160 L280 200 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
        <path d="M240 160 Q243 145 250 145 Q255 138 265 142 Q272 135 280 142 Q288 140 290 155 Q295 160 290 165 L240 165 Z" fill="#fce7f3" stroke="#be185d" strokeWidth="1.5" opacity="0.95" />
        <circle cx="265" cy="138" r="3" fill="#dc2626" />
        {/* sprinkles */}
        <line x1="250" y1="155" x2="252" y2="160" stroke="#dc2626" strokeWidth="1.5" />
        <line x1="270" y1="152" x2="273" y2="157" stroke="#10b981" strokeWidth="1.5" />
        <line x1="280" y1="155" x2="282" y2="160" stroke="#3b82f6" strokeWidth="1.5" />

        {/* wooden shelf */}
        <rect x="20" y="210" width="320" height="10" fill="#a16207" />

        {/* chef hat decoration top */}
        <path d="M295 90 Q305 72 320 78 Q330 65 322 82 Q335 80 332 95 L295 95 Z" fill="#ffffff" stroke="#1a3a2f" strokeOpacity="0.4" strokeWidth="1.5" />
        <rect x="295" y="93" width="40" height="8" fill="#ffffff" stroke="#1a3a2f" strokeOpacity="0.4" strokeWidth="1.5" />

        {/* sparkle */}
        <g opacity="0.7">
          <line x1="230" y1="60" x2="230" y2="70" stroke="#e67e22" strokeWidth="2" strokeLinecap="round" />
          <line x1="225" y1="65" x2="235" y2="65" stroke="#e67e22" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
