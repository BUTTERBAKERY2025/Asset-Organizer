/** Inert effects only. Never subscribes, requests permission, sets a badge, or sends push. */
export type PushNotificationStatus = "checking" | "enabled" | "disabled" | "denied" | "unsupported" | "not-installed" | "ownership-conflict" | "session-expired" | "provider-unsupported" | "server-error";
export type PushSyncResult = "enabled" | "none" | "unsupported" | "not-installed" | "ownership-conflict" | "session-expired" | "provider-unsupported" | "server-error";
const notice = () => window.dispatchEvent(new CustomEvent("synthetic-preview-action", { detail: "معاينة فقط — لا اشتراك أو إذن أو إشعار مرسل." }));
export const syncPushSubscription = async (): Promise<PushSyncResult> => "unsupported";
export const getPushNotificationStatus = async (): Promise<PushNotificationStatus> => "unsupported";
export const enablePushNotifications = async (): Promise<PushNotificationStatus | "error"> => { notice(); return "unsupported"; };
export const disablePushNotifications = async (): Promise<PushNotificationStatus | "error"> => { notice(); return "unsupported"; };
export const reinitializePushNotifications = async (): Promise<PushNotificationStatus | "error"> => { notice(); return "unsupported"; };
export const sendTestPushToCurrentDevice = async () => { notice(); return false; };
export const setPushSubscriptionSession = (_id: string | null) => {};
export const setBadgeAccount = (_id: string | null) => {};
export const syncAppBadge = async () => {};
export function useToast() { return { toast: (_input: unknown) => { notice(); } }; }