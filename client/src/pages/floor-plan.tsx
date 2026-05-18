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
  Handshake, Package, Cake, HardHat, Wine, Soup, Sun, Sunset, Moon, RotateCw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ZoomIn, ZoomOut, Maximize2, Lock, Unlock, Magnet, Grid3x3, Search, Pencil, MousePointer2 } from "lucide-react";
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
  zones: Array<{ id: number; name: string; color: string; x: number; y: number; width: number; height: number; rotation: number }>;
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
  const [zoneDialog, setZoneDialog] = useState<{ mode: "create" | "edit"; x?: number; y?: number; id?: number; name?: string; color?: string; width?: number; height?: number; rotation?: number } | null>(null);
  // Live resize transient state — overrides server dims while user drags a handle
  const [resizing, setResizing] = useState<{ id: number; x: number; y: number; width: number; height: number } | null>(null);
  // Live rotation transient state — overrides server rotation while user drags the rotation handle
  const [rotating, setRotating] = useState<{ id: number; rotation: number } | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ x: number; y: number; employeeId?: number; suggestedRole?: string } | null>(null);
  const [editAssignDialog, setEditAssignDialog] = useState<{
    id: number; employeeId: number | null; employeeName: string | null;
    role: string; notes: string;
  } | null>(null);
  // Role placement mode: when set, the next canvas click drops an empty slot of this role
  const [placementRole, setPlacementRole] = useState<string | null>(null);
  // Canvas controls — toolbar state
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapGrid, setSnapGrid] = useState(false);
  const [locked, setLocked] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"roles" | "zones" | "employees">("roles");
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const GRID_SIZE = 10;
  const snap = (n: number) => snapGrid ? Math.round(n / GRID_SIZE) * GRID_SIZE : Math.round(n);
  const setZoomClamped = (z: number) => setZoom(Math.min(2, Math.max(0.25, Math.round(z * 100) / 100)));
  const fitToView = () => {
    if (!canvasWrapRef.current || !data) return;
    const avail = canvasWrapRef.current.clientWidth - 16;
    setZoomClamped(avail / data.plan.width);
  };
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
  const updatePlan = useMutation({
    mutationFn: async (body: any) =>
      (await apiRequest("PUT", `/api/floor-plans/${selectedBranchId}`, body)).json(),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "فشل تحديث المخطط", description: e?.message, variant: "destructive" }),
  });

  // ---- Drag & Drop helpers ----
  // Canvas may be CSS-scaled (zoom). `getBoundingClientRect()` returns the
  // already-scaled rect, so we divide by `zoom` to recover plan coordinates.
  const getCanvasCoords = (e: React.DragEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e as any).clientX - rect.left) / zoom;
    const y = ((e as any).clientY - rect.top) / zoom;
    return { x: Math.max(0, snap(x)), y: Math.max(0, snap(y)) };
  };

  // Rotation-aware hit test — inverse-rotates the point into the zone's local
  // frame before checking the axis-aligned rectangle.
  const pointInZone = (px: number, py: number, z: { x: number; y: number; width: number; height: number; rotation?: number }) => {
    const cx = z.x + z.width / 2;
    const cy = z.y + z.height / 2;
    const r = ((z.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(-r), sin = Math.sin(-r);
    const dx = px - cx, dy = py - cy;
    const lx = dx * cos - dy * sin + z.width / 2;
    const ly = dx * sin + dy * cos + z.height / 2;
    return lx >= 0 && lx <= z.width && ly >= 0 && ly <= z.height;
  };

  const onDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const employeeIdStr = e.dataTransfer.getData("application/x-employee-id");
    const moveAssignIdStr = e.dataTransfer.getData("application/x-assignment-id");
    const moveZoneIdStr = e.dataTransfer.getData("application/x-zone-id");
    const newRoleName = e.dataTransfer.getData("application/x-role-name");
    const { x, y } = getCanvasCoords(e);
    // Dragged a role chip from the sidebar → create an empty slot of that role
    // at the drop point. Single-action add, no extra click needed.
    if (newRoleName) {
      createAssignment.mutate({ role: newRoleName, x: snap(x), y: snap(y), employeeId: null });
      return;
    }
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
      const zone = (data?.zones || []).find(z => pointInZone(x, y, z));
      const preset = zone ? ZONE_PRESETS.find(p => p.name === zone.name) : undefined;
      setAssignDialog({ x, y, employeeId, suggestedRole: preset?.defaultRole || undefined });
    } else if (moveAssignIdStr) {
      if (locked) return;
      const id = parseInt(moveAssignIdStr, 10);
      const dx = parseFloat(e.dataTransfer.getData("x-offset") || "0");
      const dy = parseFloat(e.dataTransfer.getData("y-offset") || "0");
      updateAssignment.mutate({ id, body: { x: Math.max(0, snap(x - dx)), y: Math.max(0, snap(y - dy)) } });
    } else if (moveZoneIdStr) {
      if (locked) return;
      const id = parseInt(moveZoneIdStr, 10);
      // dx/dy = cursor offset from the zone's CENTER (rotation pivot) at drag-start,
      // in plan coordinates. Stays glued to the visual grab point regardless of rotation.
      const dx = parseFloat(e.dataTransfer.getData("x-offset") || "0");
      const dy = parseFloat(e.dataTransfer.getData("y-offset") || "0");
      const z = data?.zones.find(zz => zz.id === id);
      if (!z) return;
      const newCx = x - dx;
      const newCy = y - dy;
      const newX = Math.max(0, snap(newCx - z.width / 2));
      const newY = Math.max(0, snap(newCy - z.height / 2));
      updateZone.mutate({ id, body: { x: newX, y: newY } });
    }
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // only blank canvas clicks (not on a zone/pawn)
    // Role placement mode — drop a new empty slot of the chosen role at this point.
    // This is the ONLY case where a click on the blank canvas creates something.
    // Outside of placement mode we do nothing, so users can click freely without
    // popping the assignment dialog unexpectedly.
    if (placementRole) {
      const { x, y } = getCanvasCoords(e);
      createAssignment.mutate({ role: placementRole, x: snap(x), y: snap(y), employeeId: null });
    }
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

  // ---- Zone resize by dragging any of 8 handles ----
  // dir contains any of t/b/l/r letters (e.g. "br" = bottom-right corner, "l" = left edge, "tl" = top-left corner)
  const startResize = (
    e: React.MouseEvent,
    zoneId: number,
    startX: number,
    startY: number,
    startW: number,
    startH: number,
    dir: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const mx = e.clientX, my = e.clientY;
    let x = startX, y = startY, w = startW, h = startH;
    const MIN = 60;
    const onMove = (ev: MouseEvent) => {
      // Convert screen-pixel delta to plan-coordinate delta when zoomed
      const dx = (ev.clientX - mx) / zoom;
      const dy = (ev.clientY - my) / zoom;
      if (dir.includes("r")) w = Math.max(MIN, snap(startW + dx));
      if (dir.includes("l")) {
        const nw = Math.max(MIN, snap(startW - dx));
        x = Math.max(0, snap(startX + (startW - nw)));
        w = nw;
      }
      if (dir.includes("b")) h = Math.max(MIN, snap(startH + dy));
      if (dir.includes("t")) {
        const nh = Math.max(MIN, snap(startH - dy));
        y = Math.max(0, snap(startY + (startH - nh)));
        h = nh;
      }
      setResizing({ id: zoneId, x, y, width: w, height: h });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const body: any = {};
      if (w !== startW) body.width = w;
      if (h !== startH) body.height = h;
      if (x !== startX) body.x = x;
      if (y !== startY) body.y = y;
      if (Object.keys(body).length) updateZone.mutate({ id: zoneId, body });
      setResizing(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ---- Zone rotation by dragging the rotation handle ----
  // Computes the angle from the zone's visual center to the cursor; Shift snaps to 15°.
  const startRotate = (
    e: React.MouseEvent,
    zoneId: number,
    startRotation: number,
    zoneEl: HTMLElement,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = zoneEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startMouseAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    let rot = startRotation;
    const onMove = (ev: MouseEvent) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      let delta = ((a - startMouseAngle) * 180) / Math.PI;
      let next = startRotation + delta;
      if (ev.shiftKey) next = Math.round(next / 15) * 15;
      else next = Math.round(next);
      // Normalize to (-180, 180]
      next = ((next % 360) + 360) % 360;
      if (next > 180) next -= 360;
      rot = next;
      setRotating({ id: zoneId, rotation: rot });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (rot !== startRotation) updateZone.mutate({ id: zoneId, body: { rotation: rot } });
      setRotating(null);
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
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
            {/* Sidebar — tabbed to keep the page compact */}
            <Card className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
              {/* Live shift summary (always visible) */}
              <div className="p-3 border-b bg-muted/40">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground">المواقع</div>
                    <div className="text-base font-bold tabular-nums" data-testid="stat-total-slots">{data.assignments.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">مُعيَّنة</div>
                    <div className="text-base font-bold tabular-nums text-green-700" data-testid="stat-filled-slots">{data.assignments.length - emptySlots.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">شاغرة</div>
                    <div className="text-base font-bold tabular-nums text-amber-700" data-testid="stat-empty-slots">{emptySlots.length}</div>
                  </div>
                </div>
                {data.assignments.length > 0 && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2" title="نسبة الإشغال">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${Math.round(((data.assignments.length - emptySlots.length) / data.assignments.length) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} dir="rtl" className="flex flex-col flex-1 overflow-hidden">
                <TabsList className="grid grid-cols-3 mx-2 mt-2">
                  <TabsTrigger value="roles" data-testid="tab-sidebar-roles" className="text-xs">الوظائف</TabsTrigger>
                  <TabsTrigger value="zones" data-testid="tab-sidebar-zones" className="text-xs">المناطق</TabsTrigger>
                  <TabsTrigger value="employees" data-testid="tab-sidebar-employees" className="text-xs gap-1">
                    الموظفون
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums" data-testid="badge-unplaced-count">{unplacedEmployees.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                {/* Roles tab */}
                <TabsContent value="roles" className="flex-1 overflow-auto m-0 p-3 space-y-2">
                  <div className={`rounded-md border p-2 ${placementRole ? "border-primary bg-primary/5" : "border-transparent"}`}>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                      اسحب الوظيفة وأفلتها على المخطط مباشرة، أو اضغط ثم اختر مكاناً. Esc للخروج.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {COMMON_ROLES.map(r => {
                        const def = ROLE_DEFS[r]; const RI = def.icon;
                        const active = placementRole === r;
                        return (
                          <div
                            key={r}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/x-role-name", r);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => setPlacementRole(active ? null : r)}
                            data-testid={`btn-role-${r}`}
                            className={`flex items-center gap-1.5 p-1.5 rounded-md border text-right transition-colors cursor-grab active:cursor-grabbing select-none ${
                              active ? "border-primary bg-primary/10 ring-1 ring-primary"
                                     : "border-border bg-card hover:bg-accent hover:border-primary"
                            }`}
                            title={`اسحب على المخطط أو اضغط ثم اختر موقعاً — ${def.label}`}
                          >
                            <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="w-6 h-6 flex items-center justify-center text-white shrink-0"
                              style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}>
                              <RI className="w-3 h-3" />
                            </span>
                            <span className="text-[11px] truncate flex-1">{def.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    {placementRole && (
                      <Button variant="outline" size="sm" className="w-full mt-2 h-7 text-xs"
                        onClick={() => setPlacementRole(null)} data-testid="btn-cancel-placement">
                        إنهاء وضع الإضافة (Esc)
                      </Button>
                    )}
                  </div>
                  <Separator />
                  <Button className="w-full justify-start" variant="outline" size="sm"
                    onClick={() => setZoneDialog({ mode: "create" })} data-testid="btn-add-zone">
                    <Plus className="w-4 h-4 ml-1" /> إضافة منطقة مخصصة
                  </Button>
                </TabsContent>

                {/* Zones tab — preset bakery/cafe areas */}
                <TabsContent value="zones" className="flex-1 overflow-auto m-0 p-3 space-y-1.5">
                  <p className="text-[11px] text-muted-foreground mb-1">
                    اضغط لإضافة منطقة جاهزة بألوان وأبعاد مناسبة. يمكنك تحريكها، تكبيرها، أو تدويرها بعد الإضافة.
                  </p>
                  {ZONE_PRESETS.map(preset => {
                    const def = preset.defaultRole ? ROLE_DEFS[preset.defaultRole] : null;
                    const PI = def?.icon;
                    return (
                      <button
                        key={preset.name} type="button" onClick={() => addPresetZone(preset)}
                        disabled={createZone.isPending} data-testid={`btn-preset-${preset.name}`}
                        className="w-full flex items-center gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent hover:border-primary transition-colors text-right disabled:opacity-50"
                      >
                        <span className="w-5 h-5 rounded shrink-0 border border-black/10"
                          style={{ backgroundColor: preset.color }} aria-hidden />
                        <span className="flex-1 text-sm truncate">{preset.name}</span>
                        {def && PI && (
                          <span className="w-6 h-6 flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}
                            title={`الوظيفة الافتراضية: ${preset.defaultRole}`}>
                            <PI className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </TabsContent>

                {/* Employees tab — searchable + draggable */}
                <TabsContent value="employees" className="flex-1 overflow-hidden m-0 flex flex-col">
                  <div className="p-3 pb-2 space-y-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      اسحب موظفاً وأفلته على موقع شاغر لملئه، أو على المخطط لإنشاء موقع جديد.
                    </p>
                    <div className="relative">
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                        placeholder="ابحث بالاسم أو الوظيفة..." className="h-8 pr-8 text-sm"
                        data-testid="input-employee-search"
                      />
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="px-3 pb-3 space-y-1.5">
                      {(() => {
                        const q = empSearch.trim().toLowerCase();
                        const filtered = q
                          ? unplacedEmployees.filter(e =>
                              e.employeeName.toLowerCase().includes(q) ||
                              (e.jobTitle || "").toLowerCase().includes(q))
                          : unplacedEmployees;
                        if (filtered.length === 0) {
                          return (
                            <div className="text-center text-xs text-muted-foreground py-6">
                              {data.employees.length === 0
                                ? "لا يوجد موظفون نشطون بهذا الفرع"
                                : q ? "لا نتائج مطابقة للبحث"
                                    : `جميع الموظفين موزَّعون في شفت ${SHIFTS.find(s => s.value === selectedShift)?.label}`}
                            </div>
                          );
                        }
                        return filtered.map(emp => {
                          const def = getRoleDef(null, emp.jobTitle);
                          const RoleIcon = def.icon;
                          return (
                            <div key={emp.id} draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("application/x-employee-id", String(emp.id));
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              className="flex items-center gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent hover:border-primary cursor-grab active:cursor-grabbing transition-colors"
                              data-testid={`employee-pill-${emp.id}`}
                            >
                              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="w-8 h-8 flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}>
                                <RoleIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{emp.employeeName}</div>
                                <div className="text-xs text-muted-foreground truncate">{emp.jobTitle}</div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </Card>

            {/* Canvas */}
            <Card className="overflow-hidden">
              {/* Sticky toolbar — zoom, grid, snap, lock, plan size */}
              <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b p-2 flex flex-wrap items-center gap-2">
                {/* Zoom group */}
                <div className="flex items-center gap-1 rounded-md border bg-card p-0.5">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoomClamped(zoom - 0.1)} title="تصغير" data-testid="btn-zoom-out">
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <button type="button" onClick={() => setZoomClamped(1)} className="text-xs font-medium tabular-nums w-12 text-center hover:bg-accent rounded" title="إعادة 100%" data-testid="btn-zoom-reset">
                    {Math.round(zoom * 100)}%
                  </button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoomClamped(zoom + 0.1)} title="تكبير" data-testid="btn-zoom-in">
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fitToView} title="ملاءمة الشاشة" data-testid="btn-zoom-fit">
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-3 rounded-md border bg-card px-2 py-1">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="إظهار/إخفاء الشبكة">
                    <Grid3x3 className="w-3.5 h-3.5 text-muted-foreground" />
                    <Switch checked={showGrid} onCheckedChange={setShowGrid} data-testid="switch-grid" className="scale-75" />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer" title={`المحاذاة لشبكة ${GRID_SIZE} بكسل`}>
                    <Magnet className="w-3.5 h-3.5 text-muted-foreground" />
                    <Switch checked={snapGrid} onCheckedChange={setSnapGrid} data-testid="switch-snap" className="scale-75" />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="قفل التحريك والتكبير">
                    {locked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-muted-foreground" />}
                    <Switch checked={locked} onCheckedChange={setLocked} data-testid="switch-lock" className="scale-75" />
                  </label>
                </div>

                {/* Plan size editor */}
                <div className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">
                  <span className="text-muted-foreground">المقاس:</span>
                  <Input
                    type="number" value={data.plan.width} min={400} max={4000} step={20}
                    onBlur={(e) => {
                      const w = parseInt(e.target.value, 10);
                      if (!isNaN(w) && w !== data.plan.width) updatePlan.mutate({ width: Math.max(400, Math.min(4000, w)) });
                    }}
                    defaultValue={data.plan.width}
                    key={`w-${data.plan.id}-${data.plan.width}`}
                    className="h-6 w-16 px-1 text-xs tabular-nums"
                    data-testid="input-plan-width"
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    type="number" min={300} max={4000} step={20}
                    onBlur={(e) => {
                      const h = parseInt(e.target.value, 10);
                      if (!isNaN(h) && h !== data.plan.height) updatePlan.mutate({ height: Math.max(300, Math.min(4000, h)) });
                    }}
                    defaultValue={data.plan.height}
                    key={`h-${data.plan.id}-${data.plan.height}`}
                    className="h-6 w-16 px-1 text-xs tabular-nums"
                    data-testid="input-plan-height"
                  />
                </div>

                {/* Stats badge — always visible at-a-glance */}
                <Badge variant="outline" className="ms-auto text-[11px] tabular-nums gap-1.5" data-testid="badge-canvas-stats">
                  <span className="text-muted-foreground">المناطق</span> <span className="font-semibold">{data.zones.length}</span>
                  <Separator orientation="vertical" className="h-3 mx-1" />
                  <span className="text-green-700 font-semibold">{data.assignments.length - emptySlots.length}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="font-semibold">{data.assignments.length}</span>
                </Badge>
              </div>

              <CardContent className="p-0">
                {placementRole && (() => {
                  const def = ROLE_DEFS[placementRole]; const PI = def.icon;
                  return (
                    <div className="px-3 py-2 bg-primary/10 border-b border-primary/30 text-sm flex items-center gap-2"
                      data-testid="banner-placement-mode">
                      <span className="w-6 h-6 flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}>
                        <PI className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-medium">اضغط على المخطط لإضافة موقع: {def.label}</span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">— كرّر للضغط لإضافة عدة مواقع. Esc للخروج.</span>
                      <button type="button" className="ms-auto text-xs text-primary hover:underline"
                        onClick={() => setPlacementRole(null)} data-testid="btn-exit-placement-banner">إنهاء</button>
                    </div>
                  );
                })()}
                {locked && (
                  <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5" /> المخطط مقفول — لا يمكن التحريك أو التكبير أو التدوير. أوقف القفل للتعديل.
                  </div>
                )}
                {!locked && !placementRole && (
                  <div className="px-3 py-1.5 bg-muted/40 border-b text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1" data-testid="banner-canvas-help">
                    <span className="flex items-center gap-1"><MousePointer2 className="w-3.5 h-3.5" /> اسحب لتحريك المنطقة أو الموظف</span>
                    <span className="flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> نقرة مزدوجة أو أيقونة القلم للتعديل</span>
                    <span className="hidden sm:flex items-center gap-1 text-amber-700">• المواقع الشاغرة تُفتح بنقرة واحدة للتعيين</span>
                  </div>
                )}
                <div ref={canvasWrapRef} className="overflow-auto bg-muted/30">
                  {/* Zoom wrapper — the scaled canvas occupies its scaled dimensions so scroll bars match */}
                  <div style={{ width: data.plan.width * zoom, height: data.plan.height * zoom }}>
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
                      backgroundImage: showGrid
                        ? `linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)`
                        : undefined,
                      backgroundSize: showGrid ? (snapGrid ? `${GRID_SIZE * 4}px ${GRID_SIZE * 4}px` : "40px 40px") : undefined,
                      cursor: placementRole ? "crosshair" : undefined,
                      transform: `scale(${zoom})`,
                      transformOrigin: "top right",
                    }}
                    data-testid="floor-plan-canvas"
                  >
                    {/* Zones */}
                    {data.zones.map(z => {
                      const liveX = resizing?.id === z.id ? resizing.x : z.x;
                      const liveY = resizing?.id === z.id ? resizing.y : z.y;
                      const liveW = resizing?.id === z.id ? resizing.width : z.width;
                      const liveH = resizing?.id === z.id ? resizing.height : z.height;
                      const liveR = rotating?.id === z.id ? rotating.rotation : (z.rotation || 0);
                      // 8 resize handles + 1 rotation handle. dir uses t/b/l/r letters.
                      const handles: Array<{ dir: string; cls: string; cursor: string; size: string }> = [
                        { dir: "tl", cls: "-top-1 -left-1", cursor: "nwse-resize", size: "w-4 h-4" },
                        { dir: "tr", cls: "-top-1 -right-1", cursor: "nesw-resize", size: "w-4 h-4" },
                        { dir: "bl", cls: "-bottom-1 -left-1", cursor: "nesw-resize", size: "w-4 h-4" },
                        { dir: "br", cls: "-bottom-1 -right-1", cursor: "nwse-resize", size: "w-4 h-4" },
                        { dir: "t",  cls: "-top-1 left-1/2 -translate-x-1/2", cursor: "ns-resize", size: "w-6 h-3" },
                        { dir: "b",  cls: "-bottom-1 left-1/2 -translate-x-1/2", cursor: "ns-resize", size: "w-6 h-3" },
                        { dir: "l",  cls: "top-1/2 -left-1 -translate-y-1/2", cursor: "ew-resize", size: "w-3 h-6" },
                        { dir: "r",  cls: "top-1/2 -right-1 -translate-y-1/2", cursor: "ew-resize", size: "w-3 h-6" },
                      ];
                      return (
                      <div
                        key={z.id}
                        draggable={!locked}
                        onDragStart={(e) => {
                          if (locked) { e.preventDefault(); return; }
                          if ((e.target as HTMLElement).dataset?.resize === "1") { e.preventDefault(); return; }
                          // Offset from the zone's CENTER (rotation pivot), captured in
                          // PLAN coordinates (divide by zoom). Stays glued to the visual
                          // grab point regardless of rotation or zoom level.
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const cx = rect.left + rect.width / 2;
                          const cy = rect.top + rect.height / 2;
                          e.dataTransfer.setData("application/x-zone-id", String(z.id));
                          e.dataTransfer.setData("x-offset", String((e.clientX - cx) / zoom));
                          e.dataTransfer.setData("y-offset", String((e.clientY - cy) / zoom));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (locked) return;
                          if ((e.target as HTMLElement).dataset?.resize === "1") return;
                          setZoneDialog({ mode: "edit", id: z.id, name: z.name, color: z.color, width: z.width, height: z.height, rotation: z.rotation || 0 });
                        }}
                        className="absolute rounded-lg border-2 border-dashed cursor-grab active:cursor-grabbing flex items-start justify-start p-2 shadow-sm hover:shadow-md hover:border-solid transition-shadow group/zone"
                        style={{
                          left: liveX, top: liveY, width: liveW, height: liveH,
                          backgroundColor: z.color + "cc", borderColor: z.color,
                          transform: liveR ? `rotate(${liveR}deg)` : undefined,
                          transformOrigin: "center center",
                        }}
                        data-testid={`zone-${z.id}`}
                      >
                        <span
                          className="text-xs font-semibold text-foreground/80 bg-white/70 px-1.5 py-0.5 rounded"
                          // Counter-rotate the label so the zone name stays readable when rotated
                          style={liveR ? { transform: `rotate(${-liveR}deg)`, transformOrigin: "top left" } : undefined}
                        >{z.name}</span>
                        {/* Quick-edit pencil — appears on hover for one-click edit access */}
                        {!locked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoneDialog({ mode: "edit", id: z.id, name: z.name, color: z.color, width: z.width, height: z.height, rotation: z.rotation || 0 });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="absolute top-1 left-1 w-6 h-6 rounded-md bg-white/90 hover:bg-white text-foreground/70 hover:text-primary shadow flex items-center justify-center opacity-0 group-hover/zone:opacity-100 transition-opacity z-20"
                            style={liveR ? { transform: `rotate(${-liveR}deg)`, transformOrigin: "top left" } : undefined}
                            title="تعديل المنطقة"
                            data-testid={`btn-edit-zone-${z.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {(resizing?.id === z.id || rotating?.id === z.id) && (
                          <span className="absolute top-1 right-1 text-[10px] bg-black/80 text-white px-1.5 py-0.5 rounded tabular-nums shadow"
                            style={liveR ? { transform: `rotate(${-liveR}deg)`, transformOrigin: "top right" } : undefined}
                          >
                            {rotating?.id === z.id ? `${Math.round(liveR)}°` : `${liveW} × ${liveH}`}
                          </span>
                        )}
                        {/* 8 resize handles + rotation handle — hidden when locked */}
                        {!locked && handles.map(h => (
                          <div
                            key={h.dir}
                            data-resize="1"
                            onMouseDown={(e) => startResize(e, z.id, z.x, z.y, z.width, z.height, h.dir)}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute ${h.cls} ${h.size} bg-white border-2 border-primary rounded-sm shadow z-20`}
                            style={{ touchAction: "none", cursor: h.cursor }}
                            data-testid={`zone-resize-${h.dir}-${z.id}`}
                          />
                        ))}
                        {!locked && (
                          <>
                            <div
                              data-resize="1"
                              onMouseDown={(e) => startRotate(e, z.id, z.rotation || 0, e.currentTarget.parentElement as HTMLElement)}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 bg-primary text-white border-2 border-white rounded-full shadow z-20 flex items-center justify-center"
                              style={{ touchAction: "none", cursor: "grab" }}
                              title="اسحب للتدوير — اضغط Shift للقفز كل 15°"
                              data-testid={`zone-rotate-${z.id}`}
                            >
                              <RotateCw className="w-3 h-3" />
                            </div>
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-primary/60 z-10 pointer-events-none" />
                          </>
                        )}
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
                          draggable={!locked}
                          onDragStart={(e) => {
                            if (locked) { e.preventDefault(); return; }
                            // Capture offset in PLAN coordinates (account for zoom).
                            // Pill is centered at (a.x, a.y), drawn at (a.x-30, a.y-30).
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            e.dataTransfer.setData("application/x-assignment-id", String(a.id));
                            e.dataTransfer.setData("x-offset", String((e.clientX - rect.left) / zoom - 30));
                            e.dataTransfer.setData("y-offset", String((e.clientY - rect.top) / zoom - 30));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (locked) return;
                            // Empty slots open on a single click (quick-assign UX).
                            // Filled slots require double-click to avoid accidental
                            // dialogs while dragging/repositioning.
                            if (!isEmpty) return;
                            setEditAssignDialog({
                              id: a.id,
                              employeeId: a.employeeId,
                              employeeName: emp?.employeeName ?? null,
                              role: a.role || emp?.jobTitle || "",
                              notes: a.notes || "",
                            });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (locked) return;
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
                          {/* Quick-edit pencil — appears on hover, avoids needing a double-click */}
                          {!locked && !isEmpty && (
                            <button
                              type="button"
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
                              onMouseDown={(e) => e.stopPropagation()}
                              className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white text-primary shadow-md border border-border opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20"
                              title="تعديل الموظف"
                              data-testid={`btn-edit-assignment-${a.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
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
                  updateZone.mutate({ id: zoneDialog.id, body: { name: form.name, color: form.color, width: form.width, height: form.height, rotation: form.rotation } });
                } else {
                  createZone.mutate({ name: form.name, color: form.color, x: zoneDialog?.x ?? 60, y: zoneDialog?.y ?? 60, width: form.width, height: form.height, rotation: form.rotation });
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
  initial?: { name?: string; color?: string; width?: number; height?: number; rotation?: number };
  isEdit?: boolean;
  onSubmit: (f: { name: string; color: string; width: number; height: number; rotation: number }) => void;
  onDelete?: () => void;
  pending?: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || ZONE_COLORS[0].value);
  const [width, setWidth] = useState(initial?.width ?? 220);
  const [height, setHeight] = useState(initial?.height ?? 160);
  const [rotation, setRotation] = useState(initial?.rotation ?? 0);
  const normalizeRot = (r: number) => {
    let n = ((r % 360) + 360) % 360;
    if (n > 180) n -= 360;
    return n;
  };
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
      <div>
        <Label className="mb-1 block flex items-center gap-2">
          الدوران <span className="text-xs text-muted-foreground tabular-nums">({rotation}°)</span>
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number" value={rotation}
            onChange={e => setRotation(normalizeRot(parseInt(e.target.value) || 0))}
            className="w-24"
            data-testid="input-zone-rotation"
          />
          <div className="flex gap-1 flex-wrap">
            {[-90, -15, 0, 15, 90].map(d => (
              <Button
                key={d} type="button" variant="outline" size="sm"
                className="h-8 px-2 text-xs tabular-nums"
                onClick={() => setRotation(d === 0 ? 0 : normalizeRot(rotation + d))}
                data-testid={`btn-rotate-${d}`}
              >
                {d === 0 ? "تصفير" : `${d > 0 ? "+" : ""}${d}°`}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">يمكنك أيضاً سحب المقبض الدائري الأزرق فوق المنطقة. اضغط Shift أثناء السحب للقفز كل 15°.</p>
      </div>
      <DialogFooter className="flex-row-reverse gap-2 sm:gap-2 sm:justify-between">
        {onDelete && (
          <Button variant="destructive" onClick={onDelete} disabled={pending} data-testid="btn-delete-zone">
            <Trash2 className="w-4 h-4 ml-1" /> حذف
          </Button>
        )}
        <Button onClick={() => name.trim() && onSubmit({ name: name.trim(), color, width, height, rotation })} disabled={!name.trim() || pending} data-testid="btn-save-zone">
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
