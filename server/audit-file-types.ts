// Browser MIME is deliberately not an input: validate bytes first, then
// distinguish formats sharing a container signature by the validated extension.
const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".csv": "text/csv",
  ".zip": "application/zip",
};

export function sniffBuffer(buf: Buffer): string | null {
  if (buf.length < 8) return null;
  const head = buf.subarray(0, 8);
  if (head.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (head[0] === 0x50 && head[1] === 0x4b) return "application/zip";
  if (head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))) return "image/png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(head.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return "application/vnd.ms-excel";
  return null;
}

export function canonicalAuditMime(ext: string, buf: Buffer): string | null {
  const e = ext.toLowerCase();
  const mime = MIME_BY_EXT[e];
  if (!mime) return null;
  const sniffed = sniffBuffer(buf);
  if (e === ".csv") return !sniffed && !buf.subarray(0, 4096).includes(0) ? mime : null;
  if ([".xlsx", ".docx", ".zip"].includes(e)) return sniffed === "application/zip" ? mime : null;
  if ([".xls", ".doc"].includes(e)) return ["application/vnd.ms-excel", "application/zip"].includes(sniffed || "") ? mime : null;
  return sniffed === mime ? mime : null;
}