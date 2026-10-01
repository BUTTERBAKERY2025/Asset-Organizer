export function previewNotice(detail = "معاينة فقط — لم يتم إرسال طلب أو تعديل أي بيانات.") {
  window.dispatchEvent(new CustomEvent("synthetic-preview-action", { detail }));
}
const toast = (options: { title?: string; description?: string; [key: string]: unknown }) =>
  previewNotice([options.title, options.description].filter(Boolean).join(" — "));
export function useToast() { return { toast }; }
export async function apiRequest(..._args: unknown[]): Promise<Response> {
  previewNotice();
  throw new Error("Synthetic preview: backend requests and mutations are disabled.");
}
export function useReactToPrint(_options: unknown) {
  return () => previewNotice("معاينة فقط — الطباعة معطلة؛ لم يتم فتح نافذة خارجية.");
}
export async function detachPushSubscriptionFromCurrentUser() {
  throw new Error("Synthetic preview: authentication and push operations are disabled.");
}