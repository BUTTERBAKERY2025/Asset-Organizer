import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAppInit } from "@/hooks/useAppInit";
import { useAuth } from "@/hooks/useAuth";
import { isAuthoritativeAuthReady } from "@/lib/auth-readiness";

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
  const session = useAuth(true);
  // /auth/me is the only bootstrap call allowed for an owner. Legacy users
  // still receive the original branch/permissions init once their role is known.
  const authoritative = session.isFetchedAfterMount && !session.isFetching && !session.isAuthError;
  const legacy = useAppInit(authoritative && !!session.user && session.user.role !== "business_owner");
  const canShowApp = isAuthoritativeAuthReady({
    fetchedAfterMount: session.isFetchedAfterMount, fetching: session.isFetching, error: session.isAuthError,
    role: session.user?.role, hasUser: !!session.user, legacyLoading: legacy.isLoading,
  });
  const [hasResolved, setHasResolved] = useState(false);

  useEffect(() => {
    if (canShowApp && !hasResolved) {
      setHasResolved(true);
    }
  }, [canShowApp, hasResolved]);

  // Dismiss the static #initial-loader exactly when the authenticated app
  // shell is ready to paint — guarantees no blank/skeleton flash between
  // React's first commit and the real UI.
  useEffect(() => {
    if (hasResolved) {
      window.dispatchEvent(new Event("app-ready"));
    }
  }, [hasResolved]);

  if (!hasResolved) {
    if (session.isAuthError) return <div dir="rtl" role="alert" style={{ minHeight: "100dvh", display: "grid", placeContent: "center", textAlign: "center", padding: 24, fontFamily: "Cairo,sans-serif", color: "#33244b", background: "#faf8f5" }}>
      <strong>تعذر التحقق من جلستك</strong><p>لم نعرض بيانات محفوظة قبل التأكد من صلاحية الوصول.</p>
      <button style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#4d337a", color: "#fff", cursor: "pointer" }} onClick={() => void session.refetchAuth()}>إعادة المحاولة</button>
    </div>;
    // Render nothing while auth resolves. The static loader (rendered as a
    // fixed overlay outside #root in index.html) remains visible until the
    // app-ready event above fires, so the user never sees an empty page.
    return null;
  }

  return (
    <AuthContext.Provider value={{ isReady: true, isAuthenticated: !!session.user }}>
      {children}
    </AuthContext.Provider>
  );
}
