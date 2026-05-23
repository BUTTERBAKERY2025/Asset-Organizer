import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import {
  DoorOpen,
  DoorClosed,
  ChevronLeft,
  Check,
  X,
  Camera,
  Upload,
  Trash2,
  Clock,
  Building2,
  Users,
  Sparkles,
  Wrench,
  Package,
  Boxes,
  Banknote,
  Lock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Circle,
  PenTool,
  Eye,
  History,
  CalendarDays,
  RefreshCw,
  ClipboardList,
  ImageIcon,
  Wifi,
  WifiOff,
  MapPin,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  Shield,
} from "lucide-react";
import type { ChecklistTemplate, ChecklistItem, BranchShift } from "@shared/schema";

interface TemplateWithItems extends ChecklistTemplate {
  items: ChecklistItem[];
}

interface ChecklistResponse {
  itemId: number;
  isCompleted: boolean;
  notes: string;
  photoUrl: string | null;
  status: string;
}

const shiftTypes = [
  { value: "morning", label: "صباحي", time: "6:00 - 14:00", icon: "🌅" },
  { value: "evening", label: "مسائي", time: "14:00 - 22:00", icon: "🌇" },
  { value: "night", label: "ليلي", time: "22:00 - 6:00", icon: "🌙" },
];

const categoryIcons: Record<string, any> = {
  cleanliness: Sparkles,
  equipment: Wrench,
  products: Package,
  inventory: Boxes,
  cashier: Banknote,
  employees: Users,
  security: Lock,
  waste: Trash2,
  report: FileText,
};

const categoryColors: Record<string, string> = {
  cleanliness: "from-blue-500 to-blue-600",
  equipment: "from-purple-500 to-purple-600",
  products: "from-amber-500 to-amber-600",
  inventory: "from-emerald-500 to-emerald-600",
  cashier: "from-rose-500 to-rose-600",
  employees: "from-cyan-500 to-cyan-600",
  security: "from-red-500 to-red-600",
  waste: "from-orange-500 to-orange-600",
  report: "from-indigo-500 to-indigo-600",
};

const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas error")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const saveToLocalStorage = (key: string, data: any): boolean => {
  try {
    localStorage.setItem(`butter_shift_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
    return true;
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
    return false;
  }
};

const getFromLocalStorage = (key: string) => {
  try {
    const item = localStorage.getItem(`butter_shift_${key}`);
    if (item) {
      const parsed = JSON.parse(item);
      if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) return parsed.data;
    }
  } catch (e) { console.error("Failed to get from localStorage:", e); }
  return null;
};

const clearLocalStorage = (key: string) => {
  try { localStorage.removeItem(`butter_shift_${key}`); }
  catch (e) { console.error("Failed to clear localStorage:", e); }
};

const getPendingShiftsCount = (): number => {
  const pending = getFromLocalStorage("pending_shifts");
  return Array.isArray(pending) ? pending.length : 0;
};

const queueForSync = (item: { url: string; method: string; data: any; label?: string }): boolean => {
  const existing = getFromLocalStorage("pending_shifts");
  const list = Array.isArray(existing) ? existing : [];
  list.push({ ...item, queuedAt: Date.now(), attempts: 0 });
  return saveToLocalStorage("pending_shifts", list);
};

const isNetworkError = (err: any): boolean => {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed");
};

export default function BranchShiftsPage() {
  const [, setLocation] = useLocation();
  const { canView, canCreate, canEdit, hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canSign = hasPermission("branch_closure", "sign");
  const hasAccess = canView("branch_closure");
  
  const [activeTab, setActiveTab] = useState<"opening" | "closing">("opening");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedShiftType, setSelectedShiftType] = useState<string>("morning");
  const [currentShift, setCurrentShift] = useState<BranchShift | null>(null);
  const [responses, setResponses] = useState<Record<number, ChecklistResponse>>({});
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string>("");
  const [supervisorName, setSupervisorName] = useState("");
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [showHistory, setShowHistory] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasSignature, setHasSignature] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const [lastSyncError, setLastSyncError] = useState<string>("");
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string>("");
  const [supervisorNotes, setSupervisorNotes] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [uploadingItem, setUploadingItem] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!permissionsLoading && !hasAccess) setLocation("/");
  }, [permissionsLoading, hasAccess, setLocation]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast({ title: "تم استعادة الاتصال بالإنترنت" });
      syncPendingData();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast({ title: "أنت الآن في وضع عدم الاتصال", description: "سيتم حفظ البيانات محلياً", variant: "destructive" });
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setPendingSyncCount(getPendingShiftsCount());
    if (navigator.onLine && getPendingShiftsCount() > 0) {
      syncPendingData();
    }
    const interval = setInterval(() => {
      const c = getPendingShiftsCount();
      setPendingSyncCount(c);
      if (c > 0 && navigator.onLine && !isSyncingRef.current) syncPendingData();
    }, 30000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsError(""); },
        () => { setGpsError("تعذر تحديد الموقع"); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  const syncPendingData = async (manual = false) => {
    if (isSyncingRef.current) return;
    const pendingData = getFromLocalStorage("pending_shifts");
    if (!Array.isArray(pendingData) || pendingData.length === 0) {
      setPendingSyncCount(0);
      if (manual) toast({ title: "لا توجد بيانات معلقة للمزامنة" });
      return;
    }
    if (!navigator.onLine) {
      if (manual) toast({ title: "لا يوجد اتصال بالإنترنت", description: "ستتم المزامنة تلقائياً عند عودة الاتصال", variant: "destructive" });
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setLastSyncError("");
    const failed: any[] = [];
    let succeeded = 0;
    let lastErrorMsg = "";

    for (const item of pendingData) {
      const attempts = (item.attempts || 0) + 1;
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(item.data),
        });
        if (!res.ok) {
          let errMsg = `HTTP ${res.status}`;
          try { const errBody = await res.json(); errMsg = errBody.error || errMsg; } catch {}
          throw new Error(errMsg);
        }
        succeeded++;
      } catch (e: any) {
        lastErrorMsg = e?.message || "خطأ في الشبكة";
        console.error("Failed to sync item:", item.url, e);
        if (attempts < 5) {
          failed.push({ ...item, attempts, lastError: lastErrorMsg });
        } else {
          console.error("Item exceeded retry limit, dropping:", item);
        }
      }
    }

    if (failed.length > 0) {
      saveToLocalStorage("pending_shifts", failed);
      setLastSyncError(lastErrorMsg);
      toast({
        title: `تمت مزامنة ${succeeded} ، وفشلت ${failed.length}`,
        description: `سبب الفشل: ${lastErrorMsg}. سيُعاد المحاولة تلقائياً أو اضغط زر إعادة المحاولة.`,
        variant: "destructive",
      });
    } else {
      clearLocalStorage("pending_shifts");
      setLastSyncError("");
      toast({ title: `تمت مزامنة ${succeeded} عنصر بنجاح` });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-shifts/dashboard/today"] });
    }
    setPendingSyncCount(failed.length);
    setIsSyncing(false);
    isSyncingRef.current = false;
  };

  useEffect(() => {
    if (currentShift && Object.keys(responses).length > 0) {
      saveToLocalStorage(`shift_${currentShift.id}_responses`, responses);
    }
  }, [responses, currentShift]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    retry: 1,
    retryDelay: 1000,
  });

  useEffect(() => { setSupervisorName(""); }, [selectedBranch]);

  const saudiToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [workingDate, setWorkingDate] = useState(() => {
    const now = new Date();
    const saudiHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: 'numeric', hour12: false }).format(now));
    if (saudiHour >= 0 && saudiHour < 6) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(yesterday);
    }
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  });

  const isWorkingDateToday = workingDate === saudiToday;

  const goToPreviousDay = () => {
    const d = new Date(workingDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setWorkingDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d));
  };

  const goToNextDay = () => {
    const d = new Date(workingDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const next = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    if (next <= saudiToday) setWorkingDate(next);
  };

  const goToToday = () => setWorkingDate(saudiToday);
  const { data: shiftEmployeeCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/shifts/employee-count", selectedBranch, workingDate, selectedShiftType],
    queryFn: async () => {
      const res = await fetch(`/api/shifts/employee-count?branchId=${selectedBranch}&date=${workingDate}&shiftType=${selectedShiftType}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!selectedBranch,
    staleTime: 15000,
  });

  useEffect(() => {
    if (shiftEmployeeCountData?.count && shiftEmployeeCountData.count > 0) setEmployeeCount(shiftEmployeeCountData.count);
  }, [shiftEmployeeCountData]);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<TemplateWithItems[]>({
    queryKey: ["/api/branch-shifts/all-items", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/branch-shifts/all-items?type=${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const { data: dashboardData } = useQuery<{ dashboard: any[], shifts: any[] }>({
    queryKey: ["/api/branch-shifts/dashboard/today", workingDate],
    queryFn: async () => {
      const res = await fetch(`/api/branch-shifts/dashboard/today?date=${workingDate}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });
  const todayShifts = dashboardData?.dashboard || [];

  const { data: shiftHistory = [] } = useQuery<BranchShift[]>({
    queryKey: ["/api/branch-shifts", selectedBranch],
    enabled: !!selectedBranch,
  });

  const createShiftMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/branch-shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.status === 409) { const err = await res.json(); throw new Error(err.error || "الشفت مكتمل بالفعل"); }
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "فشل في إنشاء الشفت"); }
      return res.json();
    },
    onSuccess: (shift) => {
      setCurrentShift(shift);
      queryClient.invalidateQueries({ queryKey: ["/api/branch-shifts"] });
      if (shift._existing) toast({ title: "تم استرجاع شفت موجود لهذا الفرع اليوم" });
      else toast({ title: "تم إنشاء الشفت بنجاح" });
    },
    onError: (error: Error) => { toast({ title: error.message, variant: "destructive" }); },
  });

  const saveResponseMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = `/api/branch-shifts/${currentShift?.id}/responses`;
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "فشل في حفظ الاستجابات"); }
        return res.json();
      } catch (e: any) {
        if (isNetworkError(e)) {
          const queued = queueForSync({ url, method: "POST", data, label: "حفظ ردود قائمة الفحص" });
          setPendingSyncCount(getPendingShiftsCount());
          if (queued) {
            toast({ title: "محفوظ محلياً", description: "سيُرسَل تلقائياً عند عودة الاتصال" });
            return { _queued: true };
          }
          throw new Error("فشل الحفظ المحلي ولا يوجد اتصال — البيانات قد تُفقد");
        }
        throw e;
      }
    },
    onError: (error: Error) => { toast({ title: error.message, variant: "destructive" }); },
  });

  const saveSignatureMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = `/api/branch-shifts/${currentShift?.id}/signatures`;
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
        if (!res.ok) throw new Error("Failed to save signature");
        return res.json();
      } catch (e: any) {
        if (isNetworkError(e)) {
          const queued = queueForSync({ url, method: "POST", data, label: "حفظ التوقيع" });
          setPendingSyncCount(getPendingShiftsCount());
          if (queued) {
            toast({ title: "التوقيع محفوظ محلياً", description: "سيُرسَل تلقائياً عند عودة الاتصال" });
            return { _queued: true };
          }
          throw new Error("فشل حفظ التوقيع محلياً");
        }
        throw e;
      }
    },
    onSuccess: (result: any) => {
      if (result?._queued) { setShowSignature(false); return; }
      toast({ title: "تم حفظ التوقيع بنجاح" });
      setShowSignature(false);
      setHasSignature(true);
    },
    onError: (error: Error) => { toast({ title: error.message, variant: "destructive" }); },
  });

  const completeShiftMutation = useMutation({
    mutationFn: async (data: any) => {
      const dataWithLocation = { ...data, gpsLatitude: gpsLocation?.lat, gpsLongitude: gpsLocation?.lng };
      const url = `/api/branch-shifts/${currentShift?.id}`;
      try {
        const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(dataWithLocation) });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "فشل في إكمال الشفت"); }
        return res.json();
      } catch (e: any) {
        if (isNetworkError(e)) {
          const queued = queueForSync({ url, method: "PATCH", data: dataWithLocation, label: "إكمال الشفت" });
          setPendingSyncCount(getPendingShiftsCount());
          if (queued) {
            toast({ title: "إكمال الشفت محفوظ محلياً", description: "سيُرسَل تلقائياً عند عودة الاتصال" });
            return { _queued: true };
          }
          throw new Error("فشل حفظ إكمال الشفت محلياً");
        }
        throw e;
      }
    },
    onSuccess: async (result: any) => {
      if (result?._queued) {
        return;
      }
      if (navigator.onLine) {
        try {
          const branchName = branches.find((b: any) => b.id === currentShift?.branchId)?.name || currentShift?.branchId;
          await fetch("/api/notifications", {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({ title: activeTab === "opening" ? "تم فتح فرع" : "تم إغلاق فرع", message: `${activeTab === "opening" ? "تم إكمال إجراءات الفتح" : "تم إكمال إجراءات الإغلاق"} لفرع ${branchName} بواسطة ${supervisorName}`, type: "shift_completion", priority: "normal", targetRole: "admin", metadata: { branchId: currentShift?.branchId, shiftType: currentShift?.shiftType, completionType: activeTab, supervisorName, gpsLocation } }),
          });
        } catch (e) { console.error("Failed to send notification:", e); }
      }
      if (currentShift) clearLocalStorage(`shift_${currentShift.id}_responses`);
      queryClient.invalidateQueries({ queryKey: ["/api/branch-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-shifts/dashboard/today", workingDate] });
      toast({ title: activeTab === "opening" ? "تم إكمال إجراءات الفتح بنجاح" : "تم إكمال إجراءات الإغلاق بنجاح" });
      setCurrentShift(null);
      setResponses({});
      setHasSignature(false);
    },
    onError: (error: Error) => { toast({ title: error.message, variant: "destructive" }); },
  });

  const startShift = () => {
    if (!selectedBranch) { toast({ title: "يرجى اختيار الفرع", variant: "destructive" }); return; }
    if (!supervisorName) { toast({ title: "يرجى اختيار اسم المشرف / المدير", variant: "destructive" }); return; }
    if (activeTab === "closing") {
      const branchStatus = todayShifts.find((b: any) => b.branchId === selectedBranch);
      if (!branchStatus || branchStatus.openingStatus !== "completed") {
        toast({ title: "يجب إكمال إجراءات الفتح أولاً قبل البدء بالإغلاق", variant: "destructive" }); return;
      }
    }
    createShiftMutation.mutate({ branchId: selectedBranch, shiftType: selectedShiftType, shiftDate: workingDate, supervisorName, employeeCount, openingTime: activeTab === "opening" ? new Date() : undefined });
  };

  const toggleItem = (itemId: number, checked: boolean) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], itemId, isCompleted: checked, notes: prev[itemId]?.notes || "", photoUrl: prev[itemId]?.photoUrl || null, status: checked ? "passed" : "pending" } }));
  };

  const updateItemNotes = (itemId: number, notes: string) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], itemId, notes, isCompleted: prev[itemId]?.isCompleted || false, photoUrl: prev[itemId]?.photoUrl || null, status: prev[itemId]?.status || "pending" } }));
  };

  const handlePhotoUpload = async (itemId: number, file: File) => {
    setUploadingItem(itemId);
    try {
      const compressed = await compressImage(file, 1200, 0.6);
      setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], itemId, photoUrl: compressed, isCompleted: prev[itemId]?.isCompleted || false, notes: prev[itemId]?.notes || "", status: prev[itemId]?.status || "pending" } }));
      toast({ title: "تم إرفاق الصورة بنجاح" });
    } catch (err) {
      toast({ title: "فشل في معالجة الصورة", variant: "destructive" });
    }
    setUploadingItem(null);
  };

  const removePhoto = (itemId: number) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], photoUrl: null } as ChecklistResponse }));
  };

  const totalItems = templates.reduce((sum, t) => sum + t.items.length, 0);
  const completedItems = Object.values(responses).filter((r) => r.isCompleted).length;
  const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const photosUploaded = Object.values(responses).filter((r) => r.photoUrl).length;
  const photosPercentage = totalItems > 0 ? (photosUploaded / totalItems) * 100 : 0;

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.lineCap = "round"; }
    }
  };

  useEffect(() => { if (showSignature) setTimeout(initCanvas, 100); }, [showSignature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext("2d"); const rect = canvas.getBoundingClientRect(); if (ctx) { ctx.beginPath(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top); } }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext("2d"); const rect = canvas.getBoundingClientRect(); if (ctx) { ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke(); } }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) setSignatureData(canvas.toDataURL());
  };

  const clearSignature = () => { initCanvas(); setSignatureData(""); };

  const saveSignature = () => {
    if (!signatureData) { toast({ title: "يرجى التوقيع أولاً", variant: "destructive" }); return; }
    saveSignatureMutation.mutate({ signatureType: activeTab === "opening" ? "opening_supervisor" : "closing_supervisor", signatureData, signerName: supervisorName || "المشرف", signerRole: "supervisor" });
  };

  const completeChecklist = async () => {
    if (progressPercentage < 100) { toast({ title: "يرجى إكمال جميع البنود أولاً", variant: "destructive" }); return; }
    const filteredTemplates = templates.filter((t) => t.type === activeTab);
    const allItems = filteredTemplates.flatMap((t) => t.items);
    const missingPhotos = allItems.filter((item) => !responses[item.id]?.photoUrl);
    if (missingPhotos.length > 0) {
      toast({ title: `صور ناقصة (${missingPhotos.length} بند)`, description: `يجب التقاط صورة لكل بند`, variant: "destructive" }); return;
    }
    if (!hasSignature) { toast({ title: "التوقيع إلزامي", variant: "destructive" }); setShowSignature(true); return; }
    const responsesArray = Object.values(responses).map((r) => ({ itemId: r.itemId, checklistType: activeTab, isCompleted: r.isCompleted, notes: r.notes, photoUrl: r.photoUrl, status: r.status }));
    await saveResponseMutation.mutateAsync({ checklistType: activeTab, responses: responsesArray, supervisorNotes });
    completeShiftMutation.mutate(activeTab === "opening" ? { openingCompleted: true, openingCompletedAt: new Date(), supervisorNotes } : { closingCompleted: true, closingCompletedAt: new Date(), closingTime: new Date(), supervisorNotes });
  };

  if (permissionsLoading) return <Layout><div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div></Layout>;
  if (!hasAccess) return <Layout><div className="flex items-center justify-center min-h-[50vh]"><div className="text-center"><Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-lg text-gray-500">غير مصرح لك بالوصول لهذه الصفحة</p></div></div></Layout>;

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={StoreIcon}
          tone="primary"
          title="نظام فتح وإغلاق الفروع"
          description="قوائم التحقق اليومية مع التوثيق المصور"
          backHref="/operations"
          actions={
            <>
              <Link href="/shift-reports">
                <Button variant="outline" size="sm" className="gap-2 h-9 text-xs sm:text-sm" data-testid="btn-reports">
                  <ClipboardList className="h-4 w-4" />
                  التقارير
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="gap-2 h-9 text-xs sm:text-sm" onClick={() => setShowHistory(true)} data-testid="btn-history">
                <History className="h-4 w-4" />
                السجل
              </Button>
            </>
          }
        />

        {/* Branch Status */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3 border-b bg-gradient-to-l from-amber-50/50 to-white">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Building2 className="h-5 w-5 text-amber-600" />
                حالة الفروع {isWorkingDateToday ? "اليوم" : ""}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPreviousDay} data-testid="btn-prev-day">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Badge 
                  variant="outline" 
                  className={`bg-white text-xs sm:text-sm cursor-pointer select-none ${!isWorkingDateToday ? "border-amber-500 bg-amber-50 text-amber-800" : ""}`}
                  onClick={goToToday}
                  data-testid="badge-working-date"
                >
                  {new Date(workingDate + "T12:00:00").toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" })}
                  {!isWorkingDateToday && <span className="mr-1.5 text-[10px] text-amber-600">(اضغط للعودة لليوم)</span>}
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextDay} disabled={isWorkingDateToday} data-testid="btn-next-day">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {!isWorkingDateToday && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>أنت تعرض بيانات يوم سابق — يمكنك إغلاق فرع تم فتحه في هذا اليوم</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {todayShifts.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl border">
                <div className="flex items-center gap-1.5 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-green-700 font-medium">مكتمل: {todayShifts.filter((b: any) => b.openingStatus === "completed" && b.closingStatus === "completed").length}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-700 font-medium">مفتوح: {todayShifts.filter((b: any) => b.openingStatus === "completed" && b.closingStatus !== "completed").length}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  <span className="text-gray-600 font-medium">لم يبدأ: {todayShifts.filter((b: any) => b.openingStatus !== "completed").length}</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {todayShifts.map((branch: any) => {
                const isFullyComplete = branch.openingStatus === "completed" && branch.closingStatus === "completed";
                const isPartial = branch.openingStatus === "completed" && branch.closingStatus !== "completed";
                const openingTime = branch.shift?.openingCompletedAt ? new Date(branch.shift.openingCompletedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Riyadh" }) : null;
                const closingTime = branch.shift?.closingCompletedAt ? new Date(branch.shift.closingCompletedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Riyadh" }) : null;
                return (
                  <div key={branch.branchId} className={`p-3 rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg ${isFullyComplete ? "border-green-400 bg-gradient-to-br from-green-50 to-emerald-50" : isPartial ? "border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50" : "border-gray-200 bg-white hover:border-amber-300"}`} onClick={() => setSelectedBranch(branch.branchId)} data-testid={`branch-status-${branch.branchId}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm truncate" data-testid={`branch-name-${branch.branchId}`}>{branch.branchName}</span>
                      {isFullyComplete ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : isPartial ? <Clock className="h-5 w-5 text-amber-600 animate-pulse shrink-0" /> : <Circle className="h-5 w-5 text-gray-300 shrink-0" />}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 ${branch.openingStatus === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        <DoorOpen className="h-3 w-3 shrink-0" />
                        {branch.openingStatus === "completed" ? <span>تم الفتح {openingTime && <span className="text-[10px] font-mono" dir="ltr">{openingTime}</span>}</span> : "لم يفتح"}
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 ${branch.closingStatus === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        <DoorClosed className="h-3 w-3 shrink-0" />
                        {branch.closingStatus === "completed" ? <span>تم الإغلاق {closingTime && <span className="text-[10px] font-mono" dir="ltr">{closingTime}</span>}</span> : "لم يغلق"}
                      </div>
                    </div>
                    {branch.shift?.supervisorName && <p className="text-[11px] text-gray-600 mt-1.5 truncate">{branch.shift.supervisorName}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {!currentShift ? (
          <Card className="border-0 shadow-md">
            <CardHeader className="border-b bg-gradient-to-l from-gray-50 to-white">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CalendarDays className="h-5 w-5 text-amber-600" />
                بدء شفت جديد
              </CardTitle>
              <CardDescription>اختر الفرع ونوع الشفت والمشرف للبدء</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">الفرع *</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="h-11 border-2 focus:border-amber-400" data-testid="select-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch: any) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">نوع الشفت</Label>
                  <Select value={selectedShiftType} onValueChange={setSelectedShiftType}>
                    <SelectTrigger className="h-11 border-2 focus:border-amber-400" data-testid="select-shift-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.icon} {type.label} ({type.time})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">اسم المشرف / المدير *</Label>
                  <Input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} placeholder="أدخل اسم المشرف أو المدير" className="h-11 border-2 focus:border-amber-400" data-testid="input-supervisor" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">عدد الموظفين</Label>
                  <Input type="number" value={employeeCount || ""} onChange={(e) => setEmployeeCount(parseInt(e.target.value) || 0)} placeholder="عدد الموظفين" className="h-11 border-2 focus:border-amber-400" data-testid="input-employee-count" />
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "opening" | "closing")}>
                <TabsList className="grid w-full max-w-lg grid-cols-2 h-12 mx-auto">
                  <TabsTrigger value="opening" className="gap-2 text-sm" data-testid="tab-opening">
                    <DoorOpen className="h-4 w-4" />
                    فتح الفرع
                  </TabsTrigger>
                  <TabsTrigger value="closing" className="gap-2 text-sm" data-testid="tab-closing">
                    <DoorClosed className="h-4 w-4" />
                    إغلاق الفرع
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Status Indicators */}
              {pendingSyncCount > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3" data-testid="banner-pending-sync">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <RefreshCw className={`h-5 w-5 text-amber-600 flex-shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-amber-900" data-testid="text-pending-count">
                        {pendingSyncCount} عنصر بانتظار المزامنة
                      </p>
                      {lastSyncError && (
                        <p className="text-[11px] text-red-600 truncate" data-testid="text-sync-error">
                          آخر خطأ: {lastSyncError}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-400 text-amber-800 hover:bg-amber-100 flex-shrink-0"
                    onClick={() => syncPendingData(true)}
                    disabled={isSyncing || isOffline}
                    data-testid="button-retry-sync"
                  >
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
                    إعادة المحاولة
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3 text-center">
                  <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                  <span className="text-lg font-bold text-amber-800 font-mono" dir="ltr">{currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</span>
                  <p className="text-[10px] text-amber-600 mt-0.5">الوقت الفعلي</p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${isOffline ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  {isOffline ? <WifiOff className="h-5 w-5 text-red-500 mx-auto mb-1" /> : <Wifi className="h-5 w-5 text-green-500 mx-auto mb-1" />}
                  <span className={`text-sm font-bold ${isOffline ? "text-red-800" : "text-green-800"}`}>{isOffline ? "غير متصل" : "متصل"}</span>
                  <p className={`text-[10px] mt-0.5 ${isOffline ? "text-red-600" : "text-green-600"}`}>{isOffline ? "حفظ محلي" : "متصل بالسيرفر"}</p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${gpsLocation ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                  <MapPin className={`h-5 w-5 mx-auto mb-1 ${gpsLocation ? "text-blue-600" : "text-gray-400"}`} />
                  <span className={`text-sm font-bold ${gpsLocation ? "text-blue-800" : "text-gray-500"}`}>{gpsLocation ? "تم التحديد" : gpsError || "جاري..."}</span>
                  {gpsLocation && <p className="text-[10px] text-blue-600 mt-0.5 font-mono" dir="ltr">{gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)}</p>}
                </div>
              </div>

              <Button className="w-full gap-2 h-12 text-base bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md" onClick={startShift} disabled={!selectedBranch || !supervisorName || createShiftMutation.isPending} data-testid="btn-start-shift">
                {createShiftMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : activeTab === "opening" ? <DoorOpen className="h-5 w-5" /> : <DoorClosed className="h-5 w-5" />}
                بدء {activeTab === "opening" ? "إجراءات الفتح" : "إجراءات الإغلاق"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Progress Overview */}
            <Card className="border-0 shadow-md overflow-hidden">
              <div className="bg-gradient-to-l from-amber-600 to-orange-500 p-4 text-white">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-white/20 border-white/30 text-white text-sm px-3 py-1">
                      <Building2 className="h-4 w-4 ml-1" />
                      {branches.find((b: any) => b.id === currentShift.branchId)?.name}
                    </Badge>
                    <Badge className="bg-white/20 border-white/30 text-white text-xs">
                      {activeTab === "opening" ? "فتح الفرع" : "إغلاق الفرع"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="font-mono font-bold text-sm" dir="ltr">{currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</span>
                    </div>
                  </div>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-amber-600">{Math.round(progressPercentage)}%</p>
                    <p className="text-xs text-gray-500">البنود المكتملة</p>
                    <p className="text-xs text-gray-500">{completedItems}/{totalItems}</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-3xl font-bold ${photosPercentage === 100 ? "text-green-600" : "text-red-500"}`}>{photosUploaded}</p>
                    <p className="text-xs text-gray-500">الصور المرفقة</p>
                    <p className="text-xs text-gray-500">من {totalItems}</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-3xl font-bold ${hasSignature ? "text-green-600" : "text-red-500"}`}>{hasSignature ? "✓" : "✗"}</p>
                    <p className="text-xs text-gray-500">التوقيع</p>
                    <p className="text-xs text-gray-500">{hasSignature ? "تم" : "مطلوب"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>البنود</span>
                    <span>{completedItems}/{totalItems}</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2.5" />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> الصور</span>
                    <span className={photosPercentage === 100 ? "text-green-600 font-bold" : "text-red-500"}>{photosUploaded}/{totalItems}</span>
                  </div>
                  <Progress value={photosPercentage} className={`h-2.5 ${photosPercentage === 100 ? '[&>div]:bg-green-500' : '[&>div]:bg-red-400'}`} />
                </div>
              </CardContent>
            </Card>

            {/* Checklist Categories */}
            <div className="space-y-3">
              {templates.map((template) => {
                const Icon = categoryIcons[template.category] || FileText;
                const colorClass = categoryColors[template.category] || "from-gray-500 to-gray-600";
                const templateCompleted = template.items.filter((item) => responses[item.id]?.isCompleted).length;
                const templateProgress = template.items.length > 0 ? (templateCompleted / template.items.length) * 100 : 0;
                const templatePhotos = template.items.filter((item) => responses[item.id]?.photoUrl).length;
                const isExpanded = expandedCategories.includes(template.category);
                const isComplete = templateProgress === 100 && templatePhotos === template.items.length;

                return (
                  <Card key={template.id} className={`border-0 shadow-md overflow-hidden transition-all ${isComplete ? 'ring-2 ring-green-400' : ''}`} data-testid={`template-${template.id}`}>
                    <button className="w-full text-right" onClick={() => toggleCategory(template.category)}>
                      <div className={`flex items-center justify-between p-3 sm:p-4 ${isComplete ? 'bg-gradient-to-l from-green-50 to-emerald-50' : 'bg-white'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${isComplete ? 'from-green-500 to-emerald-600' : colorClass} shadow-sm`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-sm sm:text-base">{template.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">{template.items.length} بند</span>
                              <span className="text-xs text-gray-400">|</span>
                              <span className={`text-xs flex items-center gap-0.5 ${templatePhotos === template.items.length ? "text-green-600" : "text-red-500"}`}>
                                <Camera className="h-3 w-3" />{templatePhotos}/{template.items.length}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isComplete ? (
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${templateProgress}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-600 w-8">{Math.round(templateProgress)}%</span>
                            </div>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </div>
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="border-t bg-gray-50/50 p-3 sm:p-4">
                        <div className="space-y-2">
                          {template.items.map((item) => {
                            const resp = responses[item.id];
                            const hasPhoto = !!resp?.photoUrl;
                            const isChecked = resp?.isCompleted || false;
                            const isUploading = uploadingItem === item.id;
                            return (
                              <div key={item.id} className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border-2 transition-all ${isChecked && hasPhoto ? "bg-green-50 border-green-300" : isChecked ? "bg-amber-50 border-amber-300" : "bg-white border-gray-200 hover:border-gray-300"}`} data-testid={`checklist-item-${item.id}`}>
                                <Checkbox checked={isChecked} onCheckedChange={(checked) => toggleItem(item.id, checked as boolean)} className="h-5 w-5 shrink-0 border-2" data-testid={`checkbox-${item.id}`} />
                                <span className={`text-xs sm:text-sm flex-1 leading-snug ${isChecked ? "text-green-800" : "text-gray-800"}`}>{item.title}</span>
                                
                                {item.requiresNote && (
                                  <Input placeholder="عدد" value={resp?.notes || ""} onChange={(e) => updateItemNotes(item.id, e.target.value)} className="h-7 w-16 text-xs text-center shrink-0 border-2" data-testid={`notes-${item.id}`} />
                                )}

                                {hasPhoto ? (
                                  <div className="relative group shrink-0">
                                    <img src={resp.photoUrl!} alt="" className="h-10 w-10 sm:h-12 sm:w-12 object-cover rounded-lg border-2 border-green-400 cursor-pointer" onClick={() => setPreviewPhoto(resp.photoUrl)} />
                                    <button className="absolute -top-1.5 -left-1.5 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" onClick={() => removePhoto(item.id)}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="cursor-pointer shrink-0">
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(item.id, file); }} data-testid={`photo-input-${item.id}`} />
                                    <div className={`p-2 rounded-xl border-2 transition-all ${isUploading ? "bg-amber-100 border-amber-300" : "bg-red-50 border-red-300 hover:bg-red-100 hover:border-red-400"}`}>
                                      {isUploading ? <Loader2 className="h-5 w-5 text-amber-600 animate-spin" /> : <Camera className="h-5 w-5 text-red-500" />}
                                    </div>
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Supervisor Notes */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600" />
                  <span className="font-bold text-sm">ملاحظات المشرف / المدير</span>
                </div>
                <Textarea placeholder="أضف أي ملاحظات أو مشاكل أو اقتراحات هنا..." value={supervisorNotes} onChange={(e) => setSupervisorNotes(e.target.value)} className="min-h-[80px] border-2 focus:border-amber-400" data-testid="textarea-supervisor-notes" />
              </CardContent>
            </Card>

            {/* Signature & Complete */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4 space-y-4">
                <div className={`flex items-center justify-between p-3 rounded-xl border-2 ${hasSignature ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {hasSignature ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
                    <span className={`text-sm font-bold ${hasSignature ? "text-green-700" : "text-red-600"}`}>{hasSignature ? "تم التوقيع بنجاح" : "التوقيع إلزامي"}</span>
                  </div>
                  <Button variant={hasSignature ? "outline" : "default"} size="sm" className={`gap-1.5 ${!hasSignature ? 'bg-amber-600 hover:bg-amber-700' : ''}`} onClick={() => setShowSignature(true)} data-testid="btn-add-signature">
                    <PenTool className="h-4 w-4" />
                    {hasSignature ? "تعديل" : "توقيع"}
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1 gap-2 h-12 text-base bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md" onClick={completeChecklist} disabled={progressPercentage < 100 || photosPercentage < 100 || !hasSignature || completeShiftMutation.isPending} data-testid="btn-complete-checklist">
                    {completeShiftMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    إكمال {activeTab === "opening" ? "الفتح" : "الإغلاق"}
                  </Button>
                  <Button variant="outline" className="h-12 px-6 border-2" onClick={() => { setCurrentShift(null); setResponses({}); }} data-testid="btn-cancel-shift">
                    إلغاء
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Signature Dialog */}
        <Dialog open={showSignature} onOpenChange={setShowSignature}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader>
              <DialogTitle className="text-xl text-center">التوقيع الإلكتروني</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-500 text-center">وقّع بإصبعك أو القلم في المنطقة أدناه</p>
              <div className="border-2 border-amber-400 rounded-xl p-3 bg-gradient-to-b from-amber-50 to-white shadow-inner">
                <canvas ref={canvasRef} width={600} height={300} className="w-full cursor-crosshair bg-white rounded-lg border border-gray-200 touch-none" style={{ minHeight: '250px' }}
                  onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                  onTouchStart={(e) => { e.preventDefault(); const touch = e.touches[0]; const canvas = canvasRef.current; if (canvas) { const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height; const ctx = canvas.getContext("2d"); if (ctx) { ctx.beginPath(); ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY); setIsDrawing(true); } } }}
                  onTouchMove={(e) => { e.preventDefault(); if (!isDrawing) return; const touch = e.touches[0]; const canvas = canvasRef.current; if (canvas) { const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height; const ctx = canvas.getContext("2d"); if (ctx) { ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.strokeStyle = "#1a1a2e"; ctx.lineTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY); ctx.stroke(); } } }}
                  onTouchEnd={(e) => { e.preventDefault(); setIsDrawing(false); const canvas = canvasRef.current; if (canvas) setSignatureData(canvas.toDataURL()); }}
                  data-testid="canvas-signature"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={clearSignature} className="flex-1 h-12 text-base" data-testid="btn-clear-signature">مسح التوقيع</Button>
                <Button onClick={saveSignature} className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700" data-testid="btn-save-signature">حفظ التوقيع</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Photo Preview Dialog */}
        <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
          <DialogContent className="max-w-3xl p-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-amber-600" />
                معاينة الصورة
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4 bg-gray-100 rounded-lg">
              {previewPhoto && <img src={previewPhoto} alt="معاينة" className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg" />}
            </div>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-amber-600" />
                سجل الشفتات
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {shiftHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">لا يوجد سجلات سابقة</p>
                </div>
              ) : (
                shiftHistory.map((shift) => (
                  <Card key={shift.id} className="border hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-100 rounded-xl p-2 text-center min-w-[48px]">
                            <p className="text-lg font-bold text-amber-800">{new Date(shift.shiftDate).getDate()}</p>
                            <p className="text-[10px] text-amber-600">{new Date(shift.shiftDate).toLocaleDateString("en-GB", { month: "short" })}</p>
                          </div>
                          <div>
                            <p className="font-bold text-sm">{shift.supervisorName || "المشرف"}</p>
                            <p className="text-xs text-gray-500">{shiftTypes.find((t) => t.value === shift.shiftType)?.label}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={shift.openingCompleted ? "default" : "outline"} className={`text-xs ${shift.openingCompleted ? 'bg-green-600' : ''}`}>{shift.openingCompleted ? "تم الفتح" : "لم يفتح"}</Badge>
                          <Badge variant={shift.closingCompleted ? "default" : "outline"} className={`text-xs ${shift.closingCompleted ? 'bg-green-600' : ''}`}>{shift.closingCompleted ? "تم الإغلاق" : "لم يغلق"}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
