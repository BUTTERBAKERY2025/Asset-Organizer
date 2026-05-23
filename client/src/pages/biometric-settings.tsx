import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Fingerprint,
  ChevronLeft,
  Building2,
  Users,
  Smartphone,
  ScanFace,
  Shield,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Settings,
  AlertTriangle,
  Hash,
  Monitor,
  Tablet,
  MoreVertical,
  Info,
  Plus,
  Scan,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import type { BranchEmployee } from "@shared/schema";

function base64urlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface BiometricCredentialInfo {
  id: number;
  registrationMethod: string;
  deviceType: string | null;
  deviceModel: string | null;
  deviceOS: string | null;
  deviceBrowser: string | null;
  deviceInfo: string | null;
  isActive: boolean;
  registeredByName: string | null;
  registeredById: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  deactivationReason: string | null;
  createdAt: string;
}

interface AttendanceStats {
  totalAttendance: number;
  biometricAttendance: number;
  onTimeCount: number;
  lateCount: number;
  lastAttendanceDate: string | null;
}

interface LastAttendance {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  locationInfo: string | null;
  deviceInfo: string | null;
  biometricVerified: boolean;
  status: string;
}

interface EmployeeBiometricData {
  employee: BranchEmployee;
  biometricStatus: "registered" | "not_registered";
  credentials: BiometricCredentialInfo[];
  totalCredentials: number;
  activeCredentials: number;
  attendanceStats: AttendanceStats | null;
  lastAttendance: LastAttendance | null;
}

interface Branch {
  id: string;
  name: string;
}

const registrationMethodLabels: Record<string, string> = {
  fingerprint: "بصمة الإصبع",
  face: "التعرف على الوجه",
};

const registrationMethodIcons: Record<string, typeof Fingerprint> = {
  fingerprint: Fingerprint,
  face: ScanFace,
};

const deviceTypeLabels: Record<string, string> = {
  mobile_android: "هاتف أندرويد",
  mobile_ios: "هاتف آيفون",
  tablet: "جهاز لوحي",
  desktop: "كمبيوتر",
  unknown: "غير معروف",
};

const deviceTypeIcons: Record<string, typeof Smartphone> = {
  mobile_android: Smartphone,
  mobile_ios: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  unknown: Monitor,
};

export default function BiometricSettingsPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeBiometricData | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCredential, setEditingCredential] = useState<BiometricCredentialInfo | null>(null);
  const [editMethod, setEditMethod] = useState("");
  const [editDeviceType, setEditDeviceType] = useState("");
  const [editDeviceModel, setEditDeviceModel] = useState("");
  const [deleteCredentialId, setDeleteCredentialId] = useState<number | null>(null);
  const [resetEmployeeId, setResetEmployeeId] = useState<string | null>(null);
  const [resetEmployeeName, setResetEmployeeName] = useState("");
  const [deactivateCredentialId, setDeactivateCredentialId] = useState<number | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [registerEmployee, setRegisterEmployee] = useState<EmployeeBiometricData | null>(null);
  const [registerMethod, setRegisterMethod] = useState<string>("fingerprint");
  const [registerStep, setRegisterStep] = useState<"choose" | "scanning" | "success" | "error">("choose");
  const [registerError, setRegisterError] = useState("");
  const { toast } = useToast();
  const { isAdmin, user: currentUser } = useAuth();
  const { canView, canCreate, canEdit, canDelete, hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const canViewBiometric = canView("biometric_settings");
  const canCreateBiometric = canCreate("biometric_settings");
  const canEditBiometric = canEdit("biometric_settings");
  const canDeleteBiometric = canDelete("biometric_settings");
  const canChangeStatus = hasPermission("biometric_settings", "change_status");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: employeesData = [], isLoading } = useQuery<EmployeeBiometricData[]>({
    queryKey: ["/api/biometric-settings/branch", selectedBranch],
    queryFn: async () => {
      if (!selectedBranch) return [];
      const res = await fetch(`/api/biometric-settings/branch/${selectedBranch}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedBranch,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/biometric-settings/stats"],
    queryFn: async () => {
      const res = await fetch("/api/biometric-settings/stats", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: isAdmin,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive, reason }: { id: number; isActive: boolean; reason?: string }) => {
      const res = await fetch(`/api/biometric-settings/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive, reason }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometric-settings/branch", selectedBranch] });
      queryClient.invalidateQueries({ queryKey: ["/api/biometric-settings/stats"] });
      toast({ title: "تم تحديث حالة البصمة" });
      setDeactivateCredentialId(null);
      setDeactivateReason("");
    },
    onError: () => {
      toast({ title: "فشل في تحديث حالة البصمة", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/biometric-settings/${id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometric-settings/branch", selectedBranch] });
      toast({ title: "تم تحديث إعدادات البصمة" });
      setShowEditDialog(false);
    },
    onError: () => {
      toast({ title: "فشل في تحديث الإعدادات", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/biometric-settings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometric-settings/branch", selectedBranch] });
      queryClient.invalidateQueries({ queryKey: ["/api/biometric-settings/stats"] });
      toast({ title: "تم حذف البصمة بنجاح" });
      setDeleteCredentialId(null);
    },
    onError: () => {
      toast({ title: "فشل في حذف البصمة", variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await fetch(`/api/biometric-settings/employee/${employeeId}/reset`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometric-settings/branch", selectedBranch] });
      queryClient.invalidateQueries({ queryKey: ["/api/biometric-settings/stats"] });
      toast({ title: "تم إعادة تعيين البصمة", description: data.message });
      setResetEmployeeId(null);
    },
    onError: () => {
      toast({ title: "فشل في إعادة تعيين البصمة", variant: "destructive" });
    },
  });

  const filteredEmployees = employeesData.filter(emp =>
    !searchQuery || emp.employee.employeeName.includes(searchQuery) ||
    emp.employee.employeeNumber?.includes(searchQuery) ||
    emp.employee.jobTitle?.includes(searchQuery)
  );

  const registeredCount = employeesData.filter(e => e.biometricStatus === "registered").length;
  const notRegisteredCount = employeesData.filter(e => e.biometricStatus === "not_registered").length;

  const openRegisterDialog = (emp: EmployeeBiometricData) => {
    setRegisterEmployee(emp);
    setRegisterMethod("fingerprint");
    setRegisterStep("choose");
    setRegisterError("");
    setShowRegisterDialog(true);
  };

  const detectDeviceType = (): string => {
    const ua = navigator.userAgent.toLowerCase();
    if (/ipad/.test(ua)) return "tablet";
    if (/iphone/.test(ua)) return "mobile_ios";
    if (/android/.test(ua) && /mobile/.test(ua)) return "mobile_android";
    if (/android/.test(ua)) return "tablet";
    return "desktop";
  };

  const detectDeviceModel = (): string => {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return "iPhone";
    if (/iPad/.test(ua)) return "iPad";
    const androidMatch = ua.match(/;\s*([^;)]+)\s*Build/);
    if (androidMatch) return androidMatch[1].trim();
    if (/Mac/.test(ua)) return "Mac";
    if (/Windows/.test(ua)) return "Windows PC";
    return "جهاز غير معروف";
  };

  const handleStartRegistration = async () => {
    if (!registerEmployee || !selectedBranch) return;
    setRegisterStep("scanning");
    setRegisterError("");

    try {
      const challengeRes = await fetch("/api/biometric-settings/register/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employeeId: `branch_emp_${registerEmployee.employee.id}`,
          employeeName: registerEmployee.employee.employeeName,
          branchId: selectedBranch,
        }),
      });

      if (!challengeRes.ok) {
        const err = await challengeRes.json();
        throw new Error(err.error || "فشل في إنشاء تحدي التسجيل");
      }

      const options = await challengeRes.json();

      if (!window.PublicKeyCredential) {
        throw new Error("متصفحك لا يدعم تسجيل البصمة. استخدم متصفح حديث مثل Chrome أو Safari");
      }

      const challengeBuffer = base64urlToBuffer(options.challenge);
      const userIdBuffer = base64urlToBuffer(options.user.id);

      const excludeCredentials = (options.excludeCredentials || []).map((c: any) => ({
        id: base64urlToBuffer(c.id),
        type: c.type as PublicKeyCredentialType,
        transports: (c.transports || ["internal"]) as AuthenticatorTransport[],
      }));

      const rpId = window.location.hostname;
      console.log("[Biometric] RP ID:", rpId, "Server RP ID:", options.rp.id);

      const createOptions: PublicKeyCredentialCreationOptions = {
        challenge: challengeBuffer,
        rp: { name: options.rp.name, id: rpId },
        user: {
          id: userIdBuffer,
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        authenticatorSelection: {
          authenticatorAttachment: "platform" as AuthenticatorAttachment,
          userVerification: "required" as UserVerificationRequirement,
          residentKey: "required" as ResidentKeyRequirement,
          requireResidentKey: true,
        },
        excludeCredentials,
        timeout: 60000,
        attestation: "none" as AttestationConveyancePreference,
      };

      console.log("[Biometric] Creating credential with options:", JSON.stringify({
        rpId: createOptions.rp.id,
        userName: createOptions.user.name,
        excludeCount: excludeCredentials.length,
      }));

      const credential = await navigator.credentials.create({
        publicKey: createOptions,
      }) as PublicKeyCredential;

      if (!credential) throw new Error("تم إلغاء عملية التسجيل");

      const response = credential.response as AuthenticatorAttestationResponse;
      const credentialIdBase64 = bufferToBase64url(credential.rawId);
      const pubKeyData = response.getPublicKey?.() || response.attestationObject;
      const publicKeyBase64 = bufferToBase64url(pubKeyData);

      const completeRes = await fetch("/api/biometric-settings/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employeeId: `branch_emp_${registerEmployee.employee.id}`,
          employeeName: registerEmployee.employee.employeeName,
          branchId: selectedBranch,
          credentialId: credentialIdBase64,
          publicKey: publicKeyBase64,
          registrationMethod: registerMethod,
          deviceType: detectDeviceType(),
          deviceModel: detectDeviceModel(),
        }),
      });

      if (!completeRes.ok) {
        const err = await completeRes.json();
        throw new Error(err.error || "فشل في حفظ البصمة");
      }

      setRegisterStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/biometric-settings/branch", selectedBranch] });
      queryClient.invalidateQueries({ queryKey: ["/api/biometric-settings/stats"] });
      toast({ title: "تم تسجيل البصمة بنجاح", description: `تم تسجيل بصمة ${registerEmployee.employee.employeeName}` });
    } catch (err: any) {
      console.error("[Biometric] Registration error:", err.name, err.message, err);
      if (err.name === "NotAllowedError") {
        setRegisterError("تم رفض الوصول للبصمة. تأكد من السماح بالبصمة في إعدادات الجهاز وأن الجهاز يدعم البصمة");
      } else if (err.name === "NotSupportedError") {
        setRegisterError("جهازك لا يدعم هذا النوع من التسجيل البيومتري. تأكد من استخدام جهاز يدعم البصمة");
      } else if (err.name === "SecurityError") {
        setRegisterError("خطأ أمني: تأكد من استخدام اتصال HTTPS آمن");
      } else if (err.name === "InvalidStateError") {
        setRegisterError("البصمة مسجلة مسبقاً لهذا الموظف على هذا الجهاز");
      } else {
        setRegisterError(err.message || "حدث خطأ أثناء تسجيل البصمة");
      }
      setRegisterStep("error");
    }
  };

  const openEditDialog = (cred: BiometricCredentialInfo) => {
    setEditingCredential(cred);
    setEditMethod(cred.registrationMethod);
    setEditDeviceType(cred.deviceType || "");
    setEditDeviceModel(cred.deviceModel || "");
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editingCredential) return;
    updateMutation.mutate({
      id: editingCredential.id,
      data: {
        registrationMethod: editMethod,
        deviceType: editDeviceType || null,
        deviceModel: editDeviceModel || null,
      },
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ar-SA-u-nu-latn", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!canViewBiometric) {
    return (
      <Layout>
        <div className="page-container" dir="rtl">
          <div className="flex flex-col items-center justify-center py-20">
            <Shield className="h-16 w-16 text-red-400 mb-4" />
            <h2 className="text-xl font-bold text-gray-700 mb-2">غير مصرح بالوصول</h2>
            <p className="text-gray-500 mb-4">ليس لديك صلاحية للوصول إلى إعدادات البصمة</p>
            <Link href="/settings">
              <Button variant="outline">
                <ChevronLeft className="h-4 w-4 ml-2" />
                العودة للإعدادات
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container" dir="rtl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="back-to-settings">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Fingerprint className="h-7 w-7 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">إعدادات بصمة الموظفين</h1>
              <p className="text-sm text-gray-500">إدارة ومراقبة تسجيل البصمة البيومترية لموظفي الفروع</p>
            </div>
          </div>
        </div>

        {isAdmin && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="p-4 text-center">
                <Fingerprint className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-purple-700">{stats.total}</div>
                <div className="text-xs text-purple-600">إجمالي البصمات</div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-green-700">{stats.active}</div>
                <div className="text-xs text-green-600">بصمات نشطة</div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 text-center">
                <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-red-700">{stats.inactive}</div>
                <div className="text-xs text-red-600">بصمات معطلة</div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4 text-center">
                <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-blue-700">
                  {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                </div>
                <div className="text-xs text-blue-600">نسبة التفعيل</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <Label className="mb-2 block">اختر الفرع</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="اختر الفرع لعرض الموظفين" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {branch.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="mb-2 block">بحث عن موظف</Label>
                <Input
                  placeholder="اسم الموظف أو الرقم الوظيفي..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="search-employee"
                />
              </div>
              {selectedBranch && (
                <div className="flex gap-2 text-sm">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    <CheckCircle className="h-3 w-3 ml-1" />
                    مسجل: {registeredCount}
                  </Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                    <XCircle className="h-3 w-3 ml-1" />
                    غير مسجل: {notRegisteredCount}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!selectedBranch ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500">اختر فرعاً لعرض إعدادات البصمة</h3>
              <p className="text-sm text-gray-400 mt-2">حدد الفرع من القائمة أعلاه لاستعراض موظفيه وإعدادات البصمة الخاصة بهم</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="h-12 w-12 text-purple-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500">جاري تحميل بيانات الموظفين...</p>
            </CardContent>
          </Card>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500">لا يوجد موظفون</h3>
              <p className="text-sm text-gray-400 mt-2">لا يوجد موظفون مسجلون في هذا الفرع</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                موظفو الفرع ({filteredEmployees.length} موظف)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">حالة البصمة</TableHead>
                      <TableHead className="text-right">نوع البصمة</TableHead>
                      <TableHead className="text-right">الجهاز</TableHead>
                      <TableHead className="text-right">الموقع</TableHead>
                      <TableHead className="text-right">آخر حضور</TableHead>
                      <TableHead className="text-right">عدد الاستخدامات</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((item) => {
                      const activeCred = item.credentials.find(c => c.isActive);
                      const MethodIcon = activeCred ? (registrationMethodIcons[activeCred.registrationMethod] || Fingerprint) : Fingerprint;
                      const DeviceIcon = activeCred?.deviceType ? (deviceTypeIcons[activeCred.deviceType] || Monitor) : Smartphone;

                      return (
                        <TableRow key={item.employee.id} data-testid={`employee-row-${item.employee.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.employee.employeeName}</div>
                              <div className="text-xs text-gray-500">
                                {item.employee.employeeNumber && <span>{item.employee.employeeNumber}</span>}
                                {item.employee.jobTitle && <span className="mr-1">• {item.employee.jobTitle}</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.biometricStatus === "registered" ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                <CheckCircle className="h-3 w-3 ml-1" />
                                مسجلة
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                                <XCircle className="h-3 w-3 ml-1" />
                                غير مسجلة
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {activeCred ? (
                              <div className="flex items-center gap-2">
                                {activeCred.registrationMethod === "face" ? (
                                  <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1" data-testid={`biometric-type-${item.employee.id}`}>
                                    <ScanFace className="h-5 w-5 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">بصمة وجه</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1" data-testid={`biometric-type-${item.employee.id}`}>
                                    <Fingerprint className="h-5 w-5 text-purple-600" />
                                    <span className="text-sm font-medium text-purple-700">بصمة إصبع</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {activeCred ? (
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1 text-sm">
                                  <DeviceIcon className="h-4 w-4 text-blue-500" />
                                  <span>{activeCred.deviceModel || deviceTypeLabels[activeCred.deviceType || "unknown"]}</span>
                                </div>
                                {activeCred.deviceOS && activeCred.deviceOS !== "غير معروف" && (
                                  <span className="text-xs text-gray-500">{activeCred.deviceOS}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.lastAttendance?.locationInfo ? (
                              <div className="flex items-center gap-1 text-sm text-green-700">
                                <MapPin className="h-3.5 w-3.5 text-green-500" />
                                <span className="text-xs max-w-[120px] truncate">{item.lastAttendance.locationInfo}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.lastAttendance ? (
                              <div className="flex flex-col">
                                <span className="text-sm">{item.lastAttendance.date}</span>
                                <span className="text-xs text-gray-500">
                                  {item.lastAttendance.checkIn && `دخول: ${item.lastAttendance.checkIn}`}
                                </span>
                                {item.lastAttendance.biometricVerified && (
                                  <Badge className="bg-blue-50 text-blue-600 text-[10px] w-fit mt-0.5">
                                    <ShieldCheck className="h-2.5 w-2.5 ml-0.5" />
                                    موثقة
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {activeCred ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-lg font-bold text-purple-700">{activeCred.usageCount}</span>
                                <span className="text-[10px] text-gray-500">مرة</span>
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`actions-btn-${item.employee.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  {canCreateBiometric && (
                                    <DropdownMenuItem
                                      onClick={() => openRegisterDialog(item)}
                                      className="text-purple-700 focus:text-purple-700 focus:bg-purple-50"
                                      data-testid={`register-btn-${item.employee.id}`}
                                    >
                                      <Plus className="h-4 w-4 ml-2" />
                                      تسجيل بصمة جديدة
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { setSelectedEmployee(item); setShowDetailsDialog(true); }}>
                                    <Eye className="h-4 w-4 ml-2" />
                                    عرض التفاصيل
                                  </DropdownMenuItem>

                                  {activeCred && canEditBiometric && (
                                    <DropdownMenuItem onClick={() => openEditDialog(activeCred)}>
                                      <Edit className="h-4 w-4 ml-2" />
                                      تعديل إعدادات البصمة
                                    </DropdownMenuItem>
                                  )}

                                  {activeCred && canChangeStatus && (
                                    <DropdownMenuItem
                                      onClick={() => setDeactivateCredentialId(activeCred.id)}
                                    >
                                      <ToggleLeft className="h-4 w-4 ml-2 text-orange-500" />
                                      تعطيل البصمة
                                    </DropdownMenuItem>
                                  )}

                                  {!activeCred && item.credentials.length > 0 && canChangeStatus && (
                                    <DropdownMenuItem
                                      onClick={() => toggleMutation.mutate({ id: item.credentials[0].id, isActive: true })}
                                    >
                                      <ToggleRight className="h-4 w-4 ml-2 text-green-500" />
                                      تفعيل البصمة
                                    </DropdownMenuItem>
                                  )}

                                  {canDeleteBiometric && item.credentials.length > 0 && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                                        onClick={() => {
                                          setResetEmployeeId(String(item.employee.id));
                                          setResetEmployeeName(item.employee.employeeName);
                                        }}
                                      >
                                        <RefreshCw className="h-4 w-4 ml-2" />
                                        إعادة تعيين جميع البصمات
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-purple-600" />
                مراقبة بصمة: {selectedEmployee?.employee.employeeName}
              </DialogTitle>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <span className="text-xs text-gray-500">الاسم</span>
                    <p className="font-medium text-sm">{selectedEmployee.employee.employeeName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">الرقم الوظيفي</span>
                    <p className="font-medium text-sm">{selectedEmployee.employee.employeeNumber || "-"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">الوظيفة</span>
                    <p className="font-medium text-sm">{selectedEmployee.employee.jobTitle || "-"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">حالة البصمة</span>
                    <p>
                      {selectedEmployee.biometricStatus === "registered" ? (
                        <Badge className="bg-green-100 text-green-700">مسجلة</Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-300">غير مسجلة</Badge>
                      )}
                    </p>
                  </div>
                </div>

                {selectedEmployee.attendanceStats && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-1">
                      <Clock className="h-4 w-4 text-blue-500" />
                      إحصائيات الحضور
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-blue-700">{selectedEmployee.attendanceStats.totalAttendance}</div>
                        <div className="text-xs text-blue-600">إجمالي الحضور</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-green-700">{selectedEmployee.attendanceStats.biometricAttendance}</div>
                        <div className="text-xs text-green-600">حضور ببصمة</div>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-emerald-700">{selectedEmployee.attendanceStats.onTimeCount}</div>
                        <div className="text-xs text-emerald-600">في الوقت</div>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-orange-700">{selectedEmployee.attendanceStats.lateCount}</div>
                        <div className="text-xs text-orange-600">تأخير</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedEmployee.lastAttendance && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-1">
                      <Eye className="h-4 w-4 text-purple-500" />
                      آخر حضور مسجل
                    </h4>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">التاريخ:</span>
                          <p className="font-medium">{selectedEmployee.lastAttendance.date}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">وقت الدخول:</span>
                          <p className="font-medium">{selectedEmployee.lastAttendance.checkIn || "-"}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">وقت الخروج:</span>
                          <p className="font-medium">{selectedEmployee.lastAttendance.checkOut || "لم يسجل بعد"}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">الحالة:</span>
                          <p>
                            {selectedEmployee.lastAttendance.status === "on_time" && <Badge className="bg-green-100 text-green-700">في الوقت</Badge>}
                            {selectedEmployee.lastAttendance.status === "late" && <Badge className="bg-orange-100 text-orange-700">متأخر</Badge>}
                            {selectedEmployee.lastAttendance.status === "absent" && <Badge className="bg-red-100 text-red-700">غائب</Badge>}
                            {selectedEmployee.lastAttendance.status === "completed" && <Badge className="bg-blue-100 text-blue-700">مكتمل</Badge>}
                            {!["on_time", "late", "absent", "completed"].includes(selectedEmployee.lastAttendance.status) && (
                              <Badge variant="outline">{selectedEmployee.lastAttendance.status}</Badge>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">تحقق البصمة:</span>
                          <p>
                            {selectedEmployee.lastAttendance.biometricVerified ? (
                              <Badge className="bg-green-100 text-green-700"><ShieldCheck className="h-3 w-3 ml-1" /> موثقة</Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500">غير موثقة</Badge>
                            )}
                          </p>
                        </div>
                        {selectedEmployee.lastAttendance.locationInfo && (
                          <div>
                            <span className="text-gray-500 text-xs">الموقع الجغرافي:</span>
                            <p className="font-medium text-xs">{selectedEmployee.lastAttendance.locationInfo}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedEmployee.credentials.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-700 flex items-center gap-1">
                      <Shield className="h-4 w-4 text-amber-500" />
                      البصمات المسجلة ({selectedEmployee.credentials.length})
                    </h4>
                    {selectedEmployee.credentials.map((cred, idx) => {
                      const MethodIcon = registrationMethodIcons[cred.registrationMethod] || Fingerprint;
                      const DeviceIcon = cred.deviceType ? (deviceTypeIcons[cred.deviceType] || Monitor) : Smartphone;
                      return (
                        <Card key={cred.id} className={`${cred.isActive ? 'border-green-200' : 'border-red-200 bg-red-50/30'}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <MethodIcon className="h-5 w-5 text-purple-500" />
                                <span className="font-medium">بصمة #{idx + 1} - {registrationMethodLabels[cred.registrationMethod] || cred.registrationMethod}</span>
                              </div>
                              {cred.isActive ? (
                                <Badge className="bg-green-100 text-green-700">نشطة</Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-600 border-red-300">معطلة</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                              <div className="flex items-start gap-2">
                                <DeviceIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                <div>
                                  <span className="text-gray-500 text-xs block">الجهاز</span>
                                  <span className="font-medium">{cred.deviceModel || deviceTypeLabels[cred.deviceType || "unknown"]}</span>
                                </div>
                              </div>
                              {cred.deviceOS && cred.deviceOS !== "غير معروف" && (
                                <div>
                                  <span className="text-gray-500 text-xs block">نظام التشغيل</span>
                                  <span className="font-medium">{cred.deviceOS}</span>
                                </div>
                              )}
                              {cred.deviceBrowser && cred.deviceBrowser !== "غير معروف" && (
                                <div>
                                  <span className="text-gray-500 text-xs block">المتصفح</span>
                                  <span className="font-medium">{cred.deviceBrowser}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500 text-xs block">تاريخ التسجيل</span>
                                <span className="font-medium">{formatDate(cred.createdAt)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 text-xs block">سجّلها</span>
                                <span className="font-medium">{cred.registeredByName || "غير محدد"}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 text-xs block">آخر استخدام</span>
                                <span className="font-medium">{formatDate(cred.lastUsedAt)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 text-xs block">عدد الاستخدامات</span>
                                <span className="font-bold text-lg text-purple-700">{cred.usageCount}</span>
                              </div>
                              {!cred.isActive && cred.deactivationReason && (
                                <div className="col-span-2 md:col-span-3 bg-red-50 rounded p-2">
                                  <span className="text-red-500 text-xs">سبب التعطيل:</span>
                                  <span className="mr-1 text-red-700">{cred.deactivationReason}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-2" />
                    <p className="text-gray-500">لا توجد بصمات مسجلة لهذا الموظف</p>
                    <p className="text-xs text-gray-400 mt-1">يمكن تسجيل البصمة من صفحة الحضور والانصراف</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                تعديل إعدادات البصمة
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>نوع التسجيل</Label>
                <Select value={editMethod} onValueChange={setEditMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fingerprint">
                      <div className="flex items-center gap-2">
                        <Fingerprint className="h-4 w-4" />
                        بصمة الإصبع
                      </div>
                    </SelectItem>
                    <SelectItem value="face">
                      <div className="flex items-center gap-2">
                        <ScanFace className="h-4 w-4" />
                        التعرف على الوجه
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>نوع الجهاز</Label>
                <Select value={editDeviceType} onValueChange={setEditDeviceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع الجهاز" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile_android">هاتف أندرويد</SelectItem>
                    <SelectItem value="mobile_ios">هاتف آيفون</SelectItem>
                    <SelectItem value="tablet">جهاز لوحي</SelectItem>
                    <SelectItem value="desktop">كمبيوتر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>موديل الجهاز</Label>
                <Input
                  placeholder="مثال: Samsung Galaxy S24, iPhone 15..."
                  value={editDeviceModel}
                  onChange={(e) => setEditDeviceModel(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>إلغاء</Button>
              <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <CheckCircle className="h-4 w-4 ml-2" />}
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteCredentialId !== null} onOpenChange={(open) => !open && setDeleteCredentialId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد حذف البصمة</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذه البصمة؟ سيحتاج الموظف إلى إعادة تسجيل البصمة. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteCredentialId && deleteMutation.mutate(deleteCredentialId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Trash2 className="h-4 w-4 ml-2" />}
                حذف البصمة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={resetEmployeeId !== null} onOpenChange={(open) => !open && setResetEmployeeId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>إعادة تعيين جميع بصمات الموظف</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف جميع بصمات الموظف <strong>{resetEmployeeName}</strong> وسيحتاج إلى إعادة التسجيل. هل أنت متأكد؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => resetEmployeeId && resetMutation.mutate(resetEmployeeId)}
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                إعادة تعيين
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deactivateCredentialId !== null} onOpenChange={(open) => !open && setDeactivateCredentialId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تعطيل البصمة</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم تعطيل هذه البصمة ولن يتمكن الموظف من استخدامها للحضور. يمكنك إعادة تفعيلها لاحقاً.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2 px-1">
              <Label>سبب التعطيل (اختياري)</Label>
              <Textarea
                className="mt-2"
                placeholder="أدخل سبب تعطيل البصمة..."
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
              />
            </div>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => deactivateCredentialId && toggleMutation.mutate({ id: deactivateCredentialId, isActive: false, reason: deactivateReason })}
                disabled={toggleMutation.isPending}
              >
                {toggleMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <ToggleLeft className="h-4 w-4 ml-2" />}
                تعطيل البصمة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showRegisterDialog} onOpenChange={(open) => { if (!open) { setShowRegisterDialog(false); setRegisterStep("choose"); } }}>
          <DialogContent dir="rtl" className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Fingerprint className="h-6 w-6 text-purple-600" />
                </div>
                تسجيل بصمة جديدة
              </DialogTitle>
            </DialogHeader>

            {registerEmployee && (
              <div className="bg-gray-50 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{registerEmployee.employee.employeeName}</p>
                    <p className="text-xs text-gray-500">
                      {registerEmployee.employee.employeeNumber && `رقم: ${registerEmployee.employee.employeeNumber} • `}
                      {(registerEmployee.employee as any).position || registerEmployee.employee.jobTitle || "موظف"}
                    </p>
                  </div>
                  {registerEmployee.totalCredentials > 0 && (
                    <Badge variant="outline" className="mr-auto text-xs">
                      {registerEmployee.totalCredentials} بصمة مسجلة
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {registerStep === "choose" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-3 block">اختر نوع التسجيل البيومتري</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setRegisterMethod("fingerprint")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        registerMethod === "fingerprint"
                          ? "border-purple-500 bg-purple-50 shadow-md"
                          : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/50"
                      }`}
                      data-testid="method-fingerprint"
                    >
                      <Fingerprint className={`h-8 w-8 ${registerMethod === "fingerprint" ? "text-purple-600" : "text-gray-400"}`} />
                      <span className={`text-xs font-medium ${registerMethod === "fingerprint" ? "text-purple-700" : "text-gray-600"}`}>
                        بصمة الإصبع
                      </span>
                    </button>
                    <button
                      onClick={() => setRegisterMethod("face")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        registerMethod === "face"
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                      }`}
                      data-testid="method-face"
                    >
                      <ScanFace className={`h-8 w-8 ${registerMethod === "face" ? "text-blue-600" : "text-gray-400"}`} />
                      <span className={`text-xs font-medium ${registerMethod === "face" ? "text-blue-700" : "text-gray-600"}`}>
                        التعرف على الوجه
                      </span>
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 flex gap-2">
                  <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">كيف يعمل التسجيل؟</p>
                    <p>عند الضغط على "بدء التسجيل"، سيطلب منك الجهاز استخدام {
                      registerMethod === "fingerprint" ? "بصمة الإصبع" : "التعرف على الوجه"
                    } لتأكيد الهوية. تأكد أن الموظف موجود لتنفيذ العملية.</p>
                  </div>
                </div>

                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-base"
                  onClick={handleStartRegistration}
                  data-testid="start-registration-btn"
                >
                  <Scan className="h-5 w-5 ml-2" />
                  بدء التسجيل
                </Button>
              </div>
            )}

            {registerStep === "scanning" && (
              <div className="text-center py-8 space-y-4">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-30" />
                  <div className="relative w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center">
                    {registerMethod === "face" ? (
                      <ScanFace className="h-12 w-12 text-purple-600 animate-pulse" />
                    ) : (
                      <Fingerprint className="h-12 w-12 text-purple-600 animate-pulse" />
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">جاري التسجيل...</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {registerMethod === "fingerprint" && "ضع إصبعك على مستشعر البصمة"}
                    {registerMethod === "face" && "وجّه الكاميرا نحو وجهك"}
                  </p>
                </div>
                <Loader2 className="h-6 w-6 text-purple-500 animate-spin mx-auto" />
              </div>
            )}

            {registerStep === "success" && (
              <div className="text-center py-8 space-y-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck className="h-10 w-10 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-700">تم التسجيل بنجاح!</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    تم حفظ بصمة {registerEmployee?.employee.employeeName} بنجاح
                  </p>
                </div>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => { setShowRegisterDialog(false); setRegisterStep("choose"); }}
                  data-testid="close-success-btn"
                >
                  <CheckCircle className="h-4 w-4 ml-2" />
                  إغلاق
                </Button>
              </div>
            )}

            {registerStep === "error" && (
              <div className="text-center py-6 space-y-4">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="h-10 w-10 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-700">فشل التسجيل</h3>
                  <p className="text-sm text-red-600 mt-2 bg-red-50 rounded-lg p-3">{registerError}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => { setShowRegisterDialog(false); setRegisterStep("choose"); }}
                  >
                    إغلاق
                  </Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => setRegisterStep("choose")}
                    data-testid="retry-registration-btn"
                  >
                    <RefreshCw className="h-4 w-4 ml-2" />
                    إعادة المحاولة
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
