import { useState, useMemo, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutGrid, Plus, Trash2, Save, GripVertical, User as UserIcon, Square,
  Crown, Shield, Calculator, Coffee, ChefHat, Utensils, Sparkles,
  Handshake, Package, Cake, HardHat, Wine, Soup, Sun, Sunset, Moon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Branch } from "@shared/schema";

interface BranchEmployee {
  id: number;
  branchId: string;
  employeeName: string;
  jobTitle: string;
  department?: string | null;
  status?: string;
}
type ShiftType = "morning" | "evening" | "night";
const SHIFTS: { value: ShiftType; label: string; icon: any; color: string }[] = [
  { value: "morning", label: "صباحي", icon: Sun,    color: "#f59e0b" },
  { value: "evening", label: "مسائي", icon: Sunset, color: "#f97316" },
  { value: "night",   label: "ليلي",  icon: Moon,   color: "#6366f1" },
];

interface FloorPlanData {
  plan: { id: number; branchId: string; name: string | null; width: number; height: number; backgroundColor: string };
  zones: Array<{ id: number; name: string; color: string; x: number; y: number; width: number; height: number }>;
  assignments: Array<{ id: number; employeeId: number; role: string | null; notes: string | null; x: number; y: number; shiftType: ShiftType }>;
  employees: BranchEmployee[];
  shiftType: ShiftType;
}

const ZONE_COLORS = [
  { name: "أصفر", value: "#fde68a" },
  { name: "أزرق", value: "#bfdbfe" },
  { name: "أخضر", value: "#bbf7d0" },
  { name: "وردي", value: "#fbcfe8" },
  { name: "بنفسجي", value: "#ddd6fe" },
  { name: "برتقالي", value: "#fed7aa" },
  { name: "رمادي", value: "#e5e7eb" },
];

type RoleShape = "circle" | "square" | "hexagon";
type RoleDef = { label: string; icon: any; color: string; shape: RoleShape };

const ROLE_DEFS: Record<string, RoleDef> = {
  "مدير الفرع":   { label: "مدير الفرع",  icon: Crown,      color: "#7c3aed", shape: "hexagon" },
  "مشرف":         { label: "مشرف",        icon: Shield,     color: "#0ea5e9", shape: "hexagon" },
  "كاشير":        { label: "كاشير",       icon: Calculator, color: "#059669", shape: "circle"  },
  "ويتر":         { label: "ويتر",        icon: Utensils,   color: "#d97706", shape: "circle"  },
  "شيف":          { label: "شيف",         icon: ChefHat,    color: "#dc2626", shape: "square"  },
  "مساعد شيف":    { label: "مساعد شيف",   icon: Soup,       color: "#f97316", shape: "square"  },
  "باريستا":      { label: "باريستا",     icon: Coffee,     color: "#92400e", shape: "circle"  },
  "عامل نظافة":   { label: "عامل نظافة",  icon: Sparkles,   color: "#64748b", shape: "circle"  },
  "مضيف":         { label: "مضيف",        icon: Handshake,  color: "#0891b2", shape: "circle"  },
  "أمين مخزن":    { label: "أمين مخزن",   icon: Package,    color: "#475569", shape: "square"  },
  "حلواني":       { label: "حلواني",      icon: Cake,       color: "#ec4899", shape: "square"  },
  "عامل":         { label: "عامل",        icon: HardHat,    color: "#a16207", shape: "circle"  },
  "ساقي":         { label: "ساقي",        icon: Wine,       color: "#9333ea", shape: "circle"  },
};
const COMMON_ROLES = Object.keys(ROLE_DEFS);
const DEFAULT_ROLE: RoleDef = { label: "موظف", icon: UserIcon, color: "#3b82f6", shape: "circle" };
const getRoleDef = (role?: string | null, jobTitle?: string | null): RoleDef => {
  if (role && ROLE_DEFS[role]) return ROLE_DEFS[role];
  if (jobTitle && ROLE_DEFS[jobTitle]) return ROLE_DEFS[jobTitle];
  return DEFAULT_ROLE;
};
const shapeStyle = (shape: RoleShape): React.CSSProperties => {
  if (shape === "circle")  return { borderRadius: "50%" };
  if (shape === "square")  return { borderRadius: 10 };
  // hexagon
  return { clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)", borderRadius: 0 };
};

export default function FloorPlanPage() {
  const { activeBranch, allowedBranches, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Branch selection
  const { data: allBranches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });
  const branches = useMemo(
    () => isAdmin ? allBranches : allBranches.filter(b => allowedBranches.some(ub => ub.branchId === b.id)),
    [allBranches, allowedBranches, isAdmin]
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<ShiftType>("morning");
  // Close stale dialogs when switching shifts so an edit/assign action can't
  // land on the wrong shift's row.
  useEffect(() => {
    setAssignDialog(null);
    setEditAssignDialog(null);
  }, [selectedShift]);
  useEffect(() => {
    if (!selectedBranchId && (activeBranch?.id || branches[0]?.id)) {
      setSelectedBranchId(activeBranch?.id || branches[0].id);
    }
  }, [activeBranch, branches, selectedBranchId]);

  // Floor plan bundle (per shift)
  const { data, isLoading } = useQuery<FloorPlanData>({
    queryKey: [`/api/floor-plans/${selectedBranchId}`, selectedShift],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/floor-plans/${selectedBranchId}?shift=${selectedShift}`);
      return res.json();
    },
    enabled: !!selectedBranchId,
  });

  // Dialogs state
  const [zoneDialog, setZoneDialog] = useState<{ mode: "create" | "edit"; x?: number; y?: number; id?: number; name?: string; color?: string; width?: number; height?: number } | null>(null);
  // Live resize transient state — overrides server dims while user drags a handle
  const [resizing, setResizing] = useState<{ id: number; width: number; height: number } | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ x: number; y: number; employeeId?: number } | null>(null);
  const [editAssignDialog, setEditAssignDialog] = useState<{ id: number; employeeName: string; role: string; notes: string } | null>(null);

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/floor-plans/${selectedBranchId}`, selectedShift] });

  const createZone = useMutation({
    mutationFn: async (body: any) => (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/zones`, body)).json(),
    onSuccess: () => { invalidate(); setZoneDialog(null); toast({ title: "تمت إضافة المنطقة" }); },
    onError: (e: any) => toast({ title: "فشل إضافة المنطقة", description: e?.message, variant: "destructive" }),
  });
  const updateZone = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) =>
      (await apiRequest("PATCH", `/api/floor-plans/${selectedBranchId}/zones/${id}`, body)).json(),
    onSuccess: () => { invalidate(); setZoneDialog(null); },
    onError: (e: any) => toast({ title: "فشل التحديث", description: e?.message, variant: "destructive" }),
  });
  const deleteZone = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/zones/${id}`)).json(),
    onSuccess: () => { invalidate(); setZoneDialog(null); toast({ title: "تم حذف المنطقة" }); },
  });

  const createAssignment = useMutation({
    mutationFn: async (body: any) =>
      (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/assignments`, { ...body, shiftType: selectedShift })).json(),
    onSuccess: () => { invalidate(); setAssignDialog(null); toast({ title: "تم تعيين الموظف" }); },
    onError: (e: any) => toast({ title: "فشل التعيين", description: e?.message, variant: "destructive" }),
  });
  const updateAssignment = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) =>
      (await apiRequest("PATCH", `/api/floor-plans/${selectedBranchId}/assignments/${id}`, { ...body, shiftType: selectedShift })).json(),
    onSuccess: () => { invalidate(); setEditAssignDialog(null); },
    onError: (e: any) => toast({ title: "فشل التحديث", description: e?.message, variant: "destructive" }),
  });
  const deleteAssignment = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/assignments/${id}?shift=${selectedShift}`)).json(),
    onSuccess: () => { invalidate(); setEditAssignDialog(null); toast({ title: "تم إزالة الموظف من المخطط" }); },
  });

  // ---- Drag & Drop helpers ----
  const getCanvasCoords = (e: React.DragEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.round((e as any).clientX - rect.left)),
      y: Math.max(0, Math.round((e as any).clientY - rect.top)),
    };
  };

  const onDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const employeeIdStr = e.dataTransfer.getData("application/x-employee-id");
    const moveAssignIdStr = e.dataTransfer.getData("application/x-assignment-id");
    const moveZoneIdStr = e.dataTransfer.getData("application/x-zone-id");
    const { x, y } = getCanvasCoords(e);
    if (employeeIdStr) {
      const employeeId = parseInt(employeeIdStr, 10);
      const existing = data?.assignments.find(a => a.employeeId === employeeId);
      if (existing) {
        updateAssignment.mutate({ id: existing.id, body: { x, y } });
      } else {
        setAssignDialog({ x, y, employeeId });
      }
    } else if (moveAssignIdStr) {
      const id = parseInt(moveAssignIdStr, 10);
      const dx = parseInt(e.dataTransfer.getData("x-offset") || "0", 10);
      const dy = parseInt(e.dataTransfer.getData("y-offset") || "0", 10);
      updateAssignment.mutate({ id, body: { x: Math.max(0, x - dx), y: Math.max(0, y - dy) } });
    } else if (moveZoneIdStr) {
      const id = parseInt(moveZoneIdStr, 10);
      const dx = parseInt(e.dataTransfer.getData("x-offset") || "0", 10);
      const dy = parseInt(e.dataTransfer.getData("y-offset") || "0", 10);
      updateZone.mutate({ id, body: { x: Math.max(0, x - dx), y: Math.max(0, y - dy) } });
    }
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // only blank canvas clicks (not on a zone/pawn)
    if (unplacedEmployees.length === 0) return;
    const { x, y } = getCanvasCoords(e);
    setAssignDialog({ x, y });
  };

  // ---- Zone resize by dragging a handle ----
  const startResize = (
    e: React.MouseEvent,
    zoneId: number,
    startW: number,
    startH: number,
    dir: "br" | "r" | "b",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let w = startW, h = startH;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (dir === "br" || dir === "r") w = Math.max(60, Math.round(startW + dx));
      if (dir === "br" || dir === "b") h = Math.max(60, Math.round(startH + dy));
      setResizing({ id: zoneId, width: w, height: h });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (w !== startW || h !== startH) {
        updateZone.mutate({ id: zoneId, body: { width: w, height: h } });
      }
      setResizing(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Employees that are NOT yet placed on the plan
  const placedEmployeeIds = new Set((data?.assignments || []).map(a => a.employeeId));
  const unplacedEmployees = (data?.employees || []).filter(e => !placedEmployeeIds.has(e.id));
  const employeeById = useMemo(() => {
    const m = new Map<number, BranchEmployee>();
    (data?.employees || []).forEach(e => m.set(e.id, e));
    return m;
  }, [data]);

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-4" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutGrid className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">مخطط أرضية الفرع</h1>
              <p className="text-sm text-muted-foreground">وزّع فريق العمل على مناطق الفرع بشكل مرئي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="branch-sel" className="text-sm whitespace-nowrap">الفرع:</Label>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger id="branch-sel" className="w-56" data-testid="select-branch">
                <SelectValue placeholder="اختر فرع" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id} data-testid={`select-branch-${b.id}`}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Shift selector tabs */}
        {selectedBranchId && (
          <Card>
            <CardContent className="p-3">
              <Tabs value={selectedShift} onValueChange={(v) => setSelectedShift(v as ShiftType)} dir="rtl">
                <TabsList className="grid grid-cols-3 w-full max-w-xl">
                  {SHIFTS.map(s => {
                    const SI = s.icon;
                    return (
                      <TabsTrigger key={s.value} value={s.value} data-testid={`tab-shift-${s.value}`} className="gap-2">
                        <SI className="w-4 h-4" style={{ color: s.color }} />
                        <span>شفت {s.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {!selectedBranchId ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">اختر فرعاً للبدء</CardContent></Card>
        ) : isLoading || !data ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">جارٍ التحميل...</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Square className="w-4 h-4" /> الأدوات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start" variant="outline" onClick={() => setZoneDialog({ mode: "create" })} data-testid="btn-add-zone">
                    <Plus className="w-4 h-4 ml-1" /> إضافة منطقة
                  </Button>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    اسحب موظفاً من الأسفل وأفلته على المخطط، أو اسحب المنطقة/الموظف لتحريكه، واضغط عليه لتعديله.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    موظفو الشفت {SHIFTS.find(s => s.value === selectedShift)?.label}
                    <Badge variant="secondary" className="ms-auto" data-testid="badge-unplaced-count">{unplacedEmployees.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[520px]">
                    <div className="p-3 space-y-1.5">
                      {unplacedEmployees.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-6">
                          {data.employees.length === 0 ? "لا يوجد موظفون نشطون بهذا الفرع" : `جميع الموظفين موزَّعون في شفت ${SHIFTS.find(s => s.value === selectedShift)?.label}`}
                        </div>
                      ) : unplacedEmployees.map(emp => {
                        const def = getRoleDef(null, emp.jobTitle);
                        const RoleIcon = def.icon;
                        return (
                        <div
                          key={emp.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/x-employee-id", String(emp.id));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className="flex items-center gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent hover:border-primary cursor-grab active:cursor-grabbing transition-colors"
                          data-testid={`employee-pill-${emp.id}`}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div
                            className="w-8 h-8 flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}
                          >
                            <RoleIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{emp.employeeName}</div>
                            <div className="text-xs text-muted-foreground truncate">{emp.jobTitle}</div>
                          </div>
                        </div>
                      );})}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Role legend */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">دليل الأشكال</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_ROLES.map(r => {
                      const def = ROLE_DEFS[r]; const RI = def.icon;
                      return (
                        <div key={r} className="flex items-center gap-2 text-xs">
                          <div className="w-7 h-7 flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}>
                            <RI className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate">{def.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Canvas */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">المخطط</CardTitle>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {data.plan.width} × {data.plan.height}  ·  المناطق: {data.zones.length}  ·  المعيَّنون: {data.assignments.length}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto bg-muted/30">
                  <div
                    ref={canvasRef}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={onDropOnCanvas}
                    onClick={onCanvasClick}
                    className="relative"
                    style={{
                      width: data.plan.width,
                      height: data.plan.height,
                      backgroundColor: data.plan.backgroundColor || "#f8fafc",
                      backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
                      backgroundSize: "40px 40px",
                    }}
                    data-testid="floor-plan-canvas"
                  >
                    {/* Zones */}
                    {data.zones.map(z => {
                      const liveW = resizing?.id === z.id ? resizing.width : z.width;
                      const liveH = resizing?.id === z.id ? resizing.height : z.height;
                      return (
                      <div
                        key={z.id}
                        draggable
                        onDragStart={(e) => {
                          if ((e.target as HTMLElement).dataset?.resize === "1") { e.preventDefault(); return; }
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          e.dataTransfer.setData("application/x-zone-id", String(z.id));
                          e.dataTransfer.setData("x-offset", String(Math.round(e.clientX - rect.left)));
                          e.dataTransfer.setData("y-offset", String(Math.round(e.clientY - rect.top)));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if ((e.target as HTMLElement).dataset?.resize === "1") return;
                          setZoneDialog({ mode: "edit", id: z.id, name: z.name, color: z.color, width: z.width, height: z.height });
                        }}
                        className="absolute rounded-lg border-2 border-dashed cursor-grab active:cursor-grabbing flex items-start justify-start p-2 shadow-sm hover:shadow-md hover:border-solid transition-shadow"
                        style={{
                          left: z.x, top: z.y, width: liveW, height: liveH,
                          backgroundColor: z.color + "cc", borderColor: z.color,
                        }}
                        data-testid={`zone-${z.id}`}
                      >
                        <span className="text-xs font-semibold text-foreground/80 bg-white/70 px-1.5 py-0.5 rounded">{z.name}</span>
                        {resizing?.id === z.id && (
                          <span className="absolute top-1 right-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded tabular-nums">
                            {liveW} × {liveH}
                          </span>
                        )}
                        {/* Resize handles — bottom-right (free), right (width), bottom (height) */}
                        <div
                          data-resize="1"
                          onMouseDown={(e) => startResize(e, z.id, z.width, z.height, "br")}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute -bottom-1 -right-1 w-4 h-4 bg-white border-2 border-primary rounded-sm cursor-nwse-resize shadow z-20"
                          style={{ touchAction: "none" }}
                          data-testid={`zone-resize-br-${z.id}`}
                        />
                        <div
                          data-resize="1"
                          onMouseDown={(e) => startResize(e, z.id, z.width, z.height, "r")}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-1/2 -right-1 -translate-y-1/2 w-3 h-6 bg-white border-2 border-primary rounded-sm cursor-ew-resize shadow z-20"
                          style={{ touchAction: "none" }}
                          data-testid={`zone-resize-r-${z.id}`}
                        />
                        <div
                          data-resize="1"
                          onMouseDown={(e) => startResize(e, z.id, z.width, z.height, "b")}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-3 w-6 bg-white border-2 border-primary rounded-sm cursor-ns-resize shadow z-20"
                          style={{ touchAction: "none" }}
                          data-testid={`zone-resize-b-${z.id}`}
                        />
                      </div>
                    );})}

                    {/* Assignments (employee pawns) */}
                    {data.assignments.map(a => {
                      const emp = employeeById.get(a.employeeId);
                      if (!emp) return null;
                      const def = getRoleDef(a.role, emp.jobTitle);
                      const RoleIcon = def.icon;
                      return (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            e.dataTransfer.setData("application/x-assignment-id", String(a.id));
                            e.dataTransfer.setData("x-offset", String(Math.round(e.clientX - rect.left)));
                            e.dataTransfer.setData("y-offset", String(Math.round(e.clientY - rect.top)));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditAssignDialog({
                              id: a.id, employeeName: emp.employeeName,
                              role: a.role || emp.jobTitle || "", notes: a.notes || "",
                            });
                          }}
                          className="absolute z-10 flex flex-col items-center cursor-grab active:cursor-grabbing group"
                          style={{ left: a.x - 30, top: a.y - 30 }}
                          data-testid={`assignment-${a.id}`}
                          title={`${emp.employeeName} — ${def.label}`}
                        >
                          <div
                            className="w-16 h-16 text-white flex items-center justify-center shadow-lg border-4 border-white group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}
                          >
                            <RoleIcon className="w-7 h-7" />
                          </div>
                          <div className="mt-1 px-2 py-0.5 rounded-md bg-white/95 shadow text-[11px] font-medium text-center max-w-[130px] truncate">
                            {emp.employeeName}
                          </div>
                          <div
                            className="mt-0.5 text-[10px] text-white px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: def.color }}
                          >
                            {def.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Zone Dialog (create + edit) */}
        <Dialog open={!!zoneDialog} onOpenChange={(o) => { if (!o) setZoneDialog(null); }}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>{zoneDialog?.mode === "edit" ? "تعديل منطقة" : "إضافة منطقة"}</DialogTitle>
              <DialogDescription>المنطقة عبارة عن مستطيل ملوّن يمثّل قسماً في الفرع (مطبخ، صالة، باريستا...).</DialogDescription>
            </DialogHeader>
            <ZoneForm
              key={zoneDialog?.id ?? "new"}
              initial={zoneDialog || undefined}
              isEdit={zoneDialog?.mode === "edit"}
              onSubmit={(form) => {
                if (zoneDialog?.mode === "edit" && zoneDialog.id) {
                  updateZone.mutate({ id: zoneDialog.id, body: { name: form.name, color: form.color, width: form.width, height: form.height } });
                } else {
                  createZone.mutate({ name: form.name, color: form.color, x: zoneDialog?.x ?? 60, y: zoneDialog?.y ?? 60, width: form.width, height: form.height });
                }
              }}
              onDelete={zoneDialog?.mode === "edit" && zoneDialog.id ? () => deleteZone.mutate(zoneDialog.id!) : undefined}
              pending={createZone.isPending || updateZone.isPending || deleteZone.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Assign Dialog (place employee at click point) */}
        <Dialog open={!!assignDialog} onOpenChange={(o) => { if (!o) setAssignDialog(null); }}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>تعيين موظف</DialogTitle>
              <DialogDescription>اختر الموظف والوظيفة في هذا الموقع.</DialogDescription>
            </DialogHeader>
            <AssignForm
              employees={unplacedEmployees}
              presetEmployeeId={assignDialog?.employeeId}
              onSubmit={(form) => createAssignment.mutate({ ...form, x: assignDialog?.x, y: assignDialog?.y })}
              pending={createAssignment.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Edit existing assignment */}
        <Dialog open={!!editAssignDialog} onOpenChange={(o) => { if (!o) setEditAssignDialog(null); }}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>تعديل تعيين {editAssignDialog?.employeeName}</DialogTitle>
            </DialogHeader>
            {editAssignDialog && (
              <div className="space-y-3">
                <div>
                  <Label className="mb-1 block">الوظيفة في هذا الشِفت</Label>
                  <Select
                    value={editAssignDialog.role}
                    onValueChange={(v) => setEditAssignDialog({ ...editAssignDialog, role: v })}
                  >
                    <SelectTrigger data-testid="select-role-edit"><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      {COMMON_ROLES.map(r => {
                        const d = ROLE_DEFS[r]; const RI = d.icon;
                        return (
                          <SelectItem key={r} value={r}>
                            <span className="inline-flex items-center gap-2">
                              <span className="w-5 h-5 flex items-center justify-center text-white" style={{ backgroundColor: d.color, ...shapeStyle(d.shape) }}>
                                <RI className="w-3 h-3" />
                              </span>
                              {r}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">ملاحظة</Label>
                  <Input
                    value={editAssignDialog.notes}
                    onChange={(e) => setEditAssignDialog({ ...editAssignDialog, notes: e.target.value })}
                    placeholder="اختياري"
                    data-testid="input-notes-edit"
                  />
                </div>
                <DialogFooter className="flex-row-reverse gap-2 sm:gap-2 sm:justify-between">
                  <Button
                    variant="destructive"
                    onClick={() => deleteAssignment.mutate(editAssignDialog.id)}
                    disabled={deleteAssignment.isPending}
                    data-testid="btn-remove-assignment"
                  >
                    <Trash2 className="w-4 h-4 ml-1" /> إزالة من المخطط
                  </Button>
                  <Button
                    onClick={() => updateAssignment.mutate({ id: editAssignDialog.id, body: { role: editAssignDialog.role, notes: editAssignDialog.notes } })}
                    disabled={updateAssignment.isPending}
                    data-testid="btn-save-assignment"
                  >
                    <Save className="w-4 h-4 ml-1" /> حفظ
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function ZoneForm({ initial, isEdit, onSubmit, onDelete, pending }: {
  initial?: { name?: string; color?: string; width?: number; height?: number };
  isEdit?: boolean;
  onSubmit: (f: { name: string; color: string; width: number; height: number }) => void;
  onDelete?: () => void;
  pending?: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || ZONE_COLORS[0].value);
  const [width, setWidth] = useState(initial?.width ?? 220);
  const [height, setHeight] = useState(initial?.height ?? 160);
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1 block">اسم المنطقة</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثل: المطبخ، الصالة، الكاشير..." data-testid="input-zone-name" />
      </div>
      <div>
        <Label className="mb-1 block">اللون</Label>
        <div className="flex flex-wrap gap-2">
          {ZONE_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`w-9 h-9 rounded-full border-2 transition-transform ${color === c.value ? "border-primary scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c.value }}
              title={c.name}
              data-testid={`color-${c.value.replace("#","")}`}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="mb-1 block">العرض</Label>
          <Input type="number" value={width} onChange={e => setWidth(Math.max(60, parseInt(e.target.value) || 60))} data-testid="input-zone-width" />
        </div>
        <div><Label className="mb-1 block">الارتفاع</Label>
          <Input type="number" value={height} onChange={e => setHeight(Math.max(60, parseInt(e.target.value) || 60))} data-testid="input-zone-height" />
        </div>
      </div>
      <DialogFooter className="flex-row-reverse gap-2 sm:gap-2 sm:justify-between">
        {onDelete && (
          <Button variant="destructive" onClick={onDelete} disabled={pending} data-testid="btn-delete-zone">
            <Trash2 className="w-4 h-4 ml-1" /> حذف
          </Button>
        )}
        <Button onClick={() => name.trim() && onSubmit({ name: name.trim(), color, width, height })} disabled={!name.trim() || pending} data-testid="btn-save-zone">
          <Save className="w-4 h-4 ml-1" /> حفظ
        </Button>
      </DialogFooter>
    </div>
  );
}

function AssignForm({ employees, presetEmployeeId, onSubmit, pending }: {
  employees: BranchEmployee[];
  presetEmployeeId?: number;
  onSubmit: (f: { employeeId: number; role: string; notes: string }) => void;
  pending?: boolean;
}) {
  const [employeeId, setEmployeeId] = useState<string>(presetEmployeeId ? String(presetEmployeeId) : "");
  const selectedEmp = employees.find(e => e.id === parseInt(employeeId, 10));
  const [role, setRole] = useState<string>("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (selectedEmp && !role) setRole(selectedEmp.jobTitle || ""); }, [selectedEmp, role]);

  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1 block">الموظف</Label>
        <Select value={employeeId} onValueChange={setEmployeeId} disabled={!!presetEmployeeId}>
          <SelectTrigger data-testid="select-employee-assign"><SelectValue placeholder="اختر موظفاً..." /></SelectTrigger>
          <SelectContent>
            {employees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1 block">الوظيفة في هذا الشِفت</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger data-testid="select-role-assign"><SelectValue placeholder="اختر..." /></SelectTrigger>
          <SelectContent>
            {COMMON_ROLES.map(r => {
              const d = ROLE_DEFS[r]; const RI = d.icon;
              return (
                <SelectItem key={r} value={r}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center text-white" style={{ backgroundColor: d.color, ...shapeStyle(d.shape) }}>
                      <RI className="w-3 h-3" />
                    </span>
                    {r}
                  </span>
                </SelectItem>
              );
            })}
            {selectedEmp?.jobTitle && !COMMON_ROLES.includes(selectedEmp.jobTitle) && (
              <SelectItem value={selectedEmp.jobTitle}>{selectedEmp.jobTitle}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1 block">ملاحظة (اختياري)</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="مثل: في صندوق الكاشير الأمامي" data-testid="input-notes-assign" />
      </div>
      <DialogFooter>
        <Button
          onClick={() => employeeId && onSubmit({ employeeId: parseInt(employeeId, 10), role, notes })}
          disabled={!employeeId || pending}
          data-testid="btn-confirm-assign"
        >
          <Save className="w-4 h-4 ml-1" /> تعيين الموظف
        </Button>
      </DialogFooter>
    </div>
  );
}
