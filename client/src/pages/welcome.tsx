import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, PartyPopper, Share2, Linkedin, MessageCircle, Crown, Building2, Briefcase } from "lucide-react";
import logo from "@assets/logo_butter_bakery__1768502624540.png";

interface WelcomeData {
  candidateName: string;
  candidateNameEn?: string | null;
  position: string;
  positionEn?: string | null;
  department?: string | null;
  branchName?: string | null;
  expiresAt: string;
  company: { nameAr: string; nameEn: string; linkedinUrl: string };
}

const ACCENT = "#e6b450";
const SOFT = "#f5d488";
const RING = "rgba(230,180,80,0.35)";
const TEXT = "#f8edd0";

function playCheer() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5 E5 G5 C6 E6
    notes.forEach((freq, i) => {
      const t = now + i * 0.12;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.7);
    });
    const shimmer = ctx.createOscillator();
    const sg = ctx.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(1760, now);
    sg.gain.setValueAtTime(0.0001, now + 0.5);
    sg.gain.exponentialRampToValueAtTime(0.08, now + 0.6);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    shimmer.connect(sg);
    sg.connect(ctx.destination);
    shimmer.start(now + 0.5);
    shimmer.stop(now + 2.5);
    setTimeout(() => {
      try {
        if (ctx.state !== "closed") ctx.close();
      } catch {
        /* تجاهل */
      }
    }, 2700);
  } catch {
    /* تجاهل أي خطأ صوتي بصمت */
  }
}

function FloatingSparkles() {
  const items = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => ({
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
            background: `radial-gradient(circle, ${ACCENT} 0%, transparent 70%)`,
            opacity: s.opacity,
          }}
          animate={{ y: [0, -760], opacity: [0, s.opacity, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function ConfettiBurst() {
  const colors = [ACCENT, SOFT, "#ffffff", "#ffd56b", "#ff8fab", "#7bd389"];
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.4 + Math.random() * 2.4,
        size: 6 + Math.random() * 9,
        color: colors[i % colors.length],
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 200,
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

function Brand() {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.img
        src={logo}
        alt="Butter Bakery"
        className="h-24 sm:h-28 w-auto drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]"
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
          backgroundImage: `linear-gradient(90deg, ${ACCENT}, #fff, ${SOFT}, ${ACCENT})`,
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

export default function WelcomePage() {
  const [, params] = useRoute("/welcome/:token");
  const token = params?.token;
  const [confetti, setConfetti] = useState(false);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cheered = useRef(false);

  const { data, isLoading, isError } = useQuery<WelcomeData>({
    queryKey: [`/api/public/welcome/${token}`],
    enabled: !!token,
    retry: 1,
  });

  useEffect(() => {
    return () => {
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  // إطلاق الاحتفال تلقائياً عند تحميل البيانات
  useEffect(() => {
    if (data && !cheered.current) {
      cheered.current = true;
      setConfetti(true);
      playCheer();
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setConfetti(false), 5500);
    }
  }, [data]);

  const replay = () => {
    setConfetti(true);
    playCheer();
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(() => setConfetti(false), 5500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1a1206] to-[#0c0903]" dir="rtl">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          className="h-14 w-14 rounded-full border-4 border-[#e6b450] border-t-transparent"
          data-testid="loader-welcome"
        />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#1a1206] to-[#0c0903] text-center px-6" dir="rtl">
        <img src={logo} alt="Butter Bakery" className="h-16 w-auto opacity-80 mb-2" />
        <Crown className="h-10 w-10 text-[#e6b450]/60" />
        <h1 className="text-xl font-bold text-[#f8edd0]" data-testid="text-welcome-error">البطاقة غير متاحة</h1>
        <p className="text-sm text-[#f8edd0]/60">الرابط غير صحيح أو انتهت صلاحيته (يوم واحد).</p>
      </div>
    );
  }

  const name = data.candidateName;
  const nameEn = data.candidateNameEn;
  const position = data.position;
  const positionEn = data.positionEn;
  const dept = data.department || data.branchName || "";

  const shareText =
    `🎉 مبروك! انضممت إلى عائلة باتر بيكري 🥐\n` +
    `🎉 Proud to join the Butter Bakery family!\n\n` +
    `💼 ${position}${positionEn ? ` | ${positionEn}` : ""}\n` +
    (dept ? `🏢 ${dept}\n` : "") +
    `\n${typeof window !== "undefined" ? window.location.href : ""}`;

  const doShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "تهنئة باتر بيكري", text: shareText, url: window.location.href });
        return;
      } catch {
        /* أُلغيت المشاركة */
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      alert("تم نسخ التهنئة! يمكنك لصقها ومشاركتها 🎉");
    } catch {
      /* تجاهل */
    }
  };

  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#1a1206] via-[#2a1d08] to-[#0c0903] py-10 px-4 flex items-center justify-center"
      dir="rtl"
      style={{ fontFamily: "Cairo, sans-serif" }}
      data-testid="page-welcome"
    >
      <FloatingSparkles />
      <AnimatePresence>{confetti && <ConfettiBurst />}</AnimatePresence>

      {/* وهج خلفي نابض */}
      <motion.div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ width: 560, height: 560, background: RING }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* البطاقة */}
      <motion.div
        initial={{ opacity: 0, y: 50, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, type: "spring", stiffness: 60 }}
        className="relative z-20 w-full max-w-xl"
        style={{ perspective: 1000 }}
      >
        <div
          className="relative rounded-[28px] border p-[2px] shadow-2xl"
          style={{ borderColor: RING, background: `linear-gradient(135deg, ${ACCENT}55, transparent, ${ACCENT}33)` }}
        >
          <div className="rounded-[26px] bg-black/55 backdrop-blur-md px-6 py-9 sm:px-10 sm:py-12 text-center">
            <Brand />

            <div className="mt-3 mb-1 flex items-center justify-center gap-2 text-[11px] tracking-widest" style={{ color: SOFT }}>
              <Sparkles className="h-3.5 w-3.5" />
              <span>{data.company.nameAr} | {data.company.nameEn}</span>
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="mx-auto my-3 h-px w-24" style={{ background: ACCENT }} />

            {/* أيقونة احتفالية نابضة */}
            <motion.div
              animate={{ scale: [1, 1.12, 1], rotate: [0, -6, 6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: `${ACCENT}22` }}
            >
              <PartyPopper className="h-8 w-8" style={{ color: ACCENT }} />
            </motion.div>

            {/* تهنئة */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-base font-bold"
              style={{ color: TEXT }}
              data-testid="text-congrats"
            >
              🎉 مبروك الانضمام · Congratulations! 🎉
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, type: "spring", stiffness: 120 }}
              className="my-1 text-3xl sm:text-4xl font-extrabold"
              style={{ color: ACCENT, textShadow: `0 0 18px ${RING}` }}
              data-testid="text-employee-name"
            >
              {name}
            </motion.h2>
            {nameEn && (
              <p className="text-sm" style={{ color: `${TEXT}cc` }} data-testid="text-employee-name-en" dir="ltr">
                {nameEn}
              </p>
            )}

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-4 text-lg font-semibold leading-relaxed"
              style={{ color: SOFT }}
            >
              أهلاً بك في عائلة باتر بيكري 🥐
              <br />
              <span className="text-sm font-normal" style={{ color: `${TEXT}cc` }} dir="ltr">
                Welcome to the Butter Bakery family!
              </span>
            </motion.p>

            {/* التفاصيل */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="mt-6 grid gap-3 text-right"
            >
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.05)" }} data-testid="row-position">
                <Briefcase className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />
                <div>
                  <p className="text-[11px]" style={{ color: `${TEXT}88` }}>المسمى الوظيفي · Position</p>
                  <p style={{ color: TEXT }} className="font-semibold">
                    {position}
                    {positionEn ? <span className="text-xs font-normal" dir="ltr"> · {positionEn}</span> : null}
                  </p>
                </div>
              </div>
              {dept && (
                <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.05)" }} data-testid="row-department">
                  <Building2 className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />
                  <div>
                    <p className="text-[11px]" style={{ color: `${TEXT}88` }}>القسم / الفرع · Department</p>
                    <p style={{ color: TEXT }} className="font-semibold">{dept}</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* أزرار المشاركة */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="mt-7 flex flex-col gap-3"
            >
              <div className="flex gap-2">
                <a href={waHref} target="_blank" rel="noreferrer" className="flex-1" data-testid="link-share-whatsapp">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold shadow-lg"
                    style={{ background: "#25D366", color: "#062b14" }}
                  >
                    <MessageCircle className="h-4 w-4" /> شارك عبر واتساب
                  </motion.button>
                </a>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={doShare}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold shadow-lg"
                  style={{ background: ACCENT, color: "#1a1206" }}
                  data-testid="button-share"
                >
                  <Share2 className="h-4 w-4" /> مشاركة
                </motion.button>
              </div>
              <a href={data.company.linkedinUrl} target="_blank" rel="noreferrer" data-testid="link-linkedin">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
                  style={{ background: "#0A66C2", color: "#fff" }}
                >
                  <Linkedin className="h-4 w-4" /> تابعنا على لينكدإن · Follow us on LinkedIn
                </motion.button>
              </a>
              <button
                onClick={replay}
                className="text-xs font-semibold underline-offset-4 hover:underline"
                style={{ color: SOFT }}
                data-testid="button-replay"
              >
                🎊 إعادة الاحتفال
              </button>
            </motion.div>

            {/* التذييل */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="mt-8 border-t pt-4"
              style={{ borderColor: RING }}
            >
              <p className="text-xs" style={{ color: `${TEXT}99` }}>
                {data.company.nameAr} — نتمنى لك التوفيق 🌹
              </p>
              <p className="text-[11px]" style={{ color: `${TEXT}66` }}>
                هذا الرابط صالح لمدة يوم واحد فقط · Valid for 1 day
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
