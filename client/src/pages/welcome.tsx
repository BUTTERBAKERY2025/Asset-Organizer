import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Linkedin, MessageCircle, Briefcase, Building2, Sparkles, PartyPopper } from "lucide-react";
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

const ORANGE = "#ef6c2c";
const ORANGE_SOFT = "#ffe7d6";
const GOLD = "#d9a23b";
const INK = "#1b1b22";
const MUTE = "#6b7280";

function playCheer() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
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

function ConfettiBurst() {
  const colors = [ORANGE, GOLD, "#ff9d5c", "#ffd56b", "#ff8fab", "#7bd389", "#5aa9e6"];
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

function FloatingDots() {
  const items = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 7 + Math.random() * 6,
        size: 4 + Math.random() * 8,
        opacity: 0.1 + Math.random() * 0.18,
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
            background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)`,
            opacity: s.opacity,
          }}
          animate={{ y: [0, -680], opacity: [0, s.opacity, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          className="h-14 w-14 rounded-full border-4 border-t-transparent"
          style={{ borderColor: ORANGE, borderTopColor: "transparent" }}
          data-testid="loader-welcome"
        />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white text-center px-6">
        <img src={logo} alt="Butter Bakery" className="h-16 w-auto opacity-90 mb-2" />
        <PartyPopper className="h-10 w-10" style={{ color: `${ORANGE}66` }} />
        <h1 className="text-xl font-bold" style={{ color: INK }} data-testid="text-welcome-error">
          البطاقة غير متاحة
        </h1>
        <p className="text-sm" style={{ color: MUTE }}>
          الرابط غير صحيح أو انتهت صلاحيته (يوم واحد).
        </p>
      </div>
    );
  }

  const name = data.candidateName;
  const nameEn = data.candidateNameEn;
  const position = data.position;
  const positionEn = data.positionEn;
  const dept = data.department || data.branchName || "";
  const companyEn = data.company.nameEn || "Butter Bakery";

  const shareText =
    `🎉 Welcome aboard! ${nameEn || name} has joined the ${companyEn} family 🥐\n` +
    `🎉 مبروك الانضمام إلى عائلة ${data.company.nameAr}!\n\n` +
    `💼 ${position}${positionEn ? ` | ${positionEn}` : ""}\n` +
    (dept ? `🏢 ${dept}\n` : "") +
    `\nBecause great things are never built alone — they rise with a team that moves together. 🌟\n` +
    `\n${typeof window !== "undefined" ? window.location.href : ""}`;

  const doShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: `Welcome to ${companyEn}`, text: shareText, url: window.location.href });
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
      className="relative min-h-screen overflow-hidden bg-white py-10 px-4 flex items-center justify-center"
      style={{ fontFamily: "'Plus Jakarta Sans', Cairo, sans-serif" }}
      data-testid="page-welcome"
    >
      {/* خلفية بيضاء بلمسة دافئة خفيفة */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(1200px 600px at 50% -10%, #fff7f1 0%, #ffffff 60%)" }}
      />
      <FloatingDots />
      <AnimatePresence>{confetti && <ConfettiBurst />}</AnimatePresence>

      {/* البطاقة */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, type: "spring", stiffness: 60 }}
        className="relative z-20 w-full max-w-xl"
      >
        <div
          className="relative rounded-[30px] bg-white px-7 py-10 sm:px-12 sm:py-12 text-center"
          style={{ border: "1px solid #f0e7df", boxShadow: "0 30px 80px -28px rgba(239,108,44,0.28), 0 8px 30px -12px rgba(0,0,0,0.08)" }}
        >
          {/* الشعار */}
          <motion.img
            src={logo}
            alt="Butter Bakery"
            className="mx-auto h-20 sm:h-24 w-auto"
            initial={{ opacity: 0, scale: 0.7, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            data-testid="img-brand-logo"
          />

          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.25em]" style={{ color: GOLD }}>
            <Sparkles className="h-3.5 w-3.5" />
            <span data-testid="text-brand-name">{companyEn.toUpperCase()}</span>
            <Sparkles className="h-3.5 w-3.5" />
          </div>

          {/* العنوان الرئيسي بأسلوب أنيق */}
          <div className="mt-7 text-left" dir="ltr">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl sm:text-5xl leading-none"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", color: "#b9b2ab" }}
            >
              Welcome
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
              className="mt-1 flex flex-wrap items-end gap-x-3 text-3xl sm:text-[2.6rem] font-extrabold leading-tight"
              style={{ color: INK }}
            >
              <span className="inline-flex items-center gap-2">
                <span style={{ color: ORANGE }}>↘</span>
                to the
              </span>
              <span style={{ color: ORANGE }}>{companyEn}</span>
              <span>Family</span>
              <motion.span
                animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.18, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="text-3xl"
              >
                ⭐
              </motion.span>
            </motion.h1>

            {/* الكلام المميز بالإنجليزية */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="mt-4 text-[15px] sm:text-base leading-relaxed"
              style={{ color: MUTE }}
              data-testid="text-tagline"
            >
              Because great things are never built by one person —{" "}
              <span className="font-semibold underline decoration-2 underline-offset-2" style={{ color: ORANGE }}>
                they rise together
              </span>
              , with a team that moves as one.
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-3 text-sm"
              style={{ color: "#9aa1ab" }}
              dir="rtl"
            >
              نسعد بانضمامك إلى عائلتنا، وكلنا ثقة أنك ستضيف الكثير. أهلاً بك 🌹
            </motion.p>
          </div>

          {/* اسم الموظف */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.95, type: "spring", stiffness: 120 }}
            className="mt-7 rounded-2xl py-5 px-4"
            style={{ background: ORANGE_SOFT }}
          >
            <p className="text-[11px] font-bold tracking-widest" style={{ color: ORANGE }}>
              🎉 MEET OUR NEW TEAM MEMBER 🎉
            </p>
            <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold" style={{ color: INK }} data-testid="text-employee-name">
              {name}
            </h2>
            {nameEn && (
              <p className="text-sm font-medium" style={{ color: MUTE }} data-testid="text-employee-name-en" dir="ltr">
                {nameEn}
              </p>
            )}
          </motion.div>

          {/* التفاصيل */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="mt-4 grid gap-3 text-right"
          >
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ border: "1px solid #f0e7df" }} data-testid="row-position">
              <Briefcase className="h-5 w-5 shrink-0" style={{ color: ORANGE }} />
              <div className="text-right">
                <p className="text-[11px]" style={{ color: MUTE }}>
                  المسمى الوظيفي · Position
                </p>
                <p style={{ color: INK }} className="font-bold">
                  {position}
                  {positionEn ? (
                    <span className="text-xs font-normal" style={{ color: MUTE }} dir="ltr">
                      {" "}
                      · {positionEn}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            {dept && (
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ border: "1px solid #f0e7df" }} data-testid="row-department">
                <Building2 className="h-5 w-5 shrink-0" style={{ color: ORANGE }} />
                <div className="text-right">
                  <p className="text-[11px]" style={{ color: MUTE }}>
                    القسم / الفرع · Department
                  </p>
                  <p style={{ color: INK }} className="font-bold">
                    {dept}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* أزرار المشاركة */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.25 }}
            className="mt-7 flex flex-col gap-3"
          >
            <div className="flex gap-2">
              <a href={waHref} target="_blank" rel="noreferrer" className="flex-1" data-testid="link-share-whatsapp">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg"
                  style={{ background: "#25D366" }}
                >
                  <MessageCircle className="h-4 w-4" /> شارك عبر واتساب
                </motion.button>
              </a>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={doShare}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg"
                style={{ background: ORANGE }}
                data-testid="button-share"
              >
                <Share2 className="h-4 w-4" /> مشاركة
              </motion.button>
            </div>
            <a href={data.company.linkedinUrl} target="_blank" rel="noreferrer" data-testid="link-linkedin">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white"
                style={{ background: "#0A66C2" }}
              >
                <Linkedin className="h-4 w-4" /> تابعنا على لينكدإن · Follow us on LinkedIn
              </motion.button>
            </a>
            <button
              onClick={replay}
              className="text-xs font-semibold underline-offset-4 hover:underline"
              style={{ color: ORANGE }}
              data-testid="button-replay"
            >
              🎊 إعادة الاحتفال · Replay
            </button>
          </motion.div>

          {/* التذييل */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="mt-8 border-t pt-4"
            style={{ borderColor: "#f0e7df" }}
          >
            <p className="text-xs font-medium" style={{ color: MUTE }}>
              {data.company.nameAr} — نتمنى لك التوفيق · We wish you a great journey 🌹
            </p>
            <p className="text-[11px]" style={{ color: "#b6bcc5" }}>
              هذا الرابط صالح لمدة يوم واحد فقط · Valid for 1 day
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
