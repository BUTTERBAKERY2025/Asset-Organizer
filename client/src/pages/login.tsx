import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useWelcomeSound } from "@/hooks/use-notification-sounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, HelpCircle, Mail } from "lucide-react";
import logo from "@assets/logo_butter_bakery__1768502624540.png";

const REMEMBER_KEY = "__btr_ru";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isLoggingIn, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [formKey, setFormKey] = useState(0);

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
      setError("فشل تسجيل الدخول");
      return;
    }

    try {
      const userData = await login({ username, password, rememberMe });

      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ u: username }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      if (userData?.role === "attendance_clerk") {
        setLocation("/attendance-check");
      } else {
        setLocation("/");
      }
    } catch (err: any) {
      setPassword("");
      setFormKey((prev) => prev + 1);
      setError(err.message || "فشل تسجيل الدخول");
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#f7f9fc] relative overflow-hidden" dir="rtl">
      {/* Decorative illustrations on both bottom corners */}
      <SideIllustrationLeft />
      <SideIllustrationRight />

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14 relative z-10">
        <div className="w-full max-w-[440px]">
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.08)] border border-slate-200/70 p-7 sm:p-9">
            {/* Logo + Title */}
            <div className="flex flex-col items-center text-center mb-6">
              <img
                src={logo}
                alt="Butter Bakery"
                className="h-14 sm:h-16 w-auto mb-2"
                data-testid="img-logo"
              />
              <div className="text-[11px] tracking-[0.35em] text-[#e67e22] font-bold mt-1">
                BUTTER BAKERY
              </div>
              <h1 className="text-[15px] sm:text-base font-semibold text-[#1a3a2f] mt-4">
                تسجيل الدخول للمتابعة
              </h1>
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

              {/* Username */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="username"
                  className="text-[13px] font-semibold text-slate-700"
                >
                  اسم المستخدم <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  name="btr_user_field"
                  type="text"
                  placeholder="أدخل اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={(e) => e.target.removeAttribute("readonly")}
                  readOnly
                  autoComplete="off"
                  className="h-11 bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#e67e22] focus:ring-2 focus:ring-[#e67e22]/20 rounded-md text-right text-sm"
                  data-testid="input-username"
                  required
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-[13px] font-semibold text-slate-700"
                >
                  كلمة المرور <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  name="btr_pass_field"
                  type="password"
                  placeholder="أدخل كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={(e) => e.target.removeAttribute("readonly")}
                  readOnly
                  autoComplete="new-password"
                  className="h-11 bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#e67e22] focus:ring-2 focus:ring-[#e67e22]/20 rounded-md text-right text-sm"
                  data-testid="input-password"
                  required
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                />
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2 pt-1">
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
                  تذكرني
                </Label>
              </div>

              {error && (
                <div
                  className="text-red-700 text-[13px] text-center px-3 py-2 bg-red-50 border border-red-200 rounded-md"
                  data-testid="text-error"
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold bg-[#e67e22] hover:bg-[#d35400] text-white rounded-md shadow-sm transition-colors"
                disabled={isLoggingIn}
                data-testid="button-login"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    <span>جارٍ الدخول...</span>
                  </>
                ) : (
                  "متابعة"
                )}
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-slate-400 text-xs">أو</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              {/* Secondary actions (visual only — keep auth logic untouched) */}
              <a
                href="https://wa.me/966500000000?text=احتاج%20مساعدة%20في%20الدخول%20لنظام%20باتر%20بيكري"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-11 border border-slate-300 rounded-md text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                data-testid="link-whatsapp-help"
              >
                <HelpCircle className="w-4 h-4 text-[#25D366]" />
                طلب مساعدة عبر واتساب
              </a>

              <a
                href="mailto:admin@butterbakery.co?subject=طلب%20استعادة%20كلمة%20المرور"
                className="flex items-center justify-center gap-2 h-11 border border-slate-300 rounded-md text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                data-testid="link-email-admin"
              >
                <Mail className="w-4 h-4 text-[#1a3a2f]" />
                تواصل مع المسؤول
              </a>

              {/* Help links */}
              <div className="flex items-center justify-center gap-2 pt-3 text-[12px] text-slate-500">
                <a
                  href="mailto:admin@butterbakery.co?subject=نسيت%20كلمة%20المرور"
                  className="underline underline-offset-2 hover:text-[#e67e22] transition-colors"
                  data-testid="link-forgot-password"
                >
                  هل نسيت كلمة المرور؟
                </a>
                <span className="text-slate-300">•</span>
                <a
                  href="https://www.butterbakery.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[#e67e22] transition-colors"
                  data-testid="link-website"
                >
                  زيارة الموقع
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom footer */}
      <div className="relative z-10 shrink-0 pb-6 pt-2 px-4">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-5 w-auto opacity-70" />
            <span className="text-[12px] font-bold tracking-widest text-slate-600">
              BUTTER BAKERY
            </span>
          </div>
          <p className="text-[11px] text-slate-400 text-center max-w-md">
            حساب موحد لإدارة المشروعات والأصول والصيانة والمبيعات والموارد البشرية
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Decorative SVG illustrations (Atlassian-inspired flat style) ─── */
function SideIllustrationLeft() {
  return (
    <div
      className="hidden md:block absolute left-0 bottom-0 w-[280px] lg:w-[340px] xl:w-[380px] pointer-events-none select-none opacity-90"
      aria-hidden="true"
    >
      <svg viewBox="0 0 380 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* ground plates */}
        <ellipse cx="120" cy="250" rx="110" ry="14" fill="#e2e8f0" />
        <ellipse cx="280" cy="265" rx="80" ry="10" fill="#e2e8f0" />

        {/* tall building */}
        <rect x="40" y="90" width="120" height="160" fill="#cfe3f9" />
        <rect x="40" y="90" width="120" height="14" fill="#1a3a2f" opacity="0.85" />
        {/* windows grid */}
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 4 }).map((_, c) => (
            <rect
              key={`w-${r}-${c}`}
              x={50 + c * 28}
              y={115 + r * 24}
              width="20"
              height="16"
              fill="#ffffff"
              stroke="#1a3a2f"
              strokeOpacity="0.15"
            />
          ))
        )}

        {/* small building */}
        <rect x="180" y="160" width="80" height="90" fill="#fde0c2" />
        <rect x="180" y="160" width="80" height="10" fill="#e67e22" />
        <rect x="190" y="180" width="20" height="20" fill="#ffffff" />
        <rect x="220" y="180" width="20" height="20" fill="#ffffff" />
        <rect x="190" y="210" width="20" height="20" fill="#ffffff" />
        <rect x="220" y="210" width="50" height="40" fill="#1a3a2f" opacity="0.7" />

        {/* worker on ladder (left building) */}
        <line x1="155" y1="120" x2="155" y2="240" stroke="#94a3b8" strokeWidth="2" />
        <line x1="165" y1="120" x2="165" y2="240" stroke="#94a3b8" strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1="155" y1={140 + i * 18} x2="165" y2={140 + i * 18} stroke="#94a3b8" strokeWidth="2" />
        ))}
        {/* worker silhouette */}
        <circle cx="160" cy="135" r="6" fill="#1a3a2f" />
        <rect x="155" y="142" width="10" height="14" rx="2" fill="#e67e22" />

        {/* small person bottom */}
        <circle cx="100" cy="232" r="6" fill="#1a3a2f" />
        <rect x="95" y="240" width="10" height="14" rx="2" fill="#3b82f6" />

        {/* document floating */}
        <rect x="270" y="120" width="60" height="50" fill="#ffffff" stroke="#1a3a2f" strokeOpacity="0.3" />
        <line x1="278" y1="132" x2="322" y2="132" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="278" y1="142" x2="322" y2="142" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="278" y1="152" x2="310" y2="152" stroke="#cbd5e1" strokeWidth="2" />
      </svg>
    </div>
  );
}

function SideIllustrationRight() {
  return (
    <div
      className="hidden md:block absolute right-0 bottom-0 w-[260px] lg:w-[320px] xl:w-[360px] pointer-events-none select-none opacity-90"
      aria-hidden="true"
    >
      <svg viewBox="0 0 360 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* ground */}
        <ellipse cx="180" cy="260" rx="170" ry="14" fill="#e2e8f0" />

        {/* big chart card */}
        <rect x="30" y="110" width="170" height="130" rx="6" fill="#ffffff" stroke="#1a3a2f" strokeOpacity="0.2" />
        <rect x="30" y="110" width="170" height="22" rx="6" fill="#1a3a2f" opacity="0.85" />
        <rect x="50" y="170" width="20" height="50" fill="#e67e22" />
        <rect x="80" y="150" width="20" height="70" fill="#fbbf24" />
        <rect x="110" y="180" width="20" height="40" fill="#10b981" />
        <rect x="140" y="160" width="20" height="60" fill="#3b82f6" />

        {/* magnifying glass person */}
        <circle cx="270" cy="140" r="35" fill="none" stroke="#3b82f6" strokeWidth="6" />
        <line x1="295" y1="165" x2="320" y2="190" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
        <circle cx="270" cy="140" r="28" fill="#fef3c7" opacity="0.6" />

        {/* worker holding picture */}
        <rect x="220" y="195" width="50" height="40" fill="#fde0c2" stroke="#e67e22" strokeWidth="2" />
        <polyline points="225,225 240,205 255,220 265,210" stroke="#1a3a2f" strokeWidth="2" fill="none" />
        <circle cx="230" cy="210" r="3" fill="#fbbf24" />

        {/* worker silhouette */}
        <circle cx="285" cy="220" r="7" fill="#1a3a2f" />
        <rect x="279" y="228" width="12" height="18" rx="2" fill="#e67e22" />

        {/* pencil */}
        <line x1="295" y1="200" x2="335" y2="160" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
        <polygon points="335,160 340,165 330,170" fill="#1a3a2f" />

        {/* tiny person */}
        <circle cx="180" cy="248" r="5" fill="#1a3a2f" />
        <rect x="176" y="254" width="8" height="10" rx="2" fill="#3b82f6" />
      </svg>
    </div>
  );
}
