import { randomUUID } from "crypto";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const PREFIX = "/objects/maintenance-tickets/";
export class MaintenanceTicketAttachmentStorage {
  constructor(private readonly objects = new ObjectStorageService()) {}
  isReady() { return this.objects.isPrivateObjectStorageReady(); }
  async upload(data: Buffer, extension: string, contentType: string) {
    if (!data.length || !["png", "jpg", "webp"].includes(extension)) throw new Error("Invalid maintenance photo");
    const storagePath = `${PREFIX}${randomUUID()}.${extension}`;
    await this.objects.uploadPrivateObject(storagePath, data, contentType);
    return { storagePath };
  }
  private validate(path: string) {
    if (!/^\/objects\/maintenance-tickets\/[a-f0-9-]+\.(png|jpg|webp)$/.test(path))
      throw new Error("Invalid private maintenance photo path");
  }
  download(path: string) { this.validate(path); return this.objects.downloadPrivateObject(path); }
  delete(path: string) { this.validate(path); return this.objects.deletePrivateObject(path); }
}
export const maintenanceTicketAttachmentStorage = new MaintenanceTicketAttachmentStorage();