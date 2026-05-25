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

  // Dismiss the static #initial-loader exactly when the authenticated app
  // shell is ready to paint — guarantees no blank/skeleton flash between
  // React's first commit and the real UI.
  useEffect(() => {
    if (hasResolved) {
      window.dispatchEvent(new Event("app-ready"));
    }
  }, [hasResolved]);

  if (!hasResolved) {
    // Render nothing while auth resolves. The static loader (rendered as a
    // fixed overlay outside #root in index.html) remains visible until the
    // app-ready event above fires, so the user never sees an empty page.
    return null;
  }

  return (
    <AuthContext.Provider value={{ isReady: true, isAuthenticated: effectiveAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
