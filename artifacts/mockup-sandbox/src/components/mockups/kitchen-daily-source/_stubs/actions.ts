import { fixture } from "./fixtures";

export function previewNotice(detail = "معاينة فقط — لم يتم إرسال طلب أو تعديل أي بيانات.") {
  window.dispatchEvent(new CustomEvent("synthetic-preview-action", { detail }));
}
const toast = (options: { title?: string; description?: string; [key: string]: unknown }) =>
  previewNotice([options.title, options.description].filter(Boolean).join(" — "));
export function useToast() { return { toast }; }
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function getHttpStatus(error: unknown): number | null {
  return error instanceof HttpError ? error.status : null;
}
export async function apiRequest(method: string, url: string, ..._args: unknown[]): Promise<Response> {
  if (method.toUpperCase() !== "GET") {
    previewNotice();
    throw new Error("Synthetic preview: backend mutations are disabled.");
  }
  return new Response(JSON.stringify(fixture([url])), { status: 200, headers: { "Content-Type": "application/json" } });
}
export function useReactToPrint(_options: unknown) { return () => previewNotice("معاينة فقط — الطباعة معطلة."); }
export interface PrintTarget { key: string; win: Window | null }
export function openPrintWindow(): PrintTarget {
  previewNotice("معاينة فقط — نافذة الطباعة معطلة.");
  return { key: "synthetic-preview-only", win: null };
}
export function renderToPrintWindow(_target: PrintTarget, _html: string) { previewNotice(); }
export type EnablePushResult = "enabled" | "denied" | "unsupported" | "not-installed" | "ownership-conflict" | "error";
// Fixed capability context, without probing or requesting real device permission.
export function pushSupported() { return true; }
export function iosNeedsInstall() { return false; }
export async function enablePushNotifications(): Promise<EnablePushResult> { previewNotice("معاينة فقط — الإذن والاشتراك والتنبيهات معطلة."); return "unsupported"; }
export async function detachPushSubscriptionFromCurrentUser() {
  throw new Error("Synthetic preview: authentication and push operations are disabled.");
}