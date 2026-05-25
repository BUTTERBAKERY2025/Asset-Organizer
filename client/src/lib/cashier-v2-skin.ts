import { useEffect, useState } from "react";

const STORAGE_KEY = "cashier_v2_skin";

export function isV2SkinEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const ui = params.get("ui");
    if (ui === "v2") {
      localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    if (ui === "classic") {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setV2SkinEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function useV2Skin(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => isV2SkinEnabled());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const update = (v: boolean) => {
    setV2SkinEnabled(v);
    setEnabled(v);
  };
  return [enabled, update];
}
