import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Calendar, Clock, Sparkles, Crown, PartyPopper } from "lucide-react";
import logo from "@assets/logo_butter_bakery__1768502624540.png";

interface InvitationData {
  guestName: string;
  invitation: {
    title: string;
    branchName?: string | null;
    eventDate?: string | null;
    eventTime?: string | null;
    location?: string | null;
    locationUrl?: string | null;
    message?: string | null;
    imageUrl?: string | null;
    theme: string;
  };
  company: {
    nameAr: string;
    nameEn: string;
    legalForm: string;
    commercialRegister: string;
  };
}

const THEMES: Record<string, { bg: string; accent: string; soft: string; ring: string; text: string }> = {
  gold: {
    bg: "from-[#1a1206] via-[#2a1d08] to-[#0c0903]",
    accent: "#e6b450",
    soft: "#f5d488",
    ring: "rgba(230,180,80,0.35)",
    text: "#f8edd0",
  },
  royal: {
    bg: "from-[#0b0a1f] via-[#171338] to-[#070611]",
    accent: "#a98bff",
    soft: "#c9b6ff",
    ring: "rgba(169,139,255,0.35)",
    text: "#ece8ff",
  },
  emerald: {
    bg: "from-[#04140f] via-[#072a1f] to-[#020a07]",
    accent: "#34d399",
    soft: "#9ff0cf",
    ring: "rgba(52,211,153,0.35)",
    text: "#e3fff3",
  },
  rose: {
    bg: "from-[#1c0710] via-[#2f0c1d] to-[#0c0307]",
    accent: "#fb7185",
    soft: "#ffb4c0",
    ring: "rgba(251,113,133,0.35)",
    text: "#ffe7ec",
  },
};

function formatDateAr(value?: string | null): string | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("ar-SA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return null;
  }
}

// نغمة افتتاح فاخرة (Web Audio — لا تحتاج ملف صوت، وتعمل عند الضغط لتفادي حظر التشغيل التلقائي)
function playOpenChime() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6 — أربيجو ماجور
    notes.forEach((freq, i) => {
      const t = now + i * 0.13;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.8);
    });
    // لمعة عالية ناعمة
    const shimmer = ctx.createOscillator();
    const sg = ctx.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(1568, now);
    sg.gain.setValueAtTime(0.0001, now + 0.45);
    sg.gain.exponentialRampToValueAtTime(0.07, now + 0.55);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);
    shimmer.connect(sg);
    sg.connect(ctx.destination);
    shimmer.start(now + 0.45);
    shimmer.stop(now + 2.4);
    // إغلاق سياق الصوت بعد انتهاء النغمة لتحرير الموارد
    setTimeout(() => {
      try {
        if (ctx.state !== "closed") ctx.close();
      } catch {
        /* تجاهل */
      }
    }, 2600);
  } catch {
    /* تجاهل أي خطأ صوتي بصمت */
  }
}

function FloatingSparkles({ accent }: { accent: string }) {
  const items = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 4,
        duration: 5 + Math.random() * 6,
        size: 5 + Math.random() * 12,
        opacity: 0.25 + Math.random() * 0.5,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((s) => (
        <motion.span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            bottom: -20,
            width: s.size,
            height: s.size,
            background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
            opacity: s.opacity,
          }}
          animate={{ y: [0, -760], opacity: [0, s.opacity, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function ConfettiBurst({ accent, soft }: { accent: string; soft: string }) {
  const colors = [accent, soft, "#ffffff", "#ffd56b"];
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2.4 + Math.random() * 2.2,
        size: 6 + Math.random() * 8,
        color: colors[i % colors.length],
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 180,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-[2px]"
          style={{ left: `${p.left}%`, top: -20, width: p.size, height: p.size * 1.6, background: p.color }}
          initial={{ y: -30, opacity: 1, rotate: p.rotate }}
          animate={{ y: "110vh", x: p.drift, opacity: [1, 1, 0], rotate: p.rotate + 360 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

function Brand({ theme, size = "md" }: { theme: any; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-12" : "h-16 sm:h-20";
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.img
        src={logo}
        alt="Butter Bakery"
        className={`${h} w-auto drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]`}
        initial={{ opacity: 0, scale: 0.7, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        data-testid="img-brand-logo"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-[11px] sm:text-xs font-extrabold tracking-[0.35em]"
        style={{
          backgroundImage: `linear-gradient(90deg, ${theme.accent}, #fff, ${theme.soft}, ${theme.accent})`,
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
        data-testid="text-brand-name"
      >
        <motion.span
          className="inline-block"
          animate={{ backgroundPosition: ["0% center", "200% center"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          style={{ backgroundImage: "inherit", backgroundSize: "inherit", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
        >
          BUTTER BAKERY
        </motion.span>
      </motion.div>
    </div>
  );
}

export default function InvitationPage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token;
  const [opened, setOpened] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  const { data, isLoading, isError } = useQuery<InvitationData>({
    queryKey: [`/api/public/invite/${token}`],
    enabled: !!token,
    retry: 1,
  });

  const theme = THEMES[data?.invitation.theme || "gold"] || THEMES.gold;

  const handleOpen = () => {
    if (opened) return;
    playOpenChime();
    setOpened(true);
    setConfetti(true);
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(() => setConfetti(false), 5200);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1a1206] to-[#0c0903]" dir="rtl">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          className="h-14 w-14 rounded-full border-4 border-[#e6b450] border-t-transparent"
          data-testid="loader-invitation"
        />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#1a1206] to-[#0c0903] text-center px-6" dir="rtl">
        <img src={logo} alt="Butter Bakery" className="h-16 w-auto opacity-80 mb-2" />
        <Crown className="h-10 w-10 text-[#e6b450]/60" />
        <h1 className="text-xl font-bold text-[#f8edd0]" data-testid="text-invite-error">الدعوة غير متاحة</h1>
        <p className="text-sm text-[#f8edd0]/60">الرابط غير صحيح أو انتهت صلاحية الدعوة.</p>
      </div>
    );
  }

  const { guestName, invitation, company } = data;
  const dateStr = formatDateAr(invitation.eventDate);

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b ${theme.bg} py-10 px-4 flex items-center justify-center`}
      dir="rtl"
      style={{ fontFamily: "Cairo, sans-serif" }}
      data-testid="page-invitation"
    >
      <FloatingSparkles accent={theme.accent} />
      <AnimatePresence>{confetti && <ConfettiBurst accent={theme.accent} soft={theme.soft} />}</AnimatePresence>

      {/* وهج خلفي نابض */}
      <motion.div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ width: 560, height: 560, background: theme.ring }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* شاشة الفتح: اضغط لفتح دعوتك (تُشغّل الصوت بفعل المستخدم) */}
      <AnimatePresence>
        {!opened && (
          <motion.button
            type="button"
            onClick={handleOpen}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 cursor-pointer"
            exit={{ opacity: 0, scale: 1.25 }}
            transition={{ duration: 0.8 }}
            data-testid="button-open-invitation"
          >
            <Brand theme={theme} />
            <motion.div
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.9, type: "spring", stiffness: 90 }}
              className="relative flex h-36 w-36 flex-col items-center justify-center rounded-full border-2 shadow-2xl"
              style={{ borderColor: theme.accent, background: "rgba(0,0,0,0.45)" }}
            >
              {/* حلقة لمعان دوّارة */}
              <motion.span
                className="absolute inset-[-6px] rounded-full"
                style={{ background: `conic-gradient(from 0deg, transparent, ${theme.accent}, transparent)` }}
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
              <span className="absolute inset-0 rounded-full" style={{ background: "rgba(0,0,0,0.55)" }} />
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative flex flex-col items-center"
              >
                <Crown style={{ color: theme.accent }} className="h-9 w-9" />
                <span className="mt-1 text-[11px] font-bold" style={{ color: theme.soft }}>دعوة خاصة</span>
              </motion.div>
            </motion.div>
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="text-sm font-semibold"
              style={{ color: theme.text }}
            >
              ✨ اضغط لفتح دعوتك ✨
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* البطاقة */}
      <motion.div
        initial={{ opacity: 0, y: 50, rotateX: 12 }}
        animate={{ opacity: opened ? 1 : 0, y: opened ? 0 : 50, rotateX: opened ? 0 : 12 }}
        transition={{ duration: 1, type: "spring", stiffness: 60 }}
        className="relative z-20 w-full max-w-xl"
        style={{ perspective: 1000 }}
      >
        <div
          className="relative rounded-[28px] border p-[2px] shadow-2xl"
          style={{ borderColor: theme.ring, background: `linear-gradient(135deg, ${theme.accent}55, transparent, ${theme.accent}33)` }}
        >
          <div className="rounded-[26px] bg-black/55 backdrop-blur-md px-6 py-9 sm:px-10 sm:py-12 text-center">
            {/* الشعار + اسم العلامة */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: opened ? 1 : 0, y: 0 }}
              transition={{ delay: opened ? 0.4 : 0 }}
            >
              <Brand theme={theme} size="sm" />
              <div className="mt-3 mb-1 flex items-center justify-center gap-2 text-[11px] tracking-widest" style={{ color: theme.soft }}>
                <Sparkles className="h-3.5 w-3.5" />
                <span>{company.nameAr}</span>
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="mx-auto my-2 h-px w-24" style={{ background: theme.accent }} />
            </motion.div>

            {invitation.imageUrl && (
              <motion.img
                src={invitation.imageUrl}
                alt={invitation.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: opened ? 1 : 0, scale: 1 }}
                transition={{ delay: 0.6, duration: 0.7 }}
                className="mx-auto mb-5 max-h-44 w-auto rounded-2xl object-cover shadow-lg"
                data-testid="img-invitation"
              />
            )}

            {/* التحية الشخصية */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: opened ? 1 : 0 }}
              transition={{ delay: 0.75 }}
              className="text-sm"
              style={{ color: theme.text }}
            >
              يسعدنا دعوتكم
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: opened ? 1 : 0, scale: 1 }}
              transition={{ delay: 0.9, type: "spring", stiffness: 120 }}
              className="my-1 text-3xl sm:text-4xl font-extrabold"
              style={{ color: theme.accent, textShadow: `0 0 18px ${theme.ring}` }}
              data-testid="text-guest-name"
            >
              {guestName}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: opened ? 1 : 0 }}
              transition={{ delay: 1 }}
              className="text-sm"
              style={{ color: theme.text }}
            >
              المساهم الكريم 🌟
            </motion.p>

            {/* العنوان الرئيسي */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: opened ? 1 : 0, y: 0 }}
              transition={{ delay: 1.15 }}
              className="mt-6 text-2xl sm:text-3xl font-bold leading-snug"
              style={{ color: theme.soft }}
              data-testid="text-invitation-title"
            >
              {invitation.title}
            </motion.h1>

            {invitation.branchName && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: opened ? 1 : 0 }}
                transition={{ delay: 1.25 }}
                className="mt-2 inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm font-semibold"
                style={{ background: `${theme.accent}22`, color: theme.accent }}
                data-testid="text-branch-name"
              >
                <PartyPopper className="h-4 w-4" />
                {invitation.branchName}
              </motion.div>
            )}

            {invitation.message && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: opened ? 1 : 0 }}
                transition={{ delay: 1.35 }}
                className="mt-5 whitespace-pre-line text-base leading-relaxed"
                style={{ color: theme.text }}
                data-testid="text-invitation-message"
              >
                {invitation.message}
              </motion.p>
            )}

            {/* التفاصيل */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: opened ? 1 : 0, y: 0 }}
              transition={{ delay: 1.5 }}
              className="mt-7 grid gap-3 text-right"
            >
              {dateStr && (
                <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.05)" }} data-testid="row-event-date">
                  <Calendar className="h-5 w-5 shrink-0" style={{ color: theme.accent }} />
                  <span style={{ color: theme.text }}>{dateStr}</span>
                </div>
              )}
              {invitation.eventTime && (
                <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.05)" }} data-testid="row-event-time">
                  <Clock className="h-5 w-5 shrink-0" style={{ color: theme.accent }} />
                  <span style={{ color: theme.text }}>{invitation.eventTime}</span>
                </div>
              )}
              {invitation.location && (
                <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.05)" }} data-testid="row-event-location">
                  <MapPin className="h-5 w-5 shrink-0" style={{ color: theme.accent }} />
                  <span style={{ color: theme.text }}>{invitation.location}</span>
                </div>
              )}
            </motion.div>

            {invitation.locationUrl && (
              <motion.a
                href={invitation.locationUrl}
                target="_blank"
                rel="noreferrer"
                initial={{ opacity: 0 }}
                animate={{ opacity: opened ? 1 : 0 }}
                transition={{ delay: 1.65 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-bold shadow-lg"
                style={{ background: theme.accent, color: "#1a1206" }}
                data-testid="link-location"
              >
                <MapPin className="h-4 w-4" />
                الموقع على الخريطة
              </motion.a>
            )}

            {/* التذييل */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: opened ? 1 : 0 }}
              transition={{ delay: 1.8 }}
              className="mt-8 border-t pt-4"
              style={{ borderColor: theme.ring }}
            >
              <p className="text-xs" style={{ color: `${theme.text}99` }}>
                {company.nameAr} — {company.legalForm}
              </p>
              <p className="text-[11px]" style={{ color: `${theme.text}66` }}>
                سجل تجاري: {company.commercialRegister}
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
