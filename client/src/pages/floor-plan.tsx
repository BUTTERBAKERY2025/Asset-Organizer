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
  Handshake, Package, Cake, HardHat, ClipboardList, Soup, Sun, Sunset, Moon, RotateCw,
  Wand2, Copy as CopyIcon, AlertCircle, CheckCircle2, Users, Loader2, Calendar,
  Printer, Undo2, Redo2, Hand, X as XIcon,
  MessageCircle, History as HistoryIcon, Bookmark, BookmarkPlus, Send, Phone,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useReactToPrint } from "react-to-print";
import { ZoomIn, ZoomOut, Maximize2, Lock, Unlock, Magnet, Grid3x3, Search, Pencil, MousePointer2, ArrowUp, ArrowDown, FileDown, PanelLeft, PanelRight, Link2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
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
  // Multi-task links — drawn lines between two assignments in the same shift.
  // Indicates a shared/cross-functional role visually only.
  links?: Array<{ id: number; fromAssignmentId: number; toAssignmentId: number; label: string | null; color: string; shiftType: ShiftType }>;
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
  { name: "محطة التحضير", color: "#d9f99d", defaultRole: "محضر طلبات", width: 220, height: 140 },
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
  "محضر طلبات":   { label: "محضر طلبات",  icon: ClipboardList, color: "#16a34a", shape: "circle" },
};
const COMMON_ROLES = Object.keys(ROLE_DEFS);
const DEFAULT_ROLE: RoleDef = { label: "موظف", icon: UserIcon, color: "#3b82f6", shape: "circle" };
// Backwards-compat: legacy data may still contain removed/renamed role labels.
// Map them to the closest current role so historical assignments keep rendering
// with a proper person avatar instead of falling through to "موظف".
const LEGACY_ROLE_ALIASES: Record<string, string> = {
  "ساقي": "محضر طلبات",
};
const resolveRole = (key?: string | null) =>
  (key && (ROLE_DEFS[key] || ROLE_DEFS[LEGACY_ROLE_ALIASES[key]])) || null;
const getRoleDef = (role?: string | null, jobTitle?: string | null): RoleDef => {
  return resolveRole(role) || resolveRole(jobTitle) || DEFAULT_ROLE;
};
const shapeStyle = (shape: RoleShape): React.CSSProperties => {
  if (shape === "circle")  return { borderRadius: "50%" };
  if (shape === "square")  return { borderRadius: 10 };
  // hexagon
  return { clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)", borderRadius: 0 };
};

// Person-shaped avatar — draws a stylized person (head + shoulders/uniform)
// colored by the role, with the role's tool icon as a badge on the chest.
// Each job thus visually looks like a person doing that job.
function PersonAvatar({ def, size = 64, empty = false }: { def: RoleDef; size?: number; empty?: boolean }) {
  const Icon = def.icon;
  const skin = "#f4cfa5";
  const bodyColor = empty ? "#ffffff" : def.color;
  const outline = def.color;
  const badgeSize = Math.round(size * 0.36);
  return (
    <div style={{ width: size, height: size, position: "relative" }} aria-hidden>
      <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: "block" }}>
        {/* Shoulders / uniform — a soft rounded shoulder shape */}
        <path
          d="M4 60 C4 40, 20 34, 32 34 C44 34, 60 40, 60 60 Z"
          fill={bodyColor}
          stroke={outline}
          strokeWidth={empty ? 2 : 1.5}
          strokeDasharray={empty ? "4 3" : undefined}
        />
        {/* Neck */}
        <rect x="28" y="26" width="8" height="8" fill={skin} />
        {/* Head */}
        <circle cx="32" cy="20" r="11" fill={skin} stroke={outline} strokeWidth="1.5" />
        {/* Subtle hair cap */}
        <path d="M21.5 20 Q21.5 11 32 11 Q42.5 11 42.5 20 L40 17 Q32 13 24 17 Z" fill="#3f2a1d" opacity="0.85" />
      </svg>
      {/* Role tool badge — small white pill on the chest with the role's icon */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: Math.round(size * 0.06),
          width: badgeSize,
          height: badgeSize,
          marginLeft: -badgeSize / 2,
          borderRadius: "50%",
          background: "#ffffff",
          color: def.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          border: `1.5px solid ${def.color}`,
        }}
      >
        <Icon style={{ width: badgeSize * 0.6, height: badgeSize * 0.6 }} />
      </div>
    </div>
  );
}

// Printable view — extracted to a standalone component so the JSX stays readable
// and the fit-to-page math runs once per render. Scales the canvas to fit A4
// landscape in a single page.
function PrintableFloorPlan(props: {
  printRef: React.RefObject<HTMLDivElement>;
  data: any;
  branches: any[];
  selectedBranchId: string;
  selectedShift: string;
  selectedDate: string;
  employeeById: Map<number, any>;
  emptySlotsCount: number;
  getRoleDef: (role: string, jobTitle?: string) => any;
  shapeStyle: (s: any) => any;
}) {
  const { printRef, data, branches, selectedBranchId, selectedShift, selectedDate, employeeById, emptySlotsCount, getRoleDef } = props;
  const printLinks: any[] = data?.links || [];
  // A4 landscape printable area at 8mm margins ≈ 281×196mm → at 96dpi ≈ 1062×740px.
  // We use slightly conservative numbers to allow for browser rounding + root
  // padding (p-3 = 24px vertical), header (~58px) and footer (~36px).
  const PAGE_W = 1024;
  const PAGE_H = 696;
  const HEADER_H = 64;
  const FOOTER_H = 40;
  const ROOT_VPAD = 24;
  const planW = data?.plan?.width || 1;
  const planH = data?.plan?.height || 1;
  const availH = PAGE_H - HEADER_H - FOOTER_H - ROOT_VPAD;
  const scale = Math.min(PAGE_W / planW, availH / planH, 1);
  const branchName = branches?.find?.((b: any) => b.id === selectedBranchId)?.name ?? selectedBranchId;
  const shiftLabel = selectedShift === "morning" ? "صباحية" : selectedShift === "evening" ? "مسائية" : "ليلية";
  return (
    <div ref={printRef} className="fp-print-root p-3 bg-white text-black" dir="rtl" style={{ width: PAGE_W }}>
      <div className="mb-2 flex items-center justify-between border-b pb-2">
        <div>
          <h1 className="text-xl font-bold">مخطط الفرع — {branchName}</h1>
          <p className="text-xs text-gray-600 mt-0.5">التاريخ: {selectedDate} • الوردية: {shiftLabel}</p>
        </div>
        <div className="text-[10px] text-gray-500">طُبع في {new Date().toLocaleString("ar-SA")}</div>
      </div>
      {data && (
        <div className="fp-print-scale mx-auto" style={{ width: planW * scale, height: planH * scale }}>
          <div
            className="relative border border-gray-300"
            style={{
              width: planW, height: planH, backgroundColor: "#fafaf7",
              transform: `scale(${scale})`, transformOrigin: "top right",
            }}
          >
            {/* Zones — mirror the on-screen styling (rounded-lg, opacity, transform-origin center). */}
            {data.zones.map((z: any) => (
              <div
                key={z.id}
                className="absolute rounded-lg border-2 border-dashed flex items-start justify-start p-2 text-xs font-medium shadow-sm"
                style={{
                  left: z.x, top: z.y, width: z.width, height: z.height,
                  backgroundColor: z.color + "cc", borderColor: z.color,
                  transform: z.rotation ? `rotate(${z.rotation}deg)` : undefined,
                  transformOrigin: "center center",
                  color: "#1f2937",
                }}
              >
                {z.name}
              </div>
            ))}
            {/* Multi-task links — drawn under pawns just like the live canvas.
                Static (no animation) for clean print/PDF output. */}
            {printLinks.length > 0 && (
              <svg
                className="absolute inset-0"
                width={data.plan.width}
                height={data.plan.height}
                style={{ pointerEvents: "none", zIndex: 5, overflow: "visible" }}
              >
                <defs>
                  <linearGradient id="fp-link-grad-print" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                {printLinks.map((l: any) => {
                  const from = data.assignments.find((a: any) => a.id === l.fromAssignmentId);
                  const to = data.assignments.find((a: any) => a.id === l.toAssignmentId);
                  if (!from || !to) return null;
                  const dx = to.x - from.x, dy = to.y - from.y;
                  const len = Math.max(1, Math.hypot(dx, dy));
                  const bow = Math.min(60, Math.max(18, len * 0.14));
                  const nx = -dy / len, ny = dx / len;
                  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
                  const cx = mx + nx * bow, cy = my + ny * bow;
                  const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
                  const stroke = l.color || "url(#fp-link-grad-print)";
                  return (
                    <g key={l.id}>
                      <path d={d} fill="none" stroke={l.color || "#6366f1"} strokeWidth={7} opacity={0.15} strokeLinecap="round" />
                      <path d={d} fill="none" stroke={stroke} strokeWidth={2.5} strokeDasharray="7 5" strokeLinecap="round" opacity={0.95} />
                      <circle cx={from.x} cy={from.y} r={4} fill="#fff" stroke={l.color || "#6366f1"} strokeWidth={2} />
                      <circle cx={to.x}   cy={to.y}   r={4} fill="#fff" stroke={l.color || "#6366f1"} strokeWidth={2} />
                    </g>
                  );
                })}
              </svg>
            )}
            {/* Assignments — use the same PersonAvatar component as the on-screen
                canvas so PDF output matches the live view exactly. */}
            {data.assignments.map((a: any) => {
              const emp = a.employeeId != null ? employeeById.get(a.employeeId) : null;
              const def = getRoleDef(a.role, emp?.jobTitle);
              const isEmpty = !emp;
              return (
                <div
                  key={a.id}
                  className="absolute flex flex-col items-center"
                  style={{ left: a.x - 30, top: a.y - 30, zIndex: 10 + (a.zIndex ?? 0) }}
                >
                  <div className="drop-shadow">
                    <PersonAvatar def={def} size={64} empty={isEmpty} />
                  </div>
                  <div
                    className={`mt-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-center max-w-[130px] truncate ${
                      isEmpty
                        ? "bg-amber-50 text-amber-700 border border-amber-200 italic"
                        : "bg-white border border-gray-200 shadow-sm"
                    }`}
                  >
                    {emp ? emp.employeeName : "غير معيّن"}
                  </div>
                  <div
                    className="mt-0.5 text-[9px] text-white px-1.5 rounded"
                    style={{ backgroundColor: def.color }}
                  >
                    {def.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {data && (
        <div className="mt-2 text-[11px] grid grid-cols-3 gap-4 border-t pt-1.5">
          <div><span className="font-semibold">إجمالي المواقع:</span> {data.assignments.length}</div>
          <div><span className="font-semibold">معيّن:</span> {data.assignments.length - emptySlotsCount}</div>
          <div><span className="font-semibold">شاغر:</span> {emptySlotsCount}</div>
        </div>
      )}
    </div>
  );
}

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

  // Employees actually scheduled for this shift TODAY — pulled from the
  // existing schedule system. Used to (a) filter the sidebar to people who
  // will really be at work, and (b) flag scheduled employees who still need
  // a position. We treat an empty/erroring response as "no schedule data".
  // Date is computed in Saudi local time (Asia/Riyadh) so we don't query the
  // wrong day around UTC midnight — attendance/schedule data is keyed by the
  // Saudi-local calendar date.
  // User-selectable plan date (defaults to today in Riyadh). Used both as the
  // `date` param for the schedule query and as the contextual "for which day
  // am I planning?" label. While the user hasn't moved off today, we let it
  // roll forward at Riyadh midnight; once they manually pick a date we stop
  // auto-advancing so their choice sticks.
  const fmtRiyadhDate = (d: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const [todayRiyadh, setTodayRiyadh] = useState<string>(() => fmtRiyadhDate(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(todayRiyadh);
  const [isPinnedToToday, setIsPinnedToToday] = useState(true);
  useEffect(() => {
    const tick = () => {
      const next = fmtRiyadhDate(new Date());
      setTodayRiyadh(prev => (prev === next ? prev : next));
    };
    const id = window.setInterval(tick, 60_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  // Auto-advance selectedDate at midnight only when the user hasn't picked
  // a date manually.
  useEffect(() => {
    if (isPinnedToToday) setSelectedDate(todayRiyadh);
  }, [todayRiyadh, isPinnedToToday]);
  const { data: scheduledRaw = [] } = useQuery<any[]>({
    queryKey: [`/api/scheduled-employees-for-attendance`, selectedBranchId, selectedShift, selectedDate],
    queryFn: async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/scheduled-employees-for-attendance?branchId=${encodeURIComponent(selectedBranchId)}&shiftType=${selectedShift}&date=${selectedDate}`,
        );
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      } catch { return []; }
    },
    enabled: !!selectedBranchId,
    staleTime: 60_000,
  });
  // Resolve a schedule row to the underlying branch-employee numeric id used
  // by floor-plan assignments. The API's `id` field is the schedule row id —
  // NOT the employee id — so we must prefer `branchEmployeeId`, then parse
  // patterns like "branch_emp_123" from the string `employeeId`. We also
  // keep startTime/endTime around so the sidebar can show the real shift
  // window for each scheduled person ("07:00–15:00").
  type ScheduledInfo = { startTime?: string; endTime?: string };
  const scheduledMap = useMemo(() => {
    const m = new Map<number, ScheduledInfo>();
    for (const e of scheduledRaw as any[]) {
      let id: number | null = null;
      if (typeof e?.branchEmployeeId === "number" && e.branchEmployeeId > 0) {
        id = e.branchEmployeeId;
      } else if (typeof e?.employeeId === "string") {
        const mm = e.employeeId.match(/(?:branch_emp_|be_)(\d+)/);
        if (mm) id = Number(mm[1]);
        else if (/^\d+$/.test(e.employeeId)) id = Number(e.employeeId);
      } else if (typeof e?.employeeId === "number" && e.employeeId > 0) {
        id = e.employeeId;
      }
      if (id && Number.isFinite(id)) {
        // Merge duplicate rows for the same employee deterministically:
        // keep the earliest startTime and the latest endTime, so the badge
        // reflects the full window the employee is on-shift.
        const prev = m.get(id);
        const pickEarlier = (a?: string, b?: string) =>
          !a ? b : !b ? a : a.localeCompare(b) <= 0 ? a : b;
        const pickLater = (a?: string, b?: string) =>
          !a ? b : !b ? a : a.localeCompare(b) >= 0 ? a : b;
        m.set(id, {
          startTime: pickEarlier(prev?.startTime, e?.startTime),
          endTime: pickLater(prev?.endTime, e?.endTime),
        });
      }
    }
    return m;
  }, [scheduledRaw]);
  const scheduledIds = useMemo(() => new Set(scheduledMap.keys()), [scheduledMap]);

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

  // ----- Batch 3: Templates, WhatsApp share, History -----
  // Save-template dialog
  const [saveTplDialog, setSaveTplDialog] = useState<{ name: string; description: string; scope: "branch" | "global"; includeZones: boolean } | null>(null);
  // History side panel
  const [historyOpen, setHistoryOpen] = useState(false);
  // WhatsApp share dialog
  type WaRecipient = { phone: string; name: string };
  const [waDialog, setWaDialog] = useState<{ recipients: WaRecipient[]; message: string; channel: "whatsapp" | "sms" | "walink" } | null>(null);
  // Canvas controls — toolbar state
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapGrid, setSnapGrid] = useState(false);
  const [locked, setLocked] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"roles" | "zones" | "employees">("roles");
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  // Show only employees actually scheduled to work this shift today (pulled from
  // the schedule system). Reduces noise and prevents assigning someone on leave.
  const [scheduledOnly, setScheduledOnly] = useState(true);
  // Disables smart-tool buttons while a bulk distribute / copy / clear runs.
  const [smartBusy, setSmartBusy] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const GRID_SIZE = 10;
  const snap = (n: number) => snapGrid ? Math.round(n / GRID_SIZE) * GRID_SIZE : Math.round(n);
  const setZoomClamped = (z: number) => setZoom(Math.min(2, Math.max(0.25, Math.round(z * 100) / 100)));
  const fitToView = () => {
    if (!canvasWrapRef.current || !data) return;
    const avail = canvasWrapRef.current.clientWidth - 16;
    setZoomClamped(avail / data.plan.width);
  };

  // ---- Boundary clamping ----
  // Keeps an element inside the plan rectangle so it can't be lost off-canvas.
  // `margin` accounts for the visual size (half a pawn = 30px) so the element
  // body — not just its origin — stays visible.
  const clampToPlan = (x: number, y: number, margin = 30) => {
    const w = data?.plan?.width ?? 1200;
    const h = data?.plan?.height ?? 700;
    return {
      x: Math.max(margin, Math.min(w - margin, x)),
      y: Math.max(margin, Math.min(h - margin, y)),
    };
  };

  // ---- Undo / Redo history (assignment ops only — high-frequency surface) ----
  // Each entry stores enough info to fully invert AND replay the operation.
  // Create/delete carry a full snapshot so we can recreate after the original
  // row is gone, and we remap server-issued ids on each recreate so subsequent
  // undo/redo cycles target the correct row. Capped to 30 entries to bound
  // memory; older actions silently roll off.
  type AssignmentSnapshot = { role: string | null; x: number; y: number; employeeId: number | null; notes?: string | null };
  type HistoryOp =
    | { type: "create"; id: number; snapshot: AssignmentSnapshot }
    | { type: "delete"; id: number; snapshot: AssignmentSnapshot }
    | { type: "update"; id: number; prev: Record<string, any>; next: Record<string, any> };
  const undoStackRef = useRef<HistoryOp[]>([]);
  const redoStackRef = useRef<HistoryOp[]>([]);
  const [, forceHistoryRender] = useState(0);
  const bumpHistory = () => forceHistoryRender(n => n + 1);
  const recordOp = (op: HistoryOp) => {
    undoStackRef.current.push(op);
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
    redoStackRef.current = [];
    bumpHistory();
  };
  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  // ---- Touch drag (iPad / phone fallback) ----
  // HTML5 drag-and-drop doesn't fire on touch devices, so we run a parallel
  // pointer-based system. Only activates for `pointerType === "touch"` and
  // shows a finger-following ghost. On release we run the same drop logic
  // the desktop path uses.
  type TouchPayload =
    | { kind: "employee"; id: number; label: string }
    | { kind: "role"; name: string; label: string }
    | { kind: "assignment"; id: number; offX: number; offY: number; label: string }
    | { kind: "zone"; id: number; offX: number; offY: number; label: string };
  const touchDragRef = useRef<TouchPayload | null>(null);
  const [touchGhost, setTouchGhost] = useState<{ x: number; y: number; label: string } | null>(null);

  // ---- Multi-task linking state ----
  // `linkingFrom` is the source assignment id while the user is dragging a
  // link-line. `linkCursor` tracks the live pointer position in PLAN
  // coordinates so we can render the ghost line. Cleared on pointerup.
  const [linkingFrom, setLinkingFrom] = useState<number | null>(null);
  const [linkCursor, setLinkCursor] = useState<{ x: number; y: number } | null>(null);
  const [hoverLinkId, setHoverLinkId] = useState<number | null>(null);
  const beginLinkDrag = (assignmentId: number, e: React.PointerEvent) => {
    if (locked) return;
    e.stopPropagation();
    e.preventDefault();
    setLinkingFrom(assignmentId);
    // Initial cursor position in plan coords
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setLinkCursor({ x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
    }
  };
  useEffect(() => {
    if (linkingFrom == null) return;
    const onMove = (ev: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      setLinkCursor({ x: (ev.clientX - rect.left) / zoom, y: (ev.clientY - rect.top) / zoom });
    };
    const onUp = (ev: PointerEvent) => {
      // Find the assignment under the pointer (if any) by walking up from
      // the element at the drop point. Pawns expose data-assignment-id.
      const target = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const pawn = target?.closest?.("[data-assignment-id]") as HTMLElement | null;
      const toId = pawn ? parseInt(pawn.dataset.assignmentId || "", 10) : NaN;
      if (!isNaN(toId) && toId !== linkingFrom) {
        // Prevent duplicate pair (either direction) — server enforces it too
        const exists = (data?.links || []).some(l =>
          (l.fromAssignmentId === linkingFrom && l.toAssignmentId === toId) ||
          (l.fromAssignmentId === toId && l.toAssignmentId === linkingFrom));
        if (!exists) {
          createLink.mutate({ fromAssignmentId: linkingFrom, toAssignmentId: toId });
        } else {
          toast({ title: "هاتان البطاقتان مربوطتان بالفعل" });
        }
      }
      setLinkingFrom(null);
      setLinkCursor(null);
    };
    const onEsc = (ev: KeyboardEvent) => { if (ev.key === "Escape") { setLinkingFrom(null); setLinkCursor(null); } };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onEsc);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkingFrom, zoom, data?.links]);

  // ---- Print / PDF export ----
  // Uses react-to-print to capture the canvas + a header for a printable A4
  // landscape view. The browser's "Save as PDF" path then turns it into a PDF.
  const printableRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printableRef,
    documentTitle: `floor-plan-${selectedBranchId}-${selectedShift}-${selectedDate}`,
    // A4 landscape ≈ 297×210mm. With 10mm margins → ~277×190mm printable.
    // `.fp-print-scale` is a wrapper around the canvas that gets CSS scaled
    // to fit the page width exactly, then we wrap it in `.fp-print-frame`
    // sized to the scaled dimensions so the page break stays on one sheet.
    pageStyle: `
      @page { size: A4 landscape; margin: 8mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .fp-print-root { page-break-inside: avoid; break-inside: avoid; }
        .fp-print-scale { transform-origin: top right; page-break-inside: avoid; break-inside: avoid; }
      }
    `,
  });
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
  const queryKey = [`/api/floor-plans/${selectedBranchId}`, selectedShift];
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  // Optimistic cache patch — avoids a full refetch + page re-render on each
  // drag/resize/rotate. Use this for geometry-only updates that don't need
  // to round-trip through the server before showing.
  const patchCache = (patch: (d: any) => any) => {
    queryClient.setQueryData(queryKey, (old: any) => old ? patch(old) : old);
  };

  const createZone = useMutation({
    mutationFn: async (body: any) => (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/zones`, body)).json(),
    onSuccess: () => { invalidate(); setZoneDialog(null); toast({ title: "تمت إضافة المنطقة" }); },
    onError: (e: any) => toast({ title: "فشل إضافة المنطقة", description: e?.message, variant: "destructive" }),
  });
  const updateZone = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) =>
      (await apiRequest("PATCH", `/api/floor-plans/${selectedBranchId}/zones/${id}`, body)).json(),
    // Optimistic: patch the cache immediately so the UI doesn't wait for the
    // server. Snapshot the previous state in case we need to roll back.
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<any>(queryKey);
      patchCache(d => ({ ...d, zones: d.zones.map((z: any) => z.id === id ? { ...z, ...body } : z) }));
      return { prev };
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: "فشل التحديث", description: e?.message, variant: "destructive" });
    },
    onSuccess: () => { setZoneDialog(null); },
  });
  const deleteZone = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/zones/${id}`)).json(),
    onSuccess: () => { invalidate(); setZoneDialog(null); toast({ title: "تم حذف المنطقة" }); },
  });

  const createAssignment = useMutation({
    mutationFn: async (body: any) =>
      (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/assignments`, { ...body, shiftType: selectedShift })).json(),
    onSuccess: (data: any, variables: any) => {
      // Record the create in history so the user can Ctrl+Z an accidental
      // role-drop / placement-click / assign-dialog submit. The server-issued
      // id is captured here so subsequent undo→redo→undo cycles re-map cleanly.
      // Skip when `__noHistory` is set (used by undo/redo themselves to avoid
      // recursive history pollution — not currently set since doUndo bypasses
      // this mutation, but kept for future safety).
      if (data?.id && !variables?.__noHistory) {
        recordOp({
          type: "create",
          id: data.id,
          snapshot: {
            role: variables?.role ?? null,
            x: variables?.x ?? data.x,
            y: variables?.y ?? data.y,
            employeeId: variables?.employeeId ?? null,
            notes: variables?.notes ?? null,
          },
        });
      }
      invalidate();
      setAssignDialog(null); /* silent success — no toast for high-frequency drops */
    },
    onError: (e: any) => toast({ title: "فشل التعيين", description: e?.message, variant: "destructive" }),
  });
  const updateAssignment = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) =>
      (await apiRequest("PATCH", `/api/floor-plans/${selectedBranchId}/assignments/${id}`, { ...body, shiftType: selectedShift })).json(),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<any>(queryKey);
      patchCache(d => ({ ...d, assignments: d.assignments.map((a: any) => a.id === id ? { ...a, ...body } : a) }));
      return { prev };
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: "فشل التحديث", description: e?.message, variant: "destructive" });
    },
    onSuccess: () => { setEditAssignDialog(null); },
  });
  const deleteAssignment = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/assignments/${id}?shift=${selectedShift}`)).json(),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<any>(queryKey);
      patchCache(d => ({
        ...d,
        assignments: d.assignments.filter((a: any) => a.id !== id),
        // Drop any links touching the deleted pawn so the SVG doesn't
        // leave a dangling ghost line until the next refetch.
        links: (d.links || []).filter((l: any) => l.fromAssignmentId !== id && l.toAssignmentId !== id),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx: any) => { if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev); },
    onSuccess: () => { setEditAssignDialog(null); },
  });

  // ----- Multi-task Links (visual connections between two pawns) -----
  // Marks employees who cover multiple positions in the same shift. The line
  // is shift-scoped — switching to another shift hides it. Created by
  // dragging from one pawn's link handle to another pawn.
  const createLink = useMutation({
    mutationFn: async (body: { fromAssignmentId: number; toAssignmentId: number; label?: string | null }) =>
      (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/links`, { ...body, shiftType: selectedShift })).json(),
    onSuccess: () => { invalidate(); toast({ title: "تم ربط البطاقتين" }); },
    onError: (e: any) => toast({ title: "فشل الربط", description: e?.message, variant: "destructive" }),
  });
  const deleteLink = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/links/${id}`)).json(),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<any>(queryKey);
      patchCache(d => ({ ...d, links: (d.links || []).filter((l: any) => l.id !== id) }));
      return { prev };
    },
    onError: (_e, _v, ctx: any) => { if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev); },
    onSuccess: () => toast({ title: "تم حذف الربط" }),
  });
  const updatePlan = useMutation({
    mutationFn: async (body: any) =>
      (await apiRequest("PUT", `/api/floor-plans/${selectedBranchId}`, body)).json(),
    onMutate: async (body: any) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<any>(queryKey);
      patchCache(d => ({ ...d, plan: { ...d.plan, ...body } }));
      return { prev };
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: "فشل تحديث المخطط", description: e?.message, variant: "destructive" });
    },
  });

  // ============ Batch 3: Templates · WhatsApp · History ============
  // Templates list (scoped to current branch + globals).
  const templatesQueryKey = useMemo(() => ["/api/floor-plan-templates", selectedBranchId], [selectedBranchId]);
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: templatesQueryKey,
    queryFn: async () => (await apiRequest("GET", `/api/floor-plan-templates?branchId=${encodeURIComponent(selectedBranchId)}`)).json(),
    enabled: !!selectedBranchId,
    staleTime: 30_000,
  });

  // History (audit log) — lazy-loaded only while side panel is open.
  const historyQueryKey = useMemo(() => [`/api/floor-plans/${selectedBranchId}/history`], [selectedBranchId]);
  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = useQuery<any[]>({
    queryKey: historyQueryKey,
    queryFn: async () => (await apiRequest("GET", `/api/floor-plans/${selectedBranchId}/history?limit=80`)).json(),
    enabled: !!selectedBranchId && historyOpen,
    staleTime: 15_000,
  });

  // Build a template payload snapshot from the *current shift*.
  // We strip ids and employee bindings — templates are reusable layouts,
  // not assignments. Zones are optional (saveTplDialog.includeZones).
  const buildTemplatePayload = (includeZones: boolean) => {
    const assignments = (data?.assignments || []).map(a => ({
      role: a.role, x: a.x, y: a.y, notes: a.notes || null,
      zIndex: (a as any).zIndex ?? 0,
    }));
    // Omit the `zones` key entirely when not including zones — the server
    // treats key-absent as "preserve existing zones" (vs. empty array =
    // "explicitly clear"). See applyFloorPlanTemplate semantics.
    if (includeZones) {
      return {
        assignments,
        zones: (data?.zones || []).map(z => ({
          name: z.name, color: z.color, x: z.x, y: z.y,
          width: z.width, height: z.height, rotation: z.rotation || 0,
          zIndex: (z as any).zIndex ?? 0,
        })),
      };
    }
    return { assignments };
  };

  const saveTemplate = useMutation({
    mutationFn: async (body: { name: string; description?: string; scope: "branch" | "global"; includeZones: boolean }) => {
      const payload = buildTemplatePayload(body.includeZones);
      return (await apiRequest("POST", `/api/floor-plan-templates`, {
        name: body.name,
        description: body.description || null,
        branchId: body.scope === "branch" ? selectedBranchId : null,
        payload,
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesQueryKey });
      toast({ title: "تم حفظ القالب" });
      setSaveTplDialog(null);
    },
    onError: (e: any) => toast({ title: "فشل حفظ القالب", description: e?.message, variant: "destructive" }),
  });

  const applyTemplate = useMutation({
    mutationFn: async (templateId: number) =>
      (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/apply-template/${templateId}`, { shiftType: selectedShift })).json(),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
      toast({ title: "تم تطبيق القالب", description: `${r?.assignmentsAdded ?? 0} موقع${r?.zonesAdded ? ` + ${r.zonesAdded} منطقة` : ""}` });
    },
    onError: (e: any) => toast({ title: "فشل تطبيق القالب", description: e?.message, variant: "destructive" }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/floor-plan-templates/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesQueryKey });
      toast({ title: "تم حذف القالب" });
    },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e?.message, variant: "destructive" }),
  });

  // Build a readable Arabic message summarizing the current shift for
  // WhatsApp/SMS. Group employees by role; list empty slots at the bottom.
  const buildShareMessage = () => {
    if (!data) return "";
    const branchName = branches.find(b => b.id === selectedBranchId)?.name || "";
    const shiftLabel = SHIFTS.find(s => s.value === selectedShift)?.label || selectedShift;
    const empById = new Map((data.employees || []).map(e => [e.id, e]));
    const filled = data.assignments.filter(a => a.employeeId != null);
    const empty = data.assignments.filter(a => a.employeeId == null);
    const byRole = new Map<string, string[]>();
    for (const a of filled) {
      const e = empById.get(a.employeeId as number);
      const name = e?.fullName || e?.name || `موظف #${a.employeeId}`;
      const key = a.role || "—";
      if (!byRole.has(key)) byRole.set(key, []);
      byRole.get(key)!.push(name);
    }
    const lines: string[] = [];
    lines.push(`📋 توزيع المهام — ${branchName}`);
    lines.push(`🗓️ ${selectedDate} • ${shiftLabel}`);
    lines.push("");
    for (const [role, names] of byRole.entries()) {
      lines.push(`• ${role}: ${names.join("، ")}`);
    }
    if (empty.length) {
      lines.push("");
      lines.push(`⚠️ مواقع شاغرة (${empty.length}):`);
      const ec = new Map<string, number>();
      for (const a of empty) ec.set(a.role || "—", (ec.get(a.role || "—") || 0) + 1);
      for (const [role, n] of ec.entries()) lines.push(`  - ${role} × ${n}`);
    }
    lines.push("");
    lines.push(`— نظام إدارة باتر`);
    return lines.join("\n");
  };

  const sendWhatsApp = useMutation({
    mutationFn: async (body: { recipients: WaRecipient[]; message: string; channel: "whatsapp" | "sms" | "walink" }) => {
      // "walink" mode bypasses Twilio entirely and opens wa.me links in new
      // tabs — useful when the Twilio sandbox is restricted or recipients
      // haven't opted-in via "join {keyword}".
      if (body.channel === "walink") {
        const encoded = encodeURIComponent(body.message);
        let opened = 0;
        for (const r of body.recipients) {
          const digits = (r.phone || "").replace(/\D/g, "");
          if (!digits) continue;
          const url = `https://wa.me/${digits}?text=${encoded}`;
          const w = window.open(url, "_blank", "noopener");
          if (w) opened++;
        }
        const blocked = body.recipients.length - opened;
        if (blocked > 0) {
          throw new Error(`المتصفح حجب ${blocked} نافذة. اسمح بالنوافذ المنبثقة لهذا الموقع وأعد المحاولة.`);
        }
        return { ok: opened, fail: 0 };
      }
      // POST one notification per recipient; the backend queues them all.
      const results = await Promise.allSettled(body.recipients.map(async r => {
        const res = await apiRequest("POST", `/api/notifications/send`, {
          recipientPhone: r.phone,
          recipientName: r.name || null,
          channel: body.channel,
          message: body.message,
          relatedModule: "floor_plan",
          relatedEntityId: data?.plan?.id ? String(data.plan.id) : null,
        });
        const json = await res.json();
        // Server returns 201 even on failed send (sandbox / opt-in errors).
        // Treat any `status: failed` as a rejection so we can surface the
        // real Twilio error to the user.
        if (json?.status === "failed") {
          throw new Error(json.errorMessage || "فشل في الإرسال");
        }
        return json;
      }));
      const ok = results.filter(r => r.status === "fulfilled").length;
      const fail = results.length - ok;
      const firstErr = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
      return { ok, fail, errorSample: firstErr?.reason?.message as string | undefined };
    },
    onSuccess: (r: { ok: number; fail: number; errorSample?: string }) => {
      toast({
        title: r.fail ? (r.ok ? "أُرسل جزئياً" : "فشل الإرسال") : "تم الإرسال",
        description: r.fail
          ? `نجح ${r.ok} • فشل ${r.fail}${r.errorSample ? ` — ${r.errorSample}` : ""}`
          : `أُرسل لـ ${r.ok} مستلم`,
        variant: r.fail ? "destructive" : "default",
      });
      if (!r.fail) setWaDialog(null);
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
    },
    onError: (e: any) => toast({ title: "فشل الإرسال", description: e?.message, variant: "destructive" }),
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

  // Unified drop handler — called from both HTML5 drop AND touch-drag release.
  // `payload` is what was being dragged; (x, y) is the plan-coord drop point.
  const performDrop = (
    payload:
      | { kind: "role"; name: string }
      | { kind: "employee"; id: number }
      | { kind: "assignment"; id: number; offX: number; offY: number }
      | { kind: "zone"; id: number; offX: number; offY: number },
    rawX: number,
    rawY: number,
  ) => {
    if (payload.kind === "role") {
      const c = clampToPlan(snap(rawX), snap(rawY));
      createAssignment.mutate({ role: payload.name, x: c.x, y: c.y, employeeId: null });
      return;
    }
    if (payload.kind === "employee") {
      const employeeId = payload.id;
      const existing = data?.assignments.find(a => a.employeeId === employeeId);
      if (existing) {
        const c = clampToPlan(rawX, rawY);
        const prev = { x: existing.x, y: existing.y };
        const next = { x: c.x, y: c.y };
        recordOp({ type: "update", id: existing.id, prev, next });
        updateAssignment.mutate({ id: existing.id, body: next });
        return;
      }
      // Dropped on/near an existing role slot? Snap radius scales inversely
      // with zoom so the "magnet" feels the same size on screen at any
      // zoom level (~36 screen-px regardless of plan scale).
      const HIT_RADIUS = 36 / Math.max(0.1, zoom);
      const allNearbySlots = (data?.assignments || [])
        .map(s => ({ s, d: Math.hypot(s.x - rawX, s.y - rawY) }))
        .filter(({ d }) => d <= HIT_RADIUS)
        .sort((a, b) => a.d - b.d);
      const targetSlot = allNearbySlots[0]?.s;
      if (targetSlot) {
        // Slot is empty → fill silently. Slot is occupied by another
        // employee → confirm before overwriting (Batch 4 safety).
        if (targetSlot.employeeId == null) {
          recordOp({ type: "update", id: targetSlot.id, prev: { employeeId: null }, next: { employeeId } });
          updateAssignment.mutate({ id: targetSlot.id, body: { employeeId } });
          return;
        }
        if (targetSlot.employeeId !== employeeId) {
          const existingEmp = data?.employees.find(e => e.id === targetSlot.employeeId);
          const incomingEmp = data?.employees.find(e => e.id === employeeId);
          const ok = window.confirm(
            `هذا الموقع شاغل بـ "${existingEmp?.employeeName ?? "موظف آخر"}".\n` +
            `هل تريد استبدال الموظف بـ "${incomingEmp?.employeeName ?? "الموظف الجديد"}"؟`
          );
          if (!ok) return;
          recordOp({ type: "update", id: targetSlot.id, prev: { employeeId: targetSlot.employeeId }, next: { employeeId } });
          updateAssignment.mutate({ id: targetSlot.id, body: { employeeId } });
          return;
        }
      }
      const zone = (data?.zones || []).find(z => pointInZone(rawX, rawY, z));
      const preset = zone ? ZONE_PRESETS.find(p => p.name === zone.name) : undefined;
      const c = clampToPlan(snap(rawX), snap(rawY));
      setAssignDialog({ x: c.x, y: c.y, employeeId, suggestedRole: preset?.defaultRole || undefined });
      return;
    }
    if (payload.kind === "assignment") {
      if (locked) return;
      const current = data?.assignments.find(a => a.id === payload.id);
      const c = clampToPlan(snap(rawX - payload.offX), snap(rawY - payload.offY));
      const next = { x: c.x, y: c.y };
      if (current) recordOp({ type: "update", id: payload.id, prev: { x: current.x, y: current.y }, next });
      updateAssignment.mutate({ id: payload.id, body: next });
      return;
    }
    if (payload.kind === "zone") {
      if (locked) return;
      const z = data?.zones.find(zz => zz.id === payload.id);
      if (!z) return;
      const newCx = rawX - payload.offX;
      const newCy = rawY - payload.offY;
      const w = data?.plan?.width ?? 1200;
      const h = data?.plan?.height ?? 700;
      const newX = Math.max(0, Math.min(w - z.width, snap(newCx - z.width / 2)));
      const newY = Math.max(0, Math.min(h - z.height, snap(newCy - z.height / 2)));
      updateZone.mutate({ id: payload.id, body: { x: newX, y: newY } });
    }
  };

  const onDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const employeeIdStr = e.dataTransfer.getData("application/x-employee-id");
    const moveAssignIdStr = e.dataTransfer.getData("application/x-assignment-id");
    const moveZoneIdStr = e.dataTransfer.getData("application/x-zone-id");
    const newRoleName = e.dataTransfer.getData("application/x-role-name");
    const { x, y } = getCanvasCoords(e);
    if (newRoleName) return performDrop({ kind: "role", name: newRoleName }, x, y);
    if (employeeIdStr) return performDrop({ kind: "employee", id: parseInt(employeeIdStr, 10) }, x, y);
    if (moveAssignIdStr) {
      return performDrop({
        kind: "assignment",
        id: parseInt(moveAssignIdStr, 10),
        offX: parseFloat(e.dataTransfer.getData("x-offset") || "0"),
        offY: parseFloat(e.dataTransfer.getData("y-offset") || "0"),
      }, x, y);
    }
    if (moveZoneIdStr) {
      return performDrop({
        kind: "zone",
        id: parseInt(moveZoneIdStr, 10),
        offX: parseFloat(e.dataTransfer.getData("x-offset") || "0"),
        offY: parseFloat(e.dataTransfer.getData("y-offset") || "0"),
      }, x, y);
    }
  };

  // ---- Touch drag plumbing ----
  // Called from onPointerDown. Uses an 8px movement threshold before engaging
  // drag — under that threshold the gesture is treated as a tap and the
  // element's onClick handler fires normally (critical for empty-slot quick
  // assign and pencil edit on iPad).
  const TOUCH_DRAG_THRESHOLD = 8;
  const beginTouchDrag = (e: React.PointerEvent, payload: TouchPayload) => {
    if (e.pointerType !== "touch") return;
    const startX = e.clientX, startY = e.clientY;
    let armed = false;
    const onMove = (ev: PointerEvent) => {
      if (!armed) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < TOUCH_DRAG_THRESHOLD) return;
        armed = true;
        touchDragRef.current = payload;
        setTouchGhost({ x: ev.clientX, y: ev.clientY, label: payload.label });
      }
      ev.preventDefault();
      setTouchGhost(g => g ? { x: ev.clientX, y: ev.clientY, label: g.label } : null);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!armed) return; // tap, not drag → let onClick fire naturally
      const p = touchDragRef.current;
      touchDragRef.current = null;
      setTouchGhost(null);
      if (!p || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
      const x = (ev.clientX - rect.left) / zoom;
      const y = (ev.clientY - rect.top) / zoom;
      if (p.kind === "employee") performDrop({ kind: "employee", id: p.id }, x, y);
      else if (p.kind === "role") performDrop({ kind: "role", name: p.name }, x, y);
      else if (p.kind === "assignment") performDrop({ kind: "assignment", id: p.id, offX: p.offX, offY: p.offY }, x, y);
      else if (p.kind === "zone") performDrop({ kind: "zone", id: p.id, offX: p.offX, offY: p.offY }, x, y);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // ---- Undo / Redo execution ----
  // Both directions push the *mirrored* op onto the opposite stack BEFORE the
  // network call resolves the id remap. For create/delete we always carry the
  // full snapshot, so any cycle (create→undo→redo→undo→...) stays consistent
  // even after the server assigns a fresh primary key on recreate.
  const doUndo = async () => {
    const op = undoStackRef.current.pop();
    if (!op) return;
    bumpHistory();
    try {
      if (op.type === "update") {
        await apiRequest("PATCH", `/api/floor-plans/${selectedBranchId}/assignments/${op.id}`, {
          ...op.prev, shiftType: selectedShift,
        });
        invalidate();
        redoStackRef.current.push({ type: "update", id: op.id, prev: op.next, next: op.prev });
      } else if (op.type === "delete") {
        // Undo of delete = recreate from snapshot. Server returns a new id; we
        // store that id on the redo entry so a subsequent redo deletes the
        // correct row.
        const r = await (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/assignments`, {
          ...op.snapshot, shiftType: selectedShift,
        })).json();
        invalidate();
        if (r?.id) redoStackRef.current.push({ type: "delete", id: r.id, snapshot: op.snapshot });
      } else if (op.type === "create") {
        // Undo of create = delete. Snapshot is preserved so redo can recreate.
        await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/assignments/${op.id}?shift=${selectedShift}`);
        invalidate();
        redoStackRef.current.push({ type: "create", id: op.id, snapshot: op.snapshot });
      }
    } catch (e: any) {
      toast({ title: "تعذّر التراجع", description: e?.message, variant: "destructive" });
    }
    bumpHistory();
  };
  const doRedo = async () => {
    const op = redoStackRef.current.pop();
    if (!op) return;
    bumpHistory();
    try {
      if (op.type === "update") {
        await apiRequest("PATCH", `/api/floor-plans/${selectedBranchId}/assignments/${op.id}`, {
          ...op.next, shiftType: selectedShift,
        });
        invalidate();
        undoStackRef.current.push({ type: "update", id: op.id, prev: op.prev, next: op.next });
      } else if (op.type === "delete") {
        // Redo of delete = delete the row we just recreated.
        await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/assignments/${op.id}?shift=${selectedShift}`);
        invalidate();
        undoStackRef.current.push({ type: "delete", id: op.id, snapshot: op.snapshot });
      } else if (op.type === "create") {
        // Redo of create = recreate from snapshot; new server id is captured
        // so the next undo deletes the right row.
        const r = await (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/assignments`, {
          ...op.snapshot, shiftType: selectedShift,
        })).json();
        invalidate();
        if (r?.id) undoStackRef.current.push({ type: "create", id: r.id, snapshot: op.snapshot });
      }
    } catch (e: any) {
      toast({ title: "تعذّر الإعادة", description: e?.message, variant: "destructive" });
    }
    bumpHistory();
  };
  // Keyboard shortcuts: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) doRedo(); else doUndo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        doRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedBranchId, selectedShift]);

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
    let raf = 0;
    const flush = () => { raf = 0; setResizing({ id: zoneId, x, y, width: w, height: h }); };
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
      // Coalesce updates to one per animation frame instead of one per pixel.
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
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
    let raf = 0;
    const flush = () => { raf = 0; setRotating({ id: zoneId, rotation: rot }); };
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
      // Coalesce to one render per animation frame
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (rot !== startRotation) updateZone.mutate({ id: zoneId, body: { rotation: rot } });
      setRotating(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Employees that are NOT yet placed on the plan
  const placedEmployeeIds = useMemo(() => new Set(
    (data?.assignments || []).map(a => a.employeeId).filter((id): id is number => id != null)
  ), [data]);
  const allUnplaced = useMemo(
    () => (data?.employees || []).filter(e => !placedEmployeeIds.has(e.id)),
    [data, placedEmployeeIds],
  );
  // Split the unplaced pool into "scheduled for THIS shift today" vs the
  // rest. This drives both the grouped sidebar UI and the schedule-first
  // auto-distribute order (scheduled people get placed first, leftovers
  // fall back to general staff if no schedule data exists).
  const unplacedScheduled = useMemo(
    () => allUnplaced.filter(e => scheduledIds.has(e.id)),
    [allUnplaced, scheduledIds],
  );
  const unplacedOthers = useMemo(
    () => allUnplaced.filter(e => !scheduledIds.has(e.id)),
    [allUnplaced, scheduledIds],
  );
  // Visible pool in the sidebar: when schedule data exists AND the user has
  // opted in to schedule-only, hide the "others" group entirely.
  const unplacedEmployees = useMemo(() => {
    if (scheduledOnly && scheduledIds.size > 0) return unplacedScheduled;
    return allUnplaced;
  }, [allUnplaced, unplacedScheduled, scheduledOnly, scheduledIds]);
  // Empty role slots (no employee yet) for this shift — useful for stats and drag-to-fill
  const emptySlots = useMemo(
    () => (data?.assignments || []).filter(a => a.employeeId == null),
    [data],
  );
  const employeeById = useMemo(() => {
    const m = new Map<number, BranchEmployee>();
    (data?.employees || []).forEach(e => m.set(e.id, e));
    return m;
  }, [data]);
  // Coverage info for the health banner: how many of each role are still empty,
  // and how many scheduled employees still need a position on the plan.
  const missingByRole = useMemo(() => {
    const m = new Map<string, number>();
    emptySlots.forEach(s => {
      const r = (s.role || "موظف").trim() || "موظف";
      m.set(r, (m.get(r) || 0) + 1);
    });
    return m;
  }, [emptySlots]);
  const unassignedScheduledCount = useMemo(() => {
    let n = 0;
    scheduledIds.forEach(id => { if (!placedEmployeeIds.has(id)) n++; });
    return n;
  }, [scheduledIds, placedEmployeeIds]);

  // ---- Smart distribution actions ----
  // Try to fill every empty slot with a scheduled, unplaced employee whose
  // jobTitle matches the slot's role. Sequential PATCHes keep the server-side
  // upsert logic safe and avoid race conditions on the same plan.
  const autoDistribute = async () => {
    if (smartBusy) return;
    setSmartBusy(true);
    try {
      // Build two priority pools per job title:
      // 1) people actually scheduled for THIS shift today — always tried first
      // 2) other unplaced employees of the branch — only used as fallback when
      //    schedule data is missing OR the user explicitly disabled the toggle
      const useScheduledOnly = scheduledIds.size > 0 && scheduledOnly;
      const buildPool = (list: BranchEmployee[]) => {
        const p: Record<string, BranchEmployee[]> = {};
        for (const e of list) {
          const jt = (e.jobTitle || "").trim();
          (p[jt] ||= []).push(e);
        }
        return p;
      };
      const primary = buildPool(unplacedScheduled);
      const fallback = useScheduledOnly ? {} : buildPool(unplacedOthers);

      type Pick = { emp: BranchEmployee; source: "primary" | "fallback"; poolKey: string };
      const take = (role: string): Pick | undefined => {
        const alias = LEGACY_ROLE_ALIASES[role] || "";
        for (const key of [role, alias]) {
          if (!key) continue;
          if (primary[key]?.length) return { emp: primary[key]!.shift()!, source: "primary", poolKey: key };
        }
        for (const key of [role, alias]) {
          if (!key) continue;
          if (fallback[key]?.length) return { emp: fallback[key]!.shift()!, source: "fallback", poolKey: key };
        }
        return undefined;
      };

      let placed = 0, failed = 0, fromSchedule = 0;
      const failedRoles: string[] = [];
      for (const slot of emptySlots) {
        const role = (slot.role || "").trim();
        const pick = take(role);
        if (!pick) continue;
        try {
          await apiRequest("PATCH", `/api/floor-plans/${selectedBranchId}/assignments/${slot.id}`, {
            employeeId: pick.emp.id, shiftType: selectedShift,
          });
          placed++;
          if (pick.source === "primary") fromSchedule++;
        } catch {
          failed++;
          failedRoles.push(role || "بدون دور");
          // Return the employee to the exact pool they came from
          const target = pick.source === "primary" ? primary : fallback;
          (target[pick.poolKey] ||= []).unshift(pick.emp);
        }
      }
      invalidate();
      if (placed === 0 && failed === 0) {
        toast({
          title: "لا يوجد تطابق ممكن",
          description: scheduledIds.size === 0
            ? "لا يوجد جدول مناوبات لهذا اليوم. أضف الجدول أولاً أو وزّع يدوياً."
            : "لا توجد مواقع شاغرة تطابق وظائف الموظفين المجدولين.",
        });
      } else {
        const desc: string[] = [];
        if (fromSchedule > 0) desc.push(`${fromSchedule} من الجدول`);
        if (placed - fromSchedule > 0) desc.push(`${placed - fromSchedule} من خارج الجدول`);
        if (failed > 0) desc.push(`فشل ${failed}: ${failedRoles.slice(0, 3).join("، ")}${failedRoles.length > 3 ? "..." : ""}`);
        toast({
          title: `تم توزيع ${placed} موظف`,
          description: desc.join(" • "),
          variant: failed > 0 ? "destructive" : undefined,
        });
      }
    } finally { setSmartBusy(false); }
  };

  // Copy assignment positions from another shift into the current one.
  // `withEmployees=false` copies only the slots (as empty positions), which is
  // the typical case: same layout, different staff per shift.
  const copyFromShift = async (sourceShift: ShiftType, withEmployees: boolean) => {
    if (smartBusy || sourceShift === selectedShift) return;
    setSmartBusy(true);
    try {
      let source: any;
      try {
        const res = await apiRequest("GET", `/api/floor-plans/${selectedBranchId}?shift=${sourceShift}`);
        source = await res.json();
      } catch (e: any) {
        toast({ title: "تعذّر قراءة الوردية المصدر", description: e?.message, variant: "destructive" });
        return;
      }
      const srcAssignments: any[] = source?.assignments || [];
      if (srcAssignments.length === 0) {
        toast({ title: "لا توجد مواقع في الوردية المصدر", variant: "destructive" });
        return;
      }
      // Skip slots that already exist at the same (x,y,role) to avoid duplicates
      const existing = new Set((data?.assignments || []).map(a => `${a.x}:${a.y}:${a.role || ""}`));
      let copied = 0, failed = 0;
      for (const a of srcAssignments) {
        const key = `${a.x}:${a.y}:${a.role || ""}`;
        if (existing.has(key)) continue;
        try {
          await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/assignments`, {
            x: a.x, y: a.y, role: a.role, notes: a.notes,
            employeeId: withEmployees ? a.employeeId : null,
            shiftType: selectedShift,
          });
          copied++;
        } catch { failed++; }
      }
      invalidate();
      const srcLabel = SHIFTS.find(s => s.value === sourceShift)?.label || sourceShift;
      if (copied === 0 && failed === 0) {
        toast({ title: "لا جديد لنسخه", description: "كل المواقع موجودة بالفعل في الوردية الحالية." });
      } else {
        toast({
          title: `تم نسخ ${copied} موقع من وردية ${srcLabel}${failed > 0 ? ` (فشل ${failed})` : ""}`,
          description: withEmployees ? "تم نسخ المواقع والموظفين." : "تم نسخ المواقع كشواغر — استخدم التوزيع التلقائي أو وزّع يدوياً.",
          variant: failed > 0 ? "destructive" : undefined,
        });
      }
    } finally { setSmartBusy(false); }
  };

  // Remove all assignments in the current shift (zones are kept).
  const clearShift = async () => {
    if (smartBusy) return;
    const all = data?.assignments || [];
    if (all.length === 0) return;
    if (!confirm(`سيتم حذف ${all.length} موقعاً من وردية ${SHIFTS.find(s => s.value === selectedShift)?.label}. لن تتأثر المناطق نفسها. متابعة؟`)) return;
    setSmartBusy(true);
    try {
      let deleted = 0, failed = 0;
      for (const a of all) {
        try {
          await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/assignments/${a.id}?shift=${selectedShift}`);
          deleted++;
        } catch { failed++; }
      }
      invalidate();
      toast({
        title: `تم مسح ${deleted} موقع${failed > 0 ? ` (فشل ${failed})` : ""}`,
        description: failed > 0 ? "أعد المحاولة لاستكمال المسح." : undefined,
        variant: failed > 0 ? "destructive" : undefined,
      });
    } finally { setSmartBusy(false); }
  };

  return (
    <Layout>
      <div dir="rtl" className="flex flex-col h-[calc(100vh-4rem)] bg-[#fdfdfc] font-['Cairo']">
        {/* TOP COMMAND BAR */}
        <div className="h-14 border-b border-slate-200/80 bg-white flex items-center justify-between px-4 shrink-0 z-10 gap-3">
          {/* Right cluster (RTL visual right): branch + shift + date */}
          <div className="flex items-center gap-3 min-w-0">
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger id="branch-sel" className="h-9 w-auto min-w-[180px] gap-2 bg-white border-slate-200" data-testid="select-branch">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-[#E4B136] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </div>
                  <SelectValue placeholder="اختر فرع" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id} data-testid={`select-branch-${b.id}`}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedBranchId && (
              <>
                <Separator orientation="vertical" className="h-6" />

                <Tabs value={selectedShift} onValueChange={(v) => setSelectedShift(v as ShiftType)} dir="rtl" className="h-8">
                  <TabsList className="h-8 bg-slate-100/80 p-0.5 border border-slate-200">
                    {SHIFTS.map(s => {
                      const SI = s.icon;
                      return (
                        <TabsTrigger key={s.value} value={s.value} data-testid={`tab-shift-${s.value}`}
                          className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-sm">
                          <SI className="w-3.5 h-3.5" style={{ color: s.color }} />
                          <span className="font-medium">{s.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute start-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        setSelectedDate(v);
                        setIsPinnedToToday(v === todayRiyadh);
                      }}
                      className="h-8 w-[150px] ps-7 text-xs tabular-nums font-medium border-slate-200"
                      data-testid="input-plan-date"
                    />
                  </div>
                  {selectedDate !== todayRiyadh ? (
                    <Button
                      variant="ghost" size="sm" className="h-7 px-2 text-xs text-[#E4B136] hover:bg-amber-50"
                      onClick={() => { setSelectedDate(todayRiyadh); setIsPinnedToToday(true); }}
                      data-testid="btn-date-today"
                    >
                      اليوم
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                      اليوم
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Center: command search (hidden on mobile, wired to empSearch) */}
          <div className="hidden md:flex flex-1 justify-center max-w-md">
            <div className="relative w-full group">
              <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#E4B136] transition-colors" />
              <Input
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="ابحث عن موظف أو وظيفة..."
                className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-[#E4B136] pr-8 pl-14 rounded-md shadow-inner shadow-slate-100 hover:bg-white focus:bg-white"
                data-testid="input-command-search"
              />
              <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <kbd className="text-[9px] font-sans bg-white border border-slate-200 rounded px-1 text-slate-400 font-medium">⌘</kbd>
                <kbd className="text-[9px] font-sans bg-white border border-slate-200 rounded px-1 text-slate-400 font-medium">K</kbd>
              </div>
            </div>
          </div>

          {/* Left cluster (RTL visual left): smart actions, history, templates, WA, PDF, save */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile-only: toggle right sidebar (tools/employees/zones) */}
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-slate-500 hover:text-[#E4B136] lg:hidden"
              onClick={() => setMobileRightOpen(true)}
              title="الأدوات والموظفين"
              data-testid="btn-mobile-right-panel"
            >
              <PanelRight className="w-4 h-4" />
            </Button>
            {/* Mobile-only: toggle left sidebar (coverage status) */}
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-slate-500 hover:text-[#E4B136] lg:hidden"
              onClick={() => setMobileLeftOpen(true)}
              title="حالة التغطية"
              data-testid="btn-mobile-left-panel"
            >
              <PanelLeft className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                  disabled={smartBusy || locked || !data}
                  title="أدوات ذكية"
                  data-testid="btn-smart-tools"
                >
                  {smartBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs">التوزيع التلقائي</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={autoDistribute}
                  disabled={emptySlots.length === 0 || unplacedEmployees.length === 0}
                  data-testid="btn-auto-distribute"
                >
                  <Wand2 className="w-3.5 h-3.5 me-2 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm">توزيع تلقائي حسب الوظيفة</div>
                    <div className="text-[11px] text-muted-foreground">
                      {emptySlots.length} شاغر • {unplacedEmployees.length} موظف متاح
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">نسخ من وردية أخرى</DropdownMenuLabel>
                {SHIFTS.filter(s => s.value !== selectedShift).map(s => (
                  <div key={s.value}>
                    <DropdownMenuItem onClick={() => copyFromShift(s.value, false)} data-testid={`btn-copy-empty-${s.value}`}>
                      <CopyIcon className="w-3.5 h-3.5 me-2" />
                      نسخ مواقع {s.label} كشواغر
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => copyFromShift(s.value, true)} data-testid={`btn-copy-full-${s.value}`}>
                      <CopyIcon className="w-3.5 h-3.5 me-2 text-green-600" />
                      نسخ مواقع {s.label} مع الموظفين
                    </DropdownMenuItem>
                  </div>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={clearShift}
                  className="text-red-600 focus:text-red-700"
                  disabled={(data?.assignments || []).length === 0}
                  data-testid="btn-clear-shift"
                >
                  <Trash2 className="w-3.5 h-3.5 me-2" />
                  مسح كل مواقع هذه الوردية
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700"
              onClick={() => setHistoryOpen(true)}
              title="سجل التغييرات"
              data-testid="btn-history"
            >
              <HistoryIcon className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700"
                  title="القوالب"
                  data-testid="btn-templates"
                >
                  <BookmarkPlus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-auto">
                <DropdownMenuItem
                  disabled={!data || (data.assignments.length === 0 && data.zones.length === 0)}
                  onClick={() => setSaveTplDialog({ name: "", description: "", scope: "branch", includeZones: true })}
                  data-testid="btn-save-template"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 me-2 text-primary" />
                  حفظ المخطط الحالي كقالب…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">القوالب المتاحة ({templates.length})</DropdownMenuLabel>
                {templates.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">لا توجد قوالب محفوظة</div>
                )}
                {templates.map((t: any) => (
                  <div key={t.id} className="px-2 py-1.5 hover:bg-accent rounded-sm" data-testid={`template-item-${t.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          {t.name}
                          {!t.branchId && <Badge variant="outline" className="text-[10px] px-1 py-0">عام</Badge>}
                        </div>
                        {t.description && <div className="text-[11px] text-muted-foreground truncate">{t.description}</div>}
                      </div>
                      <Button
                        size="sm" variant="ghost" className="h-7 px-2 text-xs text-primary"
                        disabled={locked || applyTemplate.isPending}
                        onClick={() => {
                          if (confirm(`تطبيق القالب "${t.name}" على ${SHIFTS.find(s => s.value === selectedShift)?.label}؟ سيتم استبدال المواقع الحالية لهذه الوردية.`)) {
                            applyTemplate.mutate(t.id);
                          }
                        }}
                        data-testid={`btn-apply-template-${t.id}`}
                      >
                        تطبيق
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600"
                        disabled={deleteTemplate.isPending}
                        onClick={() => { if (confirm(`حذف القالب "${t.name}" نهائياً؟`)) deleteTemplate.mutate(t.id); }}
                        data-testid={`btn-delete-template-${t.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-green-600"
              disabled={!data || data.assignments.length === 0}
              onClick={() => setWaDialog({
                recipients: [{ phone: "", name: "" }],
                message: buildShareMessage(),
                channel: "walink",
              })}
              title="مشاركة عبر واتساب"
              data-testid="btn-share-whatsapp"
            >
              <MessageCircle className="w-4 h-4 text-green-600" />
            </Button>

            <Button
              variant="ghost" size="sm"
              className="h-8 gap-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 px-2 sm:px-3"
              onClick={() => handlePrint?.()}
              data-testid="btn-print"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تصدير PDF</span>
            </Button>

            <Button
              variant="default" size="sm"
              className="h-8 text-xs bg-[#E4B136] hover:bg-[#c99a2d] text-white shadow-sm gap-1.5 px-2 sm:px-3"
              onClick={() => { invalidate(); toast({ title: "تم تحديث المخطط", description: "كل التغييرات محفوظة." }); }}
              data-testid="btn-save-changes"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">حفظ التغييرات</span>
            </Button>
          </div>
        </div>

        {!selectedBranchId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">اختر فرعاً للبدء</div>
        ) : isLoading || !data ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">جارٍ التحميل...</div>
        ) : (
          <div className="flex flex-1 overflow-hidden relative">
            {/* Mobile backdrop — closes any open drawer on tap */}
            {(mobileLeftOpen || mobileRightOpen) && (
              <div
                className="lg:hidden fixed inset-0 bg-black/30 z-30 animate-in fade-in"
                onClick={() => { setMobileLeftOpen(false); setMobileRightOpen(false); }}
                data-testid="mobile-drawer-backdrop"
              />
            )}

            {/* LEFT RAIL (RTL: visual right) — tabbed library
                On lg+: static side column. On smaller screens: slide-in drawer from right. */}
            <div
              {...(!mobileRightOpen && { inert: "" as any, "aria-hidden": true })}
              className={`w-64 border-l border-slate-200/80 bg-white flex flex-col shrink-0 shadow-[2px_0_12px_rgba(0,0,0,0.02)]
              lg:relative lg:z-10 lg:!translate-x-0 lg:[&]:!pointer-events-auto lg:[&]:!opacity-100
              max-lg:fixed max-lg:top-0 max-lg:bottom-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-200
              ${mobileRightOpen ? "max-lg:translate-x-0" : "max-lg:translate-x-full max-lg:pointer-events-none"}`}>
              <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} dir="rtl" className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center px-3 pt-1 border-b border-slate-200/80 shrink-0">
                  <TabsList className="h-9 w-full bg-transparent p-0 justify-start gap-4 rounded-none">
                    <TabsTrigger
                      value="roles" data-testid="tab-sidebar-roles"
                      className="text-xs font-medium h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-[#E4B136] data-[state=active]:text-[#E4B136] data-[state=active]:bg-transparent px-1 data-[state=active]:shadow-none"
                    >
                      الوظائف
                    </TabsTrigger>
                    <TabsTrigger
                      value="zones" data-testid="tab-sidebar-zones"
                      className="text-xs font-medium h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-[#E4B136] data-[state=active]:text-[#E4B136] data-[state=active]:bg-transparent px-1 data-[state=active]:shadow-none"
                    >
                      المناطق
                    </TabsTrigger>
                    <TabsTrigger
                      value="employees" data-testid="tab-sidebar-employees"
                      className="text-xs font-medium h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-[#E4B136] data-[state=active]:text-[#E4B136] data-[state=active]:bg-transparent px-1 gap-1 data-[state=active]:shadow-none"
                    >
                      الموظفون
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums" data-testid="badge-unplaced-count">{unplacedEmployees.length}</Badge>
                    </TabsTrigger>
                  </TabsList>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 lg:hidden text-slate-400 ms-1"
                    onClick={() => setMobileRightOpen(false)}
                    data-testid="btn-close-right-drawer"
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                </div>

                {/* Library filter — bound to empSearch so the command-bar search and this filter stay in sync */}
                <div className="p-3 border-b border-slate-200/80 bg-slate-50/50 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      placeholder="تصفية..."
                      className="h-7 text-xs pr-7 bg-white border-slate-200"
                      data-testid="input-sidebar-filter"
                    />
                  </div>
                  {/* Compact shift stats */}
                  <div className="grid grid-cols-3 gap-1 text-center mt-2">
                    <div className="rounded py-1 bg-white border border-slate-200">
                      <div className="text-[8px] uppercase tracking-wide text-slate-500 font-medium">المواقع</div>
                      <div className="text-xs font-bold tabular-nums leading-tight" data-testid="stat-total-slots">{data.assignments.length}</div>
                    </div>
                    <div className="rounded py-1 bg-emerald-50 border border-emerald-200">
                      <div className="text-[8px] uppercase tracking-wide text-emerald-700/80 font-medium">مُعيَّنة</div>
                      <div className="text-xs font-bold tabular-nums leading-tight text-emerald-700" data-testid="stat-filled-slots">{data.assignments.length - emptySlots.length}</div>
                    </div>
                    <div className="rounded py-1 bg-amber-50 border border-amber-200">
                      <div className="text-[8px] uppercase tracking-wide text-amber-700/80 font-medium">شاغرة</div>
                      <div className="text-xs font-bold tabular-nums leading-tight text-amber-700" data-testid="stat-empty-slots">{emptySlots.length}</div>
                    </div>
                  </div>
                </div>

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
                            onPointerDown={(e) => beginTouchDrag(e, { kind: "role", name: r, label: def.label })}
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

                {/* Employees tab — schedule-aware grouped list */}
                <TabsContent value="employees" className="flex-1 overflow-hidden m-0 flex flex-col">
                  <div className="p-3 pb-2 space-y-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      اسحب موظفاً على موقع شاغر لملئه، أو على المخطط لإنشاء موقع جديد.
                    </p>
                    {/* Schedule-aware filter — toggles whether "غير مجدولين"
                        group is shown alongside the scheduled group. */}
                    <label className={`flex items-center gap-2 text-[11px] cursor-pointer p-1.5 rounded border transition-colors ${
                      scheduledIds.size === 0 ? "bg-muted/40 opacity-60" : scheduledOnly ? "bg-emerald-50 border-emerald-200" : "bg-muted/40"
                    }`} title="يعتمد على جدول المناوبات لهذا اليوم">
                      <Switch
                        checked={scheduledOnly}
                        onCheckedChange={setScheduledOnly}
                        className="scale-75"
                        disabled={scheduledIds.size === 0}
                        data-testid="switch-scheduled-only"
                      />
                      <span className="flex-1 font-medium">
                        المجدولون لهذه الوردية فقط
                        {scheduledIds.size === 0 && <span className="text-muted-foreground font-normal"> — لا يوجد جدول</span>}
                      </span>
                      {scheduledIds.size > 0 && (
                        <Badge variant="outline" className="text-[10px] tabular-nums px-1 py-0 bg-card">{scheduledIds.size}</Badge>
                      )}
                    </label>
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
                    <div className="px-3 pb-3 space-y-3">
                      {(() => {
                        const q = empSearch.trim().toLowerCase();
                        const filterFn = (e: BranchEmployee) => !q ||
                          e.employeeName.toLowerCase().includes(q) ||
                          (e.jobTitle || "").toLowerCase().includes(q);
                        const fmtTime = (t?: string) => t ? t.slice(0, 5) : ""; // "HH:MM"

                        // Reusable card renderer — `scheduledInfo` is optional;
                        // when present it renders the shift time badge.
                        const renderCard = (emp: BranchEmployee, info?: ScheduledInfo) => {
                          const def = getRoleDef(null, emp.jobTitle);
                          const RoleIcon = def.icon;
                          const win = info && (info.startTime || info.endTime)
                            ? `${fmtTime(info.startTime)}${info.endTime ? `–${fmtTime(info.endTime)}` : ""}`
                            : null;
                          return (
                            <div key={emp.id} draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("application/x-employee-id", String(emp.id));
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onPointerDown={(e) => beginTouchDrag(e, { kind: "employee", id: emp.id, label: emp.employeeName })}
                              className={`flex items-center gap-2 p-2 rounded-md border bg-card hover:border-primary cursor-grab active:cursor-grabbing transition-colors touch-none ${
                                info ? "border-emerald-200 hover:bg-emerald-50/50" : "border-border hover:bg-accent"
                              }`}
                              data-testid={`employee-pill-${emp.id}`}
                            >
                              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="w-8 h-8 flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: def.color, ...shapeStyle(def.shape) }}>
                                <RoleIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{emp.employeeName}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{emp.jobTitle}</div>
                              </div>
                              {win && (
                                <Badge variant="outline" className="text-[10px] tabular-nums px-1 py-0 border-emerald-300 text-emerald-700 bg-emerald-50">
                                  {win}
                                </Badge>
                              )}
                            </div>
                          );
                        };

                        const scheduledList = unplacedScheduled.filter(filterFn);
                        const othersList = unplacedOthers.filter(filterFn);
                        const showOthers = !(scheduledOnly && scheduledIds.size > 0);
                        const hasAny = scheduledList.length + (showOthers ? othersList.length : 0) > 0;
                        if (!hasAny) {
                          return (
                            <div className="text-center text-xs text-muted-foreground py-6">
                              {data.employees.length === 0
                                ? "لا يوجد موظفون نشطون بهذا الفرع"
                                : q ? "لا نتائج مطابقة للبحث"
                                    : scheduledIds.size > 0 && scheduledOnly
                                        ? `جميع المجدولين موزَّعون لشفت ${SHIFTS.find(s => s.value === selectedShift)?.label}`
                                        : `جميع الموظفين موزَّعون`}
                            </div>
                          );
                        }
                        return (
                          <>
                            {scheduledIds.size > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 px-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-[11px] font-semibold text-emerald-800">مجدولون للوردية</span>
                                  <Badge variant="outline" className="text-[10px] tabular-nums px-1 py-0 border-emerald-300 text-emerald-700 bg-emerald-50">
                                    {scheduledList.length}
                                  </Badge>
                                  <div className="flex-1 h-px bg-emerald-100" />
                                </div>
                                {scheduledList.length === 0 ? (
                                  <div className="text-[11px] text-muted-foreground px-1 py-2">
                                    {q ? "لا نتائج في المجدولين" : "كل المجدولين موزَّعون ✓"}
                                  </div>
                                ) : scheduledList.map(emp => renderCard(emp, scheduledMap.get(emp.id)))}
                              </div>
                            )}
                            {showOthers && othersList.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 px-1">
                                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-[11px] font-semibold text-muted-foreground">
                                    {scheduledIds.size > 0 ? "غير مجدولين (احتياطي)" : "موظفو الفرع"}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] tabular-nums px-1 py-0">
                                    {othersList.length}
                                  </Badge>
                                  <div className="flex-1 h-px bg-border" />
                                </div>
                                {othersList.map(emp => renderCard(emp))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>

            {/* CENTER CANVAS COLUMN */}
            <div className="flex-1 flex flex-col relative bg-[#f8f9fa] overflow-hidden">
              {/* Floating zoom dock — top-right of canvas (visual right in RTL) */}
              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
                <div className="bg-white rounded-md shadow-sm border border-slate-200/80 p-1 flex flex-col gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-600 hover:text-[#E4B136] hover:bg-amber-50"
                    onClick={() => setZoomClamped(zoom + 0.1)} title="تكبير" data-testid="btn-zoom-in">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </Button>
                  <button type="button" onClick={() => setZoomClamped(1)}
                    className="text-[9px] font-medium text-center text-slate-500 py-1 border-y border-slate-200 my-0.5 cursor-pointer hover:text-slate-800 tabular-nums"
                    data-testid="btn-zoom-reset">
                    {Math.round(zoom * 100)}%
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-600 hover:text-[#E4B136] hover:bg-amber-50"
                    onClick={() => setZoomClamped(zoom - 0.1)} title="تصغير" data-testid="btn-zoom-out">
                    <ZoomOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="bg-white rounded-md shadow-sm border border-slate-200/80 p-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-600 hover:text-[#E4B136] hover:bg-amber-50"
                    onClick={fitToView} title="ملاءمة الشاشة" data-testid="btn-zoom-fit">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Floating left dock — undo/redo + tool selection + plan size */}
              <div className="absolute top-3 left-3 z-20">
                <div className="bg-white/95 backdrop-blur-sm rounded-md shadow-sm border border-slate-200/80 p-1 flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#E4B136] bg-amber-50" title="تحديد">
                    <MousePointer2 className="w-3.5 h-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-500 hover:text-slate-700"
                    disabled={!canUndo} onClick={doUndo} title="تراجع (Ctrl+Z)" data-testid="btn-undo">
                    <Undo2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-500 hover:text-slate-700"
                    disabled={!canRedo} onClick={doRedo} title="إعادة (Ctrl+Shift+Z)" data-testid="btn-redo">
                    <Redo2 className="w-3.5 h-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  <div className="flex items-center gap-1 px-1 text-[10px] text-slate-500" title="مقاس المخطط">
                    <Input
                      type="number" min={400} max={4000} step={20}
                      onBlur={(e) => {
                        const w = parseInt(e.target.value, 10);
                        if (!isNaN(w) && w !== data.plan.width) updatePlan.mutate({ width: Math.max(400, Math.min(4000, w)) });
                      }}
                      defaultValue={data.plan.width}
                      key={`w-${data.plan.id}-${data.plan.width}`}
                      className="h-6 w-14 px-1 text-[10px] tabular-nums"
                      data-testid="input-plan-width"
                    />
                    <span>×</span>
                    <Input
                      type="number" min={300} max={4000} step={20}
                      onBlur={(e) => {
                        const h = parseInt(e.target.value, 10);
                        if (!isNaN(h) && h !== data.plan.height) updatePlan.mutate({ height: Math.max(300, Math.min(4000, h)) });
                      }}
                      defaultValue={data.plan.height}
                      key={`h-${data.plan.id}-${data.plan.height}`}
                      className="h-6 w-14 px-1 text-[10px] tabular-nums"
                      data-testid="input-plan-height"
                    />
                  </div>
                </div>
              </div>

              {/* Inline status banners (coverage / placement-mode / locked / help) — kept from original chrome */}
              <div className="shrink-0 relative z-[1]">
                {/* Health banner — at-a-glance coverage, missing roles, unassigned people */}
                {data.assignments.length > 0 && (() => {
                  const filled = data.assignments.length - emptySlots.length;
                  const pct = Math.round((filled / data.assignments.length) * 100);
                  const tone = pct === 100 ? "emerald" : pct >= 70 ? "amber" : "rose";
                  const toneBg =
                    tone === "emerald" ? "bg-emerald-50 border-emerald-200" :
                    tone === "amber" ? "bg-amber-50 border-amber-200" :
                    "bg-rose-50 border-rose-200";
                  return (
                    <div className={`px-3 py-2 border-b text-xs flex flex-wrap items-center gap-x-3 gap-y-1.5 ${toneBg}`} data-testid="banner-coverage">
                      <span className="flex items-center gap-1.5 font-semibold">
                        {pct === 100 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                        تغطية الوردية: <span className="tabular-nums">{filled}/{data.assignments.length} ({pct}%)</span>
                      </span>
                      {missingByRole.size > 0 && (
                        <span className="flex items-center gap-1 flex-wrap">
                          <span className="text-muted-foreground">ناقص:</span>
                          {Array.from(missingByRole.entries()).map(([role, n]) => (
                            <span key={role} className="bg-white/70 border border-amber-300 rounded px-1.5 py-0.5 tabular-nums text-amber-900">
                              {n}× {role}
                            </span>
                          ))}
                        </span>
                      )}
                      {unassignedScheduledCount > 0 && (
                        <span className="flex items-center gap-1 text-sky-800" title="موظفون مجدولون لهذه الوردية اليوم لم يُعطوا موقعاً بعد">
                          <Users className="w-3.5 h-3.5" />
                          مجدولون بلا موقع: <span className="tabular-nums font-semibold">{unassignedScheduledCount}</span>
                        </span>
                      )}
                      {(emptySlots.length > 0 && unplacedEmployees.length > 0) && (
                        <button
                          type="button"
                          onClick={autoDistribute}
                          disabled={smartBusy || locked}
                          className="ms-auto inline-flex items-center gap-1 text-primary hover:underline font-medium disabled:opacity-50"
                          data-testid="btn-quick-autodistribute"
                        >
                          <Wand2 className="w-3.5 h-3.5" /> توزيع تلقائي
                        </button>
                      )}
                    </div>
                  );
                })()}
                {placementRole && (() => {
                  const def = ROLE_DEFS[placementRole];
                  return (
                    <div className="px-3 py-2 bg-primary/10 border-b border-primary/30 text-sm flex items-center gap-2"
                      data-testid="banner-placement-mode">
                      <span className="shrink-0"><PersonAvatar def={def} size={28} /></span>
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
              </div>
                <div ref={canvasWrapRef} className="flex-1 relative overflow-auto butter-canvas-pattern">
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
                      <ContextMenu key={z.id}>
                        <ContextMenuTrigger asChild disabled={locked}>
                      <div
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
                        onPointerDown={(e) => {
                          if (locked) return;
                          if ((e.target as HTMLElement).dataset?.resize === "1") return;
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const cx = rect.left + rect.width / 2;
                          const cy = rect.top + rect.height / 2;
                          beginTouchDrag(e, {
                            kind: "zone", id: z.id, label: z.name,
                            offX: (e.clientX - cx) / zoom, offY: (e.clientY - cy) / zoom,
                          });
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
                          // Stacking order persisted on the zone (Batch 4).
                          // Zones live below pawns by default (pawns are z-10).
                          zIndex: (z as any).zIndex ?? 0,
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
                        {/* Rotation pivot indicator — small dot at the zone's
                            geometric center. Visible only while rotating, so
                            the user can see the rotation reference point.
                            Counter-rotated to stay round visually. */}
                        {rotating?.id === z.id && (
                          <div
                            className="absolute top-1/2 left-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-white shadow z-20 pointer-events-none"
                            style={{ transform: `translate(-50%, -50%) rotate(${-liveR}deg)` }}
                          />
                        )}
                      </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-52">
                          <ContextMenuItem
                            onSelect={() => setZoneDialog({ mode: "edit", id: z.id, name: z.name, color: z.color, width: z.width, height: z.height, rotation: z.rotation || 0 })}
                            data-testid={`ctx-zone-edit-${z.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5 ml-2" /> تعديل المنطقة
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onSelect={() => {
                              const maxZ = (data?.zones || []).reduce(
                                (m, x) => Math.max(m, ((x as any).zIndex ?? 0)), 0,
                              );
                              updateZone.mutate({ id: z.id, body: { zIndex: maxZ + 1 } });
                            }}
                            data-testid={`ctx-zone-front-${z.id}`}
                          >
                            <ArrowUp className="w-3.5 h-3.5 ml-2" /> إلى الأمام
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => {
                              const minZ = (data?.zones || []).reduce(
                                (m, x) => Math.min(m, ((x as any).zIndex ?? 0)), 0,
                              );
                              updateZone.mutate({ id: z.id, body: { zIndex: minZ - 1 } });
                            }}
                            data-testid={`ctx-zone-back-${z.id}`}
                          >
                            <ArrowDown className="w-3.5 h-3.5 ml-2" /> إلى الخلف
                          </ContextMenuItem>
                          {(z.rotation || 0) !== 0 && (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onSelect={() => updateZone.mutate({ id: z.id, body: { rotation: 0 } })}
                                data-testid={`ctx-zone-reset-rot-${z.id}`}
                              >
                                <RotateCw className="w-3.5 h-3.5 ml-2" /> إعادة التدوير إلى 0°
                              </ContextMenuItem>
                            </>
                          )}
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => deleteZone.mutate(z.id)}
                            data-testid={`ctx-zone-delete-${z.id}`}
                          >
                            <XIcon className="w-3.5 h-3.5 ml-2" /> حذف المنطقة
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );})}

                    {/* Multi-task link lines (SVG overlay) — rendered between
                        zones and pawns so the lines visually sit underneath
                        the avatars. Uses raw plan coordinates (no zoom math)
                        since this SVG lives inside the scaled canvas. */}
                    {(() => {
                      const links = data.links || [];
                      const ghost = linkingFrom != null && linkCursor
                        ? data.assignments.find(a => a.id === linkingFrom)
                        : null;
                      if (!links.length && !ghost) return null;
                      // Build a smooth quadratic Bezier with a perpendicular
                      // bow so multiple links between different pawns don't
                      // overlap visually. Returns [pathD, midX, midY].
                      const curveFor = (x1: number, y1: number, x2: number, y2: number): [string, number, number] => {
                        const dx = x2 - x1, dy = y2 - y1;
                        const len = Math.max(1, Math.hypot(dx, dy));
                        // Perpendicular unit vector, bow size ~14% of length capped to 60px.
                        const bow = Math.min(60, Math.max(18, len * 0.14));
                        const nx = -dy / len, ny = dx / len;
                        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                        const cx = mx + nx * bow, cy = my + ny * bow;
                        // Midpoint of the quadratic curve at t=0.5 — used to
                        // position the delete badge so it sits on the curve.
                        const tx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
                        const ty = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
                        return [`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, tx, ty];
                      };
                      return (
                        <svg
                          className="absolute inset-0"
                          width={data.plan.width}
                          height={data.plan.height}
                          style={{ pointerEvents: "none", zIndex: 5, overflow: "visible" }}
                          data-testid="svg-links-overlay"
                        >
                          <defs>
                            <linearGradient id="fp-link-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#8b5cf6" />
                              <stop offset="50%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#06b6d4" />
                            </linearGradient>
                            <filter id="fp-link-glow" x="-30%" y="-30%" width="160%" height="160%">
                              <feGaussianBlur stdDeviation="3" result="blur" />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>
                          {links.map(l => {
                            const from = data.assignments.find(a => a.id === l.fromAssignmentId);
                            const to = data.assignments.find(a => a.id === l.toAssignmentId);
                            if (!from || !to) return null;
                            const stroke = l.color || "url(#fp-link-grad)";
                            const [d, mx, my] = curveFor(from.x, from.y, to.x, to.y);
                            const isHover = hoverLinkId === l.id;
                            return (
                              <g key={l.id} data-testid={`link-line-${l.id}`}>
                                {/* Soft outer halo behind the line */}
                                <path
                                  d={d}
                                  fill="none"
                                  stroke={l.color || "#6366f1"}
                                  strokeWidth={isHover ? 10 : 8}
                                  strokeLinecap="round"
                                  opacity={0.18}
                                  filter="url(#fp-link-glow)"
                                />
                                {/* Main animated dashed line */}
                                <path
                                  d={d}
                                  fill="none"
                                  stroke={stroke}
                                  strokeWidth={isHover ? 3.5 : 2.75}
                                  strokeDasharray="7 5"
                                  strokeLinecap="round"
                                  opacity={0.95}
                                >
                                  <animate
                                    attributeName="stroke-dashoffset"
                                    from="0" to="-24" dur="1.1s" repeatCount="indefinite"
                                  />
                                </path>
                                {/* Endpoint dots */}
                                <circle cx={from.x} cy={from.y} r={4.5} fill="#fff" stroke={l.color || "#6366f1"} strokeWidth={2} />
                                <circle cx={to.x}   cy={to.y}   r={4.5} fill="#fff" stroke={l.color || "#6366f1"} strokeWidth={2} />
                                {/* Transparent hit area on the curve to capture hover/click */}
                                <path
                                  d={d}
                                  fill="none"
                                  stroke="transparent"
                                  strokeWidth={20}
                                  strokeLinecap="round"
                                  style={{ pointerEvents: locked ? "none" : "stroke", cursor: "pointer" }}
                                  onMouseEnter={() => setHoverLinkId(l.id)}
                                  onMouseLeave={() => setHoverLinkId(prev => prev === l.id ? null : prev)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (locked) return;
                                    if (window.confirm("حذف الربط بين هاتين البطاقتين؟")) {
                                      deleteLink.mutate(l.id);
                                    }
                                  }}
                                >
                                  <title>اضغط لحذف الربط</title>
                                </path>
                                {/* Delete badge at the curve midpoint */}
                                <g
                                  transform={`translate(${mx}, ${my})`}
                                  style={{
                                    pointerEvents: locked ? "none" : "all",
                                    cursor: "pointer",
                                    opacity: isHover ? 1 : 0,
                                    transition: "opacity 150ms ease",
                                  }}
                                  onMouseEnter={() => setHoverLinkId(l.id)}
                                  onMouseLeave={() => setHoverLinkId(prev => prev === l.id ? null : prev)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (locked) return;
                                    if (window.confirm("حذف الربط بين هاتين البطاقتين؟")) {
                                      deleteLink.mutate(l.id);
                                    }
                                  }}
                                  data-testid={`link-delete-${l.id}`}
                                >
                                  <circle r={11} fill="#fff" stroke={l.color || "#6366f1"} strokeWidth={2} />
                                  <line x1={-4} y1={-4} x2={4} y2={4} stroke={l.color || "#6366f1"} strokeWidth={2} strokeLinecap="round" />
                                  <line x1={4}  y1={-4} x2={-4} y2={4} stroke={l.color || "#6366f1"} strokeWidth={2} strokeLinecap="round" />
                                  <title>حذف الربط</title>
                                </g>
                              </g>
                            );
                          })}
                          {/* Ghost line while dragging — curved + animated */}
                          {ghost && linkCursor && (() => {
                            const [gd] = curveFor(ghost.x, ghost.y, linkCursor.x, linkCursor.y);
                            return (
                              <g>
                                <path d={gd} fill="none" stroke="#a5b4fc" strokeWidth={7} opacity={0.35} strokeLinecap="round" filter="url(#fp-link-glow)" />
                                <path d={gd} fill="none" stroke="url(#fp-link-grad)" strokeWidth={2.75} strokeDasharray="6 5" strokeLinecap="round" opacity={0.9}>
                                  <animate attributeName="stroke-dashoffset" from="0" to="-22" dur="0.9s" repeatCount="indefinite" />
                                </path>
                                <circle cx={ghost.x} cy={ghost.y} r={5} fill="#6366f1" stroke="#fff" strokeWidth={2} />
                                <circle cx={linkCursor.x} cy={linkCursor.y} r={5} fill="#06b6d4" stroke="#fff" strokeWidth={2} />
                              </g>
                            );
                          })()}
                        </svg>
                      );
                    })()}

                    {/* Role slots (with or without an assigned employee) */}
                    {data.assignments.map(a => {
                      const emp = a.employeeId != null ? employeeById.get(a.employeeId) : null;
                      const def = getRoleDef(a.role, emp?.jobTitle);
                      const isEmpty = !emp;
                      const pawnLabel = emp ? emp.employeeName : (a.role || def.label);
                      const pawnNode = (
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
                          onPointerDown={(e) => {
                            if (locked) return;
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            beginTouchDrag(e, {
                              kind: "assignment", id: a.id, label: pawnLabel,
                              offX: (e.clientX - rect.left) / zoom - 30,
                              offY: (e.clientY - rect.top) / zoom - 30,
                            });
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
                          className="absolute flex flex-col items-center cursor-grab active:cursor-grabbing group"
                          style={{ left: a.x - 30, top: a.y - 30, zIndex: 10 + (((a as any).zIndex ?? 0)) }}
                          data-testid={`assignment-${a.id}`}
                          data-assignment-id={a.id}
                          title={isEmpty ? `${def.label} — غير معيّن` : `${emp!.employeeName} — ${def.label}`}
                        >
                          <div className="group-hover:scale-110 transition-transform drop-shadow-lg">
                            <PersonAvatar def={def} size={64} empty={isEmpty} />
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
                          {/* Link handle — drag from here to another pawn to
                              create a multi-task link. Stops propagation so
                              the pawn itself doesn't start a move drag. */}
                          {!locked && (
                            <button
                              type="button"
                              onPointerDown={(e) => beginLinkDrag(a.id, e)}
                              onMouseDown={(e) => e.stopPropagation()}
                              onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              className={`absolute -top-1 -left-1 w-6 h-6 rounded-full shadow-md border flex items-center justify-center z-20 transition-opacity touch-none ${
                                linkingFrom === a.id
                                  ? "bg-indigo-500 text-white border-indigo-600 opacity-100"
                                  : "bg-white text-indigo-600 border-border opacity-0 group-hover:opacity-100"
                              }`}
                              title="اسحب إلى بطاقة أخرى لإنشاء ربط (multi-task)"
                              data-testid={`btn-link-assignment-${a.id}`}
                              style={{ cursor: linkingFrom === a.id ? "grabbing" : "crosshair" }}
                            >
                              <Link2 className="w-3 h-3" />
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
                      // Right-click on desktop / long-press on iPad opens this
                      // context menu. shadcn's ContextMenu handles both natively.
                      return (
                        <ContextMenu key={a.id}>
                          <ContextMenuTrigger asChild disabled={locked}>{pawnNode}</ContextMenuTrigger>
                          <ContextMenuContent className="w-52">
                            <ContextMenuItem
                              onSelect={() => setEditAssignDialog({
                                id: a.id, employeeId: a.employeeId,
                                employeeName: emp?.employeeName ?? null,
                                role: a.role || emp?.jobTitle || "",
                                notes: a.notes || "",
                              })}
                              data-testid={`ctx-edit-${a.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5 ml-2" /> تعديل
                            </ContextMenuItem>
                            {!isEmpty && (
                              <ContextMenuItem
                                onSelect={() => {
                                  recordOp({ type: "update", id: a.id, prev: { employeeId: a.employeeId }, next: { employeeId: null } });
                                  updateAssignment.mutate({ id: a.id, body: { employeeId: null } });
                                }}
                                data-testid={`ctx-clear-${a.id}`}
                              >
                                <XIcon className="w-3.5 h-3.5 ml-2" /> إزالة الموظف (إبقاء الموقع)
                              </ContextMenuItem>
                            )}
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => {
                                // Bring to front: one above the current max.
                                const maxZ = (data?.assignments || []).reduce(
                                  (m, x) => Math.max(m, ((x as any).zIndex ?? 0)), 0,
                                );
                                updateAssignment.mutate({ id: a.id, body: { zIndex: maxZ + 1 } });
                              }}
                              data-testid={`ctx-front-${a.id}`}
                            >
                              <ArrowUp className="w-3.5 h-3.5 ml-2" /> إلى الأمام
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => {
                                const minZ = (data?.assignments || []).reduce(
                                  (m, x) => Math.min(m, ((x as any).zIndex ?? 0)), 0,
                                );
                                updateAssignment.mutate({ id: a.id, body: { zIndex: minZ - 1 } });
                              }}
                              data-testid={`ctx-back-${a.id}`}
                            >
                              <ArrowDown className="w-3.5 h-3.5 ml-2" /> إلى الخلف
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => {
                                recordOp({ type: "delete", id: a.id, snapshot: {
                                  role: a.role ?? null, x: a.x, y: a.y,
                                  employeeId: a.employeeId, notes: a.notes ?? null,
                                } });
                                deleteAssignment.mutate(a.id);
                              }}
                              data-testid={`ctx-delete-${a.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 ml-2" /> حذف الموقع نهائياً
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </div>
                  </div>
                </div>

              {/* BOTTOM STATUS BAR */}
              <div className="h-8 border-t border-slate-200/80 bg-white flex items-center justify-between px-3 shrink-0 text-[10px] text-slate-500 font-medium">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowGrid(!showGrid)} className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors" data-testid="btn-toggle-grid">
                    <Grid3x3 className="w-3 h-3" /> {showGrid ? "الشبكة مفعلة" : "الشبكة معطلة"}
                  </button>
                  <Separator orientation="vertical" className="h-3" />
                  <button type="button" onClick={() => setLocked(!locked)} className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors" data-testid="btn-toggle-lock">
                    {locked ? <Lock className="w-3 h-3 text-amber-600" /> : <Unlock className="w-3 h-3" />}
                    {locked ? "اللوحة مقفولة" : "اللوحة مفتوحة"}
                  </button>
                  <Separator orientation="vertical" className="h-3" />
                  <button type="button" onClick={() => setSnapGrid(!snapGrid)} className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors" data-testid="btn-toggle-snap">
                    <Magnet className="w-3 h-3" /> {snapGrid ? "الالتصاق مفعّل" : "الالتصاق معطّل"}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-slate-500" data-testid="status-coverage">
                    المناطق {data.zones.length} • {data.assignments.length - emptySlots.length}/{data.assignments.length}
                  </span>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="text-slate-400">المخطط محفوظ تلقائياً</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden />
                </div>
              </div>
            </div>

            {/* RIGHT RAIL (RTL: visual left) — coverage + status
                On lg+: static side column. On smaller screens: slide-in drawer from left. */}
            <div
              {...(!mobileLeftOpen && { inert: "" as any, "aria-hidden": true })}
              className={`w-64 border-r border-slate-200/80 bg-white flex flex-col shrink-0 shadow-[-2px_0_12px_rgba(0,0,0,0.02)]
              lg:relative lg:z-10 lg:!translate-x-0 lg:[&]:!pointer-events-auto lg:[&]:!opacity-100
              max-lg:fixed max-lg:top-0 max-lg:bottom-0 max-lg:left-0 max-lg:z-40 max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-200
              ${mobileLeftOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full max-lg:pointer-events-none"}`}>
              <div className="h-12 border-b border-slate-200/80 flex items-center px-4 font-bold text-xs shrink-0 justify-between">
                <span>حالة التغطية (الوردية {SHIFTS.find(s => s.value === selectedShift)?.label})</span>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 lg:hidden text-slate-400"
                  onClick={() => setMobileLeftOpen(false)}
                  data-testid="btn-close-left-drawer"
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                  {(() => {
                    const total = data.assignments.length;
                    const filled = total - emptySlots.length;
                    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                    const tone = pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-rose-600";
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between items-end text-xs">
                          <span className="text-slate-600 font-medium">تغطية الوردية</span>
                          <span className={`font-bold tabular-nums ${tone}`}>{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2 bg-slate-100" />
                        <p className="text-[10px] text-slate-400 tabular-nums">{filled} من أصل {total} موقع معيّن</p>
                      </div>
                    );
                  })()}

                  <Separator />

                  <div className="space-y-2.5">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">نواقص حرجة</h4>
                    {missingByRole.size === 0 && unassignedScheduledCount === 0 ? (
                      <div className="text-[11px] text-slate-400 italic">لا توجد نواقص</div>
                    ) : (
                      <>
                        {Array.from(missingByRole.entries()).slice(0, 4).map(([role, n]) => (
                          <div key={role} className="bg-amber-50 border border-amber-100 rounded-md p-2.5 flex gap-2.5 items-start" data-testid={`missing-role-${role}`}>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-xs font-bold text-amber-700 truncate">{role} ({n}) ناقص</span>
                              <span className="text-[10px] text-amber-600/80">موقع شاغر يحتاج إلى تعيين</span>
                            </div>
                          </div>
                        ))}
                        {unassignedScheduledCount > 0 && (
                          <div className="bg-sky-50 border border-sky-100 rounded-md p-2.5 flex gap-2.5 items-start" data-testid="missing-scheduled">
                            <Users className="w-3.5 h-3.5 text-sky-600 mt-0.5 shrink-0" />
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-xs font-bold text-sky-700">{unassignedScheduledCount} مجدول بلا موقع</span>
                              <span className="text-[10px] text-sky-600/80">موظفون مجدولون لكن لم يُعيَّنوا</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">مناطق مكتملة</h4>
                    {(() => {
                      const byZone = data.zones.map(z => {
                        const inside = data.assignments.filter(a =>
                          a.x >= z.x && a.x <= z.x + z.width && a.y >= z.y && a.y <= z.y + z.height
                        );
                        const filled = inside.filter(a => a.employeeId != null).length;
                        return { z, total: inside.length, filled };
                      }).filter(item => item.total > 0 && item.filled === item.total);
                      if (byZone.length === 0) {
                        return <div className="text-[11px] text-slate-400 italic">لا توجد مناطق مكتملة بعد</div>;
                      }
                      return byZone.slice(0, 8).map(({ z, total, filled }) => (
                        <div key={z.id} className="flex items-center gap-2" data-testid={`complete-zone-${z.id}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-xs text-slate-600 truncate flex-1">{z.name}</span>
                          <span className="text-[10px] text-slate-400 tabular-nums">{filled}/{total}</span>
                        </div>
                      ));
                    })()}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">خريطة مصغرة</h4>
                    <div className="aspect-video border border-dashed border-slate-200 rounded-md bg-slate-50 flex items-center justify-center" data-testid="minimap-placeholder">
                      <span className="text-[10px] text-slate-400">قريباً</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Cross-page quick links to related modules */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">صفحات ذات علاقة</h4>
                    <Link
                      href="/shift-management"
                      className="flex items-center gap-2 p-2 rounded-md text-xs text-slate-600 hover:bg-amber-50 hover:text-[#E4B136] transition-colors border border-transparent hover:border-amber-200"
                      data-testid="link-shift-management"
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 truncate">إدارة الورديات والجداول</span>
                    </Link>
                    <Link
                      href="/attendance-dashboard"
                      className="flex items-center gap-2 p-2 rounded-md text-xs text-slate-600 hover:bg-amber-50 hover:text-[#E4B136] transition-colors border border-transparent hover:border-amber-200"
                      data-testid="link-attendance"
                    >
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 truncate">لوحة الحضور والانصراف</span>
                    </Link>
                    <Link
                      href="/branch-employees"
                      className="flex items-center gap-2 p-2 rounded-md text-xs text-slate-600 hover:bg-amber-50 hover:text-[#E4B136] transition-colors border border-transparent hover:border-amber-200"
                      data-testid="link-branch-employees"
                    >
                      <UserIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 truncate">موظفو الفرع</span>
                    </Link>
                  </div>
                </div>
              </ScrollArea>
            </div>
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

        {/* Touch-drag ghost — follows the finger on iPad / mobile */}
        {touchGhost && (
          <div
            className="fixed z-[9999] pointer-events-none px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium shadow-2xl border border-primary-foreground/30 -translate-x-1/2 -translate-y-1/2 max-w-[180px] truncate"
            style={{ left: touchGhost.x, top: touchGhost.y }}
            data-testid="touch-drag-ghost"
          >
            <Hand className="w-3 h-3 inline-block ml-1" />{touchGhost.label}
          </div>
        )}

        {/* Hidden printable view — rendered off-screen, captured by react-to-print.
            Scaled to fit A4 landscape (≈1040×610px usable at 96dpi with 8mm margins). */}
        <div className="hidden print:block" style={{ position: "absolute", left: -99999, top: 0 }}>
          <PrintableFloorPlan
            printRef={printableRef}
            data={data}
            branches={branches as any[]}
            selectedBranchId={selectedBranchId}
            selectedShift={selectedShift}
            selectedDate={selectedDate}
            employeeById={employeeById}
            emptySlotsCount={emptySlots.length}
            getRoleDef={getRoleDef}
            shapeStyle={shapeStyle}
          />
        </div>

        {/* ============ Batch 3 dialogs ============ */}

        {/* Save template dialog */}
        <Dialog open={!!saveTplDialog} onOpenChange={(o) => { if (!o) setSaveTplDialog(null); }}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>حفظ المخطط كقالب</DialogTitle>
              <DialogDescription>
                احفظ مواقع الوظائف (وربما المناطق) لإعادة استخدامها لاحقاً في أي وردية أو فرع.
              </DialogDescription>
            </DialogHeader>
            {saveTplDialog && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">اسم القالب</Label>
                  <Input
                    autoFocus
                    value={saveTplDialog.name}
                    onChange={(e) => setSaveTplDialog({ ...saveTplDialog, name: e.target.value })}
                    placeholder="مثال: توزيع نهاية الأسبوع — صباحي"
                    data-testid="input-template-name"
                  />
                </div>
                <div>
                  <Label className="text-xs">وصف (اختياري)</Label>
                  <Textarea
                    rows={2}
                    value={saveTplDialog.description}
                    onChange={(e) => setSaveTplDialog({ ...saveTplDialog, description: e.target.value })}
                    placeholder="ملاحظات قصيرة عن متى يُستخدم هذا القالب"
                    data-testid="input-template-description"
                  />
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Switch
                      checked={saveTplDialog.includeZones}
                      onCheckedChange={(v) => setSaveTplDialog({ ...saveTplDialog, includeZones: v })}
                      data-testid="switch-include-zones"
                    />
                    تضمين المناطق في القالب
                  </label>
                </div>
                {isAdmin && (
                  <div>
                    <Label className="text-xs">النطاق</Label>
                    <Select value={saveTplDialog.scope} onValueChange={(v: any) => setSaveTplDialog({ ...saveTplDialog, scope: v })}>
                      <SelectTrigger className="h-9" data-testid="select-template-scope">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="branch">هذا الفرع فقط</SelectItem>
                        <SelectItem value="global">قالب عام (لكل الفروع)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
                  سيُحفظ: {data?.assignments.length ?? 0} موقع{saveTplDialog.includeZones ? ` و ${data?.zones.length ?? 0} منطقة` : ""} — بدون أسماء الموظفين.
                </div>
                <DialogFooter className="flex-row-reverse gap-2">
                  <Button
                    disabled={!saveTplDialog.name.trim() || saveTemplate.isPending}
                    onClick={() => saveTemplate.mutate(saveTplDialog)}
                    data-testid="btn-confirm-save-template"
                  >
                    {saveTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <Save className="w-4 h-4 me-1" />}
                    حفظ القالب
                  </Button>
                  <Button variant="outline" onClick={() => setSaveTplDialog(null)}>إلغاء</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* WhatsApp / SMS share dialog */}
        <Dialog open={!!waDialog} onOpenChange={(o) => { if (!o) setWaDialog(null); }}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>مشاركة التوزيع</DialogTitle>
              <DialogDescription>أرسل ملخص توزيع الوردية لأرقام الموظفين أو مجموعة المشرفين.</DialogDescription>
            </DialogHeader>
            {waDialog && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Label className="text-xs">القناة:</Label>
                  <div className="flex rounded-md border overflow-hidden">
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs ${waDialog.channel === "walink" ? "bg-green-600 text-white" : "bg-background"}`}
                      onClick={() => setWaDialog({ ...waDialog, channel: "walink" })}
                      data-testid="btn-channel-walink"
                      title="يفتح محادثة واتساب جاهزة في متصفحك — لا يحتاج Twilio"
                    >رابط واتساب مباشر</button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs ${waDialog.channel === "whatsapp" ? "bg-green-700 text-white" : "bg-background"}`}
                      onClick={() => setWaDialog({ ...waDialog, channel: "whatsapp" })}
                      data-testid="btn-channel-whatsapp"
                      title="إرسال آلي عبر Twilio — يتطلب أن يكون المستلم قد فعّل Sandbox"
                    >واتساب (آلي)</button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs ${waDialog.channel === "sms" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                      onClick={() => setWaDialog({ ...waDialog, channel: "sms" })}
                      data-testid="btn-channel-sms"
                    >SMS</button>
                  </div>
                </div>
                {waDialog.channel === "walink" && (
                  <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2" data-testid="hint-walink">
                    سيتم فتح نافذة واتساب جاهزة لكل رقم — يكفي أن تضغط "إرسال" داخل واتساب. تأكد من السماح للمتصفح بفتح النوافذ المنبثقة.
                  </div>
                )}
                {waDialog.channel === "whatsapp" && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2" data-testid="hint-whatsapp">
                    ملاحظة: في وضع Twilio Sandbox، يجب على كل مستلم أن يرسل أولاً رسالة "join &lt;keyword&gt;" إلى رقم Twilio. إن لم يفعل، ستفشل الرسالة بصمت.
                  </div>
                )}
                <div>
                  <Label className="text-xs flex items-center justify-between">
                    <span>المستلمون</span>
                    <button
                      type="button"
                      className="text-primary hover:underline text-xs"
                      onClick={() => setWaDialog({ ...waDialog, recipients: [...waDialog.recipients, { phone: "", name: "" }] })}
                      data-testid="btn-add-recipient"
                    >+ إضافة مستلم</button>
                  </Label>
                  <div className="space-y-1.5 max-h-44 overflow-auto">
                    {waDialog.recipients.map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5" data-testid={`recipient-row-${i}`}>
                        <div className="flex items-center gap-1 flex-1">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            value={r.phone}
                            onChange={(e) => {
                              const next = [...waDialog.recipients];
                              next[i] = { ...next[i], phone: e.target.value };
                              setWaDialog({ ...waDialog, recipients: next });
                            }}
                            placeholder="+9665XXXXXXXX"
                            className="h-8 text-xs"
                            dir="ltr"
                            data-testid={`input-recipient-phone-${i}`}
                          />
                        </div>
                        <Input
                          value={r.name}
                          onChange={(e) => {
                            const next = [...waDialog.recipients];
                            next[i] = { ...next[i], name: e.target.value };
                            setWaDialog({ ...waDialog, recipients: next });
                          }}
                          placeholder="الاسم (اختياري)"
                          className="h-8 text-xs flex-1"
                          data-testid={`input-recipient-name-${i}`}
                        />
                        <Button
                          variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600"
                          disabled={waDialog.recipients.length === 1}
                          onClick={() => {
                            const next = waDialog.recipients.filter((_, idx) => idx !== i);
                            setWaDialog({ ...waDialog, recipients: next });
                          }}
                          data-testid={`btn-remove-recipient-${i}`}
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs flex items-center justify-between">
                    <span>الرسالة</span>
                    <button
                      type="button" className="text-primary hover:underline text-xs"
                      onClick={() => setWaDialog({ ...waDialog, message: buildShareMessage() })}
                      data-testid="btn-regenerate-message"
                    >↻ توليد من جديد</button>
                  </Label>
                  <Textarea
                    value={waDialog.message}
                    onChange={(e) => setWaDialog({ ...waDialog, message: e.target.value })}
                    rows={10}
                    className="text-xs font-mono"
                    data-testid="input-share-message"
                  />
                  <div className="text-[10px] text-muted-foreground text-end">{waDialog.message.length} حرف</div>
                </div>
                <DialogFooter className="flex-row-reverse gap-2">
                  <Button
                    disabled={
                      sendWhatsApp.isPending ||
                      !waDialog.message.trim() ||
                      waDialog.recipients.every(r => !r.phone.trim())
                    }
                    onClick={() => {
                      // Normalize + validate: keep digits and leading +, then
                      // require 8–15 digits (E.164 range). Deduplicate by
                      // normalized phone so a number listed twice only sends
                      // once. Cheap SMS-length guard at 1000 chars (≈6 SMS
                      // segments) — WhatsApp allows more but this protects
                      // against accidental dumps.
                      const seen = new Set<string>();
                      const valid: WaRecipient[] = [];
                      for (const r of waDialog.recipients) {
                        const raw = (r.phone || "").trim();
                        const normalized = raw.replace(/[^\d+]/g, "");
                        const digits = normalized.replace(/\D/g, "");
                        if (digits.length < 8 || digits.length > 15) continue;
                        if (seen.has(normalized)) continue;
                        seen.add(normalized);
                        valid.push({ phone: normalized, name: (r.name || "").trim() });
                      }
                      if (valid.length === 0) {
                        toast({ title: "أدخل رقماً صالحاً واحداً على الأقل", description: "الأرقام يجب أن تكون بين 8 و 15 رقماً (مع رمز الدولة).", variant: "destructive" });
                        return;
                      }
                      if (waDialog.channel === "sms" && waDialog.message.length > 1000) {
                        toast({ title: "الرسالة طويلة جداً للـ SMS", description: `${waDialog.message.length} حرف — حدّد 1000 حرف.`, variant: "destructive" });
                        return;
                      }
                      if (waDialog.message.length > 4000) {
                        toast({ title: "الرسالة طويلة جداً", description: `${waDialog.message.length} حرف — حدّد 4000 حرف.`, variant: "destructive" });
                        return;
                      }
                      sendWhatsApp.mutate({ ...waDialog, recipients: valid });
                    }}
                    data-testid="btn-send-share"
                  >
                    {sendWhatsApp.isPending ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <Send className="w-4 h-4 me-1" />}
                    {waDialog.channel === "walink" ? "فتح المحادثات" : "إرسال"}
                  </Button>
                  <Button variant="outline" onClick={() => setWaDialog(null)}>إلغاء</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* History side panel */}
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="left" className="w-full sm:max-w-md flex flex-col" dir="rtl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <HistoryIcon className="w-4 h-4" /> سجل تغييرات المخطط
              </SheetTitle>
              <SheetDescription>آخر العمليات على هذا الفرع — كل وردية مدموجة معاً.</SheetDescription>
            </SheetHeader>
            <div className="flex items-center justify-between mt-2 mb-2">
              <span className="text-xs text-muted-foreground">{history.length} عملية</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => refetchHistory()} data-testid="btn-refresh-history">
                ↻ تحديث
              </Button>
            </div>
            <ScrollArea className="flex-1 -mx-6 px-6">
              {historyLoading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin me-2" /> جاري التحميل…
                </div>
              )}
              {!historyLoading && history.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">لا توجد عمليات مسجلة بعد.</div>
              )}
              <div className="space-y-2">
                {history.map((h: any) => {
                  const actionTone =
                    h.action?.startsWith("create") ? "border-emerald-300 bg-emerald-50" :
                    h.action?.startsWith("delete") ? "border-rose-300 bg-rose-50" :
                    h.action?.startsWith("apply") ? "border-violet-300 bg-violet-50" :
                    "border-sky-300 bg-sky-50";
                  return (
                    <div key={h.id} className={`border rounded-md p-2 text-xs ${actionTone}`} data-testid={`history-row-${h.id}`}>
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-medium">{h.details || h.action}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums" dir="ltr">
                          {new Date(h.createdAt).toLocaleString("ar-SA", { hour12: false })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>👤 {h.userName || "نظام"}</span>
                        <span className="font-mono">{h.action}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
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
