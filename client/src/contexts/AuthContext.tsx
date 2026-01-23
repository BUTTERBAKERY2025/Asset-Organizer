import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

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
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  
  // Sticky ready flag - once true, never goes back to false
  const [hasResolved, setHasResolved] = useState(false);

  // Check if auth has resolved (either authenticated or not)
  const authResolved = !authLoading;

  // Set sticky flag when first ready
  useEffect(() => {
    if (authResolved && !hasResolved) {
      setHasResolved(true);
    }
  }, [authResolved, hasResolved]);

  // Only show loading on first boot - never again (max 3 seconds timeout)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        setHasResolved(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [hasResolved]);

  if (!hasResolved) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center bg-[#F5F0E6]" 
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        <Loader2 className="w-10 h-10 text-[#e67e22] animate-spin" />
        <p className="mt-4 text-[#1a3a2f] text-sm">جاري تحميل النظام...</p>
      </div>
    );
  }

  // Once resolved, always render children
  return (
    <AuthContext.Provider value={{ isReady: true, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}
