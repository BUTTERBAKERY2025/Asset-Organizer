import { branchBoardUrl } from "@/lib/branch-operation-navigation";

const RETURN_PARAM = "branchReturn";
const HISTORY_KEY = "__branchDeskReturn";
const STORAGE_PREFIX = "branch-operations:return";

export type BranchDeskReturnState = {
  userId: string;
  branchId: string;
  token: string;
  scrollX: number;
  scrollY: number;
};

const SCROLL_CONTAINER_SELECTOR = "[data-app-scroll-container]";

type HistoryState = Record<string, unknown> & {
  [HISTORY_KEY]?: Pick<BranchDeskReturnState, "userId" | "branchId" | "token">;
};

function storageKey(userId: string, branchId: string) {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(branchId)}`;
}

function newToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function saveBranchDeskReturnState(
  storage: Pick<Storage, "setItem">,
  state: BranchDeskReturnState,
) {
  storage.setItem(storageKey(state.userId, state.branchId), JSON.stringify(state));
}

export function readBranchDeskReturnState(
  storage: Pick<Storage, "getItem">,
  userId: string,
  branchId: string,
  token: string,
): BranchDeskReturnState | null {
  if (!userId || !branchId || !token) return null;
  try {
    const value = JSON.parse(storage.getItem(storageKey(userId, branchId)) ?? "null") as Partial<BranchDeskReturnState> | null;
    if (!value || value.userId !== userId || value.branchId !== branchId || value.token !== token
      || !Number.isFinite(value.scrollX) || !Number.isFinite(value.scrollY)) return null;
    return value as BranchDeskReturnState;
  } catch {
    return null;
  }
}

/** Captures the board entry itself, so browser Back restores the same position. */
export function captureBranchDeskReturn(userId: string, branchId: string, destination: string) {
  const token = newToken();
  const scrollContainer = document.querySelector<HTMLElement>(SCROLL_CONTAINER_SELECTOR);
  const state: BranchDeskReturnState = {
    userId,
    branchId,
    token,
    scrollX: scrollContainer?.scrollLeft ?? window.scrollX,
    scrollY: scrollContainer?.scrollTop ?? window.scrollY,
  };
  try {
    saveBranchDeskReturnState(window.sessionStorage, state);
  } catch {
    return destination;
  }
  const currentState = (window.history.state && typeof window.history.state === "object"
    ? window.history.state : {}) as HistoryState;
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set(RETURN_PARAM, token);
  try {
    window.history.replaceState({
      ...currentState,
      [HISTORY_KEY]: { userId, branchId, token },
    }, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  } catch {
    return destination;
  }
  const url = new URL(destination, window.location.origin);
  url.searchParams.set(RETURN_PARAM, token);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function restoreBranchDeskScroll(state: Pick<BranchDeskReturnState, "scrollX" | "scrollY">) {
  const scrollContainer = document.querySelector<HTMLElement>(SCROLL_CONTAINER_SELECTOR);
  if (scrollContainer) {
    scrollContainer.scrollTo({ left: state.scrollX, top: state.scrollY, behavior: "instant" });
  } else {
    window.scrollTo({ left: state.scrollX, top: state.scrollY, behavior: "instant" });
  }
}

/** Explicit return links carry the opaque session token, never a caller URL. */
export function branchDeskReturnUrl(branchId: string | null, sourcePath: string, search: string) {
  const base = new URL(branchBoardUrl(branchId, sourcePath), "https://internal.invalid");
  const token = new URLSearchParams(search).get(RETURN_PARAM);
  if (token) base.searchParams.set(RETURN_PARAM, token);
  return `${base.pathname}${base.search}${base.hash}`;
}

export function resolveBranchDeskReturn(
  storage: Pick<Storage, "getItem">,
  userId: string,
  branchId: string,
  search: string,
  historyState: unknown,
) {
  const queryToken = new URLSearchParams(search).get(RETURN_PARAM);
  const marker = historyState && typeof historyState === "object"
    ? (historyState as HistoryState)[HISTORY_KEY] : undefined;
  const historyToken = marker?.userId === userId && marker.branchId === branchId ? marker.token : null;
  return readBranchDeskReturnState(storage, userId, branchId, queryToken ?? historyToken ?? "");
}

export function resolveBranchDeskReturnForCurrentSession(
  userId: string,
  branchId: string,
  search: string,
  historyState: unknown,
) {
  try {
    return resolveBranchDeskReturn(window.sessionStorage, userId, branchId, search, historyState);
  } catch {
    return null;
  }
}