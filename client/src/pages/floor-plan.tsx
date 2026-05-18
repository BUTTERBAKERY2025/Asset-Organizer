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
  assignments: Array<{ id: number; employeeId: number | null; role: string | null; notes: string | null; x: number; y: number; shiftType: ShiftType }>;
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

// مناطق جاهزة — تضاف بضغطة واحدة بأسماء وألوان مناسبة لمخبز/مقهى،
// وكل منطقة لها وظيفة افتراضية تُقترح تلقائياً عند سحب موظف داخلها.
type ZonePreset = {
  name: string;
  color: string;
  defaultRole: string | null;
  width: number;
  height: number;
};
const ZONE_PRESETS: ZonePreset[] = [
  { name: "بار القهوة",   color: "#fed7aa", defaultRole: "باريستا",    width: 220, height: 140 },
  { name: "بار البيكري",  color: "#fbcfe8", defaultRole: "حلواني",     width: 220, height: 140 },
  { name: "الكاشير",      color: "#bbf7d0", defaultRole: "كاشير",      width: 160, height: 120 },
  { name: "المطبخ",       color: "#fecaca", defaultRole: "شيف",        width: 260, height: 180 },
  { name: "صالة الطعام",  color: "#bfdbfe", defaultRole: "ويتر",       width: 320, height: 200 },
  { name: "الاستقبال",    color: "#a5f3fc", defaultRole: "مضيف",       width: 180, height: 120 },
  { name: "المخزن",       color: "#e5e7eb", defaultRole: "أمين مخزن",  width: 200, height: 140 },
  { name: "غرفة الموظفين", color: "#ddd6fe", defaultRole: null,        width: 180, height: 120 },
  { name: "النظافة",      color: "#cbd5e1", defaultRole: "عامل نظافة", width: 140, height: 100 },
  { name: "بار العصائر",  color: "#fde68a", defaultRole: "ساقي",       width: 200, height: 130 },
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
  const [assignDialog, setAssignDialog] = useState<{ x: number; y: number; employeeId?: number; suggestedRole?: string } | null>(null);
  const [editAssignDialog, setEditAssignDialog] = useState<{
    id: number; employeeId: number | null; employeeName: string | null;
    role: string; notes: string;
  } | null>(null);
  // Role placement mode: when set, the next canvas click drops an empty slot of this role
  const [placementRole, setPlacementRole] = useState<string | null>(null);
  // Exit placement mode on Escape
  useEffect(() => {
    if (!placementRole) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPlacementRole(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementRole]);
  // Clear placement mode on shift switch
  useEffect(() => { setPlacementRole(null); }, [selectedShift]);

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
        return;
      }
      // Dropped on top of (or near) an empty role slot? → fill the NEAREST one
      // instead of opening a dialog. Tight radius avoids accidental fills.
      const HIT_RADIUS = 36;
      const targetSlot = emptySlots
        .map(s => ({ s, d: Math.hypot(s.x - x, s.y - y) }))
        .filter(({ d }) => d <= HIT_RADIUS)
        .sort((a, b) => a.d - b.d)[0]?.s;
      if (targetSlot) {
        updateAssignment.mutate({ id: targetSlot.id, body: { employeeId } });
        return;
      }
      // Otherwise open the dialog with a role suggestion based on the zone
      const zone = (data?.zones || []).find(z =>
        x >= z.x && x <= z.x + z.width && y >= z.y && y <= z.y + z.height
      );
      const preset = zone ? ZONE_PRESETS.find(p => p.name === zone.name) : undefined;
      setAssignDialog({ x, y, employeeId, suggestedRole: preset?.defaultRole || undefined });
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
    const { x, y } = getCanvasCoords(e);
    // Role placement mode — drop a new empty slot of the chosen role at this point
    if (placementRole) {
      createAssignment.mutate({ role: placementRole, x, y, employeeId: null });
      return; // stay in placement mode so user can drop several quickly
    }
    if (unplacedEmployees.length === 0) return;
    const zone = (data?.zones || []).find(z =>
      x >= z.x && x <= z.x + z.width && y >= z.y && y <= z.y + z.height
    );
    const preset = zone ? ZONE_PRESETS.find(p => p.name === zone.name) : undefined;
    setAssignDialog({ x, y, suggestedRole: preset?.defaultRole || undefined });
  };

  // Find next free top-left slot for a preset zone — simple cascading offset
  const nextZoneSlot = (w: number, h: number) => {
    const existing = data?.zones || [];
    const planW = data?.plan?.width || 1200;
    const planH = data?.plan?.height || 700;
    let x = 20, y = 20;
    for (let i = 0; i < 50; i++) {
      const collides = existing.some(z =>
        x < z.x + z.width && x + w > z.x && y < z.y + z.height && y + h > z.y
      );
      if (!collides && x + w <= planW && y + h <= planH) return { x, y };
      x += 40; y += 30;
      if (x + w > planW) { x = 20; y += 60; }
      if (y + h > planH) { x = 20; y = 20; break; }
    }
    return { x: 20, y: 20 };
  };

  const addPresetZone = (preset: ZonePreset) => {
    const { x, y } = nextZoneSlot(preset.width, preset.height);
    createZone.mutate({ name: preset.name, color: preset.color, x, y, width: preset.width, height: preset.height });
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
  const placedEmployeeIds = new Set(
    (data?.assignments || []).map(a => a.employeeId).filter((id): id is number => id != null)
  );
  const unplacedEmployees = (data?.employees || []).filter(e => !placedEmployeeIds.has(e.id));
  // Empty role slots (no employee yet) for this shift — useful for stats and drag-to-fill
  const emptySlots = (data?.assignments || []).filter(a => a.employeeId == null);
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
              {/* PRIMARY: Role palette — distribute the plan by role first, assign people later */}
              <Card className={placementRole ? "border-primary ring-2 ring-primary/30" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserIcon className="w-4 h-4" /> لوحة الوظائف
                    {placementRole && (
                      <Badge variant="default" className="ms-auto text-[10px]" data-testid="badge-placement-active">
                        وضع الإضافة
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    اختر وظيفة ثم اضغط على المخطط لإضافة موقع شاغر لها. كرّر الضغط لإضافة عدة مواقع. اضغط Esc للخروج.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {COMMON_ROLES.map(r => {
                      const def = ROLE_DEFS[r]; const RI = def.icon;
                      const active = placementRole === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setPlacementRole(active ? null : r)}
                          data-testid={`btn-role-${r}`}
                          className={`flex items-center gap-2 p-1.5 rounded-md border text-right transition-colors ${
                            active
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card hover:bg-accent hover:border-primary"
                          }`}
                          title={`إضافة موقع: ${def.label}`}
                        >
                          <span
                            className="w-7 h-7 flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}
                          >
                            <RI className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-xs truncate flex-1">{def.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {placementRole && (
                    <Button
                      variant="outline" size="sm" className="w-full"
                      onClick={() => setPlacementRole(null)}
                      data-testid="btn-cancel-placement"
                    >
                      إنهاء وضع الإضافة (Esc)
                    </Button>
                  )}
                  <Button className="w-full justify-start" variant="ghost" size="sm" onClick={() => setZoneDialog({ mode: "create" })} data-testid="btn-add-zone">
                    <Plus className="w-4 h-4 ml-1" /> إضافة منطقة مخصصة
                  </Button>
                </CardContent>
              </Card>

              {/* Preset zones — one-click bakery/cafe areas */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">مناطق جاهزة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {ZONE_PRESETS.map(preset => {
                    const def = preset.defaultRole ? ROLE_DEFS[preset.defaultRole] : null;
                    const PI = def?.icon;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => addPresetZone(preset)}
                        disabled={createZone.isPending}
                        data-testid={`btn-preset-${preset.name}`}
                        className="w-full flex items-center gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent hover:border-primary transition-colors text-right disabled:opacity-50"
                      >
                        <span
                          className="w-5 h-5 rounded shrink-0 border border-black/10"
                          style={{ backgroundColor: preset.color }}
                          aria-hidden
                        />
                        <span className="flex-1 text-sm truncate">{preset.name}</span>
                        {def && PI && (
                          <span
                            className="w-6 h-6 flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}
                            title={`الوظيفة الافتراضية: ${preset.defaultRole}`}
                          >
                            <PI className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    موظفون متاحون للتعيين
                    <Badge variant="secondary" className="ms-auto" data-testid="badge-unplaced-count">{unplacedEmployees.length}</Badge>
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    اسحب موظفاً وأفلته على موقع شاغر لملئه، أو على المخطط لإنشاء موقع جديد.
                  </p>
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

              {/* Plan summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ملخّص الشِفت</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">إجمالي المواقع</span>
                    <span className="font-semibold tabular-nums" data-testid="stat-total-slots">{data.assignments.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">مواقع مُعيَّنة</span>
                    <span className="font-semibold tabular-nums text-green-700" data-testid="stat-filled-slots">{data.assignments.length - emptySlots.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">مواقع شاغرة</span>
                    <span className="font-semibold tabular-nums text-amber-700" data-testid="stat-empty-slots">{emptySlots.length}</span>
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
                {placementRole && (() => {
                  const def = ROLE_DEFS[placementRole]; const PI = def.icon;
                  return (
                    <div
                      className="px-3 py-2 bg-primary/10 border-y border-primary/30 text-sm flex items-center gap-2"
                      data-testid="banner-placement-mode"
                    >
                      <span className="w-6 h-6 flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}>
                        <PI className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-medium">اضغط على المخطط لإضافة موقع: {def.label}</span>
                      <span className="text-xs text-muted-foreground">— كرّر للضغط لإضافة عدة مواقع. Esc للخروج.</span>
                      <button
                        type="button"
                        className="ms-auto text-xs text-primary hover:underline"
                        onClick={() => setPlacementRole(null)}
                        data-testid="btn-exit-placement-banner"
                      >إنهاء</button>
                    </div>
                  );
                })()}
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
                      cursor: placementRole ? "crosshair" : undefined,
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

                    {/* Role slots (with or without an assigned employee) */}
                    {data.assignments.map(a => {
                      const emp = a.employeeId != null ? employeeById.get(a.employeeId) : null;
                      const def = getRoleDef(a.role, emp?.jobTitle);
                      const RoleIcon = def.icon;
                      const isEmpty = !emp;
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
                              id: a.id,
                              employeeId: a.employeeId,
                              employeeName: emp?.employeeName ?? null,
                              role: a.role || emp?.jobTitle || "",
                              notes: a.notes || "",
                            });
                          }}
                          className="absolute z-10 flex flex-col items-center cursor-grab active:cursor-grabbing group"
                          style={{ left: a.x - 30, top: a.y - 30 }}
                          data-testid={`assignment-${a.id}`}
                          title={isEmpty ? `${def.label} — غير معيّن` : `${emp!.employeeName} — ${def.label}`}
                        >
                          <div
                            className="w-16 h-16 flex items-center justify-center shadow-lg border-4 group-hover:scale-110 transition-transform"
                            style={{
                              backgroundColor: isEmpty ? "#ffffff" : def.color,
                              color: isEmpty ? def.color : "#ffffff",
                              borderColor: isEmpty ? def.color : "#ffffff",
                              borderStyle: isEmpty ? "dashed" : "solid",
                              ...shapeStyle(def.shape),
                            }}
                          >
                            <RoleIcon className="w-7 h-7" />
                          </div>
                          <div className={`mt-1 px-2 py-0.5 rounded-md shadow text-[11px] font-medium text-center max-w-[130px] truncate ${isEmpty ? "bg-amber-50 text-amber-700 border border-amber-200 italic" : "bg-white/95"}`}>
                            {emp ? emp.employeeName : "غير معيّن — اضغط للتعيين"}
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
              suggestedRole={assignDialog?.suggestedRole}
              onSubmit={(form) => createAssignment.mutate({ ...form, x: assignDialog?.x, y: assignDialog?.y })}
              pending={createAssignment.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Edit existing slot: change role, assign/unassign employee, or delete */}
        <Dialog open={!!editAssignDialog} onOpenChange={(o) => { if (!o) setEditAssignDialog(null); }}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editAssignDialog?.employeeName
                  ? `تعديل موقع: ${editAssignDialog.employeeName}`
                  : "تعديل موقع شاغر"}
              </DialogTitle>
              <DialogDescription>
                {editAssignDialog?.employeeName
                  ? "غيّر الوظيفة، أو أزل الموظف ليصبح الموقع شاغراً، أو احذف الموقع كلياً."
                  : "اختر موظفاً لتعيينه على هذا الموقع، أو غيّر الوظيفة."}
              </DialogDescription>
            </DialogHeader>
            {editAssignDialog && (
              <div className="space-y-3">
                <div>
                  <Label className="mb-1 block">الوظيفة</Label>
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
                  <Label className="mb-1 block">الموظف المعيَّن</Label>
                  <Select
                    value={editAssignDialog.employeeId == null ? "__none__" : String(editAssignDialog.employeeId)}
                    onValueChange={(v) => setEditAssignDialog({
                      ...editAssignDialog,
                      employeeId: v === "__none__" ? null : parseInt(v, 10),
                    })}
                  >
                    <SelectTrigger data-testid="select-employee-edit"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-amber-700 italic">— موقع شاغر (بدون موظف) —</span>
                      </SelectItem>
                      {/* Currently-assigned employee (if any) should remain selectable */}
                      {editAssignDialog.employeeId != null && employeeById.get(editAssignDialog.employeeId) && (
                        <SelectItem value={String(editAssignDialog.employeeId)}>
                          {employeeById.get(editAssignDialog.employeeId)!.employeeName}
                          {" "}— {employeeById.get(editAssignDialog.employeeId)!.jobTitle}
                        </SelectItem>
                      )}
                      {unplacedEmployees.map(emp => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.employeeName} — {emp.jobTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    تغيير الموظف هنا لا يمنعك لاحقاً من سحب موظف آخر وإفلاته على هذا الموقع.
                  </p>
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
                    <Trash2 className="w-4 h-4 ml-1" /> حذف الموقع
                  </Button>
                  <Button
                    onClick={() => updateAssignment.mutate({
                      id: editAssignDialog.id,
                      body: {
                        role: editAssignDialog.role,
                        notes: editAssignDialog.notes,
                        employeeId: editAssignDialog.employeeId, // null = unassign
                      },
                    })}
                    disabled={updateAssignment.isPending || !editAssignDialog.role}
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

function AssignForm({ employees, presetEmployeeId, suggestedRole, onSubmit, pending }: {
  employees: BranchEmployee[];
  presetEmployeeId?: number;
  suggestedRole?: string;
  onSubmit: (f: { employeeId: number; role: string; notes: string }) => void;
  pending?: boolean;
}) {
  const [employeeId, setEmployeeId] = useState<string>(presetEmployeeId ? String(presetEmployeeId) : "");
  const selectedEmp = employees.find(e => e.id === parseInt(employeeId, 10));
  // If the user dropped on a zone with a known default role, pre-fill it,
  // otherwise fall back to the employee's job title.
  const [role, setRole] = useState<string>(suggestedRole || "");
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
