import type { Pool, PoolClient } from "pg";
import {
  JOB_TEMPLATE_PROPOSALS, appendTemplateVersionSchema, templateContentSchema,
  type TemplateContent, type TemplateDetail, type TemplateSummary, type TemplateVersion,
} from "../shared/job-permission-templates";

export class JobTemplateDraftError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const migrationError = () => new JobTemplateDraftError(503, "migration_required",
  "Manual migration 051_job_permission_template_drafts.sql is required");

/** Dedicated append-only storage. Never reads/writes legacy role_templates or grants. */
export class JobPermissionTemplateStorage {
  constructor(private readonly pool: Pick<Pool, "query" | "connect">) {}

  async ensureReady(): Promise<void> {
    const result = await this.pool.query(`SELECT
      to_regclass('public.job_permission_template_drafts') IS NOT NULL
      AND to_regclass('public.job_permission_template_draft_versions') IS NOT NULL AS ready`);
    if (result.rows[0]?.ready !== true) throw migrationError();
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    await this.ensureReady();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  private async readDetail(client: Pick<PoolClient, "query">, id: number): Promise<TemplateDetail> {
    const result = await client.query(`SELECT v.version, v.content, v.change_reason,
      v.created_at, v.created_by, v.status
      FROM public.job_permission_template_draft_versions v WHERE v.template_id=$1 ORDER BY v.version`, [id]);
    if (!result.rows.length) throw new JobTemplateDraftError(404, "not_found", "Draft template not found");
    const versions: TemplateVersion[] = result.rows.map(row => ({
      version: row.version, content: templateContentSchema.parse(row.content),
      changeReason: row.change_reason, createdAt: new Date(row.created_at).toISOString(),
      createdBy: row.created_by, status: row.status,
    }));
    return { id, versions };
  }

  async detail(id: number): Promise<TemplateDetail> {
    await this.ensureReady();
    return this.readDetail(this.pool, id);
  }

  private async readSummaries(client: Pick<PoolClient, "query">): Promise<TemplateSummary[]> {
    const result = await client.query(`SELECT DISTINCT ON (t.id) t.id, t.key, v.version, v.content
      FROM public.job_permission_template_drafts t
      JOIN public.job_permission_template_draft_versions v ON v.template_id=t.id
      ORDER BY t.id, v.version DESC`);
    return result.rows.map(row => {
      const content = templateContentSchema.parse(row.content);
      return {
        id: row.id, key: row.key, name: content.name, latestVersion: row.version,
        scopeType: content.scopeType, status: "draft",
        permissionCount: content.permissions.reduce((count, permission) => count + permission.actions.length, 0),
      };
    });
  }

  async list(): Promise<TemplateSummary[]> {
    await this.ensureReady();
    return this.readSummaries(this.pool);
  }

  private async lockKey(client: PoolClient, key: string) {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`job-template-draft:${key}`]);
  }

  private async insertVersion(client: PoolClient, id: number, version: number,
    content: TemplateContent, reason: string, actorId: string) {
    await client.query(`INSERT INTO public.job_permission_template_draft_versions
      (template_id,version,content,change_reason,created_by,status) VALUES ($1,$2,$3::jsonb,$4,$5,'draft')`,
    [id, version, JSON.stringify(content), reason, actorId]);
    // Audit failure rolls back the draft/version too. No permission cache invalidation needed.
    await client.query(`INSERT INTO public.system_audit_logs
      (module,entity_id,entity_name,action,details,user_id,target_id,description)
      VALUES ($1,$2,$3,$4,$5,$6,$2,$7)`,
    ["job_template_drafts", String(id), content.name, version === 1 ? "create" : "append_version",
      JSON.stringify({ version, key: content.key, status: "draft", changeReason: reason, content }),
      actorId, "Draft only; no account permissions changed"]);
  }

  private async insertTemplate(client: PoolClient, content: TemplateContent, actorId: string, reason: string) {
    const result = await client.query(`INSERT INTO public.job_permission_template_drafts (key,created_by)
      VALUES ($1,$2) RETURNING id`, [content.key, actorId]);
    const id = result.rows[0].id as number;
    await this.insertVersion(client, id, 1, content, reason, actorId);
    return id;
  }

  async create(input: TemplateContent, actorId: string): Promise<TemplateDetail> {
    const content = templateContentSchema.parse(input);
    return this.transaction(async client => {
      await this.lockKey(client, content.key);
      const existing = await client.query("SELECT id FROM public.job_permission_template_drafts WHERE key=$1", [content.key]);
      if (existing.rows.length) throw new JobTemplateDraftError(409, "key_conflict", "Template key already exists");
      const id = await this.insertTemplate(client, content, actorId, "Initial draft");
      return this.readDetail(client, id);
    });
  }

  async append(id: number, input: unknown, actorId: string): Promise<TemplateDetail> {
    const body = appendTemplateVersionSchema.parse(input);
    return this.transaction(async client => {
      const template = await client.query("SELECT key FROM public.job_permission_template_drafts WHERE id=$1 FOR UPDATE", [id]);
      if (!template.rows.length) throw new JobTemplateDraftError(404, "not_found", "Draft template not found");
      if (body.content.key !== template.rows[0].key)
        throw new JobTemplateDraftError(400, "invalid_request", "Template key is immutable");
      const latest = await client.query("SELECT MAX(version) AS latest FROM public.job_permission_template_draft_versions WHERE template_id=$1", [id]);
      if (latest.rows[0]?.latest !== body.expectedLatestVersion)
        throw new JobTemplateDraftError(409, "stale_version", "Latest draft version changed; reload before saving");
      await this.insertVersion(client, id, body.expectedLatestVersion + 1, body.content, body.changeReason, actorId);
      return this.readDetail(client, id);
    });
  }

  async seedProposals(actorId: string): Promise<TemplateSummary[]> {
    return this.transaction(async client => {
      // Consistent order also protects simultaneous explicit seed requests.
      for (const proposal of [...JOB_TEMPLATE_PROPOSALS].sort((a, b) => a.key.localeCompare(b.key))) {
        const content = templateContentSchema.parse(proposal);
        await this.lockKey(client, content.key);
        const existing = await client.query("SELECT id FROM public.job_permission_template_drafts WHERE key=$1", [content.key]);
        if (!existing.rows.length) await this.insertTemplate(client, content, actorId, "Proposed matrix seed; draft only");
      }
      return this.readSummaries(client);
    });
  }
}