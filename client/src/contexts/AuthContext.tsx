import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAppInit } from "@/hooks/useAppInit";
import { hasValidSession, getCachedUser } from "@/lib/persistentCache";

interface AuthContextType {
  isReady: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isReady: false,
  isAuthenticated: false,
});

export function useAuthReady() {
  return useContext(AuthContext);
}

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { isLoading, isAuthenticated } = useAppInit();
  
  const hasCachedSession = hasValidSession();
  const cachedUser = getCachedUser();
  
  const canShowApp = !isLoading || (hasCachedSession && !!cachedUser);
  const effectiveAuth = isLoading ? !!cachedUser : isAuthenticated;

  const [hasResolved, setHasResolved] = useState(canShowApp);

  useEffect(() => {
    if (canShowApp && !hasResolved) {
      setHasResolved(true);
    }
    if (!canShowApp && !isLoading && !isAuthenticated && hasResolved) {
      setHasResolved(false);
    }
  }, [canShowApp, hasResolved, isLoading, isAuthenticated]);

  if (!hasResolved) {
    // Unified skeleton instead of a centered spinner. Matches PageLoadingFallback's
    // visual language so the very first paint feels like the app is already loading
    // its layout, not "trying to connect" from scratch. Removes the dark blank flash.
    return (
      <div
        className="min-h-screen bg-[#F5F0E6] p-6 space-y-5 skeleton-delayed"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
        data-testid="auth-gate-skeleton"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 skeleton-shimmer rounded-full" style={{ animationDelay: '0ms' }} />
            <div className="h-7 skeleton-shimmer w-40 rounded-lg" style={{ animationDelay: '40ms' }} />
          </div>
          <div className="h-9 skeleton-shimmer w-28 rounded-lg opacity-40" style={{ animationDelay: '80ms' }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="h-[88px] skeleton-shimmer rounded-xl" style={{ animationDelay: '0ms' }} />
          <div className="h-[88px] skeleton-shimmer rounded-xl opacity-85" style={{ animationDelay: '40ms' }} />
          <div className="h-[88px] skeleton-shimmer rounded-xl opacity-75" style={{ animationDelay: '80ms' }} />
          <div className="h-[88px] skeleton-shimmer rounded-xl opacity-65 hidden lg:block" style={{ animationDelay: '120ms' }} />
        </div>
        <div className="h-64 skeleton-shimmer rounded-xl" style={{ animationDelay: '40ms' }} />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isReady: true, isAuthenticated: effectiveAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
