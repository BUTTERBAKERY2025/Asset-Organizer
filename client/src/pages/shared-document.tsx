import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Eye, AlertCircle, Lock, Calendar, File } from "lucide-react";

interface SharedDocument {
  id: number;
  title: string;
  description: string | null;
  fileType: string;
  fileSize: number;
  filePath: string;
  accessLevel: string;
  currentVersion: number;
  createdAt: string;
}

interface ShareInfo {
  permission: string;
  expiresAt: string | null;
  accessCount: number;
  maxAccessCount: number | null;
}

export default function SharedDocumentPage() {
  const params = useParams<{ shareLink: string }>();
  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const canPreview = (fileType: string) => {
    return ["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase());
  };

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await fetch(`/api/documents/share/${params.shareLink}`);
        const data = await response.json();
        
        if (!response.ok) {
          setError(data.error || "حدث خطأ في تحميل الوثيقة");
          return;
        }
        
        setDocument(data.document);
        setShareInfo({
          permission: data.permission,
          expiresAt: data.expiresAt,
          accessCount: data.accessCount,
          maxAccessCount: data.maxAccessCount,
        });
      } catch (err) {
        setError("فشل في الاتصال بالخادم");
      } finally {
        setIsLoading(false);
      }
    };

    if (params.shareLink) {
      fetchDocument();
    }
  }, [params.shareLink]);

  const handleDownload = () => {
    if (document) {
      const filename = document.filePath.split("/").pop();
      window.open(`/api/documents/file/${filename}`, "_blank");
    }
  };

  const getPreviewUrl = () => {
    if (document) {
      const filename = document.filePath.split("/").pop();
      return `/api/documents/file/${filename}`;
    }
    return "";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-2xl">
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">رابط غير صالح</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <FileText className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{document.title}</CardTitle>
                  {document.description && (
                    <p className="text-gray-600 mt-1">{document.description}</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0">
                وثيقة مشتركة
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">نوع الملف</p>
                <p className="font-medium">{document.fileType.toUpperCase()}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">حجم الملف</p>
                <p className="font-medium">{formatFileSize(document.fileSize)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">الإصدار</p>
                <p className="font-medium">{document.currentVersion}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">تاريخ الإنشاء</p>
                <p className="font-medium">{formatDate(document.createdAt)}</p>
              </div>
            </div>

            {shareInfo?.expiresAt && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 mb-6">
                <Calendar className="h-5 w-5 text-amber-600" />
                <span className="text-amber-800">
                  ينتهي الرابط في: {formatDate(shareInfo.expiresAt)}
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
              <Button
                onClick={handleDownload}
                variant="outline"
                className="gap-2"
                data-testid="btn-download"
              >
                <Download className="h-4 w-4" />
                تحميل
              </Button>
            </div>
          </CardContent>
        </Card>

        {canPreview(document.fileType) && (
          <Card>
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
                  />
                ) : (
                  <img
                    src={getPreviewUrl()}
                    alt={document.title}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-gray-500">
          <p>تم مشاركة هذه الوثيقة من نظام باتر لإدارة المخابز</p>
        </div>
      </div>
    </div>
  );
}
