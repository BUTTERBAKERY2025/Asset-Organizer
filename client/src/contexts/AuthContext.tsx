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
  const [showSlowWarning, setShowSlowWarning] = useState(false);

  // Check if auth has resolved (either authenticated or not)
  const authResolved = !authLoading;

  // Set sticky flag when auth completes
  useEffect(() => {
    if (authResolved && !hasResolved) {
      setHasResolved(true);
    }
  }, [authResolved, hasResolved]);

  // Show slow loading warning after 2 seconds (but don't force resolve)
  useEffect(() => {
    if (hasResolved) return;
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        setShowSlowWarning(true);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [hasResolved]);

  if (!hasResolved) {
    return (
      <div 
        className="min-h-screen bg-[#F5F0E6]" 
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        {/* Skeleton Sidebar */}
        <div className="fixed right-0 top-0 h-full w-64 bg-[#1a3a2f] p-4">
          <div className="h-12 w-32 bg-[#2a4a3f] rounded animate-pulse mb-8" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-[#2a4a3f] rounded animate-pulse" />
            ))}
          </div>
        </div>
        {/* Skeleton Content */}
        <div className="mr-64 p-6">
          <div className="h-8 w-48 bg-gray-300 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-lg shadow animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-white rounded-lg shadow animate-pulse" />
          {/* Slow loading indicator */}
          {showSlowWarning && (
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">جاري الاتصال بالخادم...</span>
            </div>
          )}
        </div>
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
