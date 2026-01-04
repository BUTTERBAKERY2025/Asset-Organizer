import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./useAuth";

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export function useInactivityLogout() {
  const { isAuthenticated, logout } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      window.location.href = "/login";
    } catch (error) {
      console.error("Auto logout failed:", error);
      window.location.href = "/login";
    }
  }, [logout]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isAuthenticated) {
      timeoutRef.current = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated, handleLogout]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "wheel",
    ];

    const handleActivity = () => {
      resetTimer();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    resetTimer();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isAuthenticated, resetTimer]);

  return {
    resetTimer,
    getRemainingTime: () => {
      const elapsed = Date.now() - lastActivityRef.current;
      return Math.max(0, INACTIVITY_TIMEOUT - elapsed);
    },
  };
}
