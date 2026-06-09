import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Calendar, Clock, Sparkles, Crown, PartyPopper } from "lucide-react";

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

function FloatingSparkles({ accent }: { accent: string }) {
  const items = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 4,
        duration: 5 + Math.random() * 6,
        size: 6 + Math.random() * 12,
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
          animate={{ y: [0, -700], opacity: [0, s.opacity, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export default function InvitationPage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token;
  const [sealOpen, setSealOpen] = useState(false);

  const { data, isLoading, isError } = useQuery<InvitationData>({
    queryKey: [`/api/public/invite/${token}`],
    enabled: !!token,
    retry: 1,
  });

  useEffect(() => {
    if (data && !sealOpen) {
      const t = setTimeout(() => setSealOpen(true), 1400);
      return () => clearTimeout(t);
    }
  }, [data]);

  const theme = THEMES[data?.invitation.theme || "gold"] || THEMES.gold;

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
        <Crown className="h-12 w-12 text-[#e6b450]/60" />
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

      {/* وهج خلفي */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ width: 520, height: 520, background: theme.ring }}
      />

      <AnimatePresence>
        {!sealOpen && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center"
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: [0, 1.1, 1], rotate: 0 }}
              transition={{ duration: 1 }}
              className="flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 shadow-2xl"
              style={{ borderColor: theme.accent, background: "rgba(0,0,0,0.4)" }}
            >
              <Crown style={{ color: theme.accent }} className="h-10 w-10" />
              <span className="mt-1 text-xs font-bold" style={{ color: theme.soft }}>دعوة خاصة</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: sealOpen ? 1 : 0, y: sealOpen ? 0 : 40 }}
        transition={{ duration: 0.9, delay: 0.1 }}
        className="relative z-20 w-full max-w-xl"
      >
        <div
          className="relative rounded-[28px] border p-[2px] shadow-2xl"
          style={{ borderColor: theme.ring, background: `linear-gradient(135deg, ${theme.accent}55, transparent, ${theme.accent}33)` }}
        >
          <div className="rounded-[26px] bg-black/55 backdrop-blur-md px-6 py-9 sm:px-10 sm:py-12 text-center">
            {/* الترويسة */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sealOpen ? 0.5 : 0 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex items-center gap-2 text-xs tracking-widest" style={{ color: theme.soft }}>
                <Sparkles className="h-4 w-4" />
                <span>{company.nameAr}</span>
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="my-2 h-px w-24" style={{ background: theme.accent }} />
            </motion.div>

            {invitation.imageUrl && (
              <motion.img
                src={invitation.imageUrl}
                alt={invitation.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, duration: 0.7 }}
                className="mx-auto mb-5 max-h-44 w-auto rounded-2xl object-cover shadow-lg"
                data-testid="img-invitation"
              />
            )}

            {/* التحية الشخصية */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-sm"
              style={{ color: theme.text }}
            >
              يسعدنا دعوتكم
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.95, type: "spring", stiffness: 120 }}
              className="my-1 text-3xl sm:text-4xl font-extrabold"
              style={{ color: theme.accent, textShadow: `0 0 18px ${theme.ring}` }}
              data-testid="text-guest-name"
            >
              {guestName}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.05 }}
              className="text-sm"
              style={{ color: theme.text }}
            >
              المساهم الكريم 🌟
            </motion.p>

            {/* العنوان الرئيسي */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="mt-6 text-2xl sm:text-3xl font-bold leading-snug"
              style={{ color: theme.soft }}
              data-testid="text-invitation-title"
            >
              {invitation.title}
            </motion.h1>

            {invitation.branchName && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.3 }}
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
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
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
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.55 }}
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
                animate={{ opacity: 1 }}
                transition={{ delay: 1.7 }}
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
              animate={{ opacity: 1 }}
              transition={{ delay: 1.85 }}
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
