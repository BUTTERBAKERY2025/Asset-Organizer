import { db } from "./db";
import { and, eq, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  assemblyResolutions,
  assemblyResolutionItems,
  assemblyResolutionVotes,
  systemAuditLogs,
  type AssemblyResolution,
} from "@shared/schema";

// Transaction type compatible with db.transaction((tx) => ...).
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type VoteValue = "for" | "against" | "abstain";

function voteCol(v: VoteValue): string {
  return v === "for" ? "for_votes" : v === "against" ? "against_votes" : "abstain_votes";
}
function shareCol(v: VoteValue): string {
  return v === "for" ? "for_shares" : v === "against" ? "against_shares" : "abstain_shares";
}

// Recompute a clause result (share-weighted) using the effective majority. While voting
// is open we never declare a premature "rejected" — only "approved" or "pending".
function computeItemResult(
  item: { forShares: any; againstShares: any; abstainShares: any; majorityType: string | null },
  resolutionMajority: string | null,
): "approved" | "pending" {
  const effMajority = item.majorityType || resolutionMajority || "simple";
  const f = Number(item.forShares) || 0;
  const a = Number(item.againstShares) || 0;
  const ab = Number(item.abstainShares) || 0;
  const totalVoted = f + a + ab;
  const ratio = totalVoted > 0 ? f / totalVoted : 0;
  const meets =
    effMajority === "two_thirds" ? ratio >= 2 / 3
    : effMajority === "three_quarters" ? ratio >= 0.75
    : ratio > 0.5;
  return meets ? "approved" : "pending";
}

/**
 * Cast a vote for a shareholder, atomically superseding any existing valid vote for the
 * same scope (whole resolution when itemId is null, or a specific clause when set).
 * Reverses the old vote's tally, archives it to the audit log, then applies the new vote
 * and recomputes the clause result. Safe to call when no prior vote exists (acts as a
 * plain insert). MUST run inside a transaction.
 */
export async function castOrSupersedeVote(
  tx: DbTx,
  opts: {
    resolution: AssemblyResolution;
    itemId: number | null;
    shareholderId: number;
    voterName: string;
    shares: number;
    vote: VoteValue;
    voteMethod: string;
    comments?: string | null;
    ipAddress?: string | null;
    actorUserId?: string | null;
    actorName?: string | null;
  },
): Promise<{ superseded: boolean }> {
  const { resolution, itemId, shareholderId, shares, vote } = opts;
  const resolutionId = resolution.id;

  // Find the existing valid vote (if any) for this exact scope.
  const [existing] = await tx
    .select()
    .from(assemblyResolutionVotes)
    .where(
      and(
        eq(assemblyResolutionVotes.resolutionId, resolutionId),
        eq(assemblyResolutionVotes.shareholderId, shareholderId),
        itemId == null
          ? isNull(assemblyResolutionVotes.itemId)
          : eq(assemblyResolutionVotes.itemId, itemId),
        eq(assemblyResolutionVotes.isValid, true),
      ),
    )
    .limit(1);

  let superseded = false;
  if (existing) {
    superseded = true;
    const oldVote = existing.vote as VoteValue;
    const oldShares = Number(existing.sharesVoted) || 0;

    // Archive the superseded vote to the audit log (compliance / Q3).
    await tx.insert(systemAuditLogs).values({
      module: "governance",
      entityId: String(resolutionId),
      entityName: resolution.resolutionNumber || resolution.title,
      action: "update",
      details: JSON.stringify({
        type: "revote_supersede",
        resolutionId,
        itemId: itemId ?? null,
        shareholderId,
        previousVote: {
          id: existing.id,
          vote: existing.vote,
          sharesVoted: existing.sharesVoted,
          voterName: existing.voterName,
          voteMethod: existing.voteMethod,
          votedAt: existing.votedAt,
        },
        newVote: { vote, sharesVoted: String(shares), voteMethod: opts.voteMethod },
      }),
      userId: opts.actorUserId || null,
      userName: opts.actorName || "system",
      ipAddress: opts.ipAddress || "unknown",
    });

    // Reverse the old vote's tally on the target (clamped at 0).
    const oVoteCol = voteCol(oldVote);
    const oShareCol = shareCol(oldVote);
    if (itemId == null) {
      await tx.execute(sql`
        UPDATE assembly_resolutions
        SET ${sql.raw(oVoteCol)} = GREATEST(COALESCE(${sql.raw(oVoteCol)}, 0) - 1, 0),
            total_votes = GREATEST(COALESCE(total_votes, 0) - 1, 0),
            ${sql.raw(oShareCol)} = GREATEST(COALESCE(${sql.raw(oShareCol)}, 0) - ${oldShares}, 0)
        WHERE id = ${resolutionId}
      `);
    } else {
      await tx.execute(sql`
        UPDATE assembly_resolution_items
        SET ${sql.raw(oVoteCol)} = GREATEST(COALESCE(${sql.raw(oVoteCol)}, 0) - 1, 0),
            total_votes = GREATEST(COALESCE(total_votes, 0) - 1, 0),
            ${sql.raw(oShareCol)} = GREATEST(COALESCE(${sql.raw(oShareCol)}, 0) - ${oldShares}, 0),
            updated_at = now()
        WHERE id = ${itemId}
      `);
    }

    // Remove the old vote row so the unique index slot is freed for the new vote.
    await tx.delete(assemblyResolutionVotes).where(eq(assemblyResolutionVotes.id, existing.id));
  }

  // Insert the new (authoritative) vote.
  await tx.insert(assemblyResolutionVotes).values({
    resolutionId,
    itemId: itemId ?? null,
    shareholderId,
    voterName: opts.voterName,
    vote,
    sharesVoted: String(shares),
    voteMethod: opts.voteMethod,
    comments: opts.comments || null,
    ipAddress: opts.ipAddress || null,
  });

  // Apply the new vote's tally on the target.
  const nVoteCol = voteCol(vote);
  const nShareCol = shareCol(vote);
  if (itemId == null) {
    await tx.execute(sql`
      UPDATE assembly_resolutions
      SET ${sql.raw(nVoteCol)} = COALESCE(${sql.raw(nVoteCol)}, 0) + 1,
          total_votes = COALESCE(total_votes, 0) + 1,
          ${sql.raw(nShareCol)} = COALESCE(${sql.raw(nShareCol)}, 0) + ${shares}
      WHERE id = ${resolutionId}
    `);
  } else {
    await tx.execute(sql`
      UPDATE assembly_resolution_items
      SET ${sql.raw(nVoteCol)} = COALESCE(${sql.raw(nVoteCol)}, 0) + 1,
          total_votes = COALESCE(total_votes, 0) + 1,
          ${sql.raw(nShareCol)} = COALESCE(${sql.raw(nShareCol)}, 0) + ${shares},
          updated_at = now()
      WHERE id = ${itemId}
    `);

    // Recompute the clause result after the tally change.
    const [updated] = await tx
      .select()
      .from(assemblyResolutionItems)
      .where(eq(assemblyResolutionItems.id, itemId))
      .limit(1);
    if (updated) {
      const newResult = computeItemResult(updated as any, resolution.majorityType);
      if (newResult !== updated.result) {
        await tx
          .update(assemblyResolutionItems)
          .set({ result: newResult })
          .where(eq(assemblyResolutionItems.id, itemId));
      }
    }
  }

  return { superseded };
}
