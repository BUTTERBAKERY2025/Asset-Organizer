import { Paperclip, Camera, X } from "lucide-react";
import { ATTACHMENT_TYPE_LABELS, type AttachmentType } from "@shared/schema";

export interface AttachmentItem {
  id?: number | string;
  attachmentType: AttachmentType;
  fileName: string;
  downloadUrl: string;
  mimeType?: string;
}

interface AttachmentsGridProps {
  attachments: AttachmentItem[];
  uploading: Set<AttachmentType>;
  onUpload: (type: AttachmentType, file: File) => void;
  onRemove: (att: AttachmentItem) => void;
  disabled?: boolean;
}

const TYPES: AttachmentType[] = ["foodics_report", "network_report", "other"];

export function AttachmentsGrid({
  attachments,
  uploading,
  onUpload,
  onRemove,
  disabled,
}: AttachmentsGridProps) {
  const byType = (t: AttachmentType) => attachments.filter((a) => a.attachmentType === t);

  return (
    <div className="rounded-xl border border-black/[0.08] bg-white p-4" data-testid="card-attachments">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-[#534AB7]" />
          <span className="text-sm font-medium text-gray-900">المرفقات والصور</span>
        </div>
        <span
          className="rounded-full bg-[#F1EFE8] px-2 py-0.5 text-[11px] text-gray-600"
          data-testid="text-attachments-count"
        >
          {attachments.length} ملفات
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {TYPES.map((t) => (
          <UploadButton
            key={t}
            type={t}
            uploading={uploading.has(t)}
            count={byType(t).length}
            onUpload={(f) => onUpload(t, f)}
            disabled={disabled}
          />
        ))}
      </div>

      {attachments.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          {attachments.map((att, i) => (
            <div
              key={att.id ?? `${att.fileName}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-black/[0.08] bg-gray-50"
              data-testid={`thumb-attachment-${i}`}
            >
              {att.mimeType?.startsWith("image/") ? (
                <img src={att.downloadUrl} alt={att.fileName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-gray-500">
                  {att.fileName}
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(att)}
                disabled={disabled}
                data-testid={`button-remove-attachment-${i}`}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadButton({
  type,
  uploading,
  count,
  onUpload,
  disabled,
}: {
  type: AttachmentType;
  uploading: boolean;
  count: number;
  onUpload: (f: File) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-2 py-4 text-center text-sm transition-colors ${
        disabled || uploading
          ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
          : "cursor-pointer border-gray-300 text-gray-700 hover:border-[#534AB7] hover:bg-[#EEEDFE]"
      }`}
      data-testid={`upload-${type}`}
    >
      <Camera className="h-5 w-5" />
      <span className="text-xs">
        {ATTACHMENT_TYPE_LABELS[type]}
        {count > 0 && <span className="mr-1 text-[10px] text-[#534AB7]">({count})</span>}
      </span>
      {uploading && <span className="text-[10px] text-[#534AB7]">جارٍ الرفع...</span>}
      <input
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
