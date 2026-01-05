import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Clock, LogIn, LogOut, Check, Pencil, RotateCcw, Building2, User, Timer } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Branch, AttendanceRecord } from "@shared/schema";

export default function AttendanceCheckPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: branches } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });
  const { data: myAttendance } = useQuery<AttendanceRecord>({
    queryKey: ["/api/attendance/my-today"],
    enabled: !!user,
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.branchId) {
      setSelectedBranch(user.branchId);
    }
  }, [user]);

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
  }, []);

  const checkInMutation = useMutation({
    mutationFn: async (data: { branchId: string; signature: string }) => {
      return apiRequest("/api/attendance/check-in", "POST", {
        branchId: data.branchId,
        signature: data.signature,
        deviceInfo: navigator.userAgent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "تم تسجيل الحضور بنجاح", description: `الوقت: ${format(new Date(), "hh:mm a", { locale: ar })}` });
      clearCanvas();
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "فشل في تسجيل الحضور", variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (signature: string) => {
      return apiRequest("/api/attendance/check-out", "POST", { signature });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "تم تسجيل الانصراف بنجاح", description: `الوقت: ${format(new Date(), "hh:mm a", { locale: ar })}` });
      clearCanvas();
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "فشل في تسجيل الانصراف", variant: "destructive" });
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

  const handleCheckIn = () => {
    if (!hasSignature) {
      toast({ title: "يرجى التوقيع أولاً", variant: "destructive" });
      return;
    }
    if (!selectedBranch) {
      toast({ title: "يرجى اختيار الفرع", variant: "destructive" });
      return;
    }
    checkInMutation.mutate({ branchId: selectedBranch, signature: getSignatureData() });
  };

  const handleCheckOut = () => {
    if (!hasSignature) {
      toast({ title: "يرجى التوقيع أولاً", variant: "destructive" });
      return;
    }
    checkOutMutation.mutate(getSignatureData());
  };

  const isCheckedIn = myAttendance && !myAttendance.actualCheckOut;
  const isCheckedOut = myAttendance && myAttendance.actualCheckOut;

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader className="text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-white/20 rounded-full">
                <Clock className="w-8 h-8" />
              </div>
            </div>
            <CardTitle className="text-2xl">تسجيل الحضور والانصراف</CardTitle>
            <CardDescription className="text-blue-100">
              {format(currentTime, "EEEE, dd MMMM yyyy", { locale: ar })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="text-center">
              <div className="text-5xl font-mono font-bold text-primary" data-testid="current-time">
                {format(currentTime, "hh:mm:ss", { locale: ar })}
              </div>
              <div className="text-lg text-muted-foreground mt-1">
                {format(currentTime, "a", { locale: ar })}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="p-2 bg-primary/10 rounded-full">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-sm text-muted-foreground">{user?.jobTitle || "موظف"}</p>
              </div>
              {myAttendance && (
                <Badge className={`mr-auto ${isCheckedOut ? "bg-gray-100 text-gray-700" : isCheckedIn ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {isCheckedOut ? "تم الانصراف" : isCheckedIn ? "حاضر" : "لم يتم التسجيل"}
                </Badge>
              )}
            </div>

            {myAttendance && (
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-green-50 rounded-lg">
                  <LogIn className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">وقت الحضور</p>
                  <p className="font-mono font-bold text-green-700">{myAttendance.actualCheckIn || "-"}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <LogOut className="w-5 h-5 text-red-600 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">وقت الانصراف</p>
                  <p className="font-mono font-bold text-red-700">{myAttendance.actualCheckOut || "-"}</p>
                </div>
              </div>
            )}

            {!isCheckedIn && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  الفرع
                </label>
                {user?.branchId ? (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {branches?.find(b => b.id === user.branchId)?.name || user.branchId}
                  </div>
                ) : (
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger data-testid="select-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                التوقيع الإلكتروني
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
                مسح التوقيع
              </Button>
            </div>

            <div className="flex gap-3">
              {!isCheckedIn && !isCheckedOut && (
                <Button
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending || !hasSignature || !selectedBranch}
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  size="lg"
                  data-testid="btn-check-in"
                >
                  <LogIn className="w-5 h-5" />
                  {checkInMutation.isPending ? "جاري التسجيل..." : "تسجيل الحضور"}
                </Button>
              )}
              {isCheckedIn && !isCheckedOut && (
                <Button
                  onClick={handleCheckOut}
                  disabled={checkOutMutation.isPending || !hasSignature}
                  className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
                  size="lg"
                  data-testid="btn-check-out"
                >
                  <LogOut className="w-5 h-5" />
                  {checkOutMutation.isPending ? "جاري التسجيل..." : "تسجيل الانصراف"}
                </Button>
              )}
              {isCheckedOut && (
                <div className="flex-1 p-4 bg-gray-100 rounded-lg text-center">
                  <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium">تم تسجيل الحضور والانصراف لهذا اليوم</p>
                  {myAttendance.workingHours && (
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                      <Timer className="w-4 h-4" />
                      ساعات العمل: {myAttendance.workingHours.toFixed(1)} ساعة
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
