import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, Download, Eye, AlertCircle, Lock, Calendar, 
  Users, KeyRound, CheckCircle, XCircle, Info 
} from "lucide-react";

interface SharedDocument {
  id: number;
  title: string;
  description: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  mimeType: string;
  accessLevel: string;
  currentVersion: number;
  createdAt: string;
}

interface ShareInfo {
  permission: string;
  canDownload: boolean;
  expiresAt: string | null;
  accessCount: number | null;
  maxAccessCount: number | null;
}

type PageState = 'loading' | 'password_required' | 'error' | 'success';

export default function SharedDocumentPage() {
  const params = useParams<{ shareLink: string }>();
  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const canPreview = (fileType: string) => {
    return ["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase());
  };

  const fetchDocument = async (sharePassword?: string) => {
    try {
      const response = await fetch(`/api/documents/share/${params.shareLink}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: sharePassword }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401 && data.requiresPassword) {
          setPageState('password_required');
          setPasswordError(sharePassword ? "كلمة المرور غير صحيحة" : null);
          return;
        }
        setError(data.error || "حدث خطأ في تحميل الوثيقة");
        setPageState('error');
        return;
      }
      
      setDocument(data.document);
      setShareInfo({
        permission: data.permission,
        canDownload: data.canDownload,
        expiresAt: data.expiresAt,
        accessCount: data.accessCount,
        maxAccessCount: data.maxAccessCount,
      });
      setPageState('success');
    } catch (err) {
      setError("فشل في الاتصال بالخادم");
      setPageState('error');
    }
  };

  useEffect(() => {
    if (params.shareLink) {
      fetchDocument();
    }
  }, [params.shareLink]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError("يرجى إدخال كلمة المرور");
      return;
    }
    setIsSubmittingPassword(true);
    setPasswordError(null);
    await fetchDocument(password);
    setIsSubmittingPassword(false);
  };

  const handleDownload = () => {
    if (document && shareInfo?.canDownload) {
      const filename = document.filePath.split("/").pop();
      window.open(`/api/documents/shared-file/${params.shareLink}/${filename}`, "_blank");
    }
  };

  const getPreviewUrl = () => {
    if (document && params.shareLink) {
      const filename = document.filePath.split("/").pop();
      return `/api/documents/shared-file/${params.shareLink}/${filename}`;
    }
    return "";
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-2xl" data-testid="loading-card">
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === 'password_required') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md" data-testid="password-card">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle data-testid="password-title">وثيقة محمية بكلمة مرور</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="pr-10"
                    data-testid="input-password"
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-red-600 flex items-center gap-1" data-testid="password-error">
                    <XCircle className="h-4 w-4" />
                    {passwordError}
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full bg-amber-600 hover:bg-amber-700"
                disabled={isSubmittingPassword}
                data-testid="btn-submit-password"
              >
                {isSubmittingPassword ? "جاري التحقق..." : "فتح الوثيقة"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center" data-testid="error-card">
          <CardContent className="py-12">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2" data-testid="error-title">
              تعذر الوصول للوثيقة
            </h2>
            <p className="text-gray-600" data-testid="error-message">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!document || !shareInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card data-testid="document-card">
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <FileText className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl" data-testid="document-title">
                    {document.title}
                  </CardTitle>
                  {document.description && (
                    <p className="text-gray-600 mt-1" data-testid="document-description">
                      {document.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <Badge variant="outline" className="shrink-0" data-testid="badge-shared">
                  وثيقة مشتركة
                </Badge>
                <Badge 
                  variant={shareInfo.canDownload ? "default" : "secondary"}
                  className="shrink-0"
                  data-testid="badge-permission"
                >
                  {shareInfo.canDownload ? "عرض وتحميل" : "عرض فقط"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-gray-50 rounded-lg" data-testid="info-filetype">
                <p className="text-xs text-gray-500 mb-1">نوع الملف</p>
                <p className="font-medium">{document.fileType.toUpperCase()}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg" data-testid="info-filesize">
                <p className="text-xs text-gray-500 mb-1">حجم الملف</p>
                <p className="font-medium">{formatFileSize(document.fileSize)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg" data-testid="info-version">
                <p className="text-xs text-gray-500 mb-1">الإصدار</p>
                <p className="font-medium">{document.currentVersion}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg" data-testid="info-date">
                <p className="text-xs text-gray-500 mb-1">تاريخ الإنشاء</p>
                <p className="font-medium">{formatDate(document.createdAt)}</p>
              </div>
            </div>

            {(shareInfo.expiresAt || shareInfo.maxAccessCount) && (
              <div className="space-y-3 mb-6">
                {shareInfo.expiresAt && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200" data-testid="info-expiry">
                    <Calendar className="h-5 w-5 text-amber-600" />
                    <span className="text-amber-800">
                      ينتهي الرابط في: {formatDate(shareInfo.expiresAt)}
                    </span>
                  </div>
                )}
                {shareInfo.maxAccessCount && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200" data-testid="info-access-count">
                    <Users className="h-5 w-5 text-blue-600" />
                    <span className="text-blue-800">
                      عدد مرات الوصول: {shareInfo.accessCount || 0} من {shareInfo.maxAccessCount}
                    </span>
                  </div>
                )}
              </div>
            )}

            {!shareInfo.canDownload && (
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg border mb-6" data-testid="info-view-only">
                <Info className="h-5 w-5 text-gray-600" />
                <span className="text-gray-700">
                  هذه الوثيقة للعرض فقط ولا يمكن تحميلها
                </span>
              </div>
            )}

            <div className="flex gap-3">
              {canPreview(document.fileType) && (
                <Button
                  onClick={() => window.open(getPreviewUrl(), "_blank")}
                  className="gap-2 bg-amber-600 hover:bg-amber-700"
                  data-testid="btn-preview"
                >
                  <Eye className="h-4 w-4" />
                  معاينة
                </Button>
              )}
              {shareInfo.canDownload && (
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="gap-2"
                  data-testid="btn-download"
                >
                  <Download className="h-4 w-4" />
                  تحميل
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {canPreview(document.fileType) && (
          <Card data-testid="preview-card">
            <CardHeader>
              <CardTitle className="text-lg">معاينة الوثيقة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: "600px" }}>
                {document.fileType.toLowerCase() === "pdf" ? (
                  <iframe
                    src={getPreviewUrl()}
                    className="w-full h-full"
                    title={document.title}
                    data-testid="preview-iframe"
                  />
                ) : (
                  <img
                    src={getPreviewUrl()}
                    alt={document.title}
                    className="w-full h-full object-contain"
                    data-testid="preview-image"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-gray-500" data-testid="footer-text">
          <p>تم مشاركة هذه الوثيقة من BUTTER BAKERY SYSTEM</p>
        </div>
      </div>
    </div>
  );
}
