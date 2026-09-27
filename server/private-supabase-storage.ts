import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// This bucket must be created manually with Public bucket OFF. Never use the
// shared documents bucket or the browser/anon client for private evidence.
export const PRIVATE_ATTACHMENT_BUCKET = "app-private-attachments";
const MARKER = "__supabase__";
const NAMESPACES = ["branch-complaints", "maintenance-tickets", "delivery-carriers"];

export class PrivateAttachmentUnavailableError extends Error {
  constructor(message = "Private attachment storage is unavailable", options?: ErrorOptions) {
    super(message, options);
    this.name = "PrivateAttachmentUnavailableError";
  }
}

export function isRenderPlatform(): boolean {
  return process.env.RENDER === "true" || !!(process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL);
}

export function privateAttachmentProvider(): "replit" | "supabase" {
  const override = process.env.PRIVATE_ATTACHMENT_PROVIDER?.trim().toLowerCase();
  if (override && override !== "replit" && override !== "supabase")
    throw new PrivateAttachmentUnavailableError("Invalid PRIVATE_ATTACHMENT_PROVIDER");
  if (override) return override;
  if (isRenderPlatform())
    return "supabase";
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "replit";
}

export function newPrivateAttachmentPath(namespace: string, suffix: string): string {
  if (!NAMESPACES.includes(namespace) || !/^[a-zA-Z0-9/.-]+$/.test(suffix)
    || suffix.split("/").some(part => !part || part === "." || part === ".."))
    throw new PrivateAttachmentUnavailableError("Invalid private attachment path");
  const marker = privateAttachmentProvider() === "supabase" ? `${MARKER}/` : "";
  return `/objects/${namespace}/${marker}${suffix}`;
}

export function parsePrivateSupabasePath(path: string): string | null {
  if (typeof path !== "string" || /[%\\?#\x00-\x1f\x7f]/.test(path)) throw new PrivateAttachmentUnavailableError("Invalid private attachment path");
  const match = /^\/objects\/(branch-complaints|maintenance-tickets|delivery-carriers)\/(__supabase__\/)?(.+)$/.exec(path);
  if (!match) throw new PrivateAttachmentUnavailableError("Invalid private attachment path");
  const segments = match[3].split("/");
  if (segments.some(part => !part || part === "." || part === ".." || !/^[a-zA-Z0-9_.-]+$/.test(part)))
    throw new PrivateAttachmentUnavailableError("Invalid private attachment path");
  return match[2] ? `${match[1]}/${match[3]}` : null;
}

type PrivateClient = Pick<SupabaseClient, "storage">;

export class PrivateSupabaseStorage {
  constructor(private readonly injectedClient?: PrivateClient) {}

  private client(): PrivateClient {
    if (this.injectedClient) return this.injectedClient;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const rawUrl = process.env.SUPABASE_URL?.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
    if (!key || !rawUrl) throw new PrivateAttachmentUnavailableError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new PrivateAttachmentUnavailableError("Invalid SUPABASE_URL"); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
      throw new PrivateAttachmentUnavailableError("Invalid SUPABASE_URL");
    return createClient(rawUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async isReady(): Promise<boolean> {
    try {
      const { data, error } = await this.client().storage.listBuckets();
      return !error && !!data?.some(bucket => bucket.id === PRIVATE_ATTACHMENT_BUCKET && bucket.public === false);
    } catch { return false; }
  }

  private async verifiedClient(): Promise<PrivateClient> {
    const client = this.client();
    const { data, error } = await client.storage.listBuckets();
    if (error || !data?.some(bucket => bucket.id === PRIVATE_ATTACHMENT_BUCKET && bucket.public === false))
      throw new PrivateAttachmentUnavailableError("Private attachment bucket is absent or not proven private");
    return client;
  }

  async uploadPrivateObject(path: string, data: Buffer, contentType: string): Promise<void> {
    const name = parsePrivateSupabasePath(path);
    if (!name) throw new PrivateAttachmentUnavailableError("Legacy Replit path cannot be uploaded to Supabase");
    const client = await this.verifiedClient();
    const { error } = await client.storage.from(PRIVATE_ATTACHMENT_BUCKET).upload(name, data, {
      contentType, cacheControl: "0", upsert: false,
    });
    if (error) throw new PrivateAttachmentUnavailableError("Private attachment upload failed", { cause: error });
  }

  async downloadPrivateObject(path: string): Promise<{ data: Buffer; contentType?: string; size: number }> {
    const name = parsePrivateSupabasePath(path);
    if (!name) throw new PrivateAttachmentUnavailableError("Legacy Replit path cannot be read from Supabase");
    const client = await this.verifiedClient();
    const { data, error } = await client.storage.from(PRIVATE_ATTACHMENT_BUCKET).download(name);
    if (error || !data) throw new PrivateAttachmentUnavailableError("Private attachment download failed", { cause: error });
    const bytes = Buffer.from(await data.arrayBuffer());
    return { data: bytes, contentType: data.type || undefined, size: bytes.length };
  }

  async deletePrivateObject(path: string): Promise<void> {
    const name = parsePrivateSupabasePath(path);
    if (!name) throw new PrivateAttachmentUnavailableError("Legacy Replit path cannot be deleted from Supabase");
    const client = await this.verifiedClient();
    const { error } = await client.storage.from(PRIVATE_ATTACHMENT_BUCKET).remove([name]);
    if (error) throw new PrivateAttachmentUnavailableError("Private attachment delete failed", { cause: error });
  }
}