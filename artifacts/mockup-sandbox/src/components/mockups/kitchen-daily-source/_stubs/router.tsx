import { useSyncExternalStore, type AnchorHTMLAttributes } from "react";
import { previewNotice } from "./actions";

const navigate = (_href: string, _options?: unknown) => previewNotice("معاينة فقط — التنقل إلى التطبيق أو الخدمات الخارجية معطل.");
export function useLocation(): [string, typeof navigate] { return ["/central-kitchen-orders", navigate]; }
const subscribe = (update: () => void) => {
  window.addEventListener("popstate", update);
  return () => window.removeEventListener("popstate", update);
};
export function useSearch() {
  return useSyncExternalStore(subscribe, () => window.location.search, () => "");
}
export function Link({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href="#" onClick={event => { event.preventDefault(); navigate(href ?? ""); }}>{children}</a>;
}