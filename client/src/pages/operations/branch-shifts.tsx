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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<TemplateWithItems[]>({
    queryKey: ["/api/branch-shifts/all-items", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/branch-shifts/all-items?type=${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const { data: todayShifts = [] } = useQuery<any[]>({
    queryKey: ["/api/branch-shifts/dashboard/today"],
  });

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
    },
  });

  const completeShiftMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/branch-shifts/${currentShift?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to complete shift");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-shifts"] });
      toast({ title: activeTab === "opening" ? "تم إكمال إجراءات الفتح" : "تم إكمال إجراءات الإغلاق" });
      setCurrentShift(null);
      setResponses({});
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

    const responsesArray = Object.values(responses).map((r) => ({
      itemId: r.itemId,
      checklistType: activeTab,
      isCompleted: r.isCompleted,
      notes: r.notes,
      photoUrl: r.photoUrl,
      status: r.status,
    }));

    await saveResponseMutation.mutateAsync({ checklistType: activeTab, responses: responsesArray });

    completeShiftMutation.mutate(
      activeTab === "opening"
        ? { openingCompleted: true, openingCompletedAt: new Date() }
        : { closingCompleted: true, closingCompletedAt: new Date(), closingTime: new Date() }
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/production">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">نظام فتح وإغلاق الفروع</h1>
              <p className="text-gray-500">قوائم التحقق اليومية مع التوثيق</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowHistory(true)} data-testid="btn-history">
              <History className="h-4 w-4" />
              السجل
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {todayShifts.map((branch: any) => (
            <Card key={branch.branchId} className={branch.hasShift ? "border-green-200 bg-green-50" : ""} data-testid={`branch-status-${branch.branchId}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium" data-testid={`branch-name-${branch.branchId}`}>{branch.branchName}</span>
                  {branch.hasShift ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Badge variant={branch.openingStatus === "completed" ? "default" : "outline"} className="text-xs">
                    <DoorOpen className="h-3 w-3 ml-1" />
                    {branch.openingStatus === "completed" ? "تم الفتح" : "لم يفتح"}
                  </Badge>
                  <Badge variant={branch.closingStatus === "completed" ? "default" : "outline"} className="text-xs">
                    <DoorClosed className="h-3 w-3 ml-1" />
                    {branch.closingStatus === "completed" ? "تم الإغلاق" : "لم يغلق"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
                  <Label>اسم المشرف</Label>
                  <Input
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    placeholder="أدخل اسم المشرف"
                    data-testid="input-supervisor"
                  />
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
                  <div className="text-left">
                    <p className="text-sm text-gray-500">نسبة الإكمال</p>
                    <p className="text-2xl font-bold">{Math.round(progressPercentage)}%</p>
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
                    <AccordionContent className="px-2 pb-2">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {template.items.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => !item.requiresNote && toggleItem(item.id, !responses[item.id]?.isCompleted)}
                            className={`p-2 rounded-lg border-2 transition-all cursor-pointer select-none ${
                              responses[item.id]?.isCompleted 
                                ? "bg-green-100 border-green-500 shadow-sm" 
                                : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                            }`}
                            data-testid={`checklist-item-${item.id}`}
                          >
                            <div className="flex flex-col items-center text-center gap-1">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                responses[item.id]?.isCompleted 
                                  ? "bg-green-500 text-white" 
                                  : "bg-gray-100 text-gray-400"
                              }`}>
                                {responses[item.id]?.isCompleted ? (
                                  <Check className="h-5 w-5" />
                                ) : (
                                  <span className="text-xs font-bold">{template.items.indexOf(item) + 1}</span>
                                )}
                              </div>
                              <p className={`text-xs font-medium leading-tight ${
                                responses[item.id]?.isCompleted ? "text-green-700" : "text-gray-700"
                              }`}>
                                {item.title}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                {item.isCritical && (
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                )}
                                {item.requiresPhoto && (
                                  <label className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handlePhotoUpload(item.id, file);
                                      }}
                                      data-testid={`photo-input-${item.id}`}
                                    />
                                    <div className={`p-1 rounded ${responses[item.id]?.photoUrl ? "bg-green-200 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                                      <Camera className="h-3 w-3" />
                                    </div>
                                  </label>
                                )}
                              </div>
                              {item.requiresNote && (
                                <Input
                                  placeholder="عدد / ملاحظة"
                                  value={responses[item.id]?.notes || ""}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    updateItemNotes(item.id, e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-6 text-xs text-center mt-1 w-full"
                                  data-testid={`notes-${item.id}`}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

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

                <div className="flex gap-4">
                  <Button
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    onClick={completeChecklist}
                    disabled={progressPercentage < 100 || completeShiftMutation.isPending}
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>التوقيع الإلكتروني</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-2">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={200}
                  className="w-full cursor-crosshair bg-white rounded"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  data-testid="canvas-signature"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={clearSignature} className="flex-1" data-testid="btn-clear-signature">
                  مسح
                </Button>
                <Button onClick={saveSignature} className="flex-1 bg-green-600 hover:bg-green-700" data-testid="btn-save-signature">
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
