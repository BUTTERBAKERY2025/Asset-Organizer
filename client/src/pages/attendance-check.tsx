import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Clock, LogIn, LogOut, Check, Pencil, RotateCcw, Building2, User, Timer, ArrowRight, Users, Calendar, Sun, Moon, Sunrise, Loader2, MapPin, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import type { Branch, EmployeeSchedule, AttendanceRecord } from "@shared/schema";

interface ScheduledEmployee {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeNameEn?: string;
  startTime?: string;
  endTime?: string;
  shiftType?: string;
  scheduleDate: string;
  attendance?: AttendanceRecord;
}

export default function AttendanceCheckPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<ScheduledEmployee | null>(null);
  const [signatureMode, setSignatureMode] = useState<"check_in" | "check_out" | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState<"idle" | "checking" | "valid" | "invalid" | "error" | "no_location">("idle");
  const [locationDistance, setLocationDistance] = useState<number | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation("hr");
  const isRTL = i18n.language === "ar";
  const dateLocale = isRTL ? ar : enUS;

  const SHIFT_TYPES = [
    { value: "morning", label: t("attendanceCheck.morningShift"), icon: Sunrise, color: "text-amber-500" },
    { value: "evening", label: t("attendanceCheck.eveningShift"), icon: Sun, color: "text-orange-500" },
    { value: "night", label: t("attendanceCheck.nightShift"), icon: Moon, color: "text-indigo-500" },
  ];

  const actualToday = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(actualToday);
  const yesterday = format(new Date(new Date().setDate(new Date().getDate() - 1)), "yyyy-MM-dd");

  const { branches, userBranchId, canSelectBranch } = useBranches();

  const { data: scheduledEmployees, isLoading: loadingEmployees } = useQuery<ScheduledEmployee[]>({
    queryKey: ["/api/scheduled-employees-for-attendance", selectedBranch, selectedShift, selectedDate],
    queryFn: async () => {
      if (!selectedBranch || !selectedShift) return [];
      const res = await fetch(`/api/scheduled-employees-for-attendance?branchId=${selectedBranch}&shiftType=${selectedShift}&date=${selectedDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedBranch && !!selectedShift,
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (userBranchId && !selectedBranch) {
      setSelectedBranch(userBranchId);
    }
  }, [userBranchId, selectedBranch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1a365d";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [selectedEmployee, signatureMode]);

  const checkInMutation = useMutation({
    mutationFn: async (data: { employeeId: string; branchId: string; signature: string; scheduleId: number; scheduledStartTime?: string; scheduledEndTime?: string; employeeName?: string; userLatitude?: number; userLongitude?: number; attendanceDate?: string }) => {
      return apiRequest("POST", "/api/attendance/check-in-employee", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-employees-for-attendance"] });
      toast({ title: t("attendanceCheck.checkInSuccess"), description: `${t("attendanceCheck.time")}: ${format(new Date(), "hh:mm a", { locale: dateLocale })}` });
      closeSignatureDialog();
    },
    onError: (error: any) => {
      toast({ title: t("attendanceCheck.error"), description: error.message || t("attendanceCheck.checkInError"), variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (data: { employeeId: string; scheduleId: number; signature: string; attendanceDate?: string }) => {
      return apiRequest("POST", "/api/attendance/check-out-employee", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-employees-for-attendance"] });
      toast({ title: t("attendanceCheck.checkOutSuccess"), description: `${t("attendanceCheck.time")}: ${format(new Date(), "hh:mm a", { locale: dateLocale })}` });
      closeSignatureDialog();
    },
    onError: (error: any) => {
      toast({ title: t("attendanceCheck.error"), description: error.message || t("attendanceCheck.checkOutError"), variant: "destructive" });
    },
  });

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !e.touches[0]) return { x: 0, y: 0 };
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  };

  const startDrawing = (pos: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setIsDrawing(true);
    }
  };

  const draw = (pos: { x: number; y: number }) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
      }
    }
  };

  const getSignatureData = () => {
    return canvasRef.current?.toDataURL("image/png") || "";
  };

  const checkLocationValidity = async () => {
    if (!selectedBranch) return;
    
    const branch = branches.find(b => b.id === selectedBranch);
    if (!branch?.latitude || !branch?.longitude) {
      setLocationStatus("no_location");
      return;
    }
    
    setIsCheckingLocation(true);
    setLocationStatus("checking");
    
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setIsCheckingLocation(false);
      toast({ title: t("attendanceCheck.error"), description: "المتصفح لا يدعم تحديد الموقع", variant: "destructive" });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserCoords(coords);
        try {
          const res = await apiRequest("POST", `/api/branches/${selectedBranch}/validate-location`, {
            userLatitude: coords.latitude,
            userLongitude: coords.longitude,
          });
          const data = await res.json();
          setLocationDistance(data.distance);
          if (data.valid) {
            setLocationStatus("valid");
          } else {
            setLocationStatus("invalid");
          }
        } catch (error) {
          setLocationStatus("error");
        }
        setIsCheckingLocation(false);
      },
      (error) => {
        setIsCheckingLocation(false);
        setLocationStatus("error");
        toast({ title: t("attendanceCheck.error"), description: "فشل في تحديد الموقع الجغرافي", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openSignatureDialog = (employee: ScheduledEmployee, mode: "check_in" | "check_out") => {
    setSelectedEmployee(employee);
    setSignatureMode(mode);
    setHasSignature(false);
    setLocationStatus("idle");
    setLocationDistance(null);
    checkLocationValidity();
  };

  const closeSignatureDialog = () => {
    setSelectedEmployee(null);
    setSignatureMode(null);
    setHasSignature(false);
  };

  const handleSubmitSignature = () => {
    if (!hasSignature || !selectedEmployee) {
      toast({ title: t("attendanceCheck.pleaseSign"), variant: "destructive" });
      return;
    }
    
    // التحقق من الموقع - منع التسجيل إذا كان الموقع غير صحيح
    if (locationStatus === "invalid") {
      toast({ 
        title: "تسجيل الحضور مرفوض", 
        description: "يجب أن تكون داخل نطاق موقع الفرع لتسجيل الحضور", 
        variant: "destructive" 
      });
      return;
    }
    
    if (locationStatus === "checking") {
      toast({ 
        title: "انتظر", 
        description: "جاري التحقق من الموقع...", 
        variant: "destructive" 
      });
      return;
    }
    
    if (locationStatus === "error") {
      toast({ 
        title: "فشل التحقق من الموقع", 
        description: "يرجى تفعيل خدمات الموقع والمحاولة مرة أخرى", 
        variant: "destructive" 
      });
      return;
    }

    if (signatureMode === "check_in") {
      checkInMutation.mutate({
        employeeId: selectedEmployee.employeeId,
        branchId: selectedBranch,
        signature: getSignatureData(),
        scheduleId: selectedEmployee.id,
        scheduledStartTime: selectedEmployee.startTime,
        scheduledEndTime: selectedEmployee.endTime,
        employeeName: selectedEmployee.employeeName,
        userLatitude: userCoords?.latitude,
        userLongitude: userCoords?.longitude,
        attendanceDate: selectedDate,
      });
    } else {
      checkOutMutation.mutate({
        employeeId: selectedEmployee.employeeId,
        scheduleId: selectedEmployee.id,
        signature: getSignatureData(),
        attendanceDate: selectedDate,
      });
    }
  };

  const getEmployeeStatus = (emp: ScheduledEmployee) => {
    if (!emp.attendance) return { label: t("attendanceCheck.notPresent"), color: "bg-gray-100 text-gray-700", canCheckIn: true, canCheckOut: false };
    if (emp.attendance.actualCheckIn && !emp.attendance.actualCheckOut) return { label: t("attendanceCheck.present"), color: "bg-green-100 text-green-700", canCheckIn: false, canCheckOut: true };
    if (emp.attendance.actualCheckOut) return { label: t("attendanceCheck.left"), color: "bg-blue-100 text-blue-700", canCheckIn: false, canCheckOut: false };
    return { label: t("attendanceCheck.waiting"), color: "bg-amber-100 text-amber-700", canCheckIn: true, canCheckOut: false };
  };

  const selectedShiftInfo = SHIFT_TYPES.find(s => s.value === selectedShift);

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9"
              onClick={() => navigate("/attendance-dashboard")}
              data-testid="btn-back"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold" data-testid="page-title">{t("attendanceCheck.pageTitle")}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{t("attendanceCheck.pageDescription")}</p>
            </div>
          </div>
          <div className={isRTL ? "text-left" : "text-right"}>
            <div className="text-xl sm:text-2xl md:text-3xl font-mono font-bold text-primary" data-testid="current-time">
              {format(currentTime, "hh:mm:ss", { locale: dateLocale })}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {format(currentTime, "EEEE, dd MMMM yyyy", { locale: dateLocale })}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t("attendanceCheck.selectBranchShift")}
            </CardTitle>
            <CardDescription>
              {t("attendanceCheck.selectBranchShiftDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {t("attendanceCheck.branch")}
                </label>
                <Select value={selectedBranch} onValueChange={(v) => { setSelectedBranch(v); setSelectedShift(""); }} disabled={!canSelectBranch}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder={t("attendanceCheck.selectBranch")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {branches?.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t("attendanceCheck.shift")}
                </label>
                <Select value={selectedShift} onValueChange={setSelectedShift} disabled={!selectedBranch}>
                  <SelectTrigger data-testid="select-shift">
                    <SelectValue placeholder={t("attendanceCheck.selectShift")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {SHIFT_TYPES.map(shift => (
                      <SelectItem key={shift.value} value={shift.value}>
                        <div className="flex items-center gap-2">
                          <shift.icon className={`w-4 h-4 ${shift.color}`} />
                          {shift.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {t("common.date")}
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setSelectedDate(yesterday)}
                    disabled={selectedDate <= yesterday}
                    data-testid="btn-prev-day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val >= yesterday && val <= actualToday) {
                        setSelectedDate(val);
                      }
                    }}
                    min={yesterday}
                    max={actualToday}
                    className="h-10 text-sm text-center"
                    data-testid="input-attendance-date"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setSelectedDate(actualToday)}
                    disabled={selectedDate >= actualToday}
                    data-testid="btn-next-day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                {selectedDate !== actualToday && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>تاريخ سابق - {format(new Date(selectedDate + 'T00:00:00'), "EEEE, dd MMMM yyyy", { locale: dateLocale })}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedBranch && selectedShift && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t("attendanceCheck.shiftEmployees")} {selectedShiftInfo?.label || t("attendanceCheck.shift")}
                {scheduledEmployees && scheduledEmployees.length > 0 && (
                  <Badge variant="secondary">{scheduledEmployees.length} {t("stats.employee")}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {t("attendanceCheck.scheduledEmployees")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEmployees ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !scheduledEmployees || scheduledEmployees.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t("attendanceCheck.noScheduledEmployees")}</p>
                  <p className="text-xs sm:text-sm mt-2">{t("attendanceCheck.checkShiftManagement")}</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{t("attendanceCheck.employee")}</TableHead>
                        <TableHead className="text-center">{t("attendanceCheck.startTime")}</TableHead>
                        <TableHead className="text-center">{t("attendanceCheck.endTime")}</TableHead>
                        <TableHead className="text-center hidden md:table-cell">{t("attendanceCheck.checkIn")}</TableHead>
                        <TableHead className="text-center hidden md:table-cell">{t("attendanceCheck.checkOut")}</TableHead>
                        <TableHead className="text-center">{t("attendanceCheck.status")}</TableHead>
                        <TableHead className="text-center">{t("attendanceCheck.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledEmployees.map(emp => {
                        const status = getEmployeeStatus(emp);
                        return (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex flex-col">
                                  <span>{emp.employeeName}</span>
                                  {emp.employeeNameEn && (
                                    <span className="text-xs text-muted-foreground">{emp.employeeNameEn}</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs sm:text-sm">{emp.startTime || "-"}</TableCell>
                            <TableCell className="text-center font-mono text-xs sm:text-sm">{emp.endTime || "-"}</TableCell>
                            <TableCell className="text-center hidden md:table-cell">
                              {emp.attendance?.actualCheckIn ? (
                                <span className="font-mono text-green-600 text-xs sm:text-sm">{emp.attendance.actualCheckIn}</span>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-center hidden md:table-cell">
                              {emp.attendance?.actualCheckOut ? (
                                <span className="font-mono text-red-600 text-xs sm:text-sm">{emp.attendance.actualCheckOut}</span>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`${status.color} text-[10px] sm:text-xs`}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                {status.canCheckIn && (
                                  <Button
                                    size="sm"
                                    className="gap-1 bg-green-600 hover:bg-green-700"
                                    onClick={() => openSignatureDialog(emp, "check_in")}
                                    data-testid={`btn-checkin-${emp.employeeId}`}
                                  >
                                    <LogIn className="w-4 h-4" />
                                    {t("attendanceCheck.checkInBtn")}
                                  </Button>
                                )}
                                {status.canCheckOut && (
                                  <Button
                                    size="sm"
                                    className="gap-1 bg-red-600 hover:bg-red-700"
                                    onClick={() => openSignatureDialog(emp, "check_out")}
                                    data-testid={`btn-checkout-${emp.employeeId}`}
                                  >
                                    <LogOut className="w-4 h-4" />
                                    {t("attendanceCheck.checkOutBtn")}
                                  </Button>
                                )}
                                {!status.canCheckIn && !status.canCheckOut && (
                                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Check className="w-4 h-4 text-green-600" />
                                    {t("attendanceCheck.completed")}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!selectedEmployee && !!signatureMode} onOpenChange={() => closeSignatureDialog()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {signatureMode === "check_in" ? (
                  <>
                    <LogIn className="w-5 h-5 text-green-600" />
                    <div className="flex flex-col">
                      <span>{t("attendanceCheck.checkInTitle")} - {selectedEmployee?.employeeName}</span>
                      {selectedEmployee?.employeeNameEn && (
                        <span className="text-sm font-normal text-muted-foreground">{selectedEmployee.employeeNameEn}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <LogOut className="w-5 h-5 text-red-600" />
                    <div className="flex flex-col">
                      <span>{t("attendanceCheck.checkOutTitle")} - {selectedEmployee?.employeeName}</span>
                      {selectedEmployee?.employeeNameEn && (
                        <span className="text-sm font-normal text-muted-foreground">{selectedEmployee.employeeNameEn}</span>
                      )}
                    </div>
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {t("attendanceCheck.signatureRequired")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Location Verification Status */}
              <div className={`p-3 rounded-lg flex items-center gap-3 ${
                locationStatus === "checking" ? "bg-blue-50 border border-blue-200" :
                locationStatus === "valid" ? "bg-green-50 border border-green-200" :
                locationStatus === "invalid" ? "bg-red-50 border border-red-200" :
                locationStatus === "error" ? "bg-orange-50 border border-orange-200" :
                locationStatus === "no_location" ? "bg-gray-50 border border-gray-200" :
                "bg-muted"
              }`}>
                {locationStatus === "checking" && (
                  <>
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-blue-700">جاري التحقق من الموقع...</p>
                    </div>
                  </>
                )}
                {locationStatus === "valid" && (
                  <>
                    <MapPin className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-700">الموقع صحيح ✓</p>
                      {locationDistance !== null && (
                        <p className="text-xs text-green-600">المسافة: {locationDistance.toLocaleString('en-US')} متر من الفرع</p>
                      )}
                    </div>
                  </>
                )}
                {locationStatus === "invalid" && (
                  <>
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-700">الموقع خارج النطاق المسموح</p>
                      {locationDistance !== null && (
                        <p className="text-xs text-red-600">المسافة: {locationDistance.toLocaleString('en-US')} متر (يجب أن تكون داخل نطاق الفرع)</p>
                      )}
                    </div>
                  </>
                )}
                {locationStatus === "error" && (
                  <>
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-orange-700">فشل في تحديد الموقع</p>
                      <p className="text-xs text-orange-600">تأكد من تفعيل خدمات الموقع</p>
                    </div>
                  </>
                )}
                {locationStatus === "no_location" && (
                  <>
                    <MapPin className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">لم يتم تحديد موقع الفرع</p>
                      <p className="text-xs text-gray-500">التحقق من الموقع غير مفعل لهذا الفرع</p>
                    </div>
                  </>
                )}
                {locationStatus === "idle" && (
                  <>
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">في انتظار التحقق من الموقع</p>
                    </div>
                  </>
                )}
              </div>

              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-mono font-bold text-primary">
                  {format(currentTime, "hh:mm:ss", { locale: dateLocale })}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(currentTime, "a", { locale: dateLocale })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Pencil className="w-4 h-4" />
                  {t("attendanceCheck.employeeSignature")}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full touch-none cursor-crosshair"
                    onMouseDown={(e) => startDrawing(getMousePos(e))}
                    onMouseMove={(e) => draw(getMousePos(e))}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={(e) => { e.preventDefault(); startDrawing(getTouchPos(e)); }}
                    onTouchMove={(e) => { e.preventDefault(); draw(getTouchPos(e)); }}
                    onTouchEnd={stopDrawing}
                    data-testid="signature-canvas"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-2" data-testid="btn-clear-signature">
                  <RotateCcw className="w-4 h-4" />
                  {t("attendanceCheck.clearSignature")}
                </Button>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={closeSignatureDialog}
                  className="flex-1"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleSubmitSignature}
                  disabled={(signatureMode === "check_in" ? checkInMutation.isPending : checkOutMutation.isPending) || !hasSignature}
                  className={`flex-1 gap-2 ${signatureMode === "check_in" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                  data-testid="btn-submit-signature"
                >
                  {signatureMode === "check_in" ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                  {(signatureMode === "check_in" ? checkInMutation.isPending : checkOutMutation.isPending) 
                    ? t("attendanceCheck.processing") 
                    : signatureMode === "check_in" ? t("attendanceCheck.confirmCheckIn") : t("attendanceCheck.confirmCheckOut")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
