export function safeLocalDestination(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\u0000-\u001f\\]/.test(value)) {
    return fallback;
  }
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://local.invalid";
    const url = new URL(value, origin);
    if (url.origin !== origin || url.pathname === "/login") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function currentLocalDestination(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function loginReturnDestination(): string {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  return safeLocalDestination(params.get("returnUrl") || params.get("redirect"), "/");
}