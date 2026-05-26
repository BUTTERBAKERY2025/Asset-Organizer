import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, AlertCircle, Share2, Volume2, VolumeX, Heart } from "lucide-react";
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
  customSoundUrl: string | null;
  soundEnabled: boolean;
  soundType: string | null;
  defaultRecipientName: string | null;
  expiresAt: string | null;
};

type Theme =
  | "eid_adha" | "eid_fitr" | "ramadan" | "national" | "founding"
  | "anniversary" | "birthday" | "promotion" | "achievement"
  | "thank_you" | "wedding" | "newborn" | "graduation" | "default";

function detectTheme(d: GreetingData): Theme {
  const haystack = `${d.title} ${d.content} ${d.emoji || ""}`.toLowerCase();
  if (haystack.includes("أضحى") || haystack.includes("اضحى") || haystack.includes("الأضحى") || haystack.includes("الاضحى") || haystack.includes("🐑") || haystack.includes("🐏") || haystack.includes("🕋")) return "eid_adha";
  if (haystack.includes("فطر") || (haystack.includes("عيد") && !haystack.includes("أضحى") && !haystack.includes("ميلاد"))) return "eid_fitr";
  if (haystack.includes("رمضان") || haystack.includes("🌙")) return "ramadan";
  if (haystack.includes("اليوم الوطني") || haystack.includes("🇸🇦")) return "national";
  if (haystack.includes("تأسيس") || haystack.includes("🌴")) return "founding";
  if (haystack.includes("زواج") || haystack.includes("زفاف") || haystack.includes("💍")) return "wedding";
  if (haystack.includes("مولود") || haystack.includes("ولادة") || haystack.includes("👶")) return "newborn";
  if (haystack.includes("تخرج") || haystack.includes("🎓")) return "graduation";
  if (haystack.includes("ذكرى") || haystack.includes("التحاق") || haystack.includes("🏆")) return "anniversary";
  if (haystack.includes("ميلاد") || haystack.includes("🎂")) return "birthday";
  if (haystack.includes("ترقية") || haystack.includes("🥇")) return "promotion";
  if (d.effectType === "stars" || haystack.includes("تقدير") || haystack.includes("⭐")) return "achievement";
  if (haystack.includes("شكر") || haystack.includes("💐") || haystack.includes("❤️")) return "thank_you";
  return "default";
}

type ThemeConfig = {
  decorations: string[];
  bg: string;
  bigEmoji: string;
  tagline: string;
  accent: string;
  pattern: "stars" | "geometric" | "hearts" | "circles" | "diamonds";
  slideshow?: string[];
  defaultAudio?: string;
};

// Eid Al-Adha slideshow scenes (Butter Bakery branded sheep illustrations
// + cinematic café scenes extracted from second video)
const EID_ADHA_FRAMES = [
  "/eid-adha/scene_01.jpg",
  "/eid-adha/scene_02.jpg",
  "/eid-adha/scene_03.jpg",
  "/eid-adha/scene_04.jpg",
  "/eid-adha/scene_05.jpg",
  "/eid-adha/scene_06.jpg",
  "/eid-adha/scene_07.jpg",
  "/eid-adha/scene_08.jpg",
  "/eid-adha/scene_09.jpg",
  "/eid-adha/scene_10.jpg",
  "/eid-adha/scene_11.jpg",
  "/eid-adha/scene_12.jpg",
  "/eid-adha/scene_13.jpg",
  "/eid-adha/scene_14.jpg",
  "/eid-adha/scene_15.jpg",
  "/eid-adha/scene_16.jpg",
];

const THEME_CONFIG: Record<Theme, ThemeConfig> = {
  eid_adha:    { decorations: ["🐑","🕋","🎈","🌙","✨","🐏","🎊","☪️","💫"], bg: "linear-gradient(135deg,#fef3c7 0%,#fde68a 40%,#fbbf24 100%)", bigEmoji: "🕋", tagline: "عيد أضحى مبارك", accent: "#b8860b", pattern: "geometric", slideshow: EID_ADHA_FRAMES, defaultAudio: "/eid-adha/combined.mp3" },
  eid_fitr:    { decorations: ["🌙","🏮","✨","🎈","⭐","🕌","🎊","💫","☪️"], bg: "linear-gradient(135deg,#fef3c7 0%,#fcd34d 50%,#f59e0b 100%)", bigEmoji: "🌙", tagline: "عيد فطر سعيد", accent: "#d97706", pattern: "stars" },
  ramadan:     { decorations: ["🌙","🏮","⭐","✨","🕌","💫"], bg: "linear-gradient(135deg,#1e1b4b 0%,#4c1d95 50%,#7c3aed 100%)", bigEmoji: "🌙", tagline: "رمضان كريم", accent: "#fbbf24", pattern: "stars" },
  national:    { decorations: ["🇸🇦","🌴","🎆","✨","💚","⭐","🐪"], bg: "linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)", bigEmoji: "🇸🇦", tagline: "هي لنا دار", accent: "#fbbf24", pattern: "diamonds" },
  founding:    { decorations: ["🌴","🏛️","✨","💚","🐪","⚔️"], bg: "linear-gradient(135deg,#422006 0%,#78350f 50%,#92400e 100%)", bigEmoji: "🌴", tagline: "يوم بدينا", accent: "#fbbf24", pattern: "geometric" },
  anniversary: { decorations: ["🏆","🎉","🎊","⭐","✨","🥇","💼","🌟"], bg: "linear-gradient(135deg,#fef3c7 0%,#fed7aa 50%,#fb923c 100%)", bigEmoji: "🏆", tagline: "كل عام وأنت أحد رموز نجاحنا", accent: "#ea580c", pattern: "circles" },
  birthday:    { decorations: ["🎂","🎈","🎁","🎉","✨","🧁","🍰","🎊"], bg: "linear-gradient(135deg,#fce7f3 0%,#fbcfe8 50%,#f9a8d4 100%)", bigEmoji: "🎂", tagline: "كل عام وأنت بخير", accent: "#db2777", pattern: "hearts" },
  promotion:   { decorations: ["🥇","🏆","⭐","✨","🎊","📈","💎"], bg: "linear-gradient(135deg,#fef3c7 0%,#f59e0b 50%,#d97706 100%)", bigEmoji: "🥇", tagline: "مبروك الترقية", accent: "#92400e", pattern: "diamonds" },
  achievement: { decorations: ["⭐","✨","🌟","💫","🏅","🥇"], bg: "linear-gradient(135deg,#fff8e1 0%,#ffe082 50%,#ffd54f 100%)", bigEmoji: "⭐", tagline: "شكر وتقدير", accent: "#b8860b", pattern: "stars" },
  thank_you:   { decorations: ["💐","❤️","🌹","✨","🌟","💝","🌷"], bg: "linear-gradient(135deg,#fce7f3 0%,#fbcfe8 50%,#f472b6 100%)", bigEmoji: "💐", tagline: "شكراً من القلب", accent: "#be185d", pattern: "hearts" },
  wedding:     { decorations: ["💍","💐","❤️","🌹","✨","🥂","👰","🤵"], bg: "linear-gradient(135deg,#fdf2f8 0%,#fce7f3 50%,#f9a8d4 100%)", bigEmoji: "💍", tagline: "مبروك الزواج", accent: "#be185d", pattern: "hearts" },
  newborn:     { decorations: ["👶","🍼","🎈","✨","💙","💖","🧸","🌟"], bg: "linear-gradient(135deg,#dbeafe 0%,#bfdbfe 50%,#93c5fd 100%)", bigEmoji: "👶", tagline: "مبروك المولود", accent: "#2563eb", pattern: "circles" },
  graduation:  { decorations: ["🎓","📚","🏆","✨","⭐","🎉","📜"], bg: "linear-gradient(135deg,#1e3a8a 0%,#3730a3 50%,#4338ca 100%)", bigEmoji: "🎓", tagline: "مبروك التخرج", accent: "#fbbf24", pattern: "diamonds" },
  default:     { decorations: ["🎊","✨","🎉","⭐","🌟","💫"], bg: "linear-gradient(135deg,#fffbe6 0%,#fef3c7 50%,#fde68a 100%)", bigEmoji: "🎉", tagline: "Butter Bakery", accent: "#d4a017", pattern: "stars" },
};

// SVG background pattern overlay per theme
function PatternOverlay({ pattern, accent }: { pattern: ThemeConfig["pattern"]; accent: string }) {
  const id = `pat-${pattern}`;
  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none opacity-[0.08]" aria-hidden="true">
      <defs>
        {pattern === "stars" && (
          <pattern id={id} x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M40 10 L43 30 L63 30 L47 42 L53 62 L40 50 L27 62 L33 42 L17 30 L37 30 Z" fill={accent} />
          </pattern>
        )}
        {pattern === "geometric" && (
          <pattern id={id} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <polygon points="30,5 55,20 55,40 30,55 5,40 5,20" fill="none" stroke={accent} strokeWidth="2" />
          </pattern>
        )}
        {pattern === "hearts" && (
          <pattern id={id} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M30,50 C10,35 10,20 22,20 C28,20 30,25 30,25 C30,25 32,20 38,20 C50,20 50,35 30,50 Z" fill={accent} />
          </pattern>
        )}
        {pattern === "circles" && (
          <pattern id={id} x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <circle cx="25" cy="25" r="8" fill="none" stroke={accent} strokeWidth="2" />
            <circle cx="25" cy="25" r="3" fill={accent} />
          </pattern>
        )}
        {pattern === "diamonds" && (
          <pattern id={id} x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <polygon points="25,5 45,25 25,45 5,25" fill="none" stroke={accent} strokeWidth="2" />
          </pattern>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function FloatingDecoration({ emoji, delay, x, size, viewportH }: { emoji: string; delay: number; x: number; size: number; viewportH: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ left: `${x}%`, fontSize: `${size}px`, bottom: -60, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" }}
      initial={{ y: 0, opacity: 0 }}
      animate={{
        y: -viewportH - 100,
        opacity: [0, 1, 1, 0.8, 0],
        rotate: [0, 18, -12, 10, -5, 0],
        x: [0, 25, -18, 12, 0],
      }}
      transition={{
        duration: 9 + Math.random() * 7,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {emoji}
    </motion.div>
  );
}

function ConfettiBurst({ accent, viewportH }: { accent: string; viewportH: number }) {
  const colors = useMemo(() => [accent, "#fbbf24", "#f59e0b", "#fde68a", "#ffffff", "#ef4444", "#22c55e", "#3b82f6"], [accent]);
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: colors[i % colors.length],
    delay: Math.random() * 0.6,
    rotate: Math.random() * 720,
    size: 6 + Math.random() * 8,
    shape: i % 3,
  })), [colors]);
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          className={p.shape === 0 ? "absolute rounded-sm" : p.shape === 1 ? "absolute rounded-full" : "absolute"}
          style={{
            left: `${p.x}%`,
            top: -20,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: p.shape === 2 ? "rotate(45deg)" : undefined,
          }}
          initial={{ y: 0, rotate: 0, opacity: 1 }}
          animate={{ y: viewportH + 100, rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: 3.5 + Math.random() * 2.5, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

// Animated rays/sparkle behind big emoji
function SparkleRays({ accent }: { accent: string }) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 1.5, 1.2], opacity: [0, 0.6, 0.35] }}
      transition={{ delay: 0.5, duration: 1.5 }}
    >
      <svg width="320" height="320" viewBox="0 0 320 320" className="max-w-[80vw] max-h-[40vh]">
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x2 = 160 + Math.cos(angle) * 150;
          const y2 = 160 + Math.sin(angle) * 150;
          return <line key={i} x1="160" y1="160" x2={x2} y2={y2} stroke={accent} strokeWidth="3" opacity="0.5" />;
        })}
      </svg>
    </motion.div>
  );
}

function personalize(text: string, name: string): string {
  if (!name) return text.replace(/\{\{name\}\}/g, "").replace(/\{\{years\}\}/g, "");
  return text.replace(/\{\{name\}\}/g, name).replace(/\{\{years\}\}/g, "");
}

// Built-in melodies via Web Audio API (used when no customSoundUrl).
// Returns { ok: true, durationMs } on success, { ok: false } on failure (e.g. autoplay blocked).
function playBuiltinTune(type: string): { ok: boolean; durationMs: number } {
  const notes: Record<string, number[]> = {
    celebration: [523, 659, 784, 1047],
    fanfare: [392, 523, 659, 784, 1047],
    chime: [880, 1175, 1396],
    gentle: [523, 659, 784],
    default: [659, 784, 1047],
  };
  const seq = notes[type] || notes.default;
  const durationMs = seq.length * 200 + 500;
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return { ok: false, durationMs };
    const ctx = new AC();
    if (ctx.state === "suspended") {
      // Autoplay policy blocked — context starts suspended without user gesture
      ctx.close().catch(() => {});
      return { ok: false, durationMs };
    }
    seq.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.start(start);
      osc.stop(start + 0.45);
    });
    setTimeout(() => ctx.close().catch(() => {}), durationMs);
    return { ok: true, durationMs };
  } catch {
    return { ok: false, durationMs };
  }
}

// Validate that a sound URL is safe to play: https or same-origin relative + known audio extension.
function isValidAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Same-origin relative path (starts with / and not //) is always safe
  if (url.startsWith("/") && !url.startsWith("//")) {
    return /\.(mp3|ogg|wav|m4a|aac|webm)(\?|$)/i.test(url);
  }
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return /\.(mp3|ogg|wav|m4a|aac|webm)(\?|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

// Animated slideshow component — cycles through frames with fade transition.
// Used for richer theme cards (e.g. eid_adha shows Butter Bakery sheep scenes).
function ThemeSlideshow({ frames, accent, intervalMs = 3200 }: { frames: string[]; accent: string; intervalMs?: number }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % frames.length), intervalMs);
    return () => clearInterval(t);
  }, [frames.length, intervalMs]);
  return (
    <div
      className="relative mx-auto mb-4 rounded-2xl overflow-hidden shadow-2xl border-4"
      style={{
        borderColor: accent,
        width: "min(96vw, 760px)",
        aspectRatio: "16/9",
        boxShadow: `0 24px 70px ${accent}66, 0 0 0 2px ${accent}33`,
      }}
      data-testid="theme-slideshow"
    >
      <AnimatePresence mode="popLayout">
        <motion.img
          key={idx}
          src={frames[idx]}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          loading="eager"
        />
      </AnimatePresence>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(180deg, transparent 0%, transparent 70%, ${accent}33 100%)` }}
      />
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
        {frames.map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === idx ? 20 : 6,
              height: 6,
              backgroundColor: i === idx ? "#ffffff" : "rgba(255,255,255,0.55)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function PublicGreetingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<GreetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confettiVisible, setConfettiVisible] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [viewportH, setViewportH] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const recipientName = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("name")?.trim() || data?.defaultRecipientName || "";
  }, [data]);

  useEffect(() => {
    const onResize = () => {
      setViewportH(window.innerHeight);
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
        fetch(`/api/public/greetings/${slug}/view`, { method: "POST" }).catch(() => {});
      } catch (e: any) {
        if (!cancelled) setError(e.message || "خطأ غير معروف");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (data && !revealed) {
      const t = setTimeout(() => setRevealed(true), 500);
      return () => clearTimeout(t);
    }
  }, [data, revealed]);

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setConfettiVisible(false), 7000);
    return () => clearTimeout(t);
  }, [data]);

  // Pick effective audio URL: user-provided customSoundUrl wins; otherwise theme default.
  const themeCfg = useMemo(() => data ? THEME_CONFIG[detectTheme(data)] : null, [data]);
  const effectiveAudioUrl = useMemo(() => {
    const url = data?.customSoundUrl || themeCfg?.defaultAudio || null;
    return isValidAudioUrl(url) ? url : null;
  }, [data, themeCfg]);
  const validCustomSound = effectiveAudioUrl !== null;

  // Auto-play audio (handle browser autoplay restrictions)
  useEffect(() => {
    if (!data || !revealed || !data.soundEnabled) return;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    const tryAutoplay = async () => {
      if (validCustomSound && audioRef.current) {
        try {
          await audioRef.current.play();
          setAudioPlaying(true);
        } catch {
          setAudioBlocked(true);
        }
      } else {
        const r = playBuiltinTune(data.soundType || "default");
        if (r.ok) {
          setAudioPlaying(true);
          stopTimer = setTimeout(() => setAudioPlaying(false), r.durationMs);
        } else {
          setAudioBlocked(true);
        }
      }
    };
    const t = setTimeout(tryAutoplay, 800);
    return () => {
      clearTimeout(t);
      if (stopTimer) clearTimeout(stopTimer);
    };
  }, [data, revealed, validCustomSound]);

  const handlePlayAudio = () => {
    if (!data) return;
    setAudioBlocked(false);
    if (validCustomSound && audioRef.current) {
      audioRef.current.play().then(() => setAudioPlaying(true)).catch(() => setAudioBlocked(true));
    } else {
      const r = playBuiltinTune(data.soundType || "default");
      if (r.ok) {
        setAudioPlaying(true);
        setTimeout(() => setAudioPlaying(false), r.durationMs);
      } else {
        setAudioBlocked(true);
      }
    }
  };

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioPlaying(false);
  };

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
  const accent = data.accentColor || cfg.accent;
  const personalContent = personalize(data.content, recipientName);
  const personalTitle = personalize(data.title, recipientName);
  const isDarkTheme = ["ramadan", "national", "founding", "graduation"].includes(theme);

  // Mobile-aware decoration count
  const decorCount = isMobile ? 8 : 16;
  const decorations = Array.from({ length: decorCount }, (_, i) => ({
    emoji: cfg.decorations[i % cfg.decorations.length],
    delay: i * 0.65,
    x: (i * 9 + 5) % 95,
    size: (isMobile ? 22 : 32) + (i % 4) * (isMobile ? 8 : 12),
  }));

  const handleShare = async () => {
    const shareData = {
      title: data.title,
      text: `${data.emoji || "✨"} ${data.title}`,
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

  const handleWhatsappShare = () => {
    const text = `${data.emoji || "✨"} ${data.title}\n\n${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden relative"
      style={{ background: cfg.bg, fontFamily: "'Cairo', sans-serif" }}
      dir="rtl"
      data-testid="public-greeting"
    >
      {/* SVG pattern overlay */}
      <PatternOverlay pattern={cfg.pattern} accent={isDarkTheme ? "#ffffff" : accent} />

      {/* Floating background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {decorations.map((d, i) => (
          <FloatingDecoration key={i} {...d} viewportH={viewportH} />
        ))}
      </div>

      {/* Confetti burst */}
      <AnimatePresence>{confettiVisible && <ConfettiBurst accent={accent} viewportH={viewportH} />}</AnimatePresence>

      {/* Hidden audio element (custom validated URL or theme default) */}
      {effectiveAudioUrl && (
        <audio
          ref={audioRef}
          src={effectiveAudioUrl}
          preload="auto"
          loop
          onEnded={() => setAudioPlaying(false)}
          onPause={() => setAudioPlaying(false)}
          onError={() => { setAudioPlaying(false); setAudioBlocked(true); }}
        />
      )}

      {/* Audio control button (floating top-left) */}
      {data.soundEnabled && (
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          onClick={audioPlaying ? handleStopAudio : handlePlayAudio}
          className={`fixed top-4 left-4 z-40 rounded-full p-3 shadow-lg backdrop-blur-md transition-all hover:scale-110 ${audioBlocked ? "animate-pulse ring-4 ring-white/50" : ""}`}
          style={{ backgroundColor: isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.85)", color: accent }}
          title={audioPlaying ? "إيقاف الصوت" : "تشغيل الصوت"}
          data-testid="button-audio-toggle"
        >
          {audioPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </motion.button>
      )}

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
              className="rounded-3xl shadow-2xl p-5 sm:p-8 md:p-12 backdrop-blur-sm border-2 relative overflow-hidden"
              style={{
                backgroundColor: data.backgroundColor ? `${data.backgroundColor}f5` : (isDarkTheme ? "rgba(30,30,40,0.92)" : "rgba(255,255,255,0.96)"),
                borderColor: accent,
                color: isDarkTheme ? "#ffffff" : (data.textColor || "#1a1a1a"),
              }}
            >
              {/* Corner glow */}
              <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 rounded-full opacity-20 -translate-y-1/2 translate-x-1/2 blur-2xl" style={{ background: accent }} />
              <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-40 sm:h-40 rounded-full opacity-20 translate-y-1/2 -translate-x-1/2 blur-2xl" style={{ background: accent }} />

              {/* Butter Bakery Logo — dances when music is playing (transform-only for perf) */}
              <motion.div
                className="flex justify-center mb-4 sm:mb-5 relative z-10"
                initial={{ y: -30, opacity: 0 }}
                animate={
                  audioPlaying
                    ? {
                        y: [0, -10, 0, -6, 0],
                        rotate: [0, -6, 6, -4, 4, 0],
                        scale: [1, 1.08, 1, 1.05, 1],
                        opacity: 1,
                      }
                    : { y: 0, rotate: 0, scale: 1, opacity: 1 }
                }
                transition={
                  audioPlaying
                    ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.3, ease: "easeOut" }
                }
                style={{ willChange: audioPlaying ? "transform" : "auto" }}
              >
                <img
                  src="/butter-logo.png"
                  alt="Butter Bakery"
                  className="h-24 sm:h-32 md:h-40 w-auto object-contain"
                  style={{ filter: `drop-shadow(0 8px 16px ${accent}66)` }}
                  data-testid="img-logo"
                />
              </motion.div>

              {/* Sparkle rays behind emoji/slideshow */}
              <div className="relative">
                <SparkleRays accent={accent} />

                {/* Theme slideshow (e.g. eid_adha) OR big themed emoji */}
                {cfg.slideshow && cfg.slideshow.length > 0 ? (
                  <motion.div
                    className="relative z-10"
                    initial={{ scale: 0.5, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.8, type: "spring" }}
                  >
                    <ThemeSlideshow frames={cfg.slideshow} accent={accent} />
                  </motion.div>
                ) : (
                  <motion.div
                    className="text-center mb-3 sm:mb-4 relative z-10"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: [0, 1.3, 1], rotate: [180, 0, 0] }}
                    transition={{ delay: 0.6, duration: 0.9 }}
                  >
                    <motion.span
                      className="text-6xl sm:text-7xl md:text-9xl inline-block"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      data-testid="big-emoji"
                    >
                      {data.emoji || cfg.bigEmoji}
                    </motion.span>
                  </motion.div>
                )}
              </div>

              {/* Personal name greeting */}
              {recipientName && (
                <motion.div
                  className="text-center mb-3 sm:mb-4 relative z-10"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  data-testid="text-recipient-greeting"
                >
                  <p className="text-xs sm:text-sm md:text-base font-medium opacity-70">
                    إلى الزميل/ـة
                  </p>
                  <motion.p
                    className="text-2xl sm:text-3xl md:text-5xl font-extrabold mt-1 break-words"
                    style={{ color: accent, textShadow: `0 2px 10px ${accent}33` }}
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    data-testid="text-recipient-name"
                  >
                    {recipientName}
                  </motion.p>
                </motion.div>
              )}

              {/* Title */}
              <motion.h1
                className="text-xl sm:text-2xl md:text-4xl font-bold text-center mb-3 sm:mb-4 relative z-10 leading-relaxed"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.0, duration: 0.5 }}
                data-testid="text-title"
              >
                {personalTitle}
              </motion.h1>

              {/* Tagline pill */}
              <motion.div
                className="text-center mb-4 sm:mb-6 relative z-10"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 }}
              >
                <span
                  className="inline-block px-4 py-1.5 rounded-full text-sm sm:text-base md:text-lg font-bold"
                  style={{ background: `${accent}22`, color: accent, border: `1.5px solid ${accent}66` }}
                >
                  ✨ {cfg.tagline} ✨
                </span>
              </motion.div>

              {/* Content */}
              <motion.div
                className="text-center text-sm sm:text-base md:text-lg leading-loose whitespace-pre-line mb-4 sm:mb-6 relative z-10 px-2"
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
                  className="flex justify-center mb-4 sm:mb-6 relative z-10"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                >
                  <img
                    src={data.imageUrl}
                    alt=""
                    className="max-h-48 sm:max-h-64 w-auto rounded-2xl shadow-lg"
                    data-testid="img-greeting"
                  />
                </motion.div>
              )}

              {/* Audio prompt if blocked */}
              {audioBlocked && data.soundEnabled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center mb-4 relative z-10"
                >
                  <Button
                    onClick={handlePlayAudio}
                    size="sm"
                    className="rounded-full shadow-lg animate-pulse"
                    style={{ background: accent, color: "#fff" }}
                    data-testid="button-enable-audio"
                  >
                    <Volume2 className="w-4 h-4 ml-2" />
                    اضغط لتشغيل الموسيقى 🎵
                  </Button>
                </motion.div>
              )}

              {/* Footer & share buttons */}
              <motion.div
                className="flex flex-col items-center gap-3 pt-4 border-t-2 relative z-10"
                style={{ borderColor: `${accent}33` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 }}
              >
                <p className="text-sm md:text-base font-bold flex items-center gap-2" style={{ color: accent }}>
                  <Sparkles className="w-4 h-4" />
                  Butter Bakery — باتر بيكري
                  <Sparkles className="w-4 h-4" />
                </p>
                <p className="text-xs opacity-60 flex items-center gap-1">
                  صُنعت بـ <Heart className="w-3 h-3 fill-current" style={{ color: accent }} /> خصيصاً لك
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    onClick={handleShare}
                    variant="outline"
                    size="sm"
                    className="rounded-full border-2 hover:scale-105 transition-transform"
                    style={{ borderColor: accent, color: accent, backgroundColor: "transparent" }}
                    data-testid="button-share"
                  >
                    <Share2 className="w-4 h-4 ml-2" />
                    مشاركة
                  </Button>
                  <Button
                    onClick={handleWhatsappShare}
                    size="sm"
                    className="rounded-full hover:scale-105 transition-transform bg-emerald-500 hover:bg-emerald-600 text-white"
                    data-testid="button-share-whatsapp"
                  >
                    <Share2 className="w-4 h-4 ml-2" />
                    واتساب
                  </Button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
