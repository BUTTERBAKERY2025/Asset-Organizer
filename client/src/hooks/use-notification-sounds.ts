import { useCallback, useRef, useEffect } from "react";

type SoundType = "welcome" | "login" | "success" | "notification" | "alert" | "complete";

interface AudioContextState {
  context: AudioContext | null;
  initialized: boolean;
}

const audioState: AudioContextState = {
  context: null,
  initialized: false,
};

const getAudioContext = (): AudioContext | null => {
  if (!audioState.context) {
    try {
      audioState.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioState.initialized = true;
    } catch (error) {
      console.error("Failed to create AudioContext:", error);
      return null;
    }
  }
  return audioState.context;
};

const resumeAudioContext = async (ctx: AudioContext): Promise<boolean> => {
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
      return true;
    } catch {
      return false;
    }
  }
  return true;
};

const playNote = (
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number = 0.3,
  type: OscillatorType = "sine"
) => {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
  
  return oscillator;
};

const playChord = (
  ctx: AudioContext,
  frequencies: number[],
  startTime: number,
  duration: number,
  volume: number = 0.15
) => {
  frequencies.forEach(freq => {
    playNote(ctx, freq, startTime, duration, volume, "sine");
  });
};

const soundPatterns: Record<SoundType, (ctx: AudioContext) => void> = {
  welcome: (ctx: AudioContext) => {
    const now = ctx.currentTime;
    
    playNote(ctx, 392.00, now, 0.15, 0.2, "sine");
    playNote(ctx, 523.25, now + 0.12, 0.15, 0.25, "sine");
    playNote(ctx, 659.25, now + 0.24, 0.15, 0.3, "sine");
    playNote(ctx, 783.99, now + 0.36, 0.2, 0.35, "sine");
    
    playChord(ctx, [523.25, 659.25, 783.99], now + 0.5, 0.4, 0.12);
    
    playNote(ctx, 1046.50, now + 0.7, 0.35, 0.2, "sine");
  },

  login: (ctx: AudioContext) => {
    const now = ctx.currentTime;
    
    playNote(ctx, 440.00, now, 0.1, 0.2, "triangle");
    playNote(ctx, 554.37, now + 0.08, 0.1, 0.25, "triangle");
    playNote(ctx, 659.25, now + 0.16, 0.15, 0.3, "triangle");
    
    playChord(ctx, [440.00, 554.37, 659.25], now + 0.28, 0.25, 0.1);
  },

  success: (ctx: AudioContext) => {
    const now = ctx.currentTime;
    
    playNote(ctx, 523.25, now, 0.12, 0.25, "sine");
    playNote(ctx, 659.25, now + 0.1, 0.12, 0.3, "sine");
    playNote(ctx, 783.99, now + 0.2, 0.2, 0.35, "sine");
  },

  notification: (ctx: AudioContext) => {
    const now = ctx.currentTime;
    
    playNote(ctx, 880.00, now, 0.08, 0.2, "sine");
    playNote(ctx, 1108.73, now + 0.1, 0.12, 0.25, "sine");
  },

  alert: (ctx: AudioContext) => {
    const now = ctx.currentTime;
    
    playNote(ctx, 440.00, now, 0.15, 0.3, "sawtooth");
    playNote(ctx, 349.23, now + 0.18, 0.2, 0.25, "sawtooth");
  },

  complete: (ctx: AudioContext) => {
    const now = ctx.currentTime;
    
    playNote(ctx, 523.25, now, 0.1, 0.2, "sine");
    playNote(ctx, 587.33, now + 0.08, 0.1, 0.2, "sine");
    playNote(ctx, 659.25, now + 0.16, 0.1, 0.25, "sine");
    playNote(ctx, 783.99, now + 0.24, 0.15, 0.3, "sine");
    playNote(ctx, 1046.50, now + 0.35, 0.25, 0.35, "sine");
  },
};

export const useNotificationSounds = () => {
  const isPlayingRef = useRef(false);

  const playSound = useCallback(async (type: SoundType): Promise<boolean> => {
    if (isPlayingRef.current) return false;
    
    const ctx = getAudioContext();
    if (!ctx) return false;
    
    const resumed = await resumeAudioContext(ctx);
    if (!resumed) return false;
    
    try {
      isPlayingRef.current = true;
      const pattern = soundPatterns[type];
      if (pattern) {
        pattern(ctx);
      }
      
      setTimeout(() => {
        isPlayingRef.current = false;
      }, 1000);
      
      return true;
    } catch (error) {
      console.error("Error playing sound:", error);
      isPlayingRef.current = false;
      return false;
    }
  }, []);

  const playWelcome = useCallback(() => playSound("welcome"), [playSound]);
  const playLogin = useCallback(() => playSound("login"), [playSound]);
  const playSuccess = useCallback(() => playSound("success"), [playSound]);
  const playNotification = useCallback(() => playSound("notification"), [playSound]);
  const playAlert = useCallback(() => playSound("alert"), [playSound]);
  const playComplete = useCallback(() => playSound("complete"), [playSound]);

  return {
    playSound,
    playWelcome,
    playLogin,
    playSuccess,
    playNotification,
    playAlert,
    playComplete,
  };
};

export const useWelcomeSound = (storageKey: string = "welcomeSoundPlayed") => {
  const { playWelcome } = useNotificationSounds();
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem(storageKey);
    if (hasPlayed) {
      hasPlayedRef.current = true;
    }
  }, [storageKey]);

  const triggerWelcomeSound = useCallback(async () => {
    if (hasPlayedRef.current) return false;
    
    const success = await playWelcome();
    if (success) {
      hasPlayedRef.current = true;
      sessionStorage.setItem(storageKey, "true");
    }
    return success;
  }, [playWelcome, storageKey]);

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

export const useLoginSound = () => {
  const { playLogin } = useNotificationSounds();
  
  const triggerLoginSound = useCallback(async () => {
    return await playLogin();
  }, [playLogin]);
  
  return { triggerLoginSound };
};
