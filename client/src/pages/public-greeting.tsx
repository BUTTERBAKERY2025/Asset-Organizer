import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, AlertCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type GreetingData = {
  title: string;
  content: string;
  messageType: string;
  emoji: string | null;
  effectType: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  accentColor: string | null;
  imageUrl: string | null;
  defaultRecipientName: string | null;
  expiresAt: string | null;
};

type Theme =
  | "eid_adha"
  | "eid_fitr"
  | "ramadan"
  | "national"
  | "founding"
  | "anniversary"
  | "birthday"
  | "promotion"
  | "achievement"
  | "thank_you"
  | "default";

function detectTheme(d: GreetingData): Theme {
  const haystack = `${d.title} ${d.content} ${d.emoji || ""}`.toLowerCase();
  if (haystack.includes("أضحى") || haystack.includes("🐑") || haystack.includes("🐏") || haystack.includes("🕋")) return "eid_adha";
  if (haystack.includes("فطر") || (haystack.includes("عيد") && !haystack.includes("أضحى"))) return "eid_fitr";
  if (haystack.includes("رمضان") || haystack.includes("🌙")) return "ramadan";
  if (haystack.includes("اليوم الوطني") || haystack.includes("🇸🇦")) return "national";
  if (haystack.includes("تأسيس") || haystack.includes("🌴")) return "founding";
  if (haystack.includes("ذكرى") || haystack.includes("التحاق") || haystack.includes("🏆")) return "anniversary";
  if (haystack.includes("ميلاد") || haystack.includes("🎂")) return "birthday";
  if (haystack.includes("ترقية") || haystack.includes("🥇")) return "promotion";
  if (d.effectType === "stars" || haystack.includes("تقدير") || haystack.includes("⭐")) return "achievement";
  if (haystack.includes("شكر") || haystack.includes("💐") || haystack.includes("❤️")) return "thank_you";
  return "default";
}

const THEME_CONFIG: Record<Theme, { decorations: string[]; bg: string; bigEmoji: string; tagline: string }> = {
  eid_adha:    { decorations: ["🐑", "🕋", "🎈", "🌙", "✨", "🐏", "🎊"], bg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%)", bigEmoji: "🕋", tagline: "عيد أضحى مبارك" },
  eid_fitr:    { decorations: ["🌙", "🏮", "✨", "🎈", "⭐", "🕌", "🎊"], bg: "linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%)", bigEmoji: "🌙", tagline: "عيد فطر سعيد" },
  ramadan:     { decorations: ["🌙", "🏮", "⭐", "✨", "🕌"], bg: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #7c3aed 100%)", bigEmoji: "🌙", tagline: "رمضان كريم" },
  national:    { decorations: ["🇸🇦", "🌴", "🎆", "✨", "💚", "⭐"], bg: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)", bigEmoji: "🇸🇦", tagline: "هي لنا دار" },
  founding:    { decorations: ["🌴", "🏛️", "✨", "💚", "🐪"], bg: "linear-gradient(135deg, #422006 0%, #78350f 100%)", bigEmoji: "🌴", tagline: "يوم بدينا" },
  anniversary: { decorations: ["🏆", "🎉", "🎊", "⭐", "✨", "🥇"], bg: "linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)", bigEmoji: "🏆", tagline: "كل عام وأنت أحد رموز نجاحنا" },
  birthday:    { decorations: ["🎂", "🎈", "🎁", "🎉", "✨", "🧁"], bg: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)", bigEmoji: "🎂", tagline: "كل عام وأنت بخير" },
  promotion:   { decorations: ["🥇", "🏆", "⭐", "✨", "🎊"], bg: "linear-gradient(135deg, #fef3c7 0%, #f59e0b 100%)", bigEmoji: "🥇", tagline: "مبروك الترقية" },
  achievement: { decorations: ["⭐", "✨", "🌟", "💫", "🏅"], bg: "linear-gradient(135deg, #fff8e1 0%, #ffe082 100%)", bigEmoji: "⭐", tagline: "شكر وتقدير" },
  thank_you:   { decorations: ["💐", "❤️", "🌹", "✨", "🌟"], bg: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)", bigEmoji: "💐", tagline: "شكراً من القلب" },
  default:     { decorations: ["🎊", "✨", "🎉", "⭐", "🌟"], bg: "linear-gradient(135deg, #fffbe6 0%, #fef3c7 100%)", bigEmoji: "🎉", tagline: "Butter Bakery" },
};

function FloatingDecoration({ emoji, delay, x, size }: { emoji: string; delay: number; x: number; size: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ left: `${x}%`, fontSize: `${size}px`, bottom: -60 }}
      initial={{ y: 0, opacity: 0 }}
      animate={{
        y: -window.innerHeight - 100,
        opacity: [0, 1, 1, 0],
        rotate: [0, 15, -10, 8, 0],
      }}
      transition={{
        duration: 8 + Math.random() * 6,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {emoji}
    </motion.div>
  );
}

function ConfettiBurst({ accent }: { accent: string }) {
  const pieces = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: [accent, "#fbbf24", "#f59e0b", "#fde68a", "#ffffff"][i % 5],
    delay: Math.random() * 0.5,
    rotate: Math.random() * 360,
  })), [accent]);
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{ left: `${p.x}%`, top: -20, width: 10, height: 10, backgroundColor: p.color }}
          initial={{ y: 0, rotate: 0, opacity: 1 }}
          animate={{ y: window.innerHeight + 100, rotate: p.rotate + 720, opacity: [1, 1, 0] }}
          transition={{ duration: 3 + Math.random() * 2, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

function personalize(text: string, name: string): string {
  if (!name) return text.replace(/\{\{name\}\}/g, "").replace(/\{\{years\}\}/g, "");
  return text.replace(/\{\{name\}\}/g, name).replace(/\{\{years\}\}/g, "");
}

export default function PublicGreetingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<GreetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confettiVisible, setConfettiVisible] = useState(true);
  const [revealed, setRevealed] = useState(false);

  const recipientName = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("name")?.trim() || data?.defaultRecipientName || "";
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/greetings/${slug}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "تعذّر فتح التهنئة");
        }
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        // Fire-and-forget view tracking
        fetch(`/api/public/greetings/${slug}/view`, { method: "POST" }).catch(() => {});
      } catch (e: any) {
        if (!cancelled) setError(e.message || "خطأ غير معروف");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Auto-reveal after a short delay for dramatic effect
  useEffect(() => {
    if (data && !revealed) {
      const t = setTimeout(() => setRevealed(true), 600);
      return () => clearTimeout(t);
    }
  }, [data, revealed]);

  // Stop confetti after 6 seconds to reduce CPU
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setConfettiVisible(false), 6000);
    return () => clearTimeout(t);
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100" dir="rtl">
        <div className="flex flex-col items-center gap-3" data-testid="loading-greeting">
          <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
          <p className="text-amber-800 font-medium">جاري تحضير التهنئة...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50 p-6" dir="rtl">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center" data-testid="error-greeting">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">عذراً</h1>
          <p className="text-gray-600">{error || "تعذّر فتح التهنئة"}</p>
          <p className="text-xs text-gray-400 mt-4">Butter Bakery</p>
        </div>
      </div>
    );
  }

  const theme = detectTheme(data);
  const cfg = THEME_CONFIG[theme];
  const accent = data.accentColor || "#d4a017";
  const personalContent = personalize(data.content, recipientName);
  const personalTitle = personalize(data.title, recipientName);

  // Build floating decorations (only on client, after mount)
  const decorations = typeof window === "undefined" ? [] :
    Array.from({ length: 14 }, (_, i) => ({
      emoji: cfg.decorations[i % cfg.decorations.length],
      delay: i * 0.7,
      x: (i * 7 + 5) % 95,
      size: 30 + (i % 4) * 12,
    }));

  const handleShare = async () => {
    const shareData = {
      title: data.title,
      text: data.title,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert("تم نسخ الرابط ✅");
      } catch {}
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 overflow-hidden relative"
      style={{ background: cfg.bg, fontFamily: "'Cairo', sans-serif" }}
      dir="rtl"
      data-testid="public-greeting"
    >
      {/* Floating background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {decorations.map((d, i) => (
          <FloatingDecoration key={i} {...d} />
        ))}
      </div>

      {/* Confetti burst on reveal */}
      <AnimatePresence>{confettiVisible && <ConfettiBurst accent={accent} />}</AnimatePresence>

      {/* Main greeting card */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            className="relative z-10 w-full max-w-2xl"
            initial={{ scale: 0.3, opacity: 0, rotateY: -90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 15, duration: 1 }}
          >
            <div
              className="rounded-3xl shadow-2xl p-8 md:p-12 backdrop-blur-sm border-2"
              style={{
                backgroundColor: data.backgroundColor ? `${data.backgroundColor}f5` : "rgba(255,255,255,0.95)",
                borderColor: accent,
              }}
            >
              {/* Butter Bakery Logo */}
              <motion.div
                className="flex justify-center mb-4"
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                <img
                  src="/butter-logo.png"
                  alt="Butter Bakery"
                  className="h-20 md:h-24 w-auto object-contain drop-shadow-lg"
                  data-testid="img-logo"
                />
              </motion.div>

              {/* Big themed emoji */}
              <motion.div
                className="text-center mb-4"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: [0, 1.3, 1], rotate: [180, 0, 0] }}
                transition={{ delay: 0.6, duration: 0.8 }}
              >
                <span className="text-7xl md:text-9xl inline-block" data-testid="big-emoji">
                  {data.emoji || cfg.bigEmoji}
                </span>
              </motion.div>

              {/* Personal name greeting */}
              {recipientName && (
                <motion.div
                  className="text-center mb-4"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  data-testid="text-recipient-greeting"
                >
                  <p className="text-sm md:text-base font-medium" style={{ color: data.textColor || "#5a3e00", opacity: 0.7 }}>
                    إلى الزميل/ـة
                  </p>
                  <p className="text-3xl md:text-5xl font-bold mt-1" style={{ color: accent }} data-testid="text-recipient-name">
                    {recipientName}
                  </p>
                </motion.div>
              )}

              {/* Title */}
              <motion.h1
                className="text-2xl md:text-4xl font-bold text-center mb-4"
                style={{ color: data.textColor || "#1a1a1a" }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.0, duration: 0.5 }}
                data-testid="text-title"
              >
                {personalTitle}
              </motion.h1>

              {/* Tagline */}
              <motion.p
                className="text-center text-lg md:text-xl font-semibold mb-6"
                style={{ color: accent }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                ✨ {cfg.tagline} ✨
              </motion.p>

              {/* Content */}
              <motion.div
                className="text-center text-base md:text-lg leading-loose whitespace-pre-line mb-6"
                style={{ color: data.textColor || "#3a2a00" }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.3, duration: 0.6 }}
                data-testid="text-content"
              >
                {personalContent}
              </motion.div>

              {/* Optional image */}
              {data.imageUrl && (
                <motion.div
                  className="flex justify-center mb-6"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                >
                  <img
                    src={data.imageUrl}
                    alt=""
                    className="max-h-64 rounded-2xl shadow-lg"
                    data-testid="img-greeting"
                  />
                </motion.div>
              )}

              {/* Footer & share button */}
              <motion.div
                className="flex flex-col items-center gap-3 pt-4 border-t-2"
                style={{ borderColor: `${accent}33` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 }}
              >
                <p className="text-sm md:text-base font-bold flex items-center gap-2" style={{ color: accent }}>
                  <Sparkles className="w-4 h-4" />
                  Butter Bakery
                  <Sparkles className="w-4 h-4" />
                </p>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  size="sm"
                  className="rounded-full border-2 hover:scale-105 transition-transform"
                  style={{ borderColor: accent, color: accent }}
                  data-testid="button-share"
                >
                  <Share2 className="w-4 h-4 ml-2" />
                  مشاركة التهنئة
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
