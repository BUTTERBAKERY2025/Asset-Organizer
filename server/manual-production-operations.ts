import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { canonicalManualProductionPayload } from "@shared/manual-production-operation";

type Transaction = any;

export type ManualProductionOperation = "create" | "reschedule";

export class ManualProductionOperationError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ManualProductionOperationError";
  }
}

export class ManualProductionOperationsUnavailableError extends ManualProductionOperationError {
  constructor() {
    super("خدمة منع تكرار عمليات الإنتاج اليدوي غير متاحة حالياً؛ يرجى إعادة المحاولة بعد تجهيز قاعدة البيانات", 503);
    this.name = "ManualProductionOperationsUnavailableError";
  }
}

export type StoredManualProductionResponse = {
  status: number;
  body: unknown;
  replayed: boolean;
};

type ExecuteInput = {
  actorId: string;
  operation: ManualProductionOperation;
  idempotencyKey: string;
  canonicalPayload: unknown;
  branchId: string;
  /** Called for both a new operation and every durable replay. */
  authorizeBranch: (branchId: string) => Promise<boolean>;
  execute: (tx: Transaction) => Promise<{ status: number; body: unknown }>;
};

type Dependencies = {
  database?: any;
};

function normalizeJson(value: unknown): unknown {
  // This deliberately follows Express/JSON's wire representation, including
  // Date#toJSON, before the response is persisted for an exact replay.
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("عملية الإنتاج أعادت استجابة غير قابلة للتحويل إلى JSON");
  }
  return JSON.parse(serialized);
}

function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return typeof candidate.code === "string"
    ? candidate.code
    : typeof candidate.cause?.code === "string"
      ? candidate.cause.code
      : undefined;
}

/**
 * Durable idempotency executor. Dependencies are injectable so this can be
 * exercised without route registration; the operation itself always owns the
 * single transaction containing the lock, work, and stored response.
 */
export class ManualProductionOperations {
  private readonly database: any;

  constructor(dependencies: Dependencies = {}) {
    this.database = dependencies.database || db;
  }

  async execute(input: ExecuteInput): Promise<StoredManualProductionResponse> {
    const payloadHash = createHash("sha256")
      .update(canonicalManualProductionPayload(input.canonicalPayload))
      .digest("hex");

    try {
      return await this.database.transaction(async (tx: Transaction) => {
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(
            73031,
            hashtext(${`${input.actorId}:${input.operation}:${input.idempotencyKey}`})
          )
        `);

        const priorResult = await tx.execute(sql`
          SELECT payload_hash, branch_id, response_status, response_json
          FROM manual_production_operations
          WHERE actor_id = ${input.actorId}
            AND operation = ${input.operation}
            AND idempotency_key = ${input.idempotencyKey}
          FOR UPDATE
        `) as { rows: Array<{
          payload_hash: string;
          branch_id: string;
          response_status: number;
          response_json: unknown;
        }> };
        const prior = priorResult.rows[0];
        if (prior) {
          // Never reveal or replay an old resource merely because its key is
          // known. Authorization is deliberately evaluated again on replays.
          if (!await input.authorizeBranch(prior.branch_id)) {
            throw new ManualProductionOperationError("غير مصرح بالوصول إلى عملية الإنتاج هذه", 403);
          }
          if (prior.payload_hash !== payloadHash) {
            throw new ManualProductionOperationError("مفتاح Idempotency-Key مستخدم مع بيانات مختلفة", 409);
          }
          return {
            status: Number(prior.response_status),
            body: typeof prior.response_json === "string"
              ? JSON.parse(prior.response_json)
              : prior.response_json,
            replayed: true,
          };
        }

        if (!await input.authorizeBranch(input.branchId)) {
          throw new ManualProductionOperationError("غير مصرح بالوصول إلى فرع الإنتاج", 403);
        }
        const response = await input.execute(tx);
        const body = normalizeJson(response.body);
        await tx.execute(sql`
          INSERT INTO manual_production_operations (
            actor_id, operation, idempotency_key, payload_hash, branch_id,
            response_status, response_json
          ) VALUES (
            ${input.actorId}, ${input.operation}, ${input.idempotencyKey},
            ${payloadHash}, ${input.branchId}, ${response.status},
            ${JSON.stringify(body)}::jsonb
          )
        `);
        return { status: response.status, body, replayed: false };
      });
    } catch (error) {
      if (databaseErrorCode(error) === "42P01") {
        throw new ManualProductionOperationsUnavailableError();
      }
      throw error;
    }
  }
}

export const manualProductionOperations = new ManualProductionOperations();