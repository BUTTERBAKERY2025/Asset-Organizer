import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Folder,
  FileText,
  Plus,
  Search,
  FolderPlus,
  File,
  Download,
  Eye,
  Archive,
  RotateCcw,
  Share2,
  Clock,
  Lock,
  Unlock,
  MoreVertical,
  ChevronRight,
  Home,
  Grid,
  List,
  Filter,
  Upload,
  X,
  Loader2,
  Link2,
  Copy,
  ExternalLink,
  Calendar,
  CheckCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DocumentCategory {
  id: number;
  name: string;
  nameEn?: string;
  description?: string;
  color: string;
  icon: string;
  isActive: boolean;
}

interface DocumentFolder {
  id: number;
  name: string;
  nameEn?: string;
  description?: string;
  parentId?: number;
  path: string;
  accessLevel: string;
  ownerName?: string;
  isLocked: boolean;
}

interface Document {
  id: number;
  title: string;
  titleEn?: string;
  description?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  mimeType?: string;
  status: string;
  accessLevel: string;
  ownerName?: string;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  isLocked: boolean;
  archivedAt?: string;
  folderId?: number;
  categoryId?: number;
}

interface DocumentStats {
  totalDocuments: number;
  activeDocuments: number;
  archivedDocuments: number;
  totalFolders: number;
  totalCategories: number;
  recentDocuments: Document[];
}

const fileTypeIcons: Record<string, string> = {
  pdf: "📄",
  docx: "📝",
  doc: "📝",
  xlsx: "📊",
  xls: "📊",
  pptx: "📽️",
  ppt: "📽️",
  jpg: "🖼️",
  jpeg: "🖼️",
  png: "🖼️",
  gif: "🖼️",
  zip: "📦",
  rar: "📦",
  txt: "📃",
  csv: "📊",
};

const accessLevelColors: Record<string, string> = {
  private: "bg-red-100 text-red-800",
  internal: "bg-blue-100 text-blue-800",
  public: "bg-green-100 text-green-800",
  confidential: "bg-purple-100 text-purple-800",
};

const accessLevelLabels: Record<string, string> = {
  private: "خاص",
  internal: "داخلي",
  public: "عام",
  confidential: "سري",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  archived: "bg-amber-100 text-amber-800",
  deleted: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  active: "نشط",
  archived: "مؤرشف",
  deleted: "محذوف",
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: number | null; name: string }[]>([
    { id: null, name: "الرئيسية" },
  ]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [isNewCategoryDialogOpen, setIsNewCategoryDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6B7280");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategoryId, setUploadCategoryId] = useState<string>("");
  const [shareLink, setShareLink] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: stats, isLoading: isLoadingStats } = useQuery<DocumentStats>({
    queryKey: ["/api/documents/stats"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<DocumentCategory[]>({
    queryKey: ["/api/documents/categories"],
    staleTime: 10 * 60 * 1000,
  });

  const { data: folders = [], isLoading: isLoadingFolders } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/documents/folders", currentFolderId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentFolderId === null) {
        params.set("parentId", "null");
      } else {
        params.set("parentId", currentFolderId.toString());
      }
      const response = await fetch(`/api/documents/folders?${params}`);
      if (!response.ok) throw new Error("Failed to fetch folders");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: documentsData, isLoading: isLoadingDocuments } = useQuery<{ documents: Document[], total: number, page: number, pageSize: number }>({
    queryKey: ["/api/documents", currentFolderId, statusFilter, searchTerm, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentFolderId === null) {
        params.set("folderId", "null");
      } else {
        params.set("folderId", currentFolderId.toString());
      }
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (searchTerm) {
        params.set("search", searchTerm);
      }
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());
      const response = await fetch(`/api/documents?${params}`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      const data = await response.json();
      if (Array.isArray(data)) {
        return { documents: data, total: data.length, page: 1, pageSize: data.length };
      }
      return data;
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const documents = documentsData?.documents || [];
  const totalDocuments = documentsData?.total || 0;
  const totalPages = Math.ceil(totalDocuments / pageSize);

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; parentId?: number | null }) => {
      return apiRequest("POST", "/api/documents/folders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/stats"] });
      setIsNewFolderDialogOpen(false);
      setNewFolderName("");
      setNewFolderDescription("");
      toast({ title: "تم إنشاء المجلد بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء المجلد", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      return apiRequest("POST", "/api/documents/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/stats"] });
      setIsNewCategoryDialogOpen(false);
      setNewCategoryName("");
      toast({ title: "تم إنشاء التصنيف بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء التصنيف", variant: "destructive" });
    },
  });

  const archiveDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/documents/${id}/archive`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/stats"] });
      toast({ title: "تم أرشفة الوثيقة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في أرشفة الوثيقة", variant: "destructive" });
    },
  });

  const restoreDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/documents/${id}/restore`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/stats"] });
      toast({ title: "تم استعادة الوثيقة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في استعادة الوثيقة", variant: "destructive" });
    },
  });

  const navigateToFolder = (folder: DocumentFolder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate({
      name: newFolderName.trim(),
      description: newFolderDescription.trim() || undefined,
      parentId: currentFolderId,
    });
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    createCategoryMutation.mutate({
      name: newCategoryName.trim(),
      color: newCategoryColor,
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText));
          }
        };
        xhr.onerror = () => reject(new Error("فشل في رفع الملف"));
        xhr.open("POST", "/api/documents/upload");
        xhr.send(formData);
      });

      const uploadResult = await uploadPromise;

      const docData = {
        title: uploadTitle.trim() || file.name.replace(/\.[^/.]+$/, ""),
        description: uploadDescription.trim() || undefined,
        fileName: uploadResult.fileName,
        fileType: uploadResult.fileType,
        fileSize: uploadResult.fileSize,
        filePath: uploadResult.filePath,
        mimeType: uploadResult.mimeType,
        folderId: currentFolderId,
        categoryId: uploadCategoryId ? parseInt(uploadCategoryId) : undefined,
        status: "active" as const,
      };

      await apiRequest("POST", "/api/documents", docData);

      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/stats"] });
      
      setIsUploadDialogOpen(false);
      setUploadTitle("");
      setUploadDescription("");
      setUploadCategoryId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      toast({ title: "تم رفع الوثيقة بنجاح" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "فشل في رفع الوثيقة", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handlePreviewDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setIsPreviewDialogOpen(true);
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      await apiRequest("POST", `/api/documents/${doc.id}/download`, {});
      const filename = doc.filePath.split("/").pop();
      window.open(`/api/documents/file/${filename}`, "_blank");
      toast({ title: "جاري تحميل الوثيقة..." });
    } catch (error) {
      toast({ title: "فشل في تحميل الوثيقة", variant: "destructive" });
    }
  };

  const handleGenerateShareLink = async (doc: Document) => {
    try {
      const result = await apiRequest("POST", `/api/documents/${doc.id}/generate-share-link`, {
        permission: "view",
      });
      const data = await result.json();
      setShareLink(window.location.origin + data.fullLink);
      setSelectedDocument(doc);
      setIsShareDialogOpen(true);
      toast({ title: "تم إنشاء رابط المشاركة" });
    } catch (error) {
      toast({ title: "فشل في إنشاء رابط المشاركة", variant: "destructive" });
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({ title: "تم نسخ الرابط" });
  };

  const getPreviewUrl = (doc: Document) => {
    const filename = doc.filePath.split("/").pop();
    return `/api/documents/file/${filename}`;
  };

  const canPreview = (fileType: string) => {
    return ["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const fakeEvent = {
        target: { files }
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(fakeEvent);
    }
  };

  return (
    <Layout>
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-amber-800" data-testid="page-title">
            إدارة الوثائق والأرشفة
          </h1>
          <p className="text-gray-600 mt-1">تنظيم وإدارة ملفات ووثائق المؤسسة</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isNewCategoryDialogOpen} onOpenChange={setIsNewCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="btn-new-category">
                <Plus className="h-4 w-4 ml-2" />
                تصنيف جديد
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء تصنيف جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم التصنيف</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="أدخل اسم التصنيف"
                    data-testid="input-category-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>اللون</Label>
                  <Input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="h-10 w-20"
                    data-testid="input-category-color"
                  />
                </div>
                <Button
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                  className="w-full"
                  data-testid="btn-submit-category"
                >
                  إنشاء التصنيف
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="btn-new-folder">
                <FolderPlus className="h-4 w-4 ml-2" />
                مجلد جديد
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء مجلد جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم المجلد</Label>
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="أدخل اسم المجلد"
                    data-testid="input-folder-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الوصف (اختياري)</Label>
                  <Textarea
                    value={newFolderDescription}
                    onChange={(e) => setNewFolderDescription(e.target.value)}
                    placeholder="أدخل وصف المجلد"
                    data-testid="input-folder-description"
                  />
                </div>
                <Button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                  className="w-full"
                  data-testid="btn-submit-folder"
                >
                  إنشاء المجلد
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700" data-testid="btn-upload-document">
                <Upload className="h-4 w-4 ml-2" />
                رفع وثيقة
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle>رفع وثيقة جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>عنوان الوثيقة</Label>
                  <Input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="أدخل عنوان الوثيقة (اختياري)"
                    data-testid="input-upload-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="أدخل وصف الوثيقة (اختياري)"
                    data-testid="input-upload-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>التصنيف</Label>
                  <Select value={uploadCategoryId} onValueChange={setUploadCategoryId}>
                    <SelectTrigger data-testid="select-upload-category">
                      <SelectValue placeholder="اختر التصنيف (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>اختر الملف</Label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragging 
                        ? "border-amber-500 bg-amber-50" 
                        : "border-gray-300 hover:border-amber-400"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip,.rar"
                      data-testid="input-file-upload"
                    />
                    {isUploading ? (
                      <div className="space-y-3">
                        <Loader2 className="h-8 w-8 mx-auto text-amber-600 animate-spin" />
                        <p className="text-sm text-gray-600">جاري رفع الملف...</p>
                        <Progress value={uploadProgress} className="w-full" />
                        <p className="text-xs text-gray-500">{uploadProgress}%</p>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragging ? "text-amber-500" : "text-gray-400"}`} />
                        <p className="text-sm text-gray-600">
                          {isDragging ? "أفلت الملف هنا" : "اضغط لاختيار ملف أو اسحبه هنا"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, PowerPoint, صور (حتى 50MB)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedDocument && canPreview(selectedDocument.fileType) ? (
              <div className="w-full h-[60vh] border rounded-lg overflow-hidden">
                {selectedDocument.fileType === "pdf" ? (
                  <iframe
                    src={getPreviewUrl(selectedDocument)}
                    className="w-full h-full"
                    title={selectedDocument.title}
                  />
                ) : (
                  <img
                    src={getPreviewUrl(selectedDocument)}
                    alt={selectedDocument.title}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <File className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">لا يمكن معاينة هذا النوع من الملفات</p>
                <Button
                  onClick={() => selectedDocument && handleDownloadDocument(selectedDocument)}
                  className="mt-4"
                >
                  <Download className="h-4 w-4 ml-2" />
                  تحميل الملف
                </Button>
              </div>
            )}
          </div>
          {selectedDocument && (
            <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-4">
              <span>النوع: {selectedDocument.fileType.toUpperCase()}</span>
              <span>الحجم: {formatFileSize(selectedDocument.fileSize)}</span>
              <span>الإصدار: {selectedDocument.currentVersion}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-amber-600" />
              مشاركة الوثيقة
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.title && `مشاركة: ${selectedDocument.title}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {selectedDocument && (
              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <FileText className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedDocument.title}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>{selectedDocument.fileType.toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatFileSize(selectedDocument.fileSize)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <Label className="text-base font-medium">رابط المشاركة</Label>
              <div className="flex gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="flex-1 text-sm bg-gray-50"
                  dir="ltr"
                  data-testid="input-share-link"
                />
                <Button 
                  onClick={copyShareLink} 
                  variant="default" 
                  className="gap-2 bg-amber-600 hover:bg-amber-700"
                  data-testid="btn-copy-link"
                >
                  <Copy className="h-4 w-4" />
                  نسخ
                </Button>
              </div>
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">رابط عام</p>
                <p className="text-blue-600 mt-1">
                  يمكن لأي شخص لديه هذا الرابط عرض الوثيقة وتحميلها
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  window.open(shareLink, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4" />
                فتح الرابط
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsShareDialogOpen(false)}
              >
                إغلاق
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">إجمالي الوثائق</p>
                <p className="text-2xl font-bold">{stats?.totalDocuments || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <File className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">الوثائق النشطة</p>
                <p className="text-2xl font-bold">{stats?.activeDocuments || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Archive className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">الوثائق المؤرشفة</p>
                <p className="text-2xl font-bold">{stats?.archivedDocuments || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Folder className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">المجلدات</p>
                <p className="text-2xl font-bold">{stats?.totalFolders || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Grid className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">التصنيفات</p>
                <p className="text-2xl font-bold">{stats?.totalCategories || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">التصنيفات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                  data-testid={`category-${category.id}`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm">{category.name}</span>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  لا توجد تصنيفات
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents Area */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1 text-sm">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={index} className="flex items-center gap-1">
                      {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <button
                        onClick={() => navigateToBreadcrumb(index)}
                        className={`hover:text-amber-600 ${
                          index === breadcrumbs.length - 1
                            ? "font-medium text-gray-900"
                            : "text-gray-500"
                        }`}
                        data-testid={`breadcrumb-${index}`}
                      >
                        {index === 0 ? <Home className="h-4 w-4" /> : crumb.name}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="بحث في الوثائق..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 w-64"
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="archived">مؤرشف</SelectItem>
                    <SelectItem value="draft">مسودة</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    data-testid="btn-view-grid"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    data-testid="btn-view-list"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Folders */}
            {folders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">المجلدات</h3>
                <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-4 gap-3" : "space-y-2"}>
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => navigateToFolder(folder)}
                      className={`cursor-pointer ${
                        viewMode === "grid"
                          ? "p-4 border rounded-lg hover:bg-gray-50 hover:border-amber-300 transition-colors"
                          : "flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      }`}
                      data-testid={`folder-${folder.id}`}
                    >
                      <div className={viewMode === "grid" ? "text-center" : "flex items-center gap-3"}>
                        <Folder className={`${viewMode === "grid" ? "h-10 w-10 mx-auto mb-2" : "h-5 w-5"} text-amber-500`} />
                        <div>
                          <p className="font-medium text-sm">{folder.name}</p>
                          {folder.description && viewMode === "list" && (
                            <p className="text-xs text-gray-500">{folder.description}</p>
                          )}
                        </div>
                      </div>
                      {viewMode === "list" && (
                        <div className="flex items-center gap-2">
                          <Badge className={accessLevelColors[folder.accessLevel]}>
                            {accessLevelLabels[folder.accessLevel]}
                          </Badge>
                          {folder.isLocked && <Lock className="h-4 w-4 text-gray-400" />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-500">الوثائق</h3>
                {isLoadingDocuments && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    جاري التحميل...
                  </div>
                )}
              </div>
              
              {isLoadingDocuments && documents.length === 0 ? (
                <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-4 gap-3" : "space-y-2"}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <Skeleton className="h-8 w-8 mx-auto mb-2" />
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-3 w-2/3 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>لا توجد وثائق في هذا المجلد</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 border rounded-lg hover:bg-gray-50 hover:border-amber-300 transition-colors group"
                      data-testid={`document-${doc.id}`}
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-2">
                          {fileTypeIcons[doc.fileType.toLowerCase()] || "📄"}
                        </div>
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        <p className="text-xs text-gray-500">{doc.fileName}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatFileSize(doc.fileSize)}
                        </p>
                        <Badge className={`mt-2 ${statusColors[doc.status]}`}>
                          {statusLabels[doc.status]}
                        </Badge>
                      </div>
                      <div className="flex justify-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handlePreviewDocument(doc)}
                          data-testid={`btn-view-doc-${doc.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleDownloadDocument(doc)}
                          data-testid={`btn-download-doc-${doc.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleGenerateShareLink(doc)}>
                              <Share2 className="h-4 w-4 ml-2" />
                              مشاركة
                            </DropdownMenuItem>
                            {doc.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() => archiveDocumentMutation.mutate(doc.id)}
                              >
                                <Archive className="h-4 w-4 ml-2" />
                                أرشفة
                              </DropdownMenuItem>
                            ) : doc.status === "archived" ? (
                              <DropdownMenuItem
                                onClick={() => restoreDocumentMutation.mutate(doc.id)}
                              >
                                <RotateCcw className="h-4 w-4 ml-2" />
                                استعادة
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      data-testid={`document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {fileTypeIcons[doc.fileType.toLowerCase()] || "📄"}
                        </span>
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{doc.fileName}</span>
                            <span>•</span>
                            <span>{formatFileSize(doc.fileSize)}</span>
                            <span>•</span>
                            <span>{formatDate(doc.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Eye className="h-3 w-3" />
                          <span>{doc.viewCount}</span>
                          <Download className="h-3 w-3 mr-2" />
                          <span>{doc.downloadCount}</span>
                        </div>
                        <Badge className={accessLevelColors[doc.accessLevel]}>
                          {accessLevelLabels[doc.accessLevel]}
                        </Badge>
                        <Badge className={statusColors[doc.status]}>
                          {statusLabels[doc.status]}
                        </Badge>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handlePreviewDocument(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleDownloadDocument(doc)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleGenerateShareLink(doc)}>
                                <Share2 className="h-4 w-4 ml-2" />
                                مشاركة
                              </DropdownMenuItem>
                              {doc.status === "active" ? (
                                <DropdownMenuItem
                                  onClick={() => archiveDocumentMutation.mutate(doc.id)}
                                >
                                  <Archive className="h-4 w-4 ml-2" />
                                  أرشفة
                                </DropdownMenuItem>
                              ) : doc.status === "archived" ? (
                                <DropdownMenuItem
                                  onClick={() => restoreDocumentMutation.mutate(doc.id)}
                                >
                                  <RotateCcw className="h-4 w-4 ml-2" />
                                  استعادة
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    عرض {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalDocuments)} من {totalDocuments} وثيقة
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1 || isLoadingDocuments}
                    >
                      الأولى
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1 || isLoadingDocuments}
                    >
                      السابق
                    </Button>
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded text-sm font-medium">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || isLoadingDocuments}
                    >
                      التالي
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages || isLoadingDocuments}
                    >
                      الأخيرة
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </Layout>
  );
}
