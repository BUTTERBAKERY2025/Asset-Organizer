import type { AnchorHTMLAttributes } from "react";

const navigate = (_href: string, _options?: { replace?: boolean }) => {
  window.dispatchEvent(new CustomEvent("synthetic-preview-action", { detail: "معاينة فقط — لم يتم فتح صفحة أو إرسال طلب." }));
};
export function useLocation(): [string, typeof navigate] { return ["/branch-operations", navigate]; }
export function useSearch() { return window.location.search; }
export function Link({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href="#" onClick={event => { event.preventDefault(); navigate(href ?? ""); }}>{children}</a>;
}