import { randomUUID } from "crypto";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const COMPLAINT_OBJECT_PREFIX = "/objects/branch-complaints/";

export type StoredComplaintAttachment = {
  storagePath: string;
};

export type DownloadedComplaintAttachment = {
  data: Buffer;
  contentType?: string;
  size?: number;
};

export class ComplaintAttachmentStorage {
  constructor(private readonly objects = new ObjectStorageService()) {}

  async isReady(): Promise<boolean> {
    return this.objects.isPrivateObjectStorageReady();
  }

  async upload(data: Buffer, extension: string, contentType: string): Promise<StoredComplaintAttachment> {
    if (!Buffer.isBuffer(data) || data.length === 0) {
      throw new Error("Complaint attachment data must be a non-empty Buffer");
    }
    if (!/^[a-z0-9]+$/i.test(extension)) {
      throw new Error("Invalid complaint attachment extension");
    }
    const storagePath = `${COMPLAINT_OBJECT_PREFIX}${randomUUID()}.${extension.toLowerCase()}`;
    await this.objects.uploadPrivateObject(storagePath, data, contentType);
    return { storagePath };
  }

  async download(storagePath: string): Promise<DownloadedComplaintAttachment> {
    this.assertComplaintPath(storagePath);
    return this.objects.downloadPrivateObject(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    this.assertComplaintPath(storagePath);
    await this.objects.deletePrivateObject(storagePath);
  }

  private assertComplaintPath(storagePath: string): void {
    if (!storagePath.startsWith(COMPLAINT_OBJECT_PREFIX)) {
      throw new Error("Invalid complaint attachment storage path");
    }
  }
}

// Complaints intentionally use Replit private Object Storage only. There is no
// Supabase/public fallback: an unavailable private provider is a hard failure.
export const complaintAttachmentStorage = new ComplaintAttachmentStorage();