import { useCallback, useRef, useEffect } from "react";

const playReplitNotificationSound = async (): Promise<boolean> => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    
    const now = ctx.currentTime;
    
    // Replit-style notification: two clean tones
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(830, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1046, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.3);
    
    osc2.onended = () => ctx.close();
    
    return true;
  } catch (error) {
    console.error("Error playing notification sound:", error);
    return false;
  }
};

export const useWelcomeSound = (storageKey: string = "systemWelcomeSound") => {
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem(storageKey);
    if (hasPlayed) {
      hasPlayedRef.current = true;
    }
  }, [storageKey]);

  const triggerWelcomeSound = useCallback(async () => {
    if (hasPlayedRef.current) return false;
    
    const success = await playReplitNotificationSound();
    if (success) {
      hasPlayedRef.current = true;
      sessionStorage.setItem(storageKey, "true");
    }
    return success;
  }, [storageKey]);

  const setupInteractionListener = useCallback(() => {
    if (hasPlayedRef.current) return () => {};
    
    const handleInteraction = async () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      await triggerWelcomeSound();
    };
    
    document.addEventListener("click", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);
    document.addEventListener("keydown", handleInteraction);
    
    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
  }, [triggerWelcomeSound]);

  return {
    triggerWelcomeSound,
    setupInteractionListener,
    hasPlayed: hasPlayedRef.current,
  };
};
