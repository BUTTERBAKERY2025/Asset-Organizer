import type { Express, RequestHandler } from "express";
import { z, ZodError } from "zod";
import { JOB_TEMPLATE_MODULES, JOB_TEMPLATE_PROPOSALS, createTemplateDraftSchema, appendTemplateVersionSchema } from "../shared/job-permission-templates";
import { isAuthenticated, requireRole } from "./auth";
import { pool } from "./db";
import { JobPermissionTemplateStorage, JobTemplateDraftError } from "./job-permission-template-storage";

const idSchema = z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().positive().max(2147483647));
const base = "/api/rbac/job-template-drafts";

export function registerJobPermissionTemplateDraftRoutes(
  app: Express, service = new JobPermissionTemplateStorage(pool),
) {
  const wrap = (handler: RequestHandler): RequestHandler => async (req, res, next) => {
    try { await handler(req, res, next); }
    catch (error) {
      if (error instanceof JobTemplateDraftError)
        return void res.status(error.status).json({ error: error.code, message: error.message });
      if (error instanceof ZodError)
        return void res.status(400).json({ error: "invalid_request", message: error.message });
      if ((error as { code?: string })?.code === "42P01")
        return void res.status(503).json({ error: "migration_required", message: "Manual migration 051_job_permission_template_drafts.sql is required" });
      if ((error as { code?: string })?.code === "23505")
        return void res.status(409).json({ error: "key_conflict", message: "Template key or version already exists" });
      console.error("[job-template-drafts] Request failed", error);
      res.status(500).json({ error: "draft_storage_error", message: "Unable to process job template draft" });
    }
  };
  const guards = [isAuthenticated, requireRole(["admin"])];
  app.get(`${base}/catalog`, ...guards, wrap(async (_req, res) => {
    await service.ensureReady();
    res.json({ modules: JOB_TEMPLATE_MODULES, proposals: JOB_TEMPLATE_PROPOSALS });
  }));
  app.get(base, ...guards, wrap(async (_req, res) => { res.json(await service.list()); }));
  app.post(`${base}/seed-proposals`, ...guards, wrap(async (req, res) => {
    z.object({}).strict().parse(req.body ?? {});
    res.json(await service.seedProposals((req as any).currentUser.id));
  }));
  app.get(`${base}/:id`, ...guards, wrap(async (req, res) => {
    res.json(await service.detail(idSchema.parse(req.params.id)));
  }));
  app.post(base, ...guards, wrap(async (req, res) => {
    const body = createTemplateDraftSchema.parse(req.body);
    res.status(201).json(await service.create(body.content, (req as any).currentUser.id));
  }));
  app.post(`${base}/:id/versions`, ...guards, wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = appendTemplateVersionSchema.parse(req.body);
    res.status(201).json(await service.append(id, body, (req as any).currentUser.id));
  }));
}