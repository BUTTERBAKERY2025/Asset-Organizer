import { useState, useCallback } from "react";

interface UploadResponse {
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  mimeType: string;
  downloadUrl: string;
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
  folder?: string;
}

export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const formData = new FormData();
        formData.append("file", file);

        const folder = options.folder || "general";
        const response = await fetch(`/api/uploads?folder=${encodeURIComponent(folder)}`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        setProgress(80);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "فشل في رفع الملف");
        }

        const result = await response.json();
        setProgress(100);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [options]
  );

  return {
    uploadFile,
    isUploading,
    error,
    progress,
  };
}
