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
  }, [canShowApp, hasResolved]);

  if (!hasResolved) {
    return (
      <div 
        className="min-h-screen bg-[#F5F0E6] flex items-center justify-center" 
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-amber-700">جاري الاتصال بالنظام...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isReady: true, isAuthenticated: effectiveAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
