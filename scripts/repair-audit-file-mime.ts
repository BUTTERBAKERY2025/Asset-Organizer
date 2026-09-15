/**
 * Optional repair for legacy generic MIME metadata. Does not run on startup.
 * Dry run: npx tsx scripts/repair-audit-file-mime.ts
 * Apply to the configured database: append --apply after reviewing the dry run.
 * Re-checks stored bytes; never makes files previewable using extension alone.
 */
import { extname } from "node:path";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../server/db";
import { auditFiles } from "../shared/schema";
import { downloadFromSupabase } from "../server/supabase-storage";
import { canonicalAuditMime } from "../server/audit-file-types";

async function main() {
  const apply = process.argv.includes("--apply");
  const generic = () => or(isNull(auditFiles.mimeType), eq(auditFiles.mimeType, ""), eq(auditFiles.mimeType, "application/octet-stream"), eq(auditFiles.mimeType, "binary/octet-stream"));
  const files = await db.select({
    id: auditFiles.id, fileName: auditFiles.fileName, storagePath: auditFiles.storagePath,
  }).from(auditFiles).where(generic());
  let failed = 0;
  for (const file of files) {
    try {
      const downloaded = await downloadFromSupabase(file.storagePath);
      if (!downloaded) throw new Error("download failed");
      const mime = canonicalAuditMime(extname(file.fileName), Buffer.from(await downloaded.data.arrayBuffer()));
      if (!mime) throw new Error("content does not match a supported extension");
      if (apply) {
        const updated = await db.update(auditFiles).set({ mimeType: mime })
          .where(and(eq(auditFiles.id, file.id), generic())).returning({ id: auditFiles.id });
        console.log(updated.length ? "updated" : "skipped (metadata changed)", file.id, mime);
      } else console.log("would update", file.id, mime);
    } catch {
      failed++;
      console.error("Unable to validate file", file.id);
    }
  }
  console.log(`${apply ? "Apply" : "Dry run"} complete: ${files.length} candidates, ${failed} failures.`);
  process.exit(failed ? 1 : 0);
}
main().catch(() => { console.error("Repair failed"); process.exit(1); });