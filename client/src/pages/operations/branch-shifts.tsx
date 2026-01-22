import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
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
  { value: "morning", label: "صباحي", time: "6:00 - 14:00" },
  { value: "evening", label: "مسائي", time: "14:00 - 22:00" },
  { value: "night", label: "ليلي", time: "22:00 - 6:00" },
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

// دالة تشغيل الصوت
const playNotificationSound = (type: "success" | "warning" | "error") => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  if (type === "success") {
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
  } else if (type === "warning") {
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
    oscillator.frequency.setValueAtTime(349.23, audioContext.currentTime + 0.15); // F4
  } else {
    oscillator.frequency.setValueAtTime(261.63, audioContext.currentTime); // C4
  }
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};

// دالة حفظ البيانات محلياً (Offline)
const saveToLocalStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(`butter_shift_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
};

const getFromLocalStorage = (key: string) => {
  try {
    const item = localStorage.getItem(`butter_shift_${key}`);
    if (item) {
      const parsed = JSON.parse(item);
      // صالح لمدة 24 ساعة
      if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        return parsed.data;
      }
    }
  } catch (e) {
    console.error("Failed to get from localStorage:", e);
  }
  return null;
};

const clearLocalStorage = (key: string) => {
  try {
    localStorage.removeItem(`butter_shift_${key}`);
  } catch (e) {
    console.error("Failed to clear localStorage:", e);
  }
};

export default function BranchShiftsPage() {
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
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string>("");
  const [pendingSync, setPendingSync] = useState<any[]>([]);
  const [supervisorNotes, setSupervisorNotes] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // مراقبة حالة الاتصال
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast({ title: "تم استعادة الاتصال بالإنترنت", variant: "default" });
      syncPendingData();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast({ title: "أنت الآن في وضع عدم الاتصال", description: "سيتم حفظ البيانات محلياً", variant: "destructive" });
    };
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // جلب الموقع الجغرافي
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGpsError("");
        },
        (error) => {
          setGpsError("تعذر تحديد الموقع الجغرافي");
          console.error("GPS Error:", error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  // مزامنة البيانات المعلقة عند استعادة الاتصال
  const syncPendingData = async () => {
    const pendingData = getFromLocalStorage("pending_shifts");
    if (pendingData && pendingData.length > 0) {
      for (const item of pendingData) {
        try {
          await fetch(item.url, {
            method: item.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.data),
          });
        } catch (e) {
          console.error("Failed to sync pending data:", e);
        }
      }
      clearLocalStorage("pending_shifts");
      toast({ title: "تم مزامنة البيانات المعلقة بنجاح" });
    }
  };

  // حفظ الاستجابات محلياً عند التغيير
  useEffect(() => {
    if (currentShift && Object.keys(responses).length > 0) {
      saveToLocalStorage(`shift_${currentShift.id}_responses`, responses);
    }
  }, [responses, currentShift]);

  // تحديث الوقت كل ثانية
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    retry: 1,
    retryDelay: 1000,
  });

  // جلب موظفي الفرع المختار
  const { data: branchEmployees = [] } = useQuery<any[]>({
    queryKey: ["/api/users", "branch-employees", selectedBranch],
    queryFn: async () => {
      const res = await fetch(`/api/users?branchId=${selectedBranch}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const users = await res.json();
      // فلترة الموظفين النشطين للفرع
      return users.filter((u: any) => u.branchId === selectedBranch && u.isActive !== "inactive");
    },
    enabled: !!selectedBranch,
    staleTime: 0, // إعادة جلب البيانات عند كل تغيير
  });

  // إعادة تعيين اسم المشرف عند تغيير الفرع
  useEffect(() => {
    setSupervisorName("");
  }, [selectedBranch]);

  // جلب عدد الموظفين من جدول الورديات تلقائياً
  const todayDate = new Date().toISOString().split('T')[0];
  const { data: shiftEmployeeCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/shifts/employee-count", selectedBranch, todayDate, selectedShiftType],
    queryFn: async () => {
      const res = await fetch(
        `/api/shifts/employee-count?branchId=${selectedBranch}&date=${todayDate}&shiftType=${selectedShiftType}`,
        { credentials: "include" }
      );
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!selectedBranch,
    staleTime: 0,
  });

  // تحديث عدد الموظفين تلقائياً عند تغيير الفرع أو الشفت
  useEffect(() => {
    if (shiftEmployeeCountData?.count && shiftEmployeeCountData.count > 0) {
      setEmployeeCount(shiftEmployeeCountData.count);
    }
  }, [shiftEmployeeCountData]);

  // فلترة المشرفين والمدراء من موظفي الفرع
  const branchSupervisors = branchEmployees.filter((u: any) => 
    u.jobTitle && (
      u.jobTitle.includes("مشرف") || 
      u.jobTitle.includes("مدير") || 
      u.jobTitle.includes("supervisor") ||
      u.jobTitle.includes("manager") ||
      u.role === "admin" ||
      u.role === "manager"
    )
  );

  // إذا لم يوجد مشرفين، نعرض جميع موظفي الفرع
  const supervisorOptions = branchSupervisors.length > 0 ? branchSupervisors : branchEmployees;

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<TemplateWithItems[]>({
    queryKey: ["/api/branch-shifts/all-items", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/branch-shifts/all-items?type=${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const { data: dashboardData } = useQuery<{ dashboard: any[], shifts: any[] }>({
    queryKey: ["/api/branch-shifts/dashboard/today"],
  });
  const todayShifts = dashboardData?.dashboard || [];

  const { data: shiftHistory = [] } = useQuery<BranchShift[]>({
    queryKey: ["/api/branch-shifts", selectedBranch],
    enabled: !!selectedBranch,
  });

  const createShiftMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/branch-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create shift");
      return res.json();
    },
    onSuccess: (shift) => {
      setCurrentShift(shift);
      queryClient.invalidateQueries({ queryKey: ["/api/branch-shifts"] });
      toast({ title: "تم إنشاء الشفت بنجاح" });
    },
  });

  const saveResponseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/branch-shifts/${currentShift?.id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save response");
      return res.json();
    },
  });

  const saveSignatureMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/branch-shifts/${currentShift?.id}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save signature");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ التوقيع بنجاح" });
      setShowSignature(false);
      setHasSignature(true);
    },
  });

  const completeShiftMutation = useMutation({
    mutationFn: async (data: any) => {
      // إضافة الموقع الجغرافي للبيانات
      const dataWithLocation = {
        ...data,
        gpsLatitude: gpsLocation?.lat,
        gpsLongitude: gpsLocation?.lng,
      };
      
      const res = await fetch(`/api/branch-shifts/${currentShift?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataWithLocation),
      });
      if (!res.ok) throw new Error("Failed to complete shift");
      return res.json();
    },
    onSuccess: async () => {
      // تشغيل صوت النجاح
      playNotificationSound("success");
      
      // إرسال إشعار للإدارة
      try {
        const branchName = branches.find((b: any) => b.id === currentShift?.branchId)?.name || currentShift?.branchId;
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: activeTab === "opening" ? "تم فتح فرع" : "تم إغلاق فرع",
            message: `${activeTab === "opening" ? "تم إكمال إجراءات الفتح" : "تم إكمال إجراءات الإغلاق"} لفرع ${branchName} بواسطة ${supervisorName}`,
            type: "shift_completion",
            priority: "normal",
            targetRole: "admin",
            metadata: {
              branchId: currentShift?.branchId,
              shiftType: currentShift?.shiftType,
              completionType: activeTab,
              supervisorName,
              gpsLocation,
            },
          }),
        });
      } catch (e) {
        console.error("Failed to send notification:", e);
      }
      
      // مسح البيانات المحفوظة محلياً
      if (currentShift) {
        clearLocalStorage(`shift_${currentShift.id}_responses`);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/branch-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-shifts/dashboard/today"] });
      toast({ 
        title: activeTab === "opening" ? "تم إكمال إجراءات الفتح بنجاح ✓" : "تم إكمال إجراءات الإغلاق بنجاح ✓",
        description: "تم إرسال إشعار للإدارة"
      });
      setCurrentShift(null);
      setResponses({});
      setHasSignature(false);
    },
  });

  const startShift = () => {
    if (!selectedBranch) {
      toast({ title: "يرجى اختيار الفرع", variant: "destructive" });
      return;
    }
    createShiftMutation.mutate({
      branchId: selectedBranch,
      shiftType: selectedShiftType,
      shiftDate: new Date().toISOString().split("T")[0],
      supervisorName,
      employeeCount,
      openingTime: activeTab === "opening" ? new Date() : undefined,
    });
  };

  const toggleItem = (itemId: number, checked: boolean) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        isCompleted: checked,
        notes: prev[itemId]?.notes || "",
        photoUrl: prev[itemId]?.photoUrl || null,
        status: checked ? "passed" : "pending",
      },
    }));
  };

  const updateItemNotes = (itemId: number, notes: string) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        notes,
        isCompleted: prev[itemId]?.isCompleted || false,
        photoUrl: prev[itemId]?.photoUrl || null,
        status: prev[itemId]?.status || "pending",
      },
    }));
  };

  const handlePhotoUpload = async (itemId: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setResponses((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          itemId,
          photoUrl: reader.result as string,
          isCompleted: prev[itemId]?.isCompleted || false,
          notes: prev[itemId]?.notes || "",
          status: prev[itemId]?.status || "pending",
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const totalItems = templates.reduce((sum, t) => sum + t.items.length, 0);
  const completedItems = Object.values(responses).filter((r) => r.isCompleted).length;
  const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
  };

  useEffect(() => {
    if (showSignature) {
      setTimeout(initCanvas, 100);
    }
  }, [showSignature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      if (ctx) {
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    initCanvas();
    setSignatureData("");
  };

  const saveSignature = () => {
    if (!signatureData) {
      toast({ title: "يرجى التوقيع أولاً", variant: "destructive" });
      return;
    }
    saveSignatureMutation.mutate({
      signatureType: activeTab === "opening" ? "opening_supervisor" : "closing_supervisor",
      signatureData,
      signerName: supervisorName || "المشرف",
      signerRole: "supervisor",
    });
  };

  const completeChecklist = async () => {
    if (progressPercentage < 100) {
      toast({ title: "يرجى إكمال جميع البنود أولاً", variant: "destructive" });
      return;
    }

    // التحقق من رفع الصور المطلوبة
    const filteredTemplates = templates.filter((t) => t.type === activeTab);
    const allItems = filteredTemplates.flatMap((t) => t.items);
    const requiredPhotoItems = allItems.filter((item) => item.requiresPhoto);
    const missingPhotos = requiredPhotoItems.filter((item) => !responses[item.id]?.photoUrl);
    
    if (missingPhotos.length > 0) {
      toast({ 
        title: "صور مطلوبة ناقصة", 
        description: `يرجى التقاط صور لـ: ${missingPhotos.map(i => i.title).slice(0, 3).join('، ')}${missingPhotos.length > 3 ? '...' : ''}`,
        variant: "destructive" 
      });
      playNotificationSound("error");
      return;
    }

    if (!hasSignature) {
      toast({ title: "التوقيع إلزامي - يرجى التوقيع قبل إكمال العملية", variant: "destructive" });
      setShowSignature(true);
      return;
    }

    const responsesArray = Object.values(responses).map((r) => ({
      itemId: r.itemId,
      checklistType: activeTab,
      isCompleted: r.isCompleted,
      notes: r.notes,
      photoUrl: r.photoUrl,
      status: r.status,
    }));

    await saveResponseMutation.mutateAsync({ checklistType: activeTab, responses: responsesArray, supervisorNotes });

    completeShiftMutation.mutate(
      activeTab === "opening"
        ? { openingCompleted: true, openingCompletedAt: new Date(), supervisorNotes }
        : { closingCompleted: true, closingCompletedAt: new Date(), closingTime: new Date(), supervisorNotes }
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/operations">
              <Button variant="outline" size="sm" className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                لوحة التشغيل
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">نظام فتح وإغلاق الفروع</h1>
              <p className="text-gray-500">قوائم التحقق اليومية مع التوثيق</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/shift-reports">
              <Button variant="default" className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="btn-reports">
                <ClipboardList className="h-4 w-4" />
                التقارير
              </Button>
            </Link>
            <Button variant="outline" className="gap-2" onClick={() => setShowHistory(true)} data-testid="btn-history">
              <History className="h-4 w-4" />
              السجل
            </Button>
          </div>
        </div>

        <Card className="bg-gradient-to-l from-amber-50 to-orange-50 border-amber-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Building2 className="h-5 w-5" />
                حالة الفروع اليوم
              </CardTitle>
              <Badge variant="outline" className="bg-white">
                {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {todayShifts.map((branch: any) => (
                <div 
                  key={branch.branchId} 
                  className={`p-3 rounded-lg border-2 transition-all ${
                    branch.openingStatus === "completed" && branch.closingStatus === "completed"
                      ? "border-green-400 bg-green-50"
                      : branch.openingStatus === "completed"
                        ? "border-amber-400 bg-amber-50"
                        : "border-gray-200 bg-white"
                  }`}
                  data-testid={`branch-status-${branch.branchId}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm" data-testid={`branch-name-${branch.branchId}`}>{branch.branchName}</span>
                    {branch.openingStatus === "completed" && branch.closingStatus === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : branch.openingStatus === "completed" ? (
                      <Clock className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className={`flex items-center gap-1 text-xs ${branch.openingStatus === "completed" ? "text-green-700" : "text-gray-500"}`}>
                      <DoorOpen className="h-3 w-3" />
                      {branch.openingStatus === "completed" ? "✓ تم الفتح" : "لم يفتح"}
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${branch.closingStatus === "completed" ? "text-green-700" : "text-gray-500"}`}>
                      <DoorClosed className="h-3 w-3" />
                      {branch.closingStatus === "completed" ? "✓ تم الإغلاق" : "لم يغلق"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {!currentShift ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                بدء شفت جديد
              </CardTitle>
              <CardDescription>اختر الفرع ونوع الشفت للبدء</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفرع *</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger data-testid="select-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch: any) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>نوع الشفت</Label>
                  <Select value={selectedShiftType} onValueChange={setSelectedShiftType}>
                    <SelectTrigger data-testid="select-shift-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label} ({type.time})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>اسم المشرف / المدير</Label>
                  {supervisorOptions.length > 0 ? (
                    <Select value={supervisorName} onValueChange={setSupervisorName}>
                      <SelectTrigger data-testid="select-supervisor">
                        <SelectValue placeholder="اختر المشرف أو المدير" />
                      </SelectTrigger>
                      <SelectContent>
                        {supervisorOptions.map((user: any) => (
                          <SelectItem key={user.id} value={`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}>
                            {user.firstName || ''} {user.lastName || ''} {user.jobTitle ? `- ${user.jobTitle}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={supervisorName}
                      onChange={(e) => setSupervisorName(e.target.value)}
                      placeholder="أدخل اسم المشرف"
                      data-testid="input-supervisor"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>عدد الموظفين</Label>
                  <Input
                    type="number"
                    value={employeeCount || ""}
                    onChange={(e) => setEmployeeCount(parseInt(e.target.value) || 0)}
                    placeholder="عدد الموظفين"
                    data-testid="input-employee-count"
                  />
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "opening" | "closing")}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="opening" className="gap-2" data-testid="tab-opening">
                    <DoorOpen className="h-4 w-4" />
                    فتح الفرع
                  </TabsTrigger>
                  <TabsTrigger value="closing" className="gap-2" data-testid="tab-closing">
                    <DoorClosed className="h-4 w-4" />
                    إغلاق الفرع
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* عرض الوقت الفعلي وحالة الاتصال والموقع */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* الوقت الفعلي */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-amber-700 mb-1">الوقت الفعلي للتسجيل</p>
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-6 w-6 text-amber-600" />
                    <span className="text-2xl font-bold text-amber-800 font-mono" dir="ltr">
                      {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                    </span>
                  </div>
                  <p className="text-xs text-amber-600 mt-1" dir="ltr">
                    {currentTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                </div>

                {/* حالة الاتصال */}
                <div className={`border rounded-lg p-4 text-center ${isOffline ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  <p className={`text-sm mb-1 ${isOffline ? "text-red-700" : "text-green-700"}`}>حالة الاتصال</p>
                  <div className="flex items-center justify-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isOffline ? "bg-red-500 animate-pulse" : "bg-green-500"}`}></div>
                    <span className={`text-lg font-bold ${isOffline ? "text-red-800" : "text-green-800"}`}>
                      {isOffline ? "غير متصل" : "متصل"}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${isOffline ? "text-red-600" : "text-green-600"}`}>
                    {isOffline ? "سيتم حفظ البيانات محلياً" : "البيانات محفوظة على السيرفر"}
                  </p>
                </div>

                {/* الموقع الجغرافي */}
                <div className={`border rounded-lg p-4 text-center ${gpsLocation ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                  <p className={`text-sm mb-1 ${gpsLocation ? "text-blue-700" : "text-gray-500"}`}>الموقع الجغرافي</p>
                  <div className="flex items-center justify-center gap-2">
                    {gpsLocation ? (
                      <>
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-bold text-blue-800">تم التحديد ✓</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-500">{gpsError || "جاري التحديد..."}</span>
                      </>
                    )}
                  </div>
                  {gpsLocation && (
                    <p className="text-xs text-blue-600 mt-1 font-mono" dir="ltr">
                      {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                onClick={startShift}
                disabled={!selectedBranch || createShiftMutation.isPending}
                data-testid="btn-start-shift"
              >
                {activeTab === "opening" ? <DoorOpen className="h-4 w-4" /> : <DoorClosed className="h-4 w-4" />}
                بدء {activeTab === "opening" ? "إجراءات الفتح" : "إجراءات الإغلاق"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      <Building2 className="h-4 w-4 ml-2" />
                      {branches.find((b: any) => b.id === currentShift.branchId)?.name}
                    </Badge>
                    <Badge variant={activeTab === "opening" ? "default" : "secondary"}>
                      {activeTab === "opening" ? "فتح الفرع" : "إغلاق الفرع"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-100 rounded-lg px-3 py-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="font-mono font-bold text-amber-800" dir="ltr">
                        {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-500">نسبة الإكمال</p>
                      <p className="text-2xl font-bold">{Math.round(progressPercentage)}%</p>
                    </div>
                  </div>
                </div>
                <Progress value={progressPercentage} className="h-3" />
                <p className="text-sm text-gray-500 mt-2 text-center">
                  {completedItems} من {totalItems} بند مكتمل
                </p>
              </CardContent>
            </Card>

            <Accordion type="multiple" className="space-y-4">
              {templates.map((template) => {
                const Icon = categoryIcons[template.category] || FileText;
                const templateCompleted = template.items.filter((item) => responses[item.id]?.isCompleted).length;
                const templateProgress = template.items.length > 0 ? (templateCompleted / template.items.length) * 100 : 0;

                return (
                  <AccordionItem key={template.id} value={`template-${template.id}`} className="border rounded-lg bg-white" data-testid={`template-${template.id}`}>
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center justify-between w-full ml-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gray-100">
                            <Icon className="h-5 w-5 text-gray-600" />
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{template.name}</p>
                            <p className="text-sm text-gray-500">{template.items.length} بند</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={templateProgress} className="w-24 h-2" />
                          <span className="text-sm font-medium">{Math.round(templateProgress)}%</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-1 pb-2">
                      <div className="grid grid-cols-2 gap-1">
                        {template.items.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 p-1.5 rounded border transition-all ${
                              responses[item.id]?.isCompleted 
                                ? "bg-green-50 border-green-400" 
                                : "bg-white border-gray-200"
                            }`}
                            data-testid={`checklist-item-${item.id}`}
                          >
                            <Checkbox
                              checked={responses[item.id]?.isCompleted || false}
                              onCheckedChange={(checked) => toggleItem(item.id, checked as boolean)}
                              className="h-5 w-5 flex-shrink-0"
                              data-testid={`checkbox-${item.id}`}
                            />
                            <span className={`text-xs flex-1 leading-tight ${
                              responses[item.id]?.isCompleted ? "text-green-700 line-through" : "text-gray-800"
                            }`}>
                              {item.title}
                            </span>
                            <label className="cursor-pointer flex-shrink-0">
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePhotoUpload(item.id, file);
                                }}
                                data-testid={`photo-input-${item.id}`}
                              />
                              <div className={`p-1.5 rounded-md ${responses[item.id]?.photoUrl ? "bg-green-500 text-white" : item.requiresPhoto ? "bg-red-100 text-red-600 hover:bg-red-200 border border-red-300" : "bg-amber-100 text-amber-600 hover:bg-amber-200"}`}>
                                <Camera className="h-5 w-5" />
                              </div>
                            </label>
                            {item.requiresNote && (
                              <Input
                                placeholder="عدد"
                                value={responses[item.id]?.notes || ""}
                                onChange={(e) => updateItemNotes(item.id, e.target.value)}
                                className="h-6 w-14 text-xs text-center flex-shrink-0"
                                data-testid={`notes-${item.id}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600" />
                  <span className="font-medium text-amber-800">ملاحظات المشرف / المدير</span>
                </div>
                <Textarea
                  placeholder="أضف أي ملاحظات أو مشاكل أو اقتراحات هنا..."
                  value={supervisorNotes}
                  onChange={(e) => setSupervisorNotes(e.target.value)}
                  className="min-h-[100px] bg-white border-amber-200 focus:border-amber-400"
                  data-testid="textarea-supervisor-notes"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-5 w-5" />
                    <span className="font-medium">التوقيع الإلكتروني</span>
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => setShowSignature(true)} data-testid="btn-add-signature">
                    <PenTool className="h-4 w-4" />
                    إضافة توقيع
                  </Button>
                </div>

                {/* مؤشر حالة التوقيع */}
                <div className={`flex items-center gap-2 p-3 rounded-lg ${hasSignature ? 'bg-green-100 border border-green-300' : 'bg-red-50 border border-red-200'}`}>
                  {hasSignature ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-green-700 font-medium">تم التوقيع بنجاح</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="text-red-600 font-medium">التوقيع إلزامي - يرجى التوقيع قبل الإكمال</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-auto gap-1"
                        onClick={() => setShowSignature(true)}
                      >
                        <PenTool className="h-4 w-4" />
                        توقيع
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    onClick={completeChecklist}
                    disabled={progressPercentage < 100 || !hasSignature || completeShiftMutation.isPending}
                    data-testid="btn-complete-checklist"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    إكمال {activeTab === "opening" ? "الفتح" : "الإغلاق"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentShift(null);
                      setResponses({});
                    }}
                    data-testid="btn-cancel-shift"
                  >
                    إلغاء
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={showSignature} onOpenChange={setShowSignature}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader>
              <DialogTitle className="text-xl text-center">التوقيع الإلكتروني</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-500 text-center">وقّع بإصبعك أو القلم في المنطقة أدناه</p>
              <div className="border-2 border-amber-400 rounded-xl p-3 bg-gradient-to-b from-amber-50 to-white shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={300}
                  className="w-full cursor-crosshair bg-white rounded-lg border border-gray-200 touch-none"
                  style={{ minHeight: '250px' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const canvas = canvasRef.current;
                    if (canvas) {
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      const x = (touch.clientX - rect.left) * scaleX;
                      const y = (touch.clientY - rect.top) * scaleY;
                      const ctx = canvas.getContext("2d");
                      if (ctx) {
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        setIsDrawing(true);
                      }
                    }
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    if (!isDrawing) return;
                    const touch = e.touches[0];
                    const canvas = canvasRef.current;
                    if (canvas) {
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      const x = (touch.clientX - rect.left) * scaleX;
                      const y = (touch.clientY - rect.top) * scaleY;
                      const ctx = canvas.getContext("2d");
                      if (ctx) {
                        ctx.lineWidth = 3;
                        ctx.lineCap = "round";
                        ctx.strokeStyle = "#1a1a2e";
                        ctx.lineTo(x, y);
                        ctx.stroke();
                      }
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    setIsDrawing(false);
                  }}
                  data-testid="canvas-signature"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={clearSignature} className="flex-1 h-12 text-lg" data-testid="btn-clear-signature">
                  مسح التوقيع
                </Button>
                <Button onClick={saveSignature} className="flex-1 h-12 text-lg bg-green-600 hover:bg-green-700" data-testid="btn-save-signature">
                  حفظ التوقيع
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>سجل الشفتات</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {shiftHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-8">لا يوجد سجلات سابقة</p>
              ) : (
                shiftHistory.map((shift) => (
                  <Card key={shift.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-lg font-bold">{new Date(shift.shiftDate).getDate()}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(shift.shiftDate).toLocaleDateString("ar-SA", { month: "short" })}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">{shift.supervisorName || "المشرف"}</p>
                            <p className="text-sm text-gray-500">
                              {shiftTypes.find((t) => t.value === shift.shiftType)?.label}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={shift.openingCompleted ? "default" : "outline"}>
                            {shift.openingCompleted ? "تم الفتح" : "لم يفتح"}
                          </Badge>
                          <Badge variant={shift.closingCompleted ? "default" : "outline"}>
                            {shift.closingCompleted ? "تم الإغلاق" : "لم يغلق"}
                          </Badge>
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
