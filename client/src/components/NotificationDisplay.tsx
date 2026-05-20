import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface SystemNotification {
  id: number;
  title: string;
  content: string;
  messageType: string;
  displayStyle: string;
  priority: number;
  isActive: boolean;
  targetAllBranches: boolean;
  targetBranchIds: string[] | null;
  startDate: string | null;
  endDate: string | null;
  soundEnabled: boolean;
  soundType: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  accentColor: string | null;
  animationType: string | null;
  effectType: string | null;
  emoji: string | null;
  imageUrl: string | null;
  buttonText: string | null;
  buttonAction: string | null;
  showOnce: boolean;
  autoCloseSeconds: number | null;
  designConfig: any | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const MESSAGE_TYPE_ICONS: Record<string, string> = {
  announcement: "📢",
  motivational: "🔥",
  greeting: "🎉",
  warning: "⚠️",
  celebration: "✨",
  reminder: "⏰",
};

const playSound = (soundType: string) => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const freqs: Record<string, number> = { default: 523, chime: 659, bell: 784, fanfare: 440, alert: 880 };
    osc.frequency.value = freqs[soundType] || 523;
    osc.type = soundType === "alert" ? "square" : "sine";
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) { /* ignore audio errors */ }
};

function generateParticles(effectType: string): React.ReactNode[] {
  const count = 25;
  const particles: React.ReactNode[] = [];
  const shapes: Record<string, { content: string; colors: string[] }> = {
    confetti: { content: "", colors: ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff922b", "#cc5de8", "#20c997"] },
    fireworks: { content: "✦", colors: ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff922b"] },
    sparkles: { content: "✨", colors: ["#ffd700", "#fff4e0", "#ffe066", "#ffec99"] },
    hearts: { content: "❤️", colors: ["#ff6b6b", "#e64980", "#ff8787", "#c2255c"] },
    stars: { content: "⭐", colors: ["#ffd700", "#ffec99", "#fab005", "#fcc419"] },
  };
  const shape = shapes[effectType] || shapes.confetti;

  for (let i = 0; i < count; i++) {
    const left = Math.random() * 100;
    const top = Math.random() * 100;
    const delay = Math.random() * 2;
    const duration = 2 + Math.random() * 3;
    const size = effectType === "confetti" ? 8 + Math.random() * 8 : 12 + Math.random() * 12;
    const color = shape.colors[Math.floor(Math.random() * shape.colors.length)];
    const rotation = Math.random() * 360;

    particles.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${left}%`,
          top: `${top}%`,
          width: effectType === "confetti" ? `${size}px` : "auto",
          height: effectType === "confetti" ? `${size * 0.6}px` : "auto",
          backgroundColor: effectType === "confetti" ? color : "transparent",
          borderRadius: effectType === "confetti" ? "2px" : "0",
          fontSize: effectType !== "confetti" ? `${size}px` : undefined,
          transform: `rotate(${rotation}deg)`,
          animation: `particleFall ${duration}s ease-in-out ${delay}s infinite`,
          opacity: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {effectType !== "confetti" ? shape.content : null}
      </div>
    );
  }
  return particles;
}

function getAnimationName(animationType: string | null): string {
  switch (animationType) {
    case "fade": return "notifFadeIn";
    case "slide": return "notifSlideIn";
    case "bounce": return "notifBounce";
    case "zoom": return "notifZoom";
    case "flip": return "notifFlip";
    default: return "notifFadeIn";
  }
}

export function NotificationContent({ notification, onDismiss, isPreview }: { notification: SystemNotification; onDismiss: () => void; isPreview?: boolean }) {
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMarkedRead = useRef(false);

  useEffect(() => {
    if (!hasMarkedRead.current && !isPreview) {
      hasMarkedRead.current = true;
      apiRequest("POST", `/api/system-notifications/${notification.id}/read`).catch(() => {});
    }
    if (notification.soundEnabled) {
      playSound(notification.soundType || "default");
    }
    if (notification.autoCloseSeconds && notification.autoCloseSeconds > 0) {
      autoCloseTimer.current = setTimeout(() => {
        onDismiss();
      }, notification.autoCloseSeconds * 1000);
    }
    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [notification.id]);

  const handleDismiss = useCallback(() => {
    if (!isPreview) {
      apiRequest("POST", `/api/system-notifications/${notification.id}/dismiss`).catch(() => {});
    }
    onDismiss();
  }, [notification.id, onDismiss, isPreview]);

  const handleButtonClick = useCallback(() => {
    if (notification.buttonAction) {
      if (notification.buttonAction.startsWith("http")) {
        window.open(notification.buttonAction, "_blank");
      } else {
        window.location.href = notification.buttonAction;
      }
    }
    handleDismiss();
  }, [notification.buttonAction, handleDismiss]);

  const bgColor = notification.backgroundColor || "#ffffff";
  const txtColor = notification.textColor || "#1a1a2e";
  const accent = notification.accentColor || "#6366f1";
  const typeIcon = MESSAGE_TYPE_ICONS[notification.messageType] || "📢";
  const animName = getAnimationName(notification.animationType);

  const contentBody = (
    <div
      data-testid={`notification-content-${notification.id}`}
      style={{
        backgroundColor: bgColor,
        color: txtColor,
        borderRadius: notification.displayStyle === "fullscreen" ? "0" : "16px",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
        maxWidth: notification.displayStyle === "fullscreen" ? "100%" : notification.displayStyle === "banner" ? "100%" : "520px",
        width: "100%",
        boxShadow: notification.displayStyle === "banner" ? "0 4px 24px rgba(0,0,0,0.15)" : "0 20px 60px rgba(0,0,0,0.3)",
        animation: `${animName} 0.5s ease-out forwards`,
        direction: "rtl",
        textAlign: "right",
      }}
    >
      {notification.effectType && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {generateParticles(notification.effectType)}
        </div>
      )}

      <button
        data-testid={`notification-close-${notification.id}`}
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          background: "rgba(0,0,0,0.1)",
          border: "none",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          color: txtColor,
          zIndex: 10,
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.1)")}
      >
        ✕
      </button>

      <div style={{ position: "relative", zIndex: 1 }}>
        {notification.emoji && (
          <div style={{ fontSize: "48px", marginBottom: "12px", textAlign: "center" }}>
            {notification.emoji}
          </div>
        )}

        {notification.imageUrl && (
          <div style={{ marginBottom: "16px", textAlign: "center" }}>
            <img
              src={notification.imageUrl}
              alt=""
              style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "12px", objectFit: "cover" }}
            />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", justifyContent: "flex-start" }}>
          <span style={{ fontSize: "24px" }}>{typeIcon}</span>
          <h3
            data-testid={`notification-title-${notification.id}`}
            style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: txtColor }}
          >
            {notification.title}
          </h3>
        </div>

        <div
          data-testid={`notification-body-${notification.id}`}
          style={{
            fontSize: "15px",
            lineHeight: "1.7",
            marginBottom: notification.buttonText ? "20px" : "0",
            whiteSpace: "pre-wrap",
            color: txtColor,
            opacity: 0.9,
          }}
        >
          {notification.content}
        </div>

        {notification.buttonText && (
          <div style={{ textAlign: "center", marginTop: "8px" }}>
            <button
              data-testid={`notification-action-${notification.id}`}
              onClick={handleButtonClick}
              style={{
                backgroundColor: accent,
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "10px 28px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "transform 0.2s, opacity 0.2s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1)"; }}
            >
              {notification.buttonText}
            </button>
          </div>
        )}

        {notification.autoCloseSeconds && notification.autoCloseSeconds > 0 && (
          <div style={{ marginTop: "12px", height: "3px", borderRadius: "2px", overflow: "hidden", backgroundColor: "rgba(0,0,0,0.1)" }}>
            <div
              style={{
                height: "100%",
                backgroundColor: accent,
                animation: `notifProgress ${notification.autoCloseSeconds}s linear forwards`,
                borderRadius: "2px",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );

  if (notification.displayStyle === "fullscreen") {
    return (
      <div
        data-testid={`notification-fullscreen-${notification.id}`}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgColor,
          animation: `${animName} 0.5s ease-out forwards`,
          direction: "rtl",
        }}
      >
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {notification.effectType && generateParticles(notification.effectType)}
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: "600px", width: "90%", padding: "40px" }}>
          <button
            data-testid={`notification-close-${notification.id}`}
            onClick={handleDismiss}
            style={{
              position: "fixed",
              top: "20px",
              left: "20px",
              background: "rgba(0,0,0,0.15)",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              color: txtColor,
              zIndex: 10,
            }}
          >
            ✕
          </button>

          {notification.emoji && (
            <div style={{ fontSize: "64px", marginBottom: "20px", textAlign: "center" }}>{notification.emoji}</div>
          )}
          {notification.imageUrl && (
            <div style={{ marginBottom: "24px", textAlign: "center" }}>
              <img src={notification.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "16px", objectFit: "cover" }} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", justifyContent: "center" }}>
            <span style={{ fontSize: "32px" }}>{typeIcon}</span>
            <h2 data-testid={`notification-title-${notification.id}`} style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: txtColor }}>{notification.title}</h2>
          </div>
          <div data-testid={`notification-body-${notification.id}`} style={{ fontSize: "18px", lineHeight: "1.8", textAlign: "center", color: txtColor, opacity: 0.9, whiteSpace: "pre-wrap", marginBottom: notification.buttonText ? "28px" : "0" }}>
            {notification.content}
          </div>
          {notification.buttonText && (
            <div style={{ textAlign: "center" }}>
              <button data-testid={`notification-action-${notification.id}`} onClick={handleButtonClick} style={{ backgroundColor: accent, color: "#fff", border: "none", borderRadius: "12px", padding: "14px 40px", fontSize: "17px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {notification.buttonText}
              </button>
            </div>
          )}
          {notification.autoCloseSeconds && notification.autoCloseSeconds > 0 && (
            <div style={{ marginTop: "20px", height: "3px", borderRadius: "2px", overflow: "hidden", backgroundColor: "rgba(0,0,0,0.1)", maxWidth: "300px", margin: "20px auto 0" }}>
              <div style={{ height: "100%", backgroundColor: accent, animation: `notifProgress ${notification.autoCloseSeconds}s linear forwards`, borderRadius: "2px" }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (notification.displayStyle === "banner") {
    return (
      <div
        data-testid={`notification-banner-${notification.id}`}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          animation: "notifSlideDown 0.4s ease-out forwards",
          direction: "rtl",
        }}
      >
        {contentBody}
      </div>
    );
  }

  if (notification.displayStyle === "slide_in") {
    return (
      <div
        data-testid={`notification-slidein-${notification.id}`}
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          right: "auto",
          left: 0,
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          animation: "notifSlideFromLeft 0.4s ease-out forwards",
          direction: "rtl",
        }}
      >
        <div style={{ width: "400px", maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", margin: "20px" }}>
          {contentBody}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`notification-modal-${notification.id}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        animation: "notifBackdropIn 0.3s ease-out forwards",
        direction: "rtl",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
    >
      {contentBody}
    </div>
  );
}

export function NotificationDisplay() {
  const { activeBranchId } = useAuth();
  const [queue, setQueue] = useState<SystemNotification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const shownIds = useRef<Set<number>>(new Set());

  const { data: notifications } = useQuery<SystemNotification[]>({
    queryKey: ["/api/active-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/active-notifications", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 60000),
    refetchOnMount: true,
    staleTime: 30000,
    enabled: true,
  });

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;
    const newNotifs = notifications.filter((n) => !shownIds.current.has(n.id));
    if (newNotifs.length > 0) {
      newNotifs.forEach((n) => shownIds.current.add(n.id));
      setQueue((prev) => [...prev, ...newNotifs]);
    }
  }, [notifications]);

  const handleDismiss = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const currentNotification = queue[currentIndex];

  if (!currentNotification) return null;

  return (
    <>
      <style>{`
        @keyframes notifFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes notifBounce {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.05); }
          70% { transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes notifZoom {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes notifFlip {
          from { opacity: 0; transform: perspective(400px) rotateY(90deg); }
          to { opacity: 1; transform: perspective(400px) rotateY(0deg); }
        }
        @keyframes notifSlideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        @keyframes notifSlideFromLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes notifBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes notifProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes particleFall {
          0% { opacity: 0; transform: translateY(-20px) rotate(0deg); }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; transform: translateY(40px) rotate(360deg); }
        }
      `}</style>
      <NotificationContent
        key={currentNotification.id}
        notification={currentNotification}
        onDismiss={handleDismiss}
      />
    </>
  );
}
