import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { useLocation, useParams, Link } from "wouter";
import { ArrowRight, Save, Send, Plus, Trash2, Wallet, CreditCard, Smartphone, Truck, AlertCircle, AlertTriangle, CheckCircle, Calculator, Users, Receipt, Camera, ImageIcon, X, Upload, FileDown, Copy, RotateCcw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Branch, CashierSalesJournal, CashierPaymentBreakdown, JournalAttachment } from "@shared/schema";
import { ATTACHMENT_TYPE_LABELS, ATTACHMENT_TYPES, type AttachmentType } from "@shared/schema";
import { printHtmlContent } from "@/lib/print-utils";

// Type for an attachment that hasn't been persisted to the server yet.
// After the Supabase migration the file is already uploaded to storage at
// pick time; we only carry the storage pointer until the journal exists and
// we can persist the DB row referencing it.
type PendingAttachment = {
  attachmentType: AttachmentType;
  fileName: string;
  filePath: string;
  downloadUrl: string;
  mimeType: string;
  fileSize: number;
  // Legacy: kept optional so any stale session-storage entries from before
  // the migration can still render (and be uploaded with the old base64 path).
  fileData?: string;
};

// Upload a single attachment with up to 3 attempts (small exponential
// backoff). Most "lost attachment" reports come from transient network
// blips on store WiFi — auto-retry resolves the vast majority silently.
async function uploadAttachmentWithRetry(
  journalId: number,
  attachment: PendingAttachment,
  maxAttempts = 3,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await apiRequest("POST", `/api/cashier-journals/${journalId}/attachments`, attachment);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastErr;
}

// Persist failed attachments in sessionStorage keyed by journalId so they
// survive the redirect from /new to /:id (component remounts and loses
// in-memory state). On the edit page mount we restore them as pending
// items, ready for the user to retry. Each journal has its own bucket —
// strict isolation by journalId, no cross-journal contamination.
const PENDING_STORAGE_KEY = (journalId: number | string) =>
  `cashier-journal-pending-attachments-${journalId}`;

// Returns true on success, false on quota/storage failure. Callers MUST
// check the return value before discarding the in-memory copy of failed
// attachments — otherwise a quota exception would silently lose them.
function savePendingToStorage(journalId: number | string, items: PendingAttachment[]): boolean {
  try {
    if (items.length === 0) {
      sessionStorage.removeItem(PENDING_STORAGE_KEY(journalId));
    } else {
      sessionStorage.setItem(PENDING_STORAGE_KEY(journalId), JSON.stringify(items));
    }
    return true;
  } catch {
    return false;
  }
}

function loadPendingFromStorage(journalId: number | string): PendingAttachment[] {
  try {
    const raw = sessionStorage.getItem(PENDING_STORAGE_KEY(journalId));
    return raw ? (JSON.parse(raw) as PendingAttachment[]) : [];
  } catch {
    return [];
  }
}

function clearPendingFromStorage(journalId: number | string) {
  try {
    sessionStorage.removeItem(PENDING_STORAGE_KEY(journalId));
  } catch {
    // ignore
  }
}

// apiRequest throws `Error("<status>: <body>")` on non-2xx responses. Most of
// our endpoints return JSON like `{ error: "..." }`. Pull that human message
// out so the user sees the actual reason (e.g. duplicate-journal 409) instead
// of a generic "فشل في إنشاء اليومية".
function extractServerError(err: unknown): string | null {
  if (!err) return null;
  const msg = err instanceof Error ? err.message : String(err);
  // Strip leading "<status>: " prefix from apiRequest
  const stripped = msg.replace(/^\d{3}:\s*/, "");
  // Try parsing JSON body
  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed === "object") {
      return parsed.error || parsed.message || null;
    }
  } catch {
    // not JSON — fall through and return the raw text
  }
  return stripped || null;
}

const PAYMENT_CATEGORIES = {
  cash: { label: "نقدي", color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" },
  cards: { label: "بطاقات وشبكة", color: "bg-primary/10 text-primary" },
  apps: { label: "تطبيقات التوصيل (آجل)", color: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" },
};

const CATEGORY_COLORS = {
  cash: { bg: "bg-emerald-50/60 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-900", icon: "bg-emerald-100 dark:bg-emerald-900/40", iconText: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-400" },
  cards: { bg: "bg-primary/5", border: "border-primary/20", icon: "bg-primary/10", iconText: "text-primary", badge: "bg-primary/60" },
  apps: { bg: "bg-amber-50/60 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900", icon: "bg-amber-100 dark:bg-amber-900/40", iconText: "text-amber-600 dark:text-amber-400", badge: "bg-amber-400" },
};

// Payment methods ordered by most commonly used first
const PAYMENT_METHODS = [
  { value: "cash", label: "نقداً", icon: Wallet, category: "cash", color: CATEGORY_COLORS.cash },
  { value: "mada", label: "مدى", icon: CreditCard, category: "cards", color: CATEGORY_COLORS.cards },
  { value: "visa", label: "فيزا", icon: CreditCard, category: "cards", color: CATEGORY_COLORS.cards },
  { value: "mastercard", label: "ماستركارد", icon: CreditCard, category: "cards", color: CATEGORY_COLORS.cards },
  { value: "amex", label: "أمريكان إكسبريس", icon: CreditCard, category: "cards", color: CATEGORY_COLORS.cards },
  { value: "card_other", label: "بطاقة أخرى", icon: CreditCard, category: "cards", color: CATEGORY_COLORS.cards },
  // Legacy bank payment methods (for backward compatibility)
  { value: "card", label: "بطاقة ائتمان (قديم)", icon: CreditCard, category: "cards", color: CATEGORY_COLORS.cards },
  { value: "apple_pay", label: "Apple Pay", icon: Smartphone, category: "cards", color: CATEGORY_COLORS.cards },
  { value: "stc_pay", label: "STC Pay", icon: Smartphone, category: "cards", color: CATEGORY_COLORS.cards },
  // Delivery apps - distinct text colors for each app
  { value: "hunger_station", label: "هنقرستيشن", icon: Truck, category: "apps", color: CATEGORY_COLORS.apps },
  { value: "jahez", label: "جاهز", icon: Truck, category: "apps", color: CATEGORY_COLORS.apps },
  { value: "toyou", label: "ToYou", icon: Truck, category: "apps", color: CATEGORY_COLORS.apps },
  { value: "marsool", label: "مرسول", icon: Truck, category: "apps", color: CATEGORY_COLORS.apps },
  { value: "keeta", label: "كيتا", icon: Truck, category: "apps", color: CATEGORY_COLORS.apps },
  { value: "the_chefs", label: "ذا شيفز", icon: Truck, category: "apps", color: CATEGORY_COLORS.apps },
  { value: "talabat", label: "طلبات", icon: Truck, category: "apps", color: CATEGORY_COLORS.apps },
  { value: "other", label: "أخرى", icon: Wallet, category: "cash", color: CATEGORY_COLORS.cash },
];

const SHIFT_TYPES = [
  { value: "morning", label: "صباحي" },
  { value: "evening", label: "مسائي" },
  { value: "night", label: "ليلي" },
];

interface PaymentBreakdownInput {
  paymentMethod: string;
  amount: number;
  transactionCount: number;
  notes?: string;
  // Bank reconciliation fields - حقول مطابقة البنك
  posAmount?: number; // المبلغ من نظام نقاط البيع
  terminalAmount?: number; // المبلغ من جهاز الصراف البنكي
  bankDiscrepancy?: number; // الفرق
  bankDiscrepancyType?: string; // balanced, shortage, surplus
  terminalTransactionCount?: number; // عدد العمليات من جهاز البنك
}

// Bank payment methods that require terminal reconciliation (includes legacy methods)
const BANK_PAYMENT_METHODS = ["mada", "visa", "mastercard", "amex", "card_other", "card", "apple_pay", "stc_pay"];

const isBankPaymentMethod = (method: string): boolean => {
  return BANK_PAYMENT_METHODS.includes(method);
};

// Prevent scroll/wheel from changing number input values
const preventWheelChange = (e: { currentTarget: HTMLInputElement }) => {
  e.currentTarget.blur();
};

// Clean numeric input - remove leading zeros and format properly
const cleanNumericValue = (value: string, isDecimal: boolean = true): string => {
  if (!value || value === '') return '';
  // Remove any non-numeric characters except decimal point
  let cleaned = value.replace(/[^\d.]/g, '');
  // Handle multiple decimal points - keep only first
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  // Remove leading zeros (but keep "0." for decimals)
  if (isDecimal) {
    cleaned = cleaned.replace(/^0+(?=\d)/, '');
  } else {
    cleaned = cleaned.replace(/^0+/, '') || '0';
  }
  return cleaned;
};

// Parse numeric value safely - handles empty/invalid strings
const parseNumericValue = (value: string, isDecimal: boolean = true): number => {
  const cleaned = cleanNumericValue(value, isDecimal);
  if (!cleaned || cleaned === '') return 0;
  return isDecimal ? parseFloat(cleaned) || 0 : parseInt(cleaned) || 0;
};

// Stable Numeric Input Component - prevents value jumping during decimal input
interface StableNumericInputProps {
  value: number | undefined | null;
  onChange: (value: number) => void;
  isDecimal?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

function StableNumericInput({ 
  value, 
  onChange, 
  isDecimal = true, 
  placeholder = "0",
  disabled = false,
  className = "",
  "data-testid": testId
}: StableNumericInputProps) {
  const [localValue, setLocalValue] = useState<string>(() => {
    if (value === null || value === undefined || value === 0) return '';
    return String(value);
  });
  const [isFocused, setIsFocused] = useState(false);
  
  // Sync local value with external value when not focused
  useEffect(() => {
    if (!isFocused) {
      if (value === null || value === undefined || value === 0) {
        setLocalValue('');
      } else {
        setLocalValue(String(value));
      }
    }
  }, [value, isFocused]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Allow empty input
    if (rawValue === '') {
      setLocalValue('');
      onChange(0);
      return;
    }
    
    // Clean the input but preserve trailing decimal point and zeros
    let cleaned = rawValue.replace(/[^\d.]/g, '');
    
    // Handle multiple decimal points - keep only first
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // For integers, limit decimal places
    if (!isDecimal) {
      cleaned = cleaned.split('.')[0];
    }
    
    // Remove leading zeros but keep "0" or "0."
    if (cleaned.length > 1 && cleaned[0] === '0' && cleaned[1] !== '.') {
      cleaned = cleaned.replace(/^0+/, '');
    }
    
    setLocalValue(cleaned);
    
    // Parse and update parent - but don't remove trailing decimal point from local
    const numericValue = isDecimal ? parseFloat(cleaned) || 0 : parseInt(cleaned) || 0;
    onChange(numericValue);
  };
  
  const handleFocus = () => {
    setIsFocused(true);
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    // Format on blur
    if (localValue === '' || localValue === '.') {
      setLocalValue('');
    } else {
      const numericValue = isDecimal ? parseFloat(localValue) || 0 : parseInt(localValue) || 0;
      if (numericValue === 0) {
        setLocalValue('');
      } else {
        setLocalValue(String(numericValue));
      }
    }
  };
  
  return (
    <Input
      type="text"
      inputMode={isDecimal ? "decimal" : "numeric"}
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onWheel={preventWheelChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      data-testid={testId}
    />
  );
}

export default function CashierJournalFormPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [showShortageConfirm, setShowShortageConfirm] = useState(false);
  const [showVarianceConfirm, setShowVarianceConfirm] = useState(false);
  const [varianceConfirmed, setVarianceConfirmed] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<(() => void) | null>(null);
  const [activeTab, setActiveTab] = useState("shift");

  const isEdit = !!id;

  // Session heartbeat — pings /api/auth/me every 10 minutes while this form
  // is open so a cashier filling out the close-of-shift form (signature +
  // attachments) doesn't get logged out by the server-side inactivity timer
  // and lose their work to a 401 on upload.
  useEffect(() => {
    const tick = () => {
      fetch("/api/auth/me", { credentials: "include", cache: "no-store" }).catch(() => {});
    };
    const interval = setInterval(tick, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getUserDisplayName = () => {
    if (!user) return "";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    return user.username || "";
  };

  const [formData, setFormData] = useState({
    branchId: "",
    journalDate: new Date().toISOString().split("T")[0],
    shiftType: "morning",
    cashierName: "",
    cashierId: "",
    openingBalance: 0,
    totalSales: 0,
    cashTotal: 0,
    actualCashDrawer: 0,
    customerCount: 0,
    transactionCount: 0,
    notes: "",
  });

  useEffect(() => {
    if (!isEdit && user && !formData.cashierName) {
      setFormData(prev => ({
        ...prev,
        cashierName: getUserDisplayName(),
        cashierId: user.id,
        branchId: user.branchId || prev.branchId,
      }));
    }
  }, [user, isEdit]);

  const [paymentBreakdowns, setPaymentBreakdowns] = useState<PaymentBreakdownInput[]>([
    { paymentMethod: "cash", amount: 0, transactionCount: 0 },
  ]);

  // Returns state - المرتجع
  const [showReturns, setShowReturns] = useState(false);
  const [returnData, setReturnData] = useState({
    returnAmount: 0,
    returnPaymentMethod: "cash",
    returnReason: "",
    returnReference: "",
    hasReturn: false,
  });

  const [attachments, setAttachments] = useState<JournalAttachment[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  // Tracks a journal that was successfully created in this session but whose
  // attachment-persistence step failed (sessionStorage quota). Set so that
  // pressing Save again navigates to the existing journal instead of
  // creating a duplicate record.
  const [createdJournalId, setCreatedJournalId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = useState<AttachmentType | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  const allAttachmentImages = [
    ...attachments.map(a => ({ src: (a as any).downloadUrl || a.fileData || '', label: ATTACHMENT_TYPE_LABELS[a.attachmentType as AttachmentType] || a.attachmentType, fileName: a.fileName })),
    ...pendingAttachments.map(a => ({ src: a.downloadUrl || a.fileData || '', label: ATTACHMENT_TYPE_LABELS[a.attachmentType] || a.attachmentType, fileName: a.fileName })),
  ];

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxZoom(1);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxZoom(1);
  }, []);

  const navigateLightbox = useCallback((direction: number) => {
    setLightboxIndex(prev => {
      const next = prev + direction;
      if (next < 0) return allAttachmentImages.length - 1;
      if (next >= allAttachmentImages.length) return 0;
      return next;
    });
    setLightboxZoom(1);
  }, [allAttachmentImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") navigateLightbox(1);
      if (e.key === "ArrowRight") navigateLightbox(-1);
      if (e.key === "+" || e.key === "=") setLightboxZoom(z => Math.min(z + 0.25, 4));
      if (e.key === "-") setLightboxZoom(z => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, closeLightbox, navigateLightbox]);

  const { branches: filteredBranches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    if (userBranchId && !formData.branchId && !isEdit) {
      setFormData(prev => ({ ...prev, branchId: userBranchId }));
    }
  }, [userBranchId, formData.branchId, isEdit]);

  const { data: existingJournal, isLoading: loadingJournal } = useQuery<CashierSalesJournal & { 
    paymentBreakdowns: CashierPaymentBreakdown[];
    signatures?: { signatureType: string; signerName: string; signatureData: string; signedAt: string }[];
  }>({
    queryKey: [`/api/cashier-journals/${id}`],
    enabled: isEdit,
  });

  // Retry transient network errors but NOT auth/permission errors —
  // hammering a 403 endpoint just spams the server and delays the visible
  // error message. Treat 4xx as permanent and surface the failure.
  const { data: existingAttachments, error: attachmentsError, isError: attachmentsFailed } = useQuery<JournalAttachment[]>({
    queryKey: [`/api/cashier-journals/${id}/attachments`],
    enabled: isEdit,
    retry: (failureCount, error: any) => {
      const status = error?.status ?? (typeof error?.message === "string" ? parseInt(error.message.match(/^(\d{3}):/)?.[1] ?? "", 10) : 0);
      if (status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (existingAttachments) {
      setAttachments(existingAttachments);
    }
  }, [existingAttachments]);

  // Surface attachment fetch failures explicitly. Without this, a 403 or
  // 500 from the server would leave `attachments` at its initial empty
  // array and the user would see "لا توجد مرفقات" — indistinguishable
  // from a journal that genuinely has no photos. That silent failure was
  // the root cause of the "sometimes appear, sometimes don't" reports.
  useEffect(() => {
    if (!attachmentsFailed || !attachmentsError) return;
    const status = (attachmentsError as any)?.status ?? 0;
    const msg = String((attachmentsError as any)?.message ?? "");
    const isForbidden = status === 403 || msg.includes("403");
    toast({
      title: isForbidden ? "لا يمكن عرض المرفقات" : "تعذّر تحميل المرفقات",
      description: isForbidden
        ? "ليست لديك الصلاحية لعرض مرفقات هذه اليومية. تواصل مع المسؤول."
        : "حدث خطأ أثناء جلب المرفقات. تأكد من اتصالك بالإنترنت ثم أعد تحميل الصفحة.",
      variant: "destructive",
    });
  }, [attachmentsFailed, attachmentsError, toast]);

  // Recover attachments that failed during creation (saved in sessionStorage
  // under this journal's id) and automatically retry uploading them in the
  // background. Gated by `existingJournal` so we only fire AFTER the user
  // has demonstrated authorized access — otherwise a stale sessionStorage
  // entry for a journal the user can no longer reach would loop forever
  // on every mount, hammering the server with 403s.
  useEffect(() => {
    if (!isEdit || !id || !existingJournal) return;
    const recovered = loadPendingFromStorage(id);
    if (recovered.length === 0) return;

    let cancelled = false;
    (async () => {
      const journalIdNum = parseInt(id, 10);
      const results = await Promise.allSettled(
        recovered.map((att) => uploadAttachmentWithRetry(journalIdNum, att))
      );
      if (cancelled) return;
      const stillFailed = recovered.filter((_, i) => results[i].status === "rejected");
      if (stillFailed.length === 0) {
        clearPendingFromStorage(id);
        queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}/attachments`] });
        toast({ title: "تم استعادة ورفع المرفقات المفقودة بنجاح" });
      } else {
        // Detect permanent 403 (e.g. permissions revoked) vs transient
        // failures. A 403 means we should clear the storage so we don't
        // retry forever on every page load.
        const isAllForbidden = results.every(
          (r) => r.status === "rejected" && String((r as PromiseRejectedResult).reason).includes("403")
        );
        if (isAllForbidden) {
          clearPendingFromStorage(id);
          toast({
            title: "تعذّر استعادة المرفقات",
            description: "ليست لديك صلاحية رفع المرفقات لهذه اليومية.",
            variant: "destructive",
          });
          return;
        }
        savePendingToStorage(id, stillFailed);
        setPendingAttachments((prev) => [...prev, ...stillFailed]);
        toast({
          title: `${stillFailed.length} مرفق ينتظر إعادة المحاولة`,
          description: "اضغط زر الحفظ لإعادة محاولة الرفع",
          variant: "destructive",
        });
      }
    })();
    return () => { cancelled = true; };
    // Intentionally only depend on id/isEdit/existingJournal — we only want
    // to run this recovery ONCE per journal mount, after auth confirmed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, existingJournal]);

  useEffect(() => {
    if (existingJournal) {
      setFormData({
        branchId: existingJournal.branchId,
        journalDate: existingJournal.journalDate,
        shiftType: existingJournal.shiftType || "morning",
        cashierName: existingJournal.cashierName,
        cashierId: existingJournal.cashierId || "",
        openingBalance: existingJournal.openingBalance || 0,
        totalSales: existingJournal.totalSales,
        cashTotal: existingJournal.cashTotal,
        actualCashDrawer: existingJournal.actualCashDrawer,
        customerCount: existingJournal.customerCount || 0,
        transactionCount: existingJournal.transactionCount || 0,
        notes: existingJournal.notes || "",
      });
      if (existingJournal.paymentBreakdowns?.length > 0) {
        setPaymentBreakdowns(
          existingJournal.paymentBreakdowns.map((b: any) => ({
            paymentMethod: b.paymentMethod,
            amount: b.amount,
            transactionCount: b.transactionCount || 0,
            notes: b.notes || "",
            // Bank reconciliation fields
            posAmount: b.posAmount || b.amount || 0,
            terminalAmount: b.terminalAmount || 0,
            bankDiscrepancy: b.bankDiscrepancy || 0,
            bankDiscrepancyType: b.bankDiscrepancyType || 'balanced',
            terminalTransactionCount: b.terminalTransactionCount || 0,
          }))
        );
      }
      // Load returns data
      if ((existingJournal as any).hasReturn || (existingJournal as any).returnAmount > 0) {
        setReturnData({
          returnAmount: (existingJournal as any).returnAmount || 0,
          returnPaymentMethod: (existingJournal as any).returnPaymentMethod || "cash",
          returnReason: (existingJournal as any).returnReason || "",
          returnReference: (existingJournal as any).returnReference || "",
          hasReturn: (existingJournal as any).hasReturn || false,
        });
        setShowReturns(true);
      }
    }
  }, [existingJournal]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cashier-journals", data);
      return res.json();
    },
    onSuccess: async (createdJournal: CashierSalesJournal) => {
      // Parallel uploads with per-item retry (3 attempts each). Any items
      // that still fail are persisted to sessionStorage under the newly
      // created journal's ID so they survive the route change /new → /:id
      // and can be auto-retried after the edit page mounts.
      let failedAttachments: PendingAttachment[] = [];
      let persistenceFailed = false;
      if (pendingAttachments.length > 0) {
        const results = await Promise.allSettled(
          pendingAttachments.map((attachment) =>
            uploadAttachmentWithRetry(createdJournal.id, attachment)
          )
        );
        failedAttachments = pendingAttachments.filter((_, i) => results[i].status === "rejected");
        if (failedAttachments.length > 0) {
          console.error("Failed uploads after retries:", results.filter(r => r.status === "rejected"));
          // Verify the persisted copy actually landed in sessionStorage before
          // we clear the in-memory list — otherwise a quota exception would
          // silently lose the user's photos.
          persistenceFailed = !savePendingToStorage(createdJournal.id, failedAttachments);
        }
      }

      // Force a hard refetch (not just invalidation) so the list page sees the
      // new journal even if its query is within staleTime. Without this, users
      // were saving journals and immediately not seeing them because the list's
      // 30s stale cache served stale data on remount.
      await queryClient.invalidateQueries({
        queryKey: ["/api/cashier-journals"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/cashier-journals/stats/summary"],
        refetchType: "all",
      });

      if (failedAttachments.length > 0 && persistenceFailed) {
        // Worst case: uploads failed AND we can't persist. Keep them in
        // memory and DO NOT navigate, so the user has a chance to retry
        // without losing the photos. Remember the created journal id so
        // a subsequent Save click navigates to it instead of creating a
        // duplicate record.
        setCreatedJournalId(createdJournal.id);
        toast({
          title: "تعذّر حفظ المرفقات الفاشلة",
          description: "ذاكرة المتصفح ممتلئة. أعد المحاولة أو افتح اليومية المحفوظة.",
          variant: "destructive",
        });
        return;
      }

      setPendingAttachments([]);

      if (failedAttachments.length > 0) {
        toast({
          title: "تم حفظ اليومية — لكن فشل رفع بعض المرفقات",
          description: `${failedAttachments.length} مرفق محفوظ محلياً. سيُعاد محاولة الرفع تلقائياً.`,
          variant: "destructive",
        });
        setLocation(`/cashier-journals/${createdJournal.id}`);
      } else {
        // CRITICAL: Navigate to the detail page (not the list) so the user gets
        // INSTANT proof the journal saved — independent of any list-page filters
        // (branch, cashier, date) that may hide it. Previously users were
        // redirected to the list, and admins who created a journal for a branch
        // different from their default branchFilter would see "اليومية لا تظهر".
        toast({
          title: "تم إنشاء اليومية بنجاح",
          description: `رقم اليومية: ${createdJournal.id} — يمكنك الآن تعديلها أو ترحيلها`,
        });
        setLocation(`/cashier-journals/${createdJournal.id}`);
      }
    },
    onError: (err: any) => {
      toast({
        title: "تعذّر حفظ اليومية",
        description: extractServerError(err) || "فشل في إنشاء اليومية. تحقق من الاتصال وحاول مجدداً.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/cashier-journals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}`] });
      toast({ title: "تم تحديث اليومية بنجاح" });
      setLocation("/cashier-journals");
    },
    onError: (err: any) => {
      toast({
        title: "تعذّر تحديث اليومية",
        description: extractServerError(err) || "فشل في تحديث اليومية. تحقق من الاتصال وحاول مجدداً.",
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { signatureData?: string; signerName?: string }) =>
      apiRequest("POST", `/api/cashier-journals/${id}/submit`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      toast({ title: "تم تقديم اليومية للمراجعة" });
      setLocation("/cashier-journals");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تقديم اليومية", variant: "destructive" });
    },
  });

  const postMutation = useMutation({
    mutationFn: async (data: { signatureData?: string; signerName?: string }) =>
      apiRequest("POST", `/api/cashier-journals/${id}/post`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}`] });
      toast({ title: "تم ترحيل اليومية بنجاح", description: "لم يعد بإمكانك تعديل هذه اليومية" });
      setLocation("/cashier-journals");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في ترحيل اليومية", variant: "destructive" });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (data: { journalId: number; attachment: PendingAttachment }) => {
      // Use retry helper here too so single-file uploads in edit mode
      // benefit from the same resilience as bulk creation uploads.
      await uploadAttachmentWithRetry(data.journalId, data.attachment);
      // Refetch the canonical list — the retry helper doesn't return the
      // created row directly, but invalidating the query gets us the
      // freshest server state which is what we want anyway.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}/attachments`] });
      toast({ title: "تم رفع المرفق بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في رفع المرفق بعد عدة محاولات", variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) =>
      apiRequest("DELETE", `/api/cashier-journals/${id}/attachments/${attachmentId}`),
    onSuccess: (_, attachmentId) => {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}/attachments`] });
      toast({ title: "تم حذف المرفق" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف المرفق", variant: "destructive" });
    },
  });

  const handleFileSelect = (type: AttachmentType) => {
    setUploadingType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*";
      fileInputRef.current.capture = "environment"; // Opens rear camera on mobile
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const type = uploadingType;
    // Always reset the input/state before any early return so that picking the
    // same file twice still fires `change` and the UI doesn't get stuck.
    e.target.value = "";
    setUploadingType(null);
    if (!file || !type) return;

    // Client-side size guard — base64 inflates by ~33%, and the server body
    // limit is 50MB. We cap raw files at 10MB to leave headroom and to
    // prevent silent failures on slow connections.
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "حجم الملف كبير جداً",
        description: `الحد الأقصى ${MAX_FILE_SIZE / 1024 / 1024} ميجابايت. حجم الملف: ${(file.size / 1024 / 1024).toFixed(1)} ميجابايت`,
        variant: "destructive",
      });
      return;
    }

    // iPhone HEIC images often come through as image/heic which some browsers
    // can display but server processing may reject — warn early instead of
    // silently losing them after a failed upload.
    if (file.type && !file.type.startsWith("image/")) {
      toast({
        title: "نوع الملف غير مدعوم",
        description: "يُرجى اختيار صورة (JPG, PNG)",
        variant: "destructive",
      });
      return;
    }

    // Upload directly to Supabase Storage (via the unified /api/uploads
    // endpoint) instead of converting to base64 and stuffing into the DB.
    // The file is associated with this journal's folder when known so it's
    // easy to audit storage usage per journal.
    (async () => {
      try {
        const folder = `cashier-journals/${id || 'pending'}`;
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/uploads?folder=${encodeURIComponent(folder)}`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 401) {
            throw new Error("انتهت جلستك. يُرجى إعادة تسجيل الدخول في تبويب جديد ثم العودة لرفع المرفق");
          }
          throw new Error(err.error || err.message || `Upload failed (HTTP ${res.status})`);
        }
        const result = await res.json() as { filePath: string; downloadUrl: string };
        if (!result.filePath || !result.downloadUrl) {
          throw new Error("استجابة الرفع غير مكتملة");
        }

        if (isEdit && id) {
          uploadAttachmentMutation.mutate({
            journalId: parseInt(id),
            attachment: {
              attachmentType: type,
              fileName: file.name,
              filePath: result.filePath,
              downloadUrl: result.downloadUrl,
              mimeType: file.type,
              fileSize: file.size,
            },
          });
        } else {
          setPendingAttachments((prev) => [
            ...prev,
            {
              attachmentType: type,
              fileName: file.name,
              filePath: result.filePath,
              downloadUrl: result.downloadUrl,
              mimeType: file.type,
              fileSize: file.size,
            },
          ]);
          toast({ title: "تمت إضافة المرفق", description: "سيُربط باليومية تلقائياً عند الحفظ" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "فشل في رفع الملف";
        toast({
          title: "فشل رفع المرفق",
          description: msg,
          variant: "destructive",
        });
      }
    })();
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // In edit mode the pending list mirrors what's in sessionStorage
      // (recovered items waiting for retry). Keep them in sync so removing
      // an item from the UI also removes it from the persisted recovery
      // queue — otherwise it would reappear on next page load.
      if (isEdit && id) {
        savePendingToStorage(id, next);
      }
      return next;
    });
  };

  const isReadOnly = existingJournal && existingJournal.status !== "draft";

  // Threshold for shortage confirmation (50 SAR)
  const SHORTAGE_CONFIRM_THRESHOLD = 50;

  // Retry uploads against an already-created journal (post-quota-failure
  // path). Tries each pending file with retries; on full success, navigates
  // to the journal; on partial success, attempts to persist remaining
  // failures to sessionStorage and only navigates if persistence works.
  // If persistence STILL fails, keeps user in place so files aren't lost.
  const retryPendingForCreatedJournal = async (journalId: number) => {
    if (pendingAttachments.length === 0) {
      setLocation(`/cashier-journals/${journalId}`);
      return;
    }
    const results = await Promise.allSettled(
      pendingAttachments.map((att) => uploadAttachmentWithRetry(journalId, att))
    );
    const stillFailed = pendingAttachments.filter((_, i) => results[i].status === "rejected");
    if (stillFailed.length === 0) {
      setPendingAttachments([]);
      setCreatedJournalId(null);
      toast({ title: "تم رفع المرفقات بنجاح" });
      setLocation(`/cashier-journals/${journalId}`);
      return;
    }
    const persisted = savePendingToStorage(journalId, stillFailed);
    if (persisted) {
      setPendingAttachments([]);
      setCreatedJournalId(null);
      toast({
        title: `${stillFailed.length} مرفق سيُعاد محاولة رفعه`,
        variant: "destructive",
      });
      setLocation(`/cashier-journals/${journalId}`);
    } else {
      setPendingAttachments(stillFailed);
      toast({
        title: "ذاكرة المتصفح ممتلئة",
        description: "احذف بعض المرفقات أو نظّف ذاكرة المتصفح ثم أعد المحاولة.",
        variant: "destructive",
      });
    }
  };

  const doSave = () => {
    const canvas = signatureCanvasRef.current;
    const signatureData = hasSignature && canvas ? canvas.toDataURL("image/png") : undefined;

    const data = {
      ...formData,
      paymentBreakdowns: paymentBreakdowns.filter((b) => b.amount > 0 || (b.terminalAmount && b.terminalAmount > 0)),
      signatureData,
      signerName: formData.cashierName,
      // Returns data
      returnAmount: returnData.hasReturn ? returnData.returnAmount : 0,
      returnPaymentMethod: returnData.hasReturn ? returnData.returnPaymentMethod : null,
      returnReason: returnData.hasReturn ? returnData.returnReason : null,
      returnReference: returnData.hasReturn ? returnData.returnReference : null,
      hasReturn: returnData.hasReturn,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else if (createdJournalId) {
      // A journal was already created in this session but post-create
      // persistence failed. Don't create a duplicate — instead retry the
      // pending attachments directly against the existing journal id, then
      // navigate based on the result. This preserves the in-memory files
      // even when sessionStorage is unavailable.
      retryPendingForCreatedJournal(createdJournalId);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSave = () => {
    // Field-by-field validation with explicit, actionable error messages so the
    // user knows EXACTLY which field to fill. Previously the Save button was
    // simply disabled when these failed, leaving the user with a dead button
    // and no feedback — the single most-reported bug on this form.
    const missing: string[] = [];
    if (!formData.branchId) missing.push("الفرع");
    if (!formData.cashierName || !formData.cashierName.trim()) missing.push("اسم الكاشير");
    if (!formData.journalDate) missing.push("التاريخ");
    if (!(formData.totalSales > 0)) missing.push("إجمالي المبيعات (يجب أن يكون أكبر من صفر)");
    if (missing.length > 0) {
      toast({
        title: "بيانات ناقصة",
        description: `يرجى استكمال: ${missing.join("، ")}`,
        variant: "destructive",
      });
      return;
    }

    if (!hasSignature && !isEdit) {
      toast({ 
        title: "التوقيع الإلكتروني مطلوب", 
        description: "يجب التوقيع الإلكتروني قبل حفظ اليومية", 
        variant: "destructive" 
      });
      return;
    }

    // Show warning if there's a mismatch but allow saving as draft
    if (getTotalsMismatch()) {
      toast({ 
        title: "تنبيه: فرق في الأرقام", 
        description: "سيتم حفظ اليومية كمسودة. يرجى تصحيح الفرق قبل الترحيل.", 
        variant: "default" 
      });
    }

    // Check for large shortage and show confirmation dialog
    const discrepancy = calculateDiscrepancy();
    if (discrepancy < -SHORTAGE_CONFIRM_THRESHOLD) {
      setPendingSaveAction(() => doSave);
      setShowShortageConfirm(true);
      return;
    }

    doSave();
  };

  const handleSaveAndPost = async () => {
    // Show confirmation if there's a variance, but allow posting after confirmation
    if (getTotalsMismatch() && !varianceConfirmed) {
      setShowVarianceConfirm(true);
      return;
    }
    // Reset confirmation flag for next time
    setVarianceConfirmed(false);

    const canvas = signatureCanvasRef.current;
    const signatureData = canvas ? canvas.toDataURL("image/png") : undefined;

    if (isEdit) {
      const data = {
        ...formData,
        paymentBreakdowns: paymentBreakdowns.filter((b) => b.amount > 0 || (b.terminalAmount && b.terminalAmount > 0)),
        // Returns data
        returnAmount: returnData.hasReturn ? returnData.returnAmount : 0,
        returnPaymentMethod: returnData.hasReturn ? returnData.returnPaymentMethod : null,
        returnReason: returnData.hasReturn ? returnData.returnReason : null,
        returnReference: returnData.hasReturn ? returnData.returnReference : null,
        hasReturn: returnData.hasReturn,
      };
      await updateMutation.mutateAsync(data);
    }

    postMutation.mutate({
      signatureData,
      signerName: formData.cashierName,
    });
  };

  const handleSubmit = () => {
    const canvas = signatureCanvasRef.current;
    const signatureData = canvas ? canvas.toDataURL("image/png") : undefined;

    submitMutation.mutate({
      signatureData,
      signerName: formData.cashierName,
    });
  };

  const addPaymentBreakdown = () => {
    setPaymentBreakdowns([...paymentBreakdowns, { paymentMethod: "card", amount: 0, transactionCount: 0 }]);
  };

  const removePaymentBreakdown = (index: number) => {
    setPaymentBreakdowns(paymentBreakdowns.filter((_, i) => i !== index));
  };

  // Update a single field - use functional state update to avoid stale state issues
  const updatePaymentBreakdown = (index: number, field: string, value: any) => {
    setPaymentBreakdowns(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Update cash total if we're updating amount on cash payment
      if (field === "amount") {
        const cashBreakdown = updated.find((b) => b.paymentMethod === "cash");
        if (cashBreakdown) {
          setFormData((prevForm) => ({ ...prevForm, cashTotal: cashBreakdown.amount }));
        }
      }
      
      return updated;
    });
  };

  // Update multiple fields at once - for bank payment updates that need to set both amount and posAmount
  const updatePaymentBreakdownMultiple = (index: number, updates: Partial<PaymentBreakdownInput>) => {
    setPaymentBreakdowns(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      
      // Update cash total if we're updating amount on cash payment
      if ('amount' in updates) {
        const cashBreakdown = updated.find((b) => b.paymentMethod === "cash");
        if (cashBreakdown) {
          setFormData((prevForm) => ({ ...prevForm, cashTotal: cashBreakdown.amount }));
        }
      }
      
      return updated;
    });
  };

  const getBreakdownTotal = () => {
    // Sum POS amounts only (what was sold), not terminal amounts
    // Terminal amounts are used in the comprehensive reconciliation summary
    return paymentBreakdowns.reduce((sum, b) => sum + (b.amount || 0), 0);
  };

  // Net sales = Total Sales from payment breakdowns - Returns
  // IMPORTANT: Use getBreakdownTotal() instead of formData.totalSales 
  // because formData.totalSales is not automatically updated from payment breakdowns
  const getNetSales = () => {
    const totalFromBreakdowns = getBreakdownTotal();
    return totalFromBreakdowns - (returnData.hasReturn ? returnData.returnAmount : 0);
  };

  // Get adjusted breakdown total (subtracts return from appropriate payment method)
  const getAdjustedBreakdownTotal = () => {
    const grossTotal = getBreakdownTotal();
    if (!returnData.hasReturn || returnData.returnAmount <= 0) {
      return grossTotal;
    }
    return grossTotal - returnData.returnAmount;
  };

  // Calculate total bank reconciliation discrepancy
  const getBankReconciliationSummary = () => {
    const bankPayments = paymentBreakdowns.filter(b => isBankPaymentMethod(b.paymentMethod) && (b.amount > 0 || b.terminalAmount));
    
    let totalPosAmount = 0;
    let totalTerminalAmount = 0;
    let totalPosTransactions = 0;
    let totalTerminalTransactions = 0;
    
    bankPayments.forEach(b => {
      totalPosAmount += b.posAmount || b.amount || 0;
      totalTerminalAmount += b.terminalAmount || 0;
      totalPosTransactions += b.transactionCount || 0;
      totalTerminalTransactions += b.terminalTransactionCount || 0;
    });
    
    const discrepancy = totalTerminalAmount - totalPosAmount;
    const transactionDiff = totalTerminalTransactions - totalPosTransactions;
    
    // Detect potential input error: when cash shortage equals bank surplus (wrong payment button pressed)
    const cashDiscrepancy = calculateDiscrepancy();
    const inputErrorDetected = Math.abs(cashDiscrepancy) > 0.5 && Math.abs(discrepancy) > 0.5 && 
      Math.abs(Math.abs(cashDiscrepancy) - Math.abs(discrepancy)) < 1 && 
      (cashDiscrepancy * discrepancy) < 0; // opposite signs
    
    return {
      bankPayments,
      totalPosAmount,
      totalTerminalAmount,
      totalPosTransactions,
      totalTerminalTransactions,
      discrepancy,
      transactionDiff,
      inputErrorDetected,
      type: discrepancy > 0.5 ? 'surplus' : discrepancy < -0.5 ? 'shortage' : 'balanced'
    };
  };

  const getTotalsMismatch = () => {
    // Compare breakdown total with total sales
    // If there's a return, compare gross totals (return is separate line item, not part of breakdown)
    const breakdownTotal = getBreakdownTotal();
    const diff = Math.abs(formData.totalSales - breakdownTotal);
    return diff > 0.01;
  };

  // Calculate expected cash in drawer = Opening Balance + Cash Sales - Cash Returns
  const getExpectedCashInDrawer = () => {
    const adjustedCategoryTotals = getAdjustedCategoryTotals();
    const openingBalance = formData.openingBalance ?? 0;
    return openingBalance + adjustedCategoryTotals.cash;
  };

  const calculateDiscrepancy = () => {
    // Discrepancy = Actual Cash - Expected Cash (including opening balance)
    const expectedCash = getExpectedCashInDrawer();
    return formData.actualCashDrawer - expectedCash;
  };

  // Comprehensive variance summary - unified source of truth
  const getVarianceSummary = () => {
    const bankSummary = getBankReconciliationSummary();
    const totalTerminal = bankSummary.totalTerminalAmount || 0;
    const actualCash = formData.actualCashDrawer || 0;
    const totalActualCollected = actualCash + totalTerminal;
    const netSalesVal = getNetSales();
    const cashDiscrepancy = calculateDiscrepancy();
    const bankDiscrepancy = bankSummary.discrepancy;
    
    // Get delivery apps total (آجل - deferred payments)
    // These should NOT be included in the expected collected amount
    // because the money comes later from the app companies
    const categoryTotals = getAdjustedCategoryTotals();
    const appsTotal = categoryTotals.apps || 0;
    
    // Expected collected = net sales - deferred apps
    // We only expect to collect cash + bank payments today
    const expectedCollected = netSalesVal - appsTotal;
    
    // Net variance = actual collected - expected collected (excluding deferred apps)
    const netVariance = totalActualCollected - expectedCollected;
    
    const absVariance = Math.abs(netVariance);
    const varianceType = absVariance <= 5 ? 'balanced' : absVariance <= 25 ? 'warning' : 'critical';
    
    return {
      netVariance,
      cashDiscrepancy,
      bankDiscrepancy,
      totalActualCollected,
      netSales: netSalesVal,
      expectedCollected, // Expected cash+bank (excluding deferred apps)
      appsTotal, // Deferred delivery apps amount
      varianceType,
      hasBankPayments: bankSummary.bankPayments.length > 0,
    };
  };

  const calculateAverageTicket = () => {
    if (formData.transactionCount > 0) {
      return formData.totalSales / formData.transactionCount;
    }
    return 0;
  };

  const getDiscrepancyStatus = () => {
    const diff = calculateDiscrepancy();
    if (diff === 0) return { label: "متوازن", color: "text-green-600 bg-green-50", isShortage: false };
    if (diff < 0) return { label: `عجز ${Math.abs(diff).toFixed(2)} ر.س`, color: "text-destructive bg-destructive/10", isShortage: true };
    return { label: `زيادة ${diff.toFixed(2)} ر.س`, color: "text-amber-600 bg-amber-50", isShortage: false };
  };

  const getCategoryTotals = () => {
    const totals = { cash: 0, cards: 0, apps: 0 };
    paymentBreakdowns.forEach((b) => {
      const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
      if (method) {
        totals[method.category as keyof typeof totals] += b.amount || 0;
      }
    });
    return totals;
  };

  // Get category totals adjusted for returns (subtracts return from appropriate category)
  const getAdjustedCategoryTotals = () => {
    const totals = getCategoryTotals();
    if (!returnData.hasReturn || returnData.returnAmount <= 0) {
      return totals;
    }
    
    // Find which category the return payment method belongs to
    const method = PAYMENT_METHODS.find((m) => m.value === returnData.returnPaymentMethod);
    if (method) {
      totals[method.category as keyof typeof totals] -= returnData.returnAmount;
    }
    return totals;
  };

  const getAppBreakdowns = () => {
    return paymentBreakdowns.filter((b) => {
      const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
      return method?.category === "apps" && b.amount > 0;
    });
  };

  const getCardBreakdowns = () => {
    return paymentBreakdowns.filter((b) => {
      const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
      return method?.category === "cards" && b.amount > 0;
    });
  };

  // Allow saving drafts even with mismatch, and allow posting with variance (after confirmation)
  const canSave = formData.totalSales > 0 && formData.branchId && formData.cashierName;
  const canPost = canSave; // Allow posting with variance - confirmation dialog will be shown

  const getDiscrepancyAnalysis = () => {
    const cashDiscrepancy = calculateDiscrepancy();
    const categoryTotals = getCategoryTotals();
    const breakdownTotal = getBreakdownTotal();
    const reportedTotal = formData.totalSales;
    
    if (cashDiscrepancy === 0) {
      return { type: "balanced", message: "الصندوق متوازن" };
    }
    
    const shortage = Math.abs(cashDiscrepancy);
    const breakdownDiff = Math.abs(breakdownTotal - reportedTotal);
    
    const expectedCashFromBreakdown = categoryTotals.cash;
    const actualCashInDrawer = formData.actualCashDrawer;
    const cashDiff = expectedCashFromBreakdown - actualCashInDrawer;
    
    const expectedNonCash = reportedTotal - actualCashInDrawer;
    const recordedNonCash = categoryTotals.cards + categoryTotals.apps;
    const nonCashVariance = Math.abs(recordedNonCash - expectedNonCash);
    
    if (cashDiscrepancy < 0) {
      if (categoryTotals.cards > 0 && breakdownDiff < 5) {
        if (Math.abs(cashDiff - (categoryTotals.cards - (reportedTotal - actualCashInDrawer - categoryTotals.apps))) < 10) {
          return { 
            type: "possible_misclass", 
            message: `عجز نقدي ${shortage.toFixed(2)} ر.س - قد يكون الكاشير ضرب حركة نقدي على أنها بطاقة. تحقق من العمليات وطابق المبالغ.` 
          };
        }
      }
      
      if (categoryTotals.cards > 0 && shortage > 10 && nonCashVariance > shortage * 0.5) {
        return { 
          type: "possible_misclass", 
          message: `عجز نقدي ${shortage.toFixed(2)} ر.س - يوجد تفاوت في تصنيف طرق الدفع. تحقق من صحة المبالغ المسجلة.` 
        };
      }
      
      return { 
        type: "shortage", 
        message: `عجز حقيقي بقيمة ${shortage.toFixed(2)} ر.س - سيُسجَّل على الكاشير` 
      };
    }
    
    return { 
      type: "surplus", 
      message: `زيادة في الصندوق بقيمة ${cashDiscrepancy.toFixed(2)} ر.س - يجب توضيح السبب` 
    };
  };

  const initCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1e3a5f";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
  };

  useEffect(() => {
    initCanvas();
  }, []);

  // Get coordinates from mouse or touch event
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling on touch
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const { x, y } = getCoordinates(e);
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling on touch
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const { x, y } = getCoordinates(e);
      if (ctx) {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setHasSignature(true);
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasSignature(false);
  };

  const discrepancyStatus = getDiscrepancyStatus();
  const averageTicket = calculateAverageTicket();

  const handleExportPDF = () => {
    const branchName = filteredBranches?.find((b: Branch) => b.id === formData.branchId)?.name || formData.branchId;
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const categoryTotals = getCategoryTotals();
    const adjustedCategoryTotals = getAdjustedCategoryTotals();
    const expectedCash = formData.openingBalance + adjustedCategoryTotals.cash;
    const discrepancy = formData.actualCashDrawer - adjustedCategoryTotals.cash;
    const discrepancyStatusText = discrepancy === 0 ? 'متوازن' : discrepancy < 0 ? 'عجز' : 'فائض';
    const netSales = getNetSales();

    const STATUS_LABELS: Record<string, string> = {
      draft: "مسودة",
      submitted: "مُقدم للمراجعة", 
      approved: "معتمد",
      rejected: "مرفوض",
    };

    const SHIFT_LABELS: Record<string, string> = {
      morning: "صباحي",
      evening: "مسائي",
      night: "ليلي",
    };

    const PAYMENT_METHOD_LABELS: Record<string, string> = {
      cash: "نقداً",
      mada: "مدى",
      visa: "فيزا",
      mastercard: "ماستركارد",
      amex: "أمريكان إكسبريس",
      card_other: "بطاقة أخرى",
      card: "بطاقة ائتمان",
      apple_pay: "Apple Pay",
      stc_pay: "STC Pay",
      hunger_station: "هنقرستيشن",
      toyou: "ToYou",
      jahez: "جاهز",
      marsool: "مرسول",
      keeta: "كيتا",
      the_chefs: "ذا شيفز",
      talabat: "طلبات",
      other: "أخرى",
    };

    // Bank reconciliation summary for PDF
    const bankSummary = getBankReconciliationSummary();

    const formatDateTime = (dateVal: string | Date | null | undefined) => {
      if (!dateVal) return '-';
      const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // Get signature from existing journal or from current canvas
    const savedCashierSig = existingJournal?.signatures?.find(s => s.signatureType === 'cashier');
    const canvas = signatureCanvasRef.current;
    const currentCanvasSignature = hasSignature && canvas ? canvas.toDataURL("image/png") : null;
    const cashierSigData = savedCashierSig?.signatureData || currentCanvasSignature;
    const supervisorSig = existingJournal?.signatures?.find(s => s.signatureType === 'supervisor');

    // Compact PDF - all data on single A4 page
    const totalTerminal = bankSummary.totalTerminalAmount || 0;
    const actualCash = formData.actualCashDrawer || 0;
    const totalActualCollected = actualCash + totalTerminal;
    const netVariance = totalActualCollected - netSales;

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ملخص اليومية - ${formData.journalDate}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 6mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; background: white; color: #333; font-size: 9px; line-height: 1.2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4a853; padding-bottom: 4px; margin-bottom: 6px; }
    .header .title { font-size: 13px; font-weight: bold; }
    .header .info { font-size: 8px; color: #666; }
    .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .section { margin-bottom: 6px; page-break-inside: avoid; }
    .section-title { font-size: 9px; font-weight: bold; color: #333; margin-bottom: 3px; padding: 2px 4px; background: #f5f5f5; border-right: 3px solid #d4a853; }
    .row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #f0f0f0; font-size: 8px; }
    .row .label { color: #666; }
    .row .value { font-weight: bold; }
    .row .value.big { font-size: 11px; color: #333; }
    .cat-row { display: flex; justify-content: space-between; padding: 2px 4px; font-size: 8px; font-weight: bold; border-radius: 2px; margin: 2px 0; }
    .cat-row.cash { background: #e8f5e9; }
    .cat-row.cards { background: #fff3e0; }
    .cat-row.apps { background: #fce4ec; }
    .sub-row { display: flex; justify-content: space-between; padding: 1px 8px; font-size: 7px; color: #666; }
    .box { background: #fafafa; padding: 4px; border-radius: 3px; margin-top: 3px; }
    .box-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 8px; }
    .variance-box { text-align: center; padding: 4px; border-radius: 4px; margin-top: 4px; }
    .variance-box.shortage { background: #ffebee; }
    .variance-box.surplus { background: #e8f5e9; }
    .variance-box.balanced { background: #e8f5e9; }
    .variance-box .amount { font-size: 12px; font-weight: bold; }
    .variance-box .amount.negative { color: #c62828; }
    .variance-box .amount.positive { color: #2e7d32; }
    .variance-box .status { font-size: 8px; font-weight: bold; }
    .final-summary { background: linear-gradient(135deg, #fef9e7 0%, #fcf3cf 100%); border: 2px solid #d4a853; border-radius: 6px; padding: 8px; margin: 6px 0; }
    .final-summary .title { font-size: 10px; font-weight: bold; text-align: center; margin-bottom: 4px; color: #333; }
    .final-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; }
    .final-item { padding: 4px; background: white; border-radius: 4px; }
    .final-item .label { font-size: 7px; color: #666; }
    .final-item .value { font-size: 11px; font-weight: bold; }
    .sig-section { margin-top: 6px; padding-top: 4px; border-top: 1px solid #d4a853; }
    .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .sig-box { text-align: center; padding: 4px; border: 1px solid #ddd; border-radius: 4px; min-height: 50px; }
    .sig-box .role { font-size: 8px; font-weight: bold; color: #666; }
    .sig-box .sig-img { max-width: 60px; max-height: 25px; margin: 2px auto; display: block; }
    .sig-box .name { font-size: 8px; font-weight: bold; }
    .sig-box .placeholder { height: 25px; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 7px; }
    .footer { margin-top: 4px; padding-top: 3px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 7px; color: #666; }
    .print-btn { position: fixed; top: 10px; left: 10px; background: #d4a853; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 11px; z-index: 100; }
    .bank-detail { display: flex; justify-content: space-between; padding: 1px 4px; font-size: 7px; margin: 1px 0; border-radius: 2px; }
    @media print { .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">طباعة</button>
  
  <div class="header">
    <div>
      <div class="title">ملخص يومية الكاشير #${existingJournal?.id || '-'}</div>
      <div class="info">${branchName} | ${SHIFT_LABELS[formData.shiftType] || formData.shiftType} | ${formatDate(formData.journalDate)}</div>
    </div>
    <div style="text-align:left;font-size:8px;">
      <div>الكاشير: <strong>${formData.cashierName}</strong></div>
    </div>
  </div>
  
  <!-- Final Summary Banner -->
  <div class="final-summary">
    <div class="title">📊 ملخص التسوية النهائي</div>
    <div class="final-grid">
      <div class="final-item">
        <div class="label">صافي المبيعات</div>
        <div class="value">${netSales.toLocaleString('en', {minimumFractionDigits: 2})}</div>
      </div>
      <div class="final-item">
        <div class="label">إجمالي المحصّل (نقد+بنك)</div>
        <div class="value" style="color:#2e7d32;">${totalActualCollected.toLocaleString('en', {minimumFractionDigits: 2})}</div>
      </div>
      <div class="final-item">
        <div class="label">الفارق الإجمالي</div>
        <div class="value" style="color:${netVariance >= 0 ? '#2e7d32' : '#c62828'};">${netVariance >= 0 ? '+' : ''}${netVariance.toLocaleString('en', {minimumFractionDigits: 2})}</div>
      </div>
    </div>
    ${returnData.hasReturn && returnData.returnAmount > 0 ? `<div style="font-size:7px;text-align:center;color:#c62828;margin-top:3px;">شامل مرتجع: -${returnData.returnAmount.toFixed(2)} ر.س (${PAYMENT_METHOD_LABELS[returnData.returnPaymentMethod] || returnData.returnPaymentMethod})</div>` : ''}
  </div>
  
  <div class="main-grid">
    <!-- Left Column -->
    <div>
      <div class="section">
        <div class="section-title">ملخص المبيعات</div>
        <div class="row"><span class="label">إجمالي المبيعات</span><span class="value big">${formData.totalSales.toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
        ${returnData.hasReturn && returnData.returnAmount > 0 ? `
        <div class="row" style="color:#c62828;"><span class="label">المرتجع</span><span class="value">-${returnData.returnAmount.toFixed(2)} ر.س</span></div>
        <div class="row" style="border-top:1px solid #ddd;"><span class="label"><strong>صافي</strong></span><span class="value big" style="color:#2e7d32;">${netSales.toFixed(2)} ر.س</span></div>
        ` : ''}
        <div class="row"><span class="label">عدد الفواتير</span><span class="value">${formData.transactionCount}</span></div>
        <div class="row"><span class="label">متوسط الفاتورة</span><span class="value">${averageTicket.toFixed(2)} ر.س</span></div>
      </div>
      
      <div class="section">
        <div class="section-title">💵 تسوية الصندوق النقدي</div>
        <div class="box">
          <div class="box-row"><span>النقدية المتوقعة</span><span>${adjustedCategoryTotals.cash.toFixed(2)} ر.س</span></div>
          <div class="box-row"><span>الفعلي في الصندوق</span><span>${formData.actualCashDrawer.toFixed(2)} ر.س</span></div>
        </div>
        <div class="variance-box ${discrepancy === 0 ? 'balanced' : discrepancy < 0 ? 'shortage' : 'surplus'}">
          <div class="amount ${discrepancy < 0 ? 'negative' : discrepancy > 0 ? 'positive' : ''}">${discrepancy >= 0 ? '+' : ''}${discrepancy.toFixed(2)} ر.س</div>
          <div class="status">${discrepancy === 0 ? 'مطابق ✓' : discrepancy < 0 ? 'عجز' : 'فائض'}</div>
        </div>
      </div>
      
      ${bankSummary.bankPayments.length > 0 ? `
      <div class="section">
        <div class="section-title">🏦 مطابقة البنك</div>
        <div class="box">
          <div class="box-row"><span>POS</span><span>${bankSummary.totalPosAmount.toFixed(2)} ر.س</span></div>
          <div class="box-row"><span>التيرمنال</span><span>${bankSummary.totalTerminalAmount.toFixed(2)} ر.س</span></div>
          <div class="box-row" style="border-top:1px solid #ddd;font-weight:bold;">
            <span>الفرق</span>
            <span style="color:${bankSummary.type === 'shortage' ? '#c62828' : bankSummary.type === 'surplus' ? '#2e7d32' : '#333'};">
              ${bankSummary.discrepancy >= 0 ? '+' : ''}${bankSummary.discrepancy.toFixed(2)} ر.س
            </span>
          </div>
        </div>
        <div style="margin-top:2px;">
          ${bankSummary.bankPayments.map(p => {
            const posAmt = p.posAmount || p.amount || 0;
            const termAmt = p.terminalAmount || 0;
            const diff = termAmt - posAmt;
            const bg = diff > 0.5 ? '#e8f5e9' : diff < -0.5 ? '#ffebee' : '#f5f5f5';
            return `<div class="bank-detail" style="background:${bg};"><span>${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</span><span>POS:${posAmt.toFixed(0)} | T:${termAmt.toFixed(0)} | <strong style="color:${diff < 0 ? '#c62828' : '#2e7d32'};">${diff >= 0 ? '+' : ''}${diff.toFixed(0)}</strong></span></div>`;
          }).join('')}
        </div>
      </div>
      ` : ''}
    </div>
    
    <!-- Right Column -->
    <div>
      <div class="section">
        <div class="section-title">تصنيف المبيعات</div>
        <div class="cat-row cash"><span>💵 نقدي</span><span>${categoryTotals.cash.toFixed(2)} ر.س</span></div>
        
        <div class="cat-row cards"><span>💳 بطاقات</span><span>${categoryTotals.cards.toFixed(2)} ر.س</span></div>
        ${paymentBreakdowns.filter(p => p.amount > 0 && ['mada', 'visa', 'mastercard', 'amex', 'card_other', 'card', 'apple_pay', 'stc_pay'].includes(p.paymentMethod)).map(p => `
        <div class="sub-row"><span>• ${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</span><span>${p.amount.toFixed(2)}</span></div>
        `).join('')}
        
        ${categoryTotals.apps > 0 ? `
        <div class="cat-row apps"><span>🚗 توصيل</span><span>${categoryTotals.apps.toFixed(2)} ر.س</span></div>
        ${paymentBreakdowns.filter(p => p.amount > 0 && ['hunger_station', 'toyou', 'jahez', 'marsool', 'keeta', 'the_chefs', 'talabat'].includes(p.paymentMethod)).map(p => `
        <div class="sub-row"><span>• ${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</span><span>${p.amount.toFixed(2)}</span></div>
        `).join('')}
        ` : ''}
      </div>
      
      ${returnData.hasReturn && returnData.returnAmount > 0 ? `
      <div class="section">
        <div class="section-title" style="color:#c62828;">🔄 المرتجع</div>
        <div class="box" style="background:#ffebee;">
          <div class="box-row"><span>المبلغ</span><span style="color:#c62828;font-weight:bold;">-${returnData.returnAmount.toFixed(2)} ر.س</span></div>
          <div class="box-row"><span>الطريقة</span><span>${PAYMENT_METHOD_LABELS[returnData.returnPaymentMethod] || returnData.returnPaymentMethod}</span></div>
          ${returnData.returnReference ? `<div class="box-row"><span>المرجع</span><span>${returnData.returnReference}</span></div>` : ''}
        </div>
      </div>
      ` : ''}
      
      ${formData.notes ? `
      <div class="section">
        <div class="section-title">ملاحظات</div>
        <div style="font-size:7px;color:#666;padding:3px;background:#fffbeb;border-radius:2px;">${formData.notes}</div>
      </div>
      ` : ''}
    </div>
  </div>
  
  <div class="sig-section">
    <div class="sig-grid">
      <div class="sig-box">
        <div class="role">توقيع الكاشير</div>
        ${cashierSigData ? `<img class="sig-img" src="${cashierSigData}" />` : '<div class="placeholder">-</div>'}
        <div class="name">${formData.cashierName}</div>
      </div>
      <div class="sig-box">
        <div class="role">المشرف</div>
        ${supervisorSig?.signatureData ? `<img class="sig-img" src="${supervisorSig.signatureData}" /><div class="name">${supervisorSig.signerName}</div>` : '<div class="placeholder">-</div><div class="name">________</div>'}
      </div>
      <div class="sig-box">
        <div class="role">المدير</div>
        ${existingJournal?.approvedBy ? `<div class="name" style="margin-top:8px;">${existingJournal.approvedBy}</div>` : '<div class="placeholder">-</div><div class="name">________</div>'}
      </div>
    </div>
  </div>
  
  <div class="footer">
    <span>BUTTER BAKERY SYSTEM - CEO COMMAND</span>
    <span>${new Date().toLocaleDateString('en-GB')}</span>
  </div>
</body>
</html>`;

    printHtmlContent(htmlContent);
  };

  if (isEdit && loadingJournal) {
    return (
      <Layout>
        <div className="p-3 sm:p-4 md:p-6">
          <Skeleton className="h-10 sm:h-12 w-40 sm:w-48 mb-4 sm:mb-6" />
          <Skeleton className="h-72 sm:h-96 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* iPad-optimized: compact padding & spacing for 10.9" screens */}
      <div className="page-container space-y-2" dir="rtl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/cashier-journals">
              <Button variant="ghost" size="sm" className="h-8 w-8" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-base sm:text-lg font-bold text-primary" data-testid="page-title">
              {isEdit ? "تعديل يومية المبيعات" : "يومية مبيعات جديدة"}
            </h1>
          </div>
          {isEdit && (
            <Button onClick={handleExportPDF} variant="outline" className="gap-1.5 h-8 text-xs px-2" data-testid="button-export-pdf">
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </Button>
          )}
        </div>

        {/* iPad-optimized grid: 2 columns on tablet */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="lg:col-span-2 space-y-2">
            <Card className="shadow-sm">
              <CardHeader className="py-1.5 px-2.5 bg-primary/5">
                <CardTitle className="text-sm font-semibold">معلومات اليومية</CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-1.5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">الفرع *</Label>
                    <Select value={formData.branchId} onValueChange={(v) => setFormData({ ...formData, branchId: v })} disabled={isReadOnly || !canSelectBranch}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {filteredBranches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id} className="text-xs">
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">التاريخ *</Label>
                    <Input
                      type="date"
                      value={formData.journalDate}
                      onChange={(e) => setFormData({ ...formData, journalDate: e.target.value })}
                      disabled={isReadOnly}
                      className="h-8 text-xs"
                      data-testid="input-date"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">الوردية *</Label>
                    <Select value={formData.shiftType} onValueChange={(v) => setFormData({ ...formData, shiftType: v })} disabled={isReadOnly}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-shift">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {SHIFT_TYPES.map((shift) => (
                          <SelectItem key={shift.value} value={shift.value} className="text-xs">
                            {shift.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">الكاشير *</Label>
                    <Input
                      value={formData.cashierName}
                      readOnly
                      className="bg-muted cursor-not-allowed h-8 text-xs"
                      placeholder="اسم الكاشير"
                      data-testid="input-cashier-name"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-primary/20 shadow-sm">
              <CardHeader className="bg-primary/5 py-1.5 px-2.5">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Receipt className="w-3.5 h-3.5" />
                  إجمالي المبيعات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-1.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <div className="space-y-0.5">
                    <Label className="text-[11px] font-semibold text-primary">المبيعات (ر.س) *</Label>
                    <StableNumericInput
                      value={formData.totalSales}
                      onChange={(val) => setFormData({ ...formData, totalSales: val })}
                      isDecimal={true}
                      className="text-sm font-bold h-9"
                      placeholder="0.00"
                      disabled={isReadOnly}
                      data-testid="input-total-sales"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <Users className="w-2.5 h-2.5" />
                      الفواتير *
                    </Label>
                    <StableNumericInput
                      value={formData.transactionCount}
                      onChange={(val) => setFormData({ ...formData, transactionCount: val })}
                      isDecimal={false}
                      className="h-9 text-xs"
                      placeholder="0"
                      disabled={isReadOnly}
                      data-testid="input-transaction-count"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <Calculator className="w-2.5 h-2.5" />
                      المتوسط
                    </Label>
                    <div className="h-9 flex items-center justify-center bg-muted rounded-md px-1.5">
                      <span className="text-xs font-bold text-primary" data-testid="text-average-ticket">
                        {averageTicket.toFixed(2)} ر.س
                      </span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">العهدة</Label>
                    <StableNumericInput
                      value={formData.openingBalance}
                      onChange={(val) => setFormData({ ...formData, openingBalance: val })}
                      isDecimal={true}
                      placeholder="0.00"
                      disabled={isReadOnly}
                      className="h-9 text-xs"
                      data-testid="input-opening-balance"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="py-1.5 px-2.5">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">طرق الدفع</CardTitle>
                  {!isReadOnly && (
                    <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={addPaymentBreakdown} data-testid="button-add-payment">
                      <Plus className="w-3 h-3" />
                      إضافة
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2 pt-1.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {paymentBreakdowns.map((breakdown, index) => {
                  const method = PAYMENT_METHODS.find((m) => m.value === breakdown.paymentMethod);
                  const Icon = method?.icon || Wallet;
                  const isBank = isBankPaymentMethod(breakdown.paymentMethod);
                  const isCash = breakdown.paymentMethod === 'cash';
                  const bankDisc = (breakdown.terminalAmount || 0) - (breakdown.posAmount || breakdown.amount || 0);
                  const bankDiscType = bankDisc > 0.5 ? 'surplus' : bankDisc < -0.5 ? 'shortage' : 'balanced';
                  
                  // Use individual method colors for distinct visual identification
                  const methodColor = method?.color || { bg: "bg-muted", border: "border-border", icon: "bg-muted", iconText: "text-muted-foreground", badge: "bg-muted-foreground" };
                  const rowStyle = `${methodColor.border} ${methodColor.bg}`;
                  const iconBg = methodColor.icon;
                  const iconColor = methodColor.iconText;

                  return (
                    <div key={index} className={`p-1.5 border rounded ${rowStyle}`} data-testid={`payment-row-${index}`}>
                      {/* Ultra Compact Header Row with subtle color badge */}
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <div className={`w-0.5 h-4 rounded-full ${methodColor.badge}`} />
                        <div className={`p-0.5 rounded ${iconBg}`}>
                          <Icon className={`w-2.5 h-2.5 ${iconColor}`} />
                        </div>
                        <Select
                          value={breakdown.paymentMethod}
                          onValueChange={(v) => {
                            if (!isBankPaymentMethod(v)) {
                              updatePaymentBreakdownMultiple(index, {
                                paymentMethod: v,
                                terminalAmount: 0,
                                posAmount: 0,
                                terminalTransactionCount: 0,
                              });
                            } else {
                              updatePaymentBreakdown(index, "paymentMethod", v);
                            }
                          }}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className={`w-24 h-5 text-[10px] font-bold ${methodColor.iconText}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m.value} value={m.value} className={`py-1 text-xs font-semibold ${m.color.iconText}`}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex-1" />
                        {paymentBreakdowns.length > 1 && !isReadOnly && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 p-0" onClick={() => removePaymentBreakdown(index)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Ultra Compact Input Grid - Bank Methods */}
                      {isBank ? (
                        <div className="space-y-1">
                          {/* POS & Terminal Amounts - Side by Side */}
                          <div className="grid grid-cols-2 gap-1">
                            <div className="space-y-0">
                              <Label className="text-[9px] text-muted-foreground">POS (الكاشير)</Label>
                              <StableNumericInput
                                placeholder="0.00"
                                value={breakdown.amount}
                                onChange={(val) => updatePaymentBreakdownMultiple(index, { amount: val, posAmount: val })}
                                isDecimal={true}
                                disabled={isReadOnly}
                                className="h-7 text-xs font-bold text-center"
                                data-testid={`input-payment-amount-${index}`}
                              />
                            </div>
                            <div className="space-y-0">
                              <div className="flex items-center justify-between">
                                <Label className="text-[9px] text-muted-foreground">Terminal</Label>
                                {!isReadOnly && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-3 px-0.5 text-[9px] text-muted-foreground hover:text-foreground p-0"
                                    onClick={() => updatePaymentBreakdown(index, "terminalAmount", breakdown.amount || 0)}
                                  >
                                    <Copy className="w-2 h-2 ml-0.5" />
                                    نسخ
                                  </Button>
                                )}
                              </div>
                              <StableNumericInput
                                placeholder="0.00"
                                value={breakdown.terminalAmount}
                                onChange={(val) => updatePaymentBreakdown(index, "terminalAmount", val)}
                                isDecimal={true}
                                disabled={isReadOnly}
                                className="h-7 text-xs font-bold text-center bg-card"
                                data-testid={`input-terminal-amount-${index}`}
                              />
                            </div>
                          </div>
                          {/* Discrepancy & Transaction Counts - Ultra Compact Row */}
                          <div className="flex items-center gap-1 text-[9px]">
                            <div className={`flex-1 px-1 py-0.5 rounded flex items-center justify-between ${bankDiscType === 'surplus' ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300' : bankDiscType === 'shortage' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                              <span>الفرق:</span>
                              <span className="font-bold">
                                {bankDisc >= 0 ? '+' : ''}{bankDisc.toFixed(2)} {bankDiscType === 'surplus' ? '⬆️' : bankDiscType === 'shortage' ? '⬇️' : '✓'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 bg-muted px-1 py-0.5 rounded">
                              <div className="flex items-center gap-0.5">
                                <span className="text-muted-foreground">POS:</span>
                                <StableNumericInput
                                  placeholder="0"
                                  value={breakdown.transactionCount}
                                  onChange={(val) => updatePaymentBreakdown(index, "transactionCount", val)}
                                  isDecimal={false}
                                  disabled={isReadOnly}
                                  className="h-4 w-7 text-[9px] font-bold text-center p-0"
                                  data-testid={`input-payment-count-${index}`}
                                />
                              </div>
                              <div className="flex items-center gap-0.5">
                                <span className="text-muted-foreground">جهاز:</span>
                                <StableNumericInput
                                  placeholder="0"
                                  value={breakdown.terminalTransactionCount}
                                  onChange={(val) => updatePaymentBreakdown(index, "terminalTransactionCount", val)}
                                  isDecimal={false}
                                  disabled={isReadOnly}
                                  className="h-4 w-7 text-[9px] font-bold text-center p-0"
                                  data-testid={`input-terminal-count-${index}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : breakdown.paymentMethod === 'cash' ? (
                        /* Cash: POS Amount vs Actual Drawer - Ultra Compact */
                        (() => {
                          const expectedCash = getExpectedCashInDrawer();
                          const actualCash = formData.actualCashDrawer ?? 0;
                          const cashDisc = actualCash - expectedCash;
                          const cashDiscType = cashDisc > 0.5 ? 'surplus' : cashDisc < -0.5 ? 'shortage' : 'balanced';
                          return (
                            <div className="space-y-1">
                              {/* Cash POS & Actual Drawer - Side by Side */}
                              <div className="grid grid-cols-2 gap-1">
                                <div className="space-y-0">
                                  <Label className="text-[9px] text-muted-foreground">النقد المسجل (POS)</Label>
                                  <StableNumericInput
                                    placeholder="0.00"
                                    value={breakdown.amount}
                                    onChange={(val) => updatePaymentBreakdown(index, "amount", val)}
                                    isDecimal={true}
                                    disabled={isReadOnly}
                                    className="h-7 text-xs font-bold text-center"
                                    data-testid={`input-payment-amount-${index}`}
                                  />
                                </div>
                                <div className="space-y-0">
                                  <Label className="text-[9px] text-muted-foreground">الفعلي في الصندوق</Label>
                                  <StableNumericInput
                                    placeholder="0.00"
                                    value={formData.actualCashDrawer}
                                    onChange={(val) => setFormData({ ...formData, actualCashDrawer: val })}
                                    isDecimal={true}
                                    disabled={isReadOnly}
                                    className="h-7 text-xs font-bold text-center bg-card"
                                    data-testid="input-actual-cash-inline"
                                  />
                                </div>
                              </div>
                              {/* Cash Discrepancy & Transaction Count - Ultra Compact Row */}
                              <div className="flex items-center gap-1 text-[9px]">
                                <div className={`flex-1 px-1 py-0.5 rounded flex items-center justify-between ${cashDiscType === 'surplus' ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300' : cashDiscType === 'shortage' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                                  <span>الفرق:</span>
                                  <span className="font-bold">
                                    {cashDisc >= 0 ? '+' : ''}{cashDisc.toFixed(2)} {cashDiscType === 'surplus' ? '⬆️' : cashDiscType === 'shortage' ? '⬇️' : '✓'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-0.5 bg-muted px-1 py-0.5 rounded">
                                  <span className="text-muted-foreground">عمليات:</span>
                                  <StableNumericInput
                                    placeholder="0"
                                    value={breakdown.transactionCount}
                                    onChange={(val) => updatePaymentBreakdown(index, "transactionCount", val)}
                                    isDecimal={false}
                                    disabled={isReadOnly}
                                    className="h-4 w-7 text-[9px] font-bold text-center p-0"
                                    data-testid={`input-payment-count-${index}`}
                                  />
                                </div>
                              </div>
                              {/* Expected Cash Formula Context */}
                              <div className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex flex-wrap items-center gap-0.5">
                                <span>المتوقع:</span>
                                {formData.openingBalance > 0 && (
                                  <>
                                    <span className="font-medium">{formData.openingBalance.toFixed(0)}</span>
                                    <span>+</span>
                                  </>
                                )}
                                <span className="font-medium">{(breakdown.amount ?? 0).toFixed(0)}</span>
                                {returnData.hasReturn && returnData.returnPaymentMethod === 'cash' && returnData.returnAmount > 0 && (
                                  <>
                                    <span>-</span>
                                    <span className="font-medium text-destructive">{returnData.returnAmount.toFixed(0)}</span>
                                  </>
                                )}
                                <span>=</span>
                                <span className="font-bold">{expectedCash.toFixed(2)} ر.س</span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        /* Other Non-Bank: Simple Amount + Transaction Count */
                        <div className="flex items-end gap-1">
                          <div className="flex-1 space-y-0">
                            <Label className="text-[9px] text-muted-foreground">المبلغ</Label>
                            <StableNumericInput
                              placeholder="0.00"
                              value={breakdown.amount}
                              onChange={(val) => updatePaymentBreakdown(index, "amount", val)}
                              isDecimal={true}
                              disabled={isReadOnly}
                              className="h-7 text-xs font-bold text-center"
                              data-testid={`input-payment-amount-${index}`}
                            />
                          </div>
                          <div className="w-14 space-y-0">
                            <Label className="text-[9px] text-muted-foreground">عمليات</Label>
                            <StableNumericInput
                              placeholder="0"
                              value={breakdown.transactionCount}
                              onChange={(val) => updatePaymentBreakdown(index, "transactionCount", val)}
                              isDecimal={false}
                              disabled={isReadOnly}
                              className="h-7 text-[10px] font-medium text-center"
                              data-testid={`input-payment-count-${index}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center text-sm font-medium">
                  <span>مجموع التفصيل</span>
                  <span data-testid="text-breakdown-total">{getBreakdownTotal().toFixed(2)} ر.س</span>
                </div>
                {getTotalsMismatch() && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>تحذير: فرق في الأرقام</AlertTitle>
                    <AlertDescription>
                      مجموع التفصيل ({getBreakdownTotal().toFixed(2)} ر.س) لا يطابق إجمالي المبيعات ({formData.totalSales.toFixed(2)} ر.س)
                      <br />
                      الفرق: {Math.abs(formData.totalSales - getBreakdownTotal()).toFixed(2)} ر.س
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Bank Reconciliation Summary */}
                {(() => {
                  const bankSummary = getBankReconciliationSummary();
                  if (bankSummary.bankPayments.length === 0) return null;
                  
                  return (
                    <>
                      <Separator />
                      <div className="p-2 bg-accent/40 rounded border border-border">
                        <div className="flex items-center gap-1.5 mb-2">
                          <CreditCard className="w-4 h-4 text-primary" />
                          <span className="font-bold text-foreground text-sm">ملخص مطابقة البنك</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-[10px]">
                          <div className="p-1.5 bg-background rounded border border-border">
                            <div className="text-muted-foreground">POS</div>
                            <div className="font-bold text-xs">{bankSummary.totalPosAmount.toFixed(2)}</div>
                          </div>
                          <div className="p-1.5 bg-background rounded border border-border">
                            <div className="text-muted-foreground">تيرمنال</div>
                            <div className="font-bold text-xs">{bankSummary.totalTerminalAmount.toFixed(2)}</div>
                          </div>
                          <div className={`p-1.5 rounded ${bankSummary.type === 'surplus' ? 'bg-green-200 dark:bg-green-900/60' : bankSummary.type === 'shortage' ? 'bg-destructive/20' : 'bg-muted'}`}>
                            <div className="text-muted-foreground">الفرق</div>
                            <div className={`font-bold text-xs ${bankSummary.type === 'surplus' ? 'text-green-800 dark:text-green-200' : bankSummary.type === 'shortage' ? 'text-destructive' : ''}`}>
                              {bankSummary.discrepancy.toFixed(2)}
                            </div>
                          </div>
                          <div className={`p-1.5 rounded flex items-center justify-center ${bankSummary.type === 'surplus' ? 'bg-green-200 dark:bg-green-900/60 text-green-800 dark:text-green-200' : bankSummary.type === 'shortage' ? 'bg-destructive/20 text-destructive' : 'bg-muted'}`}>
                            <span className="font-bold text-[10px]">
                              {bankSummary.type === 'surplus' ? '⬆️ زيادة' : bankSummary.type === 'shortage' ? '⬇️ عجز' : '✓'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Bank Payment Details Breakdown */}
                        {bankSummary.bankPayments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="text-xs text-muted-foreground mb-2 font-medium">تفاصيل البطاقات البنكية:</div>
                            <div className="space-y-1">
                              {bankSummary.bankPayments.map((payment, idx) => {
                                const methodLabel = PAYMENT_METHODS.find(m => m.value === payment.paymentMethod)?.label || payment.paymentMethod;
                                const posAmt = payment.posAmount || payment.amount || 0;
                                const termAmt = payment.terminalAmount || 0;
                                const diff = termAmt - posAmt;
                                const diffStatus = diff > 0.5 ? 'surplus' : diff < -0.5 ? 'shortage' : 'balanced';
                                return (
                                  <div key={idx} className={`flex items-center justify-between text-xs p-2 rounded border ${diffStatus === 'surplus' ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900' : diffStatus === 'shortage' ? 'bg-destructive/10 border-destructive/30' : 'bg-background border-border'}`}>
                                    <span className="text-foreground font-medium">{methodLabel}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-muted-foreground">POS: {posAmt.toFixed(2)}</span>
                                      <span className="text-muted-foreground">تيرمنال: {termAmt.toFixed(2)}</span>
                                      <span className={`font-bold px-2 py-0.5 rounded ${diffStatus === 'surplus' ? 'bg-green-200 dark:bg-green-900/60 text-green-800 dark:text-green-200' : diffStatus === 'shortage' ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground'}`}>
                                        ({diff >= 0 ? '+' : ''}{diff.toFixed(2)})
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Tolerance Note - for small differences within 0.5 SAR */}
                        {bankSummary.type === 'balanced' && Math.abs(bankSummary.discrepancy) > 0.01 && Math.abs(bankSummary.discrepancy) <= 0.5 && (
                          <p className="mt-2 text-xs text-foreground bg-muted p-2 rounded">
                            ℹ️ الفرق ({Math.abs(bankSummary.discrepancy).toFixed(2)} ر.س) ضمن حد التسامح المسموح (0.50 ر.س) ويتم تداركه في إجمالي اليومية
                          </p>
                        )}
                        
                        {/* Input Error Detection Alert */}
                        {bankSummary.inputErrorDetected && (
                          <Alert className="mt-3 border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40">
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <AlertTitle className="text-amber-700 dark:text-amber-300">تنبيه: احتمال خطأ في الإدخال</AlertTitle>
                            <AlertDescription className="text-amber-700 dark:text-amber-300">
                              يُحتمل أن الكاشير ضغط زر الدفع الخاطئ! 
                              <br />
                              العجز النقدي ({Math.abs(calculateDiscrepancy()).toFixed(2)} ر.س) يساوي تقريباً الزيادة في البنك ({Math.abs(bankSummary.discrepancy).toFixed(2)} ر.س)
                              <br />
                              <strong>يرجى مراجعة عمليات الدفع والتأكد من صحتها.</strong>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Returns Section - المرتجع - Compact Design */}
            <Card className={`border ${showReturns && returnData.hasReturn ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
              <CardHeader className={`py-2 px-3 ${showReturns && returnData.hasReturn ? 'bg-destructive/10' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${showReturns ? 'bg-destructive/20' : 'bg-muted'}`}>
                      <RotateCcw className={`w-4 h-4 ${showReturns ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </div>
                    <span className={`text-sm font-medium ${showReturns && returnData.hasReturn ? 'text-destructive' : 'text-muted-foreground'}`}>
                      المرتجعات
                    </span>
                    {returnData.hasReturn && returnData.returnAmount > 0 && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                        -{returnData.returnAmount.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant={showReturns ? "destructive" : "outline"}
                      size="sm"
                      className="h-8 text-xs px-2"
                      onClick={() => {
                        if (showReturns) {
                          setShowReturns(false);
                          setReturnData({ returnAmount: 0, returnPaymentMethod: "cash", returnReason: "", returnReference: "", hasReturn: false });
                        } else {
                          setShowReturns(true);
                          setReturnData(prev => ({ ...prev, hasReturn: true }));
                        }
                      }}
                      data-testid="button-toggle-returns"
                    >
                      {showReturns ? (
                        <>
                          <X className="w-3 h-3 ml-1" />
                          إلغاء
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3 ml-1" />
                          إضافة مرتجع
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              {showReturns && (
                <CardContent className="space-y-1.5 pt-1.5 px-2 pb-2">
                  {/* Ultra Compact: All 4 fields in one row on larger screens */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-destructive font-medium">المبلغ</Label>
                      <StableNumericInput
                        value={returnData.returnAmount}
                        onChange={(val) => setReturnData(prev => ({ ...prev, returnAmount: val }))}
                        isDecimal={true}
                        className="h-7 border-destructive/30 text-xs font-bold text-center"
                        placeholder="0.00"
                        disabled={isReadOnly}
                        data-testid="input-return-amount"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-destructive font-medium">الاسترداد</Label>
                      <Select
                        value={returnData.returnPaymentMethod}
                        onValueChange={(v) => setReturnData(prev => ({ ...prev, returnPaymentMethod: v }))}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="h-7 border-destructive/30 text-[10px]" data-testid="select-return-method">
                          <SelectValue placeholder="اختر" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash" className="text-xs">نقداً</SelectItem>
                          <SelectItem value="mada" className="text-xs">مدى</SelectItem>
                          <SelectItem value="visa" className="text-xs">فيزا</SelectItem>
                          <SelectItem value="mastercard" className="text-xs">ماستركارد</SelectItem>
                          <SelectItem value="amex" className="text-xs">أمريكان إكسبريس</SelectItem>
                          <SelectItem value="card_other" className="text-xs">بطاقة أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">الفاتورة</Label>
                      <Input
                        type="text"
                        value={returnData.returnReference || ""}
                        onChange={(e) => setReturnData(prev => ({ ...prev, returnReference: e.target.value }))}
                        className="h-7 text-[10px]"
                        placeholder="INV-001234"
                        disabled={isReadOnly}
                        data-testid="input-return-reference"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">السبب</Label>
                      <Input
                        type="text"
                        value={returnData.returnReason || ""}
                        onChange={(e) => setReturnData(prev => ({ ...prev, returnReason: e.target.value }))}
                        className="h-7 text-[10px]"
                        placeholder="غير مطابق"
                        disabled={isReadOnly}
                        data-testid="input-return-reason"
                      />
                    </div>
                  </div>
                  
                  {/* Compact Impact Summary */}
                  {returnData.returnAmount > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] bg-destructive/10 border border-destructive/30 rounded px-1.5 py-1">
                      <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
                      <div className="flex flex-wrap items-center gap-0.5">
                        <span className="text-muted-foreground">{formData.totalSales.toFixed(2)}</span>
                        <span>-</span>
                        <span className="text-destructive font-medium">{returnData.returnAmount.toFixed(2)}</span>
                        <span>=</span>
                        <span className="font-bold text-destructive">{getNetSales().toFixed(2)} ر.س</span>
                        {returnData.returnPaymentMethod === "cash" && (
                          <span className="text-destructive bg-destructive/20 px-0.5 rounded text-[9px]">⚠️ نقد</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Cash Shortage Warning - Only shows when there's a shortage */}
            {discrepancyStatus.isShortage && (
              <Alert variant="destructive" className="border-2">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="text-lg font-bold">تنبيه هام: عجز في الصندوق النقدي</AlertTitle>
                <AlertDescription className="text-base mt-2">
                  <p className="font-semibold">
                    هذا العجز بقيمة {Math.abs(calculateDiscrepancy()).toFixed(2)} ر.س سيُسجَّل على أمين الصندوق / الكاشير: <strong>{formData.cashierName || "غير محدد"}</strong>
                  </p>
                  <p className="mt-2 text-sm">
                    يرجى التأكد من صحة المبلغ المُدخل قبل الحفظ. في حالة وجود عجز، سيتم توثيقه وقد يتم خصمه من راتب الموظف وفقاً لسياسة الشركة.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Comprehensive Reconciliation Summary - ملخص التسوية الشاملة */}
            {(() => {
              // Use unified variance summary function
              const varianceSummary = getVarianceSummary();
              const bankSummary = getBankReconciliationSummary();
              const totalTerminal = bankSummary.totalTerminalAmount || 0;
              const actualCash = formData.actualCashDrawer || 0;
              const totalActualCollected = varianceSummary.totalActualCollected;
              const netSalesForRecon = varianceSummary.netSales;
              const appsTotal = varianceSummary.appsTotal;
              const expectedCollected = varianceSummary.expectedCollected;
              const netVariance = varianceSummary.netVariance;
              
              const cashDiscrepancy = varianceSummary.cashDiscrepancy;
              const bankDiscrepancy = varianceSummary.bankDiscrepancy;
              
              // Detect misclassification: cash surplus offsets bank shortage (or vice versa)
              const hasMisclassification = Math.abs(cashDiscrepancy) > 5 && 
                Math.abs(bankDiscrepancy) > 5 && 
                (cashDiscrepancy * bankDiscrepancy) < 0 && // opposite signs
                Math.abs(Math.abs(cashDiscrepancy) - Math.abs(bankDiscrepancy)) < 25;
              
              // Variance classification
              const varianceType = varianceSummary.varianceType;
              const varianceColor = varianceType === 'balanced' ? 'bg-green-50 border-green-200 text-green-700' :
                varianceType === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                'bg-destructive/10 border-destructive/30 text-destructive';
              
              if (bankSummary.bankPayments.length === 0 && actualCash === 0) return null;
              
              return (
                <Card className="border border-primary/20">
                  <CardHeader className="bg-primary/5 py-2 px-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calculator className="w-4 h-4" />
                      ملخص التسوية الشاملة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-3 pt-2">
                    {/* Main Calculation */}
                    <div className="space-y-3">
                      {/* Show sales breakdown with apps deduction */}
                      <div className="p-3 bg-muted rounded-lg border space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">إجمالي المبيعات (من التفصيل)</span>
                          <span className="font-medium">{getBreakdownTotal().toFixed(2)} ر.س</span>
                        </div>
                        {returnData.hasReturn && returnData.returnAmount > 0 && (
                          <div className="flex justify-between items-center text-destructive">
                            <span>المرتجع</span>
                            <span className="font-medium">-{returnData.returnAmount.toFixed(2)} ر.س</span>
                          </div>
                        )}
                        {appsTotal > 0 && (
                          <div className="flex justify-between items-center text-amber-600">
                            <span className="flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              تطبيقات التوصيل (آجل)
                            </span>
                            <span className="font-medium">-{appsTotal.toFixed(2)} ر.س</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="font-medium">المتوقع تحصيله (نقد + بنك)</span>
                          <span className="font-bold text-lg">{expectedCollected.toFixed(2)} ر.س</span>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="text-sm text-primary mb-2 font-medium">المحصل الفعلي:</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">النقد الفعلي:</span>
                            <span className="font-medium">{actualCash.toFixed(2)} ر.س</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">إيداعات التيرمنال:</span>
                            <span className="font-medium">{totalTerminal.toFixed(2)} ر.س</span>
                          </div>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center">
                          <span className="font-medium">إجمالي المحصل:</span>
                          <span className="font-bold text-lg text-primary">{totalActualCollected.toFixed(2)} ر.س</span>
                        </div>
                      </div>
                      
                      {/* Net Variance */}
                      <div className={`p-4 rounded-lg border-2 ${varianceColor}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">صافي الفرق النهائي:</span>
                          <span className="font-bold text-xl">
                            {netVariance >= 0 ? '+' : ''}{netVariance.toFixed(2)} ر.س
                            {varianceType === 'balanced' && ' ✓'}
                          </span>
                        </div>
                        <p className="text-sm mt-1">
                          {netVariance > 5 ? 'زيادة في المحصل عن المتوقع' : 
                           netVariance < -5 ? 'عجز في المحصل عن المتوقع' : 
                           'الفرق ضمن الحد المقبول (±5 ر.س)'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          (المحصل: {totalActualCollected.toFixed(2)} - المتوقع: {expectedCollected.toFixed(2)})
                        </p>
                      </div>
                      
                      {/* Component Breakdown */}
                      <div className="p-3 bg-muted rounded-lg border">
                        <div className="text-sm text-muted-foreground mb-2">تفصيل الفروقات:</div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className={`p-2 rounded ${cashDiscrepancy > 0.5 ? 'bg-green-100' : cashDiscrepancy < -0.5 ? 'bg-destructive/10' : 'bg-muted'}`}>
                            <div className="text-xs text-muted-foreground">فرق الصندوق النقدي:</div>
                            <div className="font-bold">{cashDiscrepancy >= 0 ? '+' : ''}{cashDiscrepancy.toFixed(2)} ر.س</div>
                          </div>
                          <div className={`p-2 rounded ${bankDiscrepancy > 0.5 ? 'bg-green-100' : bankDiscrepancy < -0.5 ? 'bg-destructive/10' : 'bg-muted'}`}>
                            <div className="text-xs text-muted-foreground">فرق مطابقة البنك:</div>
                            <div className="font-bold">{bankDiscrepancy >= 0 ? '+' : ''}{bankDiscrepancy.toFixed(2)} ر.س</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Misclassification Alert */}
                      {hasMisclassification && (
                        <Alert className="border-amber-200 bg-amber-50">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <AlertTitle className="text-amber-700">احتمال خطأ تصنيف الدفع</AlertTitle>
                          <AlertDescription className="text-amber-600">
                            {cashDiscrepancy > 0 && bankDiscrepancy < 0 ? (
                              <>
                                زيادة النقد (+{cashDiscrepancy.toFixed(2)} ر.س) تقابل عجز البنك ({bankDiscrepancy.toFixed(2)} ر.س)
                                <br />
                                <strong>السبب المحتمل:</strong> عميل دفع نقداً لكن الكاشير ضغط زر بطاقة بالخطأ
                              </>
                            ) : (
                              <>
                                عجز النقد ({cashDiscrepancy.toFixed(2)} ر.س) يقابل زيادة البنك (+{bankDiscrepancy.toFixed(2)} ر.س)
                                <br />
                                <strong>السبب المحتمل:</strong> عميل دفع ببطاقة لكن الكاشير ضغط زر نقد بالخطأ
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-base">ملاحظات</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="أي ملاحظات إضافية..."
                  rows={2}
                  disabled={isReadOnly}
                  className="text-sm"
                  data-testid="input-notes"
                />
              </CardContent>
            </Card>

            <Card className="border border-primary/20">
              <CardHeader className="bg-primary/5 py-2 px-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="w-4 h-4" />
                  المرفقات والصور
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  data-testid="input-file"
                />
                
                {!isReadOnly && (
                  <div className="grid grid-cols-3 gap-1">
                    {ATTACHMENT_TYPES.map((type) => (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-7 flex items-center justify-center gap-1 text-[10px] px-1"
                        onClick={() => handleFileSelect(type)}
                        data-testid={`button-upload-${type}`}
                      >
                        <Camera className="w-3 h-3" />
                        <span className="truncate">{ATTACHMENT_TYPE_LABELS[type]}</span>
                      </Button>
                    ))}
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">المرفقات المحفوظة</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {attachments.map((attachment, idx) => (
                        <div key={attachment.id} className="relative border rounded-lg overflow-hidden group cursor-pointer" onClick={() => openLightbox(idx)} data-testid={`attachment-image-${attachment.id}`}>
                          <img
                            src={(attachment as any).downloadUrl || attachment.fileData || ''}
                            alt={attachment.fileName}
                            className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                            {ATTACHMENT_TYPE_LABELS[attachment.attachmentType as AttachmentType]}
                          </div>
                          {!isReadOnly && (
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 left-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              onClick={(e) => { e.stopPropagation(); deleteAttachmentMutation.mutate(attachment.id); }}
                              data-testid={`button-delete-attachment-${attachment.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendingAttachments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">مرفقات في انتظار الحفظ</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {pendingAttachments.map((attachment, index) => (
                        <div key={index} className="relative border rounded-lg overflow-hidden group border-dashed border-2 border-amber-300 cursor-pointer" onClick={() => openLightbox(attachments.length + index)} data-testid={`pending-attachment-image-${index}`}>
                          <img
                            src={attachment.downloadUrl || attachment.fileData || ''}
                            alt={attachment.fileName}
                            className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-amber-500/80 text-white text-xs p-2">
                            {ATTACHMENT_TYPE_LABELS[attachment.attachmentType]}
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 left-2 h-6 w-6 z-10"
                            onClick={(e) => { e.stopPropagation(); removePendingAttachment(index); }}
                            data-testid={`button-remove-pending-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">سيتم رفع هذه المرفقات بعد حفظ اليومية</p>
                  </div>
                )}

                {attachments.length === 0 && pendingAttachments.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد مرفقات</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <Card className={!hasSignature && !isEdit ? "border-destructive/30 bg-destructive/5" : ""}>
              <CardHeader className="py-2 px-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  التوقيع الإلكتروني
                  {!hasSignature && !isEdit && (
                    <span className="text-[10px] font-normal text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">مطلوب</span>
                  )}
                  {hasSignature && (
                    <span className="text-[10px] font-normal text-green-600 bg-green-100 px-1.5 py-0.5 rounded">تم ✓</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {!hasSignature && !isEdit && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive px-2 py-1.5 rounded text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" />
                    <span>يجب التوقيع قبل حفظ اليومية</span>
                  </div>
                )}
                <div className={`border-2 rounded-lg overflow-hidden ${!hasSignature && !isEdit ? "border-destructive/30" : "border-amber-400"}`}>
                  <canvas
                    ref={signatureCanvasRef}
                    width={280}
                    height={120}
                    className="w-full cursor-crosshair bg-card touch-none"
                    style={{ touchAction: 'none' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    onTouchCancel={stopDrawing}
                    data-testid="canvas-signature"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={clearSignature} className="w-full h-8 text-xs" data-testid="button-clear-signature">
                  مسح التوقيع
                </Button>
              </CardContent>
            </Card>

            {/* iPad-optimized summary card */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
              <CardHeader className="py-1.5 px-2.5">
                <CardTitle className="text-xs font-semibold">ملخص اليومية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 p-2 pt-0">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">إجمالي المبيعات</span>
                  <span className="font-bold text-sm">{getBreakdownTotal().toFixed(2)} ر.س</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">عدد الفواتير</span>
                  <span className="font-medium">{formData.transactionCount}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">متوسط الفاتورة</span>
                  <span className="font-medium">{averageTicket.toFixed(2)} ر.س</span>
                </div>
                <Separator className="my-1" />
                
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground">تصنيف المبيعات</div>
                  <div className={`flex justify-between text-[11px] p-1.5 rounded ${PAYMENT_CATEGORIES.cash.color}`}>
                    <span className="flex items-center gap-0.5">
                      <Wallet className="w-2.5 h-2.5" />
                      نقدي
                    </span>
                    <span className="font-medium">{getCategoryTotals().cash.toFixed(2)} ر.س</span>
                  </div>
                  <div className={`flex justify-between text-[11px] p-1.5 rounded ${PAYMENT_CATEGORIES.cards.color}`}>
                    <span className="flex items-center gap-0.5">
                      <CreditCard className="w-2.5 h-2.5" />
                      بطاقات
                    </span>
                    <span className="font-medium">{getCategoryTotals().cards.toFixed(2)} ر.س</span>
                  </div>
                  {getCardBreakdowns().length > 0 && (
                    <div className="pr-3 space-y-0.5">
                      {getCardBreakdowns().map((b, i) => {
                        const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
                        return (
                          <div key={i} className="flex justify-between text-[10px] text-primary">
                            <span>• {method?.label}</span>
                            <span>{b.amount.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className={`flex justify-between text-[11px] p-1.5 rounded ${PAYMENT_CATEGORIES.apps.color}`}>
                    <span className="flex items-center gap-0.5">
                      <Truck className="w-2.5 h-2.5" />
                      تطبيقات (آجل)
                    </span>
                    <span className="font-medium">{getCategoryTotals().apps.toFixed(2)} ر.س</span>
                  </div>
                  {getAppBreakdowns().length > 0 && (
                    <div className="pr-3 space-y-0.5">
                      {getAppBreakdowns().map((b, i) => {
                        const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
                        return (
                          <div key={i} className="flex justify-between text-[10px] text-amber-600">
                            <span>• {method?.label}</span>
                            <span>{b.amount.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Returns Summary */}
                {returnData.hasReturn && returnData.returnAmount > 0 && (
                  <>
                    <Separator />
                    <div className="text-xs font-semibold text-destructive">المرتجع</div>
                    <div className="p-2 bg-destructive/10 rounded border border-destructive/30">
                      <div className="flex justify-between text-sm text-destructive">
                        <span className="flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          مبلغ المرتجع
                        </span>
                        <span className="font-bold">-{returnData.returnAmount.toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between text-xs text-destructive mt-1">
                        <span>طريقة الاسترداد:</span>
                        <span>{PAYMENT_METHODS.find(m => m.value === returnData.returnPaymentMethod)?.label || returnData.returnPaymentMethod}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-destructive/30">
                        <span>صافي المبيعات:</span>
                        <span>{getNetSales().toFixed(2)} ر.س</span>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Comprehensive Variance Summary - صافي الفرق النهائي */}
                {(() => {
                  const vs = getVarianceSummary();
                  const netVarColor = vs.varianceType === 'balanced' ? 'text-green-600 bg-green-50 border-green-200' : 
                    vs.varianceType === 'warning' ? 'text-amber-600 bg-amber-50 border-amber-200' : 
                    'text-destructive bg-destructive/10 border-destructive/30';
                  
                  return (
                    <>
                      <Separator />
                      <div className="text-xs font-semibold text-primary">صافي الفرق النهائي</div>
                      <div className={`p-3 rounded-lg border-2 ${netVarColor}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">الفارق الإجمالي:</span>
                          <span className="font-bold text-lg">
                            {vs.netVariance >= 0 ? '+' : ''}{vs.netVariance.toFixed(2)} ر.س
                          </span>
                        </div>
                        <div className="text-xs mt-1 opacity-80">
                          (المحصل: {vs.totalActualCollected.toFixed(2)} - المبيعات: {vs.netSales.toFixed(2)})
                        </div>
                      </div>
                      
                      {/* Component breakdown - sub-discrepancies */}
                      {(Math.abs(vs.cashDiscrepancy) > 0.01 || Math.abs(vs.bankDiscrepancy) > 0.01) && (
                        <div className="space-y-2 p-2 bg-muted rounded border text-xs">
                          <div className="text-muted-foreground font-medium">تفصيل الفروقات:</div>
                          <div className="flex justify-between">
                            <span>فرق الصندوق النقدي:</span>
                            <span className={vs.cashDiscrepancy > 0 ? 'text-amber-600' : vs.cashDiscrepancy < 0 ? 'text-destructive' : 'text-green-600'}>
                              {vs.cashDiscrepancy >= 0 ? '+' : ''}{vs.cashDiscrepancy.toFixed(2)} ر.س
                            </span>
                          </div>
                          {vs.hasBankPayments && (
                            <div className="flex justify-between">
                              <span>فرق مطابقة البنك:</span>
                              <span className={vs.bankDiscrepancy > 0 ? 'text-amber-600' : vs.bankDiscrepancy < 0 ? 'text-destructive' : 'text-green-600'}>
                                {vs.bankDiscrepancy >= 0 ? '+' : ''}{vs.bankDiscrepancy.toFixed(2)} ر.س
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {discrepancyStatus.isShortage && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs text-center">
                          عجز مُسجَّل على الكاشير ({vs.cashDiscrepancy.toFixed(2)} ر.س)
                        </div>
                      )}
                      {getDiscrepancyAnalysis().type === "possible_misclass" && (
                        <div className="mt-2 p-2 bg-amber-100 rounded text-amber-700 text-xs">
                          <AlertCircle className="w-3 h-3 inline ml-1" />
                          {getDiscrepancyAnalysis().message}
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {isReadOnly && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700">للقراءة فقط</AlertTitle>
                <AlertDescription className="text-amber-600">
                  تم ترحيل هذه اليومية ولا يمكن تعديلها
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              {!isReadOnly && (
                <>
                  <Button
                    className="w-full gap-2 h-12"
                    onClick={handleSave}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save"
                  >
                    <Save className="w-4 h-4" />
                    {isEdit ? "حفظ التغييرات" : "حفظ كمسودة"}
                  </Button>
                  {isEdit && existingJournal?.status === "draft" && (
                    <Button
                      variant="default"
                      className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white h-12"
                      onClick={handleSaveAndPost}
                      disabled={postMutation.isPending || updateMutation.isPending || !canPost}
                      data-testid="button-save-post"
                    >
                      <Send className="w-4 h-4" />
                      حفظ وترحيل
                    </Button>
                  )}
                  {getTotalsMismatch() && (
                    <p className="text-xs text-amber-600 text-center">
                      تنبيه: يوجد فرق في الأرقام. سيُطلب تأكيد قبل الترحيل.
                    </p>
                  )}
                </>
              )}
              {isReadOnly && (
                <Button
                  variant="outline"
                  className="w-full gap-2 h-12"
                  onClick={() => setLocation("/cashier-journals")}
                  data-testid="button-back-list"
                >
                  <ArrowRight className="w-4 h-4" />
                  العودة للقائمة
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar - iPad Optimized */}
        <div className="fixed bottom-0 left-0 right-0 md:right-64 bg-card border-t-2 border-border shadow-lg z-50 p-2 md:p-3">
          <div className="flex flex-col gap-2">
            {/* Quick Add Payment Buttons - Always visible */}
            {!isReadOnly && (
              <div className="flex flex-col gap-1">
                {/* Bank Cards Row */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs text-primary font-medium ml-1">💳 بطاقات:</span>
                  {[
                    { value: "mada", label: "مدى", color: "bg-primary hover:bg-primary/90" },
                    { value: "visa", label: "فيزا", color: "bg-primary hover:bg-primary/90" },
                    { value: "mastercard", label: "ماستركارد", color: "bg-primary hover:bg-primary/90" },
                  ].filter(m => !paymentBreakdowns.some(p => p.paymentMethod === m.value)).map(method => (
                    <Button
                      key={method.value}
                      type="button"
                      size="sm"
                      className={`h-8 px-2 text-white text-xs ${method.color}`}
                      onClick={() => {
                        setPaymentBreakdowns([...paymentBreakdowns, { 
                          paymentMethod: method.value, 
                          amount: 0, 
                          transactionCount: 0,
                          posAmount: 0,
                          terminalAmount: 0,
                          terminalTransactionCount: 0
                        }]);
                      }}
                      data-testid={`quick-add-sticky-${method.value}`}
                    >
                      <CreditCard className="w-3 h-3 ml-1" />
                      {method.label}
                    </Button>
                  ))}
                </div>
                
                {/* Delivery Apps Row */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs text-amber-600 font-medium ml-1">🚚 توصيل:</span>
                  {[
                    { value: "hunger_station", label: "هنجرستيشن", color: "bg-amber-500 hover:bg-amber-600" },
                    { value: "keeta", label: "كيتا", color: "bg-amber-500 hover:bg-amber-600" },
                    { value: "jahez", label: "جاهز", color: "bg-amber-500 hover:bg-amber-600" },
                    { value: "marsool", label: "مرسول", color: "bg-amber-500 hover:bg-amber-600" },
                    { value: "toyou", label: "ToYou", color: "bg-amber-500 hover:bg-amber-600" },
                    { value: "the_chefs", label: "ذا شيفز", color: "bg-amber-500 hover:bg-amber-600" },
                  ].filter(m => !paymentBreakdowns.some(p => p.paymentMethod === m.value)).map(method => (
                    <Button
                      key={method.value}
                      type="button"
                      size="sm"
                      className={`h-8 px-2 text-white text-xs ${method.color}`}
                      onClick={() => {
                        setPaymentBreakdowns([...paymentBreakdowns, { 
                          paymentMethod: method.value, 
                          amount: 0, 
                          transactionCount: 0 
                        }]);
                      }}
                      data-testid={`quick-add-sticky-${method.value}`}
                    >
                      <Truck className="w-3 h-3 ml-1" />
                      {method.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs border-dashed"
                    onClick={addPaymentBreakdown}
                    data-testid="quick-add-sticky-other"
                  >
                    <Plus className="w-3 h-3 ml-1" />
                    أخرى
                  </Button>
                </div>
              </div>
            )}
            
            {/* iPad-optimized Summary Stats and Action Buttons Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5">
            {/* Summary Stats - compact for iPad */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
              <div className="flex items-center gap-1 bg-muted px-2 py-1.5 rounded">
                <Receipt className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">المبيعات:</span>
                <span className="font-bold text-sm">{formData.totalSales.toLocaleString('en')} ر.س</span>
              </div>
              {returnData.hasReturn && returnData.returnAmount > 0 && (
                <div className="flex items-center gap-1 bg-destructive/10 px-2 py-1.5 rounded">
                  <RotateCcw className="w-3 h-3 text-destructive" />
                  <span className="text-destructive">مرتجع:</span>
                  <span className="font-bold text-sm text-destructive">-{returnData.returnAmount.toLocaleString('en')}</span>
                </div>
              )}
              <div className={`flex items-center gap-1 px-2 py-1.5 rounded ${
                (() => {
                  const variance = getVarianceSummary();
                  if (variance.varianceType === 'balanced') return 'bg-green-100';
                  if (variance.varianceType === 'warning') return 'bg-amber-100';
                  return 'bg-destructive/10';
                })()
              }`}>
                <Calculator className="w-3 h-3" />
                <span>الفارق:</span>
                <span className={`font-bold text-sm ${
                  (() => {
                    const variance = getVarianceSummary();
                    if (variance.varianceType === 'balanced') return 'text-green-700';
                    if (variance.varianceType === 'warning') return 'text-amber-700';
                    return 'text-destructive';
                  })()
                }`}>
                  {getVarianceSummary().netVariance >= 0 ? '+' : ''}{getVarianceSummary().netVariance.toLocaleString('en', {minimumFractionDigits: 2})}
                </span>
              </div>
            </div>
            
            {/* Action Buttons - iPad optimized */}
            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <>
                  <Button
                    size="default"
                    className="gap-1.5 h-9 px-4 text-sm"
                    onClick={handleSave}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-sticky"
                  >
                    <Save className="w-4 h-4" />
                    {isEdit ? "حفظ" : "حفظ مسودة"}
                  </Button>
                  {isEdit && existingJournal?.status === "draft" && (
                    <Button
                      size="default"
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white h-9 px-4 text-sm"
                      onClick={handleSaveAndPost}
                      disabled={postMutation.isPending || updateMutation.isPending || !canPost}
                      data-testid="button-post-sticky"
                    >
                      <Send className="w-4 h-4" />
                      ترحيل
                    </Button>
                  )}
                </>
              )}
              {isReadOnly && (
                <Button
                  variant="outline"
                  size="default"
                  className="gap-1.5 h-9 px-4 text-sm"
                  onClick={() => setLocation("/cashier-journals")}
                >
                  <ArrowRight className="w-4 h-4" />
                  العودة
                </Button>
              )}
            </div>
            </div>
          </div>
        </div>
        
        {/* Spacer for sticky bar - reduced for iPad */}
        <div className="h-24 md:h-20" />
      </div>

      {/* Variance Confirmation Dialog - for posting with mismatch */}
      <AlertDialog open={showVarianceConfirm} onOpenChange={setShowVarianceConfirm}>
        <AlertDialogContent className="max-w-md" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              تأكيد الترحيل مع وجود فرق
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <p>
                يوجد فرق بين مجموع التفصيل وإجمالي المبيعات بقيمة{" "}
                <span className="font-bold text-amber-600">
                  {Math.abs(formData.totalSales - getBreakdownTotal()).toFixed(2)} ر.س
                </span>
              </p>
              <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>إجمالي المبيعات:</span>
                  <span className="font-medium">{formData.totalSales.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span>مجموع التفصيل:</span>
                  <span className="font-medium">{getBreakdownTotal().toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span>الفرق:</span>
                  <span className={`font-bold ${formData.totalSales > getBreakdownTotal() ? "text-destructive" : "text-green-600"}`}>
                    {formData.totalSales > getBreakdownTotal() ? "-" : "+"}{Math.abs(formData.totalSales - getBreakdownTotal()).toFixed(2)} ر.س
                  </span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                هل أنت متأكد من ترحيل اليومية بهذا الفرق؟
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="flex-1">
              مراجعة البيانات
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                setVarianceConfirmed(true);
                setShowVarianceConfirm(false);
                // Re-call handleSaveAndPost - the confirmed flag will allow it to proceed
                setTimeout(() => {
                  handleSaveAndPost();
                }, 100);
              }}
            >
              تأكيد الترحيل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shortage Confirmation Dialog */}
      <AlertDialog open={showShortageConfirm} onOpenChange={setShowShortageConfirm}>
        <AlertDialogContent className="max-w-md" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              تأكيد حفظ اليومية مع عجز كبير
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <p>
                تم اكتشاف عجز بقيمة <span className="font-bold text-destructive">{Math.abs(calculateDiscrepancy()).toFixed(2)} ر.س</span> في الصندوق.
              </p>
              <p className="text-amber-600">
                سيُسجَّل هذا العجز على الكاشير. هل أنت متأكد من صحة البيانات؟
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="flex-1">
              مراجعة البيانات
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (pendingSaveAction) {
                  pendingSaveAction();
                  setPendingSaveAction(null);
                }
              }}
            >
              تأكيد الحفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightboxOpen && allAttachmentImages.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
          data-testid="lightbox-overlay"
        >
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-10 w-10"
                onClick={(e) => { e.stopPropagation(); setLightboxZoom(z => Math.min(z + 0.25, 4)); }}
                data-testid="lightbox-zoom-in"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-10 w-10"
                onClick={(e) => { e.stopPropagation(); setLightboxZoom(z => Math.max(z - 0.25, 0.5)); }}
                data-testid="lightbox-zoom-out"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <span className="text-white/70 text-sm">{Math.round(lightboxZoom * 100)}%</span>
            </div>
            <div className="bg-black/60 text-white px-3 py-1.5 rounded-full text-sm">
              {allAttachmentImages[lightboxIndex]?.label} ({lightboxIndex + 1}/{allAttachmentImages.length})
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-10 w-10"
              onClick={closeLightbox}
              data-testid="lightbox-close"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div
            className="max-w-[90vw] max-h-[85vh] overflow-auto flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={allAttachmentImages[lightboxIndex]?.src}
              alt={allAttachmentImages[lightboxIndex]?.fileName}
              className="max-w-full transition-transform duration-200 rounded shadow-2xl select-none"
              style={{ transform: `scale(${lightboxZoom})`, transformOrigin: 'center center' }}
              draggable={false}
              data-testid="lightbox-image"
            />
          </div>

          {allAttachmentImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                data-testid="lightbox-prev"
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                data-testid="lightbox-next"
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
            </>
          )}

          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
            {allAttachmentImages.map((_, i) => (
              <button
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${i === lightboxIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'}`}
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); setLightboxZoom(1); }}
                data-testid={`lightbox-dot-${i}`}
              />
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
