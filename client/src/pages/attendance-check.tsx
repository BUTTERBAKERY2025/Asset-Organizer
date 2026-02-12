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
import { Clock, LogIn, LogOut, Check, Pencil, RotateCcw, Building2, User, Timer, ArrowRight, Users, Calendar, Sun, Moon, Sunrise, Loader2, MapPin, AlertTriangle, ChevronLeft, ChevronRight, ShieldAlert, Fingerprint, ScanFace, KeyRound } from "lucide-react";
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
  const [biometricStatus, setBiometricStatus] = useState<"idle" | "verifying" | "verified" | "failed" | "unavailable" | "device_mismatch">("idle");
  const [showBiometricRegister, setShowBiometricRegister] = useState<{ employeeId: string; employeeName: string } | null>(null);
  const [biometricRegistering, setBiometricRegistering] = useState(false);
  const [biometricToken, setBiometricToken] = useState<string | null>(null);
  const [employeeBiometricMethod, setEmployeeBiometricMethod] = useState<string | null>(null);
  const [deviceRegisterLoading, setDeviceRegisterLoading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation("hr");
  const isRTL = i18n.language === "ar";
  const dateLocale = isRTL ? ar : enUS;

  const DEVICE_BIOMETRIC_KEY = "biometric_registered_employees";
  const getDeviceRegisteredEmployees = (): string[] => {
    try {
      const stored = localStorage.getItem(DEVICE_BIOMETRIC_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  };
  const markEmployeeRegisteredOnDevice = (employeeId: string) => {
    const list = getDeviceRegisteredEmployees();
    if (!list.includes(employeeId)) {
      list.push(employeeId);
      localStorage.setItem(DEVICE_BIOMETRIC_KEY, JSON.stringify(list));
    }
  };
  const isEmployeeRegisteredOnDevice = (employeeId: string): boolean => {
    return getDeviceRegisteredEmployees().includes(employeeId);
  };

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

  const { data: biometricStatusMap } = useQuery<Record<string, { hasCredential: boolean; credentialCount: number; lastUsed: string | null; registrationMethod: string | null }>>({
    queryKey: ["/api/biometric/branch", selectedBranch],
    queryFn: async () => {
      if (!selectedBranch) return {};
      const res = await fetch(`/api/biometric/branch/${selectedBranch}`);
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!selectedBranch,
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
    mutationFn: async (data: { employeeId: string; branchId: string; signature: string; scheduleId: number; scheduledStartTime?: string; scheduledEndTime?: string; employeeName?: string; userLatitude?: number; userLongitude?: number; attendanceDate?: string; biometricVerified?: boolean; biometricToken?: string | null }) => {
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
    mutationFn: async (data: { employeeId: string; scheduleId: number; signature: string; attendanceDate?: string; biometricVerified?: boolean; biometricToken?: string | null }) => {
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
    setBiometricToken(null);
    const empMethod = biometricStatusMap?.[employee.employeeId]?.registrationMethod || null;
    setEmployeeBiometricMethod(empMethod);
    
    const hasServerCred = biometricStatusMap?.[employee.employeeId]?.hasCredential;
    if (!hasServerCred) {
      setBiometricStatus("unavailable");
    } else if (!isEmployeeRegisteredOnDevice(employee.employeeId)) {
      setBiometricStatus("device_mismatch");
    } else {
      setBiometricStatus("idle");
    }
    checkLocationValidity();
  };

  const closeSignatureDialog = () => {
    setSelectedEmployee(null);
    setSignatureMode(null);
    setHasSignature(false);
  };

  const handleBiometricRegister = async (employeeId: string, employeeName: string) => {
    if (!window.PublicKeyCredential) {
      toast({ title: "غير مدعوم", description: "هذا الجهاز لا يدعم البصمة البيومترية", variant: "destructive" });
      return;
    }

    const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    console.log("[Biometric] Platform authenticator available:", isAvailable);
    
    setBiometricRegistering(true);
    try {
      const optionsRes = await apiRequest("POST", "/api/biometric/register-options", {
        employeeId, employeeName, branchId: selectedBranch,
      });
      const { options, challengeKey } = await optionsRes.json();
      console.log("[Biometric] Received options, rpId:", options.rp?.id);
      
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        rp: options.rp,
        user: {
          id: Uint8Array.from(atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        authenticatorSelection: options.authenticatorSelection,
        timeout: options.timeout,
        attestation: options.attestation,
      };
      
      console.log("[Biometric] Calling navigator.credentials.create...");
      const credential = await navigator.credentials.create({ publicKey: publicKeyOptions }) as PublicKeyCredential;
      if (!credential) throw new Error("فشل في إنشاء البصمة");
      console.log("[Biometric] Credential created successfully");
      
      const credentialId = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(credential.rawId))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      const response = credential.response as AuthenticatorAttestationResponse;
      const pubKeyBytes = response.getPublicKey?.() || new ArrayBuffer(0);
      const publicKey = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(pubKeyBytes))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      await apiRequest("POST", "/api/biometric/register", {
        employeeId, employeeName, branchId: selectedBranch,
        credentialId,
        publicKey: publicKey || credentialId,
        deviceInfo: navigator.userAgent,
        challengeKey,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/branch"] });
      markEmployeeRegisteredOnDevice(employeeId);
      toast({ title: "تم تسجيل البصمة", description: `تم تسجيل بصمة ${employeeName} بنجاح` });
      setShowBiometricRegister(null);
    } catch (error: any) {
      console.error("[Biometric] Registration error:", error.name, error.message);
      if (error.name === "NotAllowedError") {
        toast({ title: "تم الإلغاء", description: "تم إلغاء تسجيل البصمة. تأكد من فتح الموقع مباشرة (ليس داخل إطار) وأن الجهاز يدعم البصمة", variant: "destructive" });
      } else if (error.name === "SecurityError") {
        toast({ title: "خطأ أمني", description: "يجب فتح الموقع عبر HTTPS أو من الرابط المباشر للتطبيق", variant: "destructive" });
      } else {
        toast({ title: "خطأ", description: error.message || "فشل في تسجيل البصمة", variant: "destructive" });
      }
    } finally {
      setBiometricRegistering(false);
    }
  };

  const biometricMethodLabels: Record<string, string> = {
    fingerprint: "بصمة الإصبع",
    face: "بصمة الوجه",
    pin: "رمز PIN",
  };

  const getBiometricIcon = (method: string | null) => {
    if (method === "face") return ScanFace;
    if (method === "pin") return KeyRound;
    return Fingerprint;
  };

  const getBiometricPrompt = (method: string | null) => {
    if (method === "face") return "وجّه وجهك نحو الكاميرا للتحقق";
    if (method === "pin") return "أدخل رمز PIN الخاص بجهازك";
    return "ضع إصبعك على مستشعر البصمة";
  };

  const handleBiometricVerify = async (employeeId: string, forceAttempt: boolean = false) => {
    if (!window.PublicKeyCredential) {
      setBiometricStatus("unavailable");
      return;
    }
    
    const empMethod = biometricStatusMap?.[employeeId]?.registrationMethod || null;
    setEmployeeBiometricMethod(empMethod);
    
    const hasServerCredential = biometricStatusMap?.[employeeId]?.hasCredential;
    if (!hasServerCredential) {
      setBiometricStatus("unavailable");
      return;
    }

    if (!forceAttempt && !isEmployeeRegisteredOnDevice(employeeId)) {
      console.log("[Biometric] Employee not registered on this device (localStorage hint), showing device_mismatch");
      setBiometricStatus("device_mismatch");
      return;
    }
    
    setBiometricStatus("verifying");
    const verifyStartTime = Date.now();
    try {
      const optionsRes = await apiRequest("POST", "/api/biometric/verify-options", { employeeId });
      const optionsData = await optionsRes.json();
      
      if (optionsData.noBiometric) {
        setBiometricStatus("unavailable");
        return;
      }
      
      const { options, challengeKey, registrationMethod } = optionsData;
      if (registrationMethod) {
        setEmployeeBiometricMethod(registrationMethod);
      }
      
      const allowCreds = options.allowCredentials.map((c: any) => ({
        id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), c2 => c2.charCodeAt(0)),
        type: c.type as PublicKeyCredentialType,
        transports: c.transports as AuthenticatorTransport[],
      }));

      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        rpId: options.rpId,
        allowCredentials: allowCreds,
        userVerification: options.userVerification as UserVerificationRequirement,
        timeout: options.timeout,
      };
      
      const assertion = await navigator.credentials.get({ publicKey: publicKeyOptions }) as PublicKeyCredential;
      if (!assertion) throw new Error("فشل التحقق");
      
      const credentialId = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(assertion.rawId))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      const verifyRes = await apiRequest("POST", "/api/biometric/verify", { credentialId, employeeId, challengeKey });
      const verifyData = await verifyRes.json();
      
      if (verifyData.verified) {
        setBiometricStatus("verified");
        setBiometricToken(verifyData.verificationToken || null);
        markEmployeeRegisteredOnDevice(employeeId);
        const methodLabel = biometricMethodLabels[registrationMethod || empMethod || "fingerprint"] || "البصمة";
        toast({ title: "تم التحقق", description: `تم التحقق من ${methodLabel} بنجاح` });
      } else {
        setBiometricStatus("failed");
        toast({ title: "فشل التحقق", description: "لم تتطابق البصمة مع المسجلة", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("[Biometric Verify] Error:", error.name, error.message);
      const errorMsg = (error.message || "").toLowerCase();
      const elapsed = Date.now() - verifyStartTime;
      
      const isNoPasskeys = errorMsg.includes("no passkey") || errorMsg.includes("no credential") || 
                           errorMsg.includes("not registered") || errorMsg.includes("no authenticator") ||
                           errorMsg.includes("empty allow list") || errorMsg.includes("not found");
      
      if (isNoPasskeys || error.name === "InvalidStateError") {
        setBiometricStatus("device_mismatch");
        toast({ 
          title: "البصمة غير موجودة على هذا الجهاز", 
          description: "سجّل البصمة على هذا الجهاز أولاً باستخدام الزر أدناه", 
          variant: "destructive" 
        });
      } else if (error.name === "NotAllowedError") {
        if (elapsed < 3000) {
          setBiometricStatus("device_mismatch");
          toast({ 
            title: "البصمة غير متاحة على هذا الجهاز", 
            description: "سجّل البصمة على هذا الجهاز أولاً", 
            variant: "destructive" 
          });
        } else {
          setBiometricStatus("idle");
          toast({ title: "تم الإلغاء", description: "تم إلغاء عملية التحقق. اضغط الزر لإعادة المحاولة.", variant: "destructive" });
        }
      } else {
        setBiometricStatus("failed");
        toast({ title: "خطأ", description: "فشل التحقق من البصمة، حاول مرة أخرى", variant: "destructive" });
      }
    }
  };

  const handleRegisterOnThisDevice = async () => {
    if (!selectedEmployee || !window.PublicKeyCredential) return;
    
    const employeeId = selectedEmployee.employeeId;
    const employeeName = selectedEmployee.employeeName;
    const method = employeeBiometricMethod || "fingerprint";
    
    setDeviceRegisterLoading(true);
    try {
      const optionsRes = await apiRequest("POST", "/api/biometric/register-options", {
        employeeId, employeeName, branchId: selectedBranch,
      });
      const { options, challengeKey } = await optionsRes.json();
      
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        rp: options.rp,
        user: {
          id: Uint8Array.from(atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        authenticatorSelection: options.authenticatorSelection,
        timeout: options.timeout,
        attestation: options.attestation,
      };
      
      const credential = await navigator.credentials.create({ publicKey: publicKeyOptions }) as PublicKeyCredential;
      if (!credential) throw new Error("فشل في إنشاء البصمة");
      
      const credentialId = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(credential.rawId))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      const response = credential.response as AuthenticatorAttestationResponse;
      const pubKeyBytes = response.getPublicKey?.() || new ArrayBuffer(0);
      const publicKey = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(pubKeyBytes))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      const ua = navigator.userAgent.toLowerCase();
      let deviceType = "desktop";
      let deviceModel = "Unknown";
      if (/ipad/.test(ua)) { deviceType = "tablet"; deviceModel = "iPad"; }
      else if (/iphone/.test(ua)) { deviceType = "mobile_ios"; deviceModel = "iPhone"; }
      else if (/android/.test(ua) && /mobile/.test(ua)) { deviceType = "mobile_android"; }
      else if (/android/.test(ua)) { deviceType = "tablet"; }
      
      await apiRequest("POST", "/api/biometric/register", {
        employeeId, employeeName, branchId: selectedBranch,
        credentialId,
        publicKey: publicKey || credentialId,
        deviceInfo: navigator.userAgent,
        deviceType,
        deviceModel,
        registrationMethod: method,
        challengeKey,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/branch"] });
      markEmployeeRegisteredOnDevice(employeeId);
      
      toast({ title: "تم تسجيل البصمة على هذا الجهاز", description: "الآن سيتم التحقق تلقائياً..." });
      
      setBiometricStatus("idle");
      setTimeout(() => handleBiometricVerify(employeeId), 500);
    } catch (error: any) {
      console.error("[Device Register] Error:", error.name, error.message);
      if (error.name === "NotAllowedError") {
        toast({ title: "تم الإلغاء", description: "تم إلغاء تسجيل البصمة", variant: "destructive" });
      } else {
        toast({ title: "خطأ", description: error.message || "فشل في تسجيل البصمة على هذا الجهاز", variant: "destructive" });
      }
      setBiometricStatus("device_mismatch");
    } finally {
      setDeviceRegisterLoading(false);
    }
  };

  const handleSubmitSignature = () => {
    if (!selectedEmployee) return;

    if (!hasSignature) {
      toast({ title: "التوقيع مطلوب", description: "يرجى وضع توقيعك أولاً", variant: "destructive" });
      return;
    }

    if (biometricStatus !== "verified") {
      toast({ title: "البصمة مطلوبة", description: "يجب التحقق من البصمة قبل تسجيل الحضور أو الانصراف", variant: "destructive" });
      return;
    }
    
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
        biometricVerified: biometricStatus === "verified",
        biometricToken: biometricToken,
      });
    } else {
      checkOutMutation.mutate({
        employeeId: selectedEmployee.employeeId,
        scheduleId: selectedEmployee.id,
        signature: getSignatureData(),
        attendanceDate: selectedDate,
        biometricVerified: biometricStatus === "verified",
        biometricToken: biometricToken,
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
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{t("attendanceCheck.employee")}</TableHead>
                        <TableHead className="text-center">{t("attendanceCheck.startTime")}</TableHead>
                        <TableHead className="text-center">{t("attendanceCheck.endTime")}</TableHead>
                        <TableHead className="text-center hidden md:table-cell">{t("attendanceCheck.checkIn")}</TableHead>
                        <TableHead className="text-center hidden md:table-cell">{t("attendanceCheck.checkOut")}</TableHead>
                        <TableHead className="text-center">{"البصمة"}</TableHead>
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
                              {biometricStatusMap?.[emp.employeeId]?.hasCredential ? (() => {
                                const method = biometricStatusMap?.[emp.employeeId]?.registrationMethod;
                                const MethodIcon = getBiometricIcon(method || null);
                                const methodLabel = biometricMethodLabels[method || "fingerprint"] || "مسجّلة";
                                return (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                                    <MethodIcon className="w-3 h-3" />
                                    {methodLabel}
                                  </Badge>
                                );
                              })() : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-muted-foreground hover:text-primary gap-1"
                                  onClick={() => handleBiometricRegister(emp.employeeId, emp.employeeName)}
                                  disabled={biometricRegistering}
                                  data-testid={`btn-register-biometric-${emp.employeeId}`}
                                >
                                  <Fingerprint className="w-3 h-3" />
                                  تسجيل بصمة
                                </Button>
                              )}
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
          <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
            <DialogHeader className="shrink-0 pb-1">
              <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                {signatureMode === "check_in" ? (
                  <>
                    <LogIn className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{t("attendanceCheck.checkInTitle")} - {selectedEmployee?.employeeName}</span>
                      {selectedEmployee?.employeeNameEn && (
                        <span className="text-xs sm:text-sm font-normal text-muted-foreground truncate">{selectedEmployee.employeeNameEn}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{t("attendanceCheck.checkOutTitle")} - {selectedEmployee?.employeeName}</span>
                      {selectedEmployee?.employeeNameEn && (
                        <span className="text-xs sm:text-sm font-normal text-muted-foreground truncate">{selectedEmployee.employeeNameEn}</span>
                      )}
                    </div>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                يجب التحقق من البصمة والتوقيع معاً لإتمام التسجيل
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 px-0.5">
              <div className={`p-2 sm:p-3 rounded-lg flex items-center gap-2 sm:gap-3 ${
                locationStatus === "checking" ? "bg-blue-50 border border-blue-200" :
                locationStatus === "valid" ? "bg-green-50 border border-green-200" :
                locationStatus === "invalid" ? "bg-red-50 border border-red-200" :
                locationStatus === "error" ? "bg-orange-50 border border-orange-200" :
                locationStatus === "no_location" ? "bg-gray-50 border border-gray-200" :
                "bg-muted"
              }`}>
                {locationStatus === "checking" && (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 animate-spin shrink-0" />
                    <p className="text-xs sm:text-sm font-medium text-blue-700">جاري التحقق من الموقع...</p>
                  </>
                )}
                {locationStatus === "valid" && (
                  <>
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-green-700">الموقع صحيح ✓</p>
                      {locationDistance !== null && (
                        <p className="text-[10px] sm:text-xs text-green-600">المسافة: {locationDistance.toLocaleString('en-US')} متر</p>
                      )}
                    </div>
                  </>
                )}
                {locationStatus === "invalid" && (
                  <>
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-red-700">الموقع خارج النطاق المسموح</p>
                      {locationDistance !== null && (
                        <p className="text-[10px] sm:text-xs text-red-600">المسافة: {locationDistance.toLocaleString('en-US')} متر</p>
                      )}
                    </div>
                  </>
                )}
                {locationStatus === "error" && (
                  <>
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-orange-700">فشل في تحديد الموقع</p>
                      <p className="text-[10px] sm:text-xs text-orange-600">تأكد من تفعيل خدمات الموقع</p>
                    </div>
                  </>
                )}
                {locationStatus === "no_location" && (
                  <>
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-700">لم يتم تحديد موقع الفرع</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">التحقق من الموقع غير مفعل لهذا الفرع</p>
                    </div>
                  </>
                )}
                {locationStatus === "idle" && (
                  <>
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
                    <p className="text-xs sm:text-sm text-muted-foreground">في انتظار التحقق من الموقع</p>
                  </>
                )}
              </div>

              {(() => {
                const method = employeeBiometricMethod || (selectedEmployee ? biometricStatusMap?.[selectedEmployee.employeeId]?.registrationMethod : null) || null;
                const BiometricIcon = getBiometricIcon(method);
                const methodLabel = biometricMethodLabels[method || "fingerprint"] || "البصمة";
                const prompt = getBiometricPrompt(method);

                return (
                  <div className={`p-3 rounded-lg border ${
                    biometricStatus === "verified" ? "bg-green-50 border-green-200" :
                    biometricStatus === "failed" || biometricStatus === "device_mismatch" ? "bg-red-50 border-red-200" :
                    biometricStatus === "verifying" ? "bg-blue-50 border-blue-200" :
                    biometricStatus === "unavailable" ? "bg-gray-50 border-gray-200" :
                    "bg-amber-50 border-amber-200"
                  }`}>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BiometricIcon className={`w-5 h-5 ${
                            biometricStatus === "verified" ? "text-green-600" :
                            biometricStatus === "failed" || biometricStatus === "device_mismatch" ? "text-red-600" :
                            biometricStatus === "verifying" ? "text-blue-600 animate-pulse" :
                            "text-amber-600"
                          }`} />
                          <div>
                            <p className="text-sm font-medium">
                              {biometricStatus === "verified" ? `تم التحقق من ${methodLabel} ✓` :
                               biometricStatus === "device_mismatch" ? `البصمة غير مسجلة على هذا الجهاز` :
                               biometricStatus === "failed" ? `فشل التحقق من ${methodLabel}` :
                               biometricStatus === "verifying" ? `جاري التحقق من ${methodLabel}...` :
                               biometricStatus === "unavailable" ? "لا توجد بصمة مسجلة" :
                               `التحقق عبر ${methodLabel}`}
                            </p>
                            {biometricStatus === "unavailable" && (
                              <p className="text-xs text-red-600 font-medium">يجب تسجيل البصمة أولاً من إعدادات البصمة</p>
                            )}
                            {biometricStatus === "device_mismatch" && (
                              <p className="text-xs text-red-600 mt-0.5">البصمة مسجلة على جهاز آخر. سجّل البصمة على هذا الجهاز للمتابعة.</p>
                            )}
                            {biometricStatus === "verifying" && (
                              <p className="text-xs text-blue-600 mt-0.5">{prompt}</p>
                            )}
                            {biometricStatus === "idle" && (
                              <p className="text-xs text-amber-700 mt-0.5">{prompt}</p>
                            )}
                          </div>
                        </div>
                        {(biometricStatus === "idle" || biometricStatus === "failed") && selectedEmployee && (
                          <Button
                            size="sm"
                            variant={biometricStatus === "failed" ? "destructive" : "default"}
                            onClick={() => selectedEmployee && handleBiometricVerify(selectedEmployee.employeeId)}
                            disabled={false}
                            data-testid="btn-verify-biometric"
                            className="gap-1"
                          >
                            <BiometricIcon className="w-4 h-4" />
                            {biometricStatus === "failed" ? "إعادة المحاولة" : method === "face" ? "تحقق بالوجه" : method === "pin" ? "أدخل PIN" : "ضع بصمتك"}
                          </Button>
                        )}
                      </div>
                      {biometricStatus === "device_mismatch" && selectedEmployee && (
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            className="w-full gap-1 bg-purple-600 hover:bg-purple-700"
                            onClick={handleRegisterOnThisDevice}
                            disabled={deviceRegisterLoading}
                            data-testid="btn-register-this-device"
                          >
                            {deviceRegisterLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <BiometricIcon className="w-4 h-4" />
                            )}
                            {deviceRegisterLoading ? "جاري التسجيل..." : `سجّل ${methodLabel} على هذا الجهاز`}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-1 text-xs"
                            onClick={() => selectedEmployee && handleBiometricVerify(selectedEmployee.employeeId, true)}
                            data-testid="btn-force-verify"
                          >
                            <BiometricIcon className="w-3.5 h-3.5" />
                            حاول التحقق مباشرة (إذا كانت البصمة متزامنة)
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="text-center p-2 sm:p-3 bg-muted rounded-lg">
                <div className="text-2xl sm:text-3xl font-mono font-bold text-primary">
                  {format(currentTime, "hh:mm:ss", { locale: dateLocale })}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {format(currentTime, "a", { locale: dateLocale })}
                </div>
              </div>

              <div className="p-2 sm:p-3 rounded-lg bg-amber-50 border border-amber-300">
                <div className="flex items-start gap-1.5 sm:gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-bold text-amber-800 leading-relaxed">
                      تنبيه: يجب أن يوقع الموظف بنفسه. سيتم مطابقة التوقيع من الموارد البشرية. التوقيع بالنيابة يعرّض للفصل وفقاً للمادة (80) من نظام العمل.
                    </p>
                    <p className="text-[10px] sm:text-xs font-semibold text-amber-700 leading-relaxed" dir="ltr" style={{textAlign: 'left'}}>
                      Employees must sign personally. Signing for others may result in termination under Article (80) of the Saudi Labor Law.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t("attendanceCheck.employeeSignature")}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={120}
                    className="w-full touch-none cursor-crosshair"
                    style={{ height: 'clamp(100px, 18vh, 150px)' }}
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
                <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-1.5 h-7 text-xs sm:text-sm sm:h-8" data-testid="btn-clear-signature">
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t("attendanceCheck.clearSignature")}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 px-1 shrink-0">
              {(() => {
                const method = employeeBiometricMethod || (selectedEmployee ? biometricStatusMap?.[selectedEmployee.employeeId]?.registrationMethod : null) || null;
                const methodLabel = biometricMethodLabels[method || "fingerprint"] || "البصمة";
                const StatusBioIcon = getBiometricIcon(method);
                return (
                  <div className="flex items-center gap-1.5">
                    <StatusBioIcon className={`w-3.5 h-3.5 ${biometricStatus === "verified" ? "text-green-600" : "text-gray-400"}`} />
                    <div className={`w-3 h-3 rounded-full ${biometricStatus === "verified" ? "bg-green-500" : "bg-gray-300"}`} />
                    <span className={`text-xs font-medium ${biometricStatus === "verified" ? "text-green-700" : "text-gray-500"}`}>
                      {biometricStatus === "verified" ? `${methodLabel} ✓` : `${methodLabel} مطلوبة`}
                    </span>
                  </div>
                );
              })()}
              <div className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${hasSignature ? "bg-green-500" : "bg-gray-300"}`} />
                <span className={`text-xs font-medium ${hasSignature ? "text-green-700" : "text-gray-500"}`}>
                  {hasSignature ? "التوقيع ✓" : "التوقيع مطلوب"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 shrink-0 pt-2">
              <Button
                variant="outline"
                onClick={closeSignatureDialog}
                className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSubmitSignature}
                disabled={(signatureMode === "check_in" ? checkInMutation.isPending : checkOutMutation.isPending) || !hasSignature || biometricStatus !== "verified"}
                className={`flex-1 gap-1.5 h-9 sm:h-10 text-xs sm:text-sm ${signatureMode === "check_in" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                data-testid="btn-submit-signature"
              >
                {signatureMode === "check_in" ? <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                {(signatureMode === "check_in" ? checkInMutation.isPending : checkOutMutation.isPending) 
                  ? t("attendanceCheck.processing") 
                  : signatureMode === "check_in" ? t("attendanceCheck.confirmCheckIn") : t("attendanceCheck.confirmCheckOut")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
