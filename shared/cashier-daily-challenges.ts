/**
 * Read-only daily cashier-challenge progress.
 *
 * This module deliberately contains no database or ledger writes.  Keeping the
 * calculation here in one place makes the self-service view use the same
 * actual-value and points rules as journal incentive calculation.
 */

export type CashierDailyChallengeTodayDto = {
  date: string;
  settingsActive: boolean;
  journals: CashierDailyChallengeJournalDto[];
};

export type CashierDailyChallengeJournalDto = {
  id: number;
  shiftType: string | null;
  challenges: CashierDailyChallengeProgressDto[];
};

export type CashierDailyChallengeProgressDto = {
  id: number;
  name: string;
  challengeType: string;
  target: number;
  actual: number;
  progress: number;
  expectedPoints: number;
};

export type CashierDailyChallengeDefinition = {
  id: number;
  name: string;
  challengeType: string;
  branchId?: string | null;
  cashierId?: string | null;
  targetValue: number | string | null | undefined;
  basePoints: number | string | null | undefined;
  bonusPointsPerUnit: number | string | null | undefined;
  shiftType?: string | null;
  isActive?: boolean;
  validFrom: string;
  validTo?: string | null;
};

export type CashierDailyChallengeJournal = {
  id: number;
  branchId: string;
  cashierId: string;
  journalDate: string;
  shiftType?: string | null;
  averageTicket: number | string | null | undefined;
  totalSales: number | string | null | undefined;
  transactionCount: number | string | null | undefined;
  customerCount: number | string | null | undefined;
};

export type CashierDailyChallengeSettings = {
  isActive?: boolean;
  seasonalMultiplier: number | string | null | undefined;
  maxDailyPoints: number | string | null | undefined;
};

const SUPPORTED_CHALLENGE_TYPES = new Set([
  "avg_ticket",
  "customer_count",
  "shift_sales",
]);

function numberOrZero(value: number | string | null | undefined): number {
  return Number(value) || 0;
}

/**
 * Calculate the actual value using the same fallback as
 * storage.calculateJournalIncentives.
 */
export function calculateCashierChallengeActual(
  challengeType: string,
  journal: CashierDailyChallengeJournal,
): number | null {
  switch (challengeType) {
    case "avg_ticket": {
      let actual = numberOrZero(journal.averageTicket);
      if (actual === 0 && numberOrZero(journal.totalSales) > 0) {
        const transactionCount = numberOrZero(journal.transactionCount);
        const customerCount = numberOrZero(journal.customerCount);
        const divisor = transactionCount > 0 ? transactionCount : (customerCount > 0 ? customerCount : 0);
        if (divisor > 0) {
          actual = Math.round((numberOrZero(journal.totalSales) / divisor) * 100) / 100;
        }
      }
      return actual;
    }
    case "customer_count":
      return numberOrZero(journal.customerCount);
    case "shift_sales":
      return numberOrZero(journal.totalSales);
    default:
      return null;
  }
}

function challengeMatchesJournal(
  challenge: CashierDailyChallengeDefinition,
  journal: CashierDailyChallengeJournal,
): boolean {
  // This intentionally mirrors calculateJournalIncentives: a null shift
  // challenge applies to every shift, while a specified shift must match
  // exactly (including a journal with no recorded shift).
  return !challenge.shiftType || challenge.shiftType === (journal.shiftType ?? null);
}

function challengeMatchesScope(
  challenge: CashierDailyChallengeDefinition,
  date: string,
  branchId: string,
  cashierId: string,
): boolean {
  if (challenge.isActive === false) return false;
  if (challenge.validFrom > date) return false;
  if (challenge.validTo && challenge.validTo < date) return false;
  if (challenge.branchId && challenge.branchId !== branchId) return false;
  if (challenge.cashierId && challenge.cashierId !== cashierId) return false;
  return SUPPORTED_CHALLENGE_TYPES.has(challenge.challengeType);
}

function expectedPointsBeforeCap(
  challenge: CashierDailyChallengeDefinition,
  actual: number,
  settings: CashierDailyChallengeSettings | undefined,
): number {
  if (!settings) return 0;

  const target = numberOrZero(challenge.targetValue);
  let points = 0;
  // Keep the same >= comparison as calculateJournalIncentives.  In
  // particular, a zero target is considered met by that calculation too.
  if (actual >= target) {
    points = numberOrZero(challenge.basePoints);
    const excess = actual - target;
    const bonusPerUnit = numberOrZero(challenge.bonusPointsPerUnit);
    if (excess > 0 && bonusPerUnit > 0) {
      points += Math.floor(excess * bonusPerUnit);
    }
  }

  const seasonalMultiplier = numberOrZero(settings.seasonalMultiplier) || 1;
  return Math.round(points * seasonalMultiplier);
}

function applyDailyPointsCap(points: number[], settings: CashierDailyChallengeSettings | undefined): number[] {
  if (!settings) return points.map(() => 0);

  // Match calculateJournalIncentives' truthy check: null/undefined/0 means
  // no cap.  The persisted setting is an integer, but preserving this
  // behavior also keeps read-only progress consistent with ledger approval.
  const maxDailyPoints = settings.maxDailyPoints ? Number(settings.maxDailyPoints) : null;
  const totalPoints = points.reduce((sum, value) => sum + value, 0);
  if (maxDailyPoints && totalPoints > maxDailyPoints) {
    const ratio = maxDailyPoints / totalPoints;
    return points.map((value) => Math.floor(value * ratio));
  }
  return points;
}

function mapChallengeProgress(
  challenges: CashierDailyChallengeDefinition[],
  journal: CashierDailyChallengeJournal | null,
  settings: CashierDailyChallengeSettings | undefined,
): CashierDailyChallengeProgressDto[] {
  const eligible = challenges.filter((challenge) => !journal || challengeMatchesJournal(challenge, journal));
  const actuals = eligible.map((challenge) => {
    const actual = journal ? calculateCashierChallengeActual(challenge.challengeType, journal) : 0;
    return actual ?? 0;
  });
  const expectedPoints = applyDailyPointsCap(
    eligible.map((challenge, index) => (
      journal ? expectedPointsBeforeCap(challenge, actuals[index], settings) : 0
    )),
    settings,
  );

  return eligible.map((challenge, index) => {
    const target = numberOrZero(challenge.targetValue);
    const actual = actuals[index];
    const progress = target > 0
      ? Math.max(0, Math.min(100, Math.round((actual / target) * 100)))
      : (journal && actual >= target ? 100 : 0);
    return {
      id: challenge.id,
      name: challenge.name,
      challengeType: challenge.challengeType,
      target,
      actual,
      progress,
      expectedPoints: expectedPoints[index],
    };
  });
}

/**
 * Build the minimal DTO returned by GET /api/my/challenges/today.
 *
 * The caller supplies today's employee scope.  Scope is checked again here
 * so a future caller cannot accidentally pass another employee's journal or
 * an inactive/out-of-window challenge into the self-service response.
 */
export function buildCashierDailyChallengeToday(input: {
  date: string;
  branchId: string;
  cashierId: string;
  journals: CashierDailyChallengeJournal[];
  challenges: CashierDailyChallengeDefinition[];
  settings?: CashierDailyChallengeSettings;
}): CashierDailyChallengeTodayDto {
  const settings = input.settings && input.settings.isActive !== false ? input.settings : undefined;
  const eligibleChallenges = input.challenges.filter((challenge) => (
    challengeMatchesScope(challenge, input.date, input.branchId, input.cashierId)
  ));
  const eligibleJournals = input.journals.filter((journal) => (
    journal.branchId === input.branchId &&
    journal.cashierId === input.cashierId &&
    journal.journalDate === input.date
  ));

  if (eligibleJournals.length === 0) {
    // No shift has been recorded yet.  Only shift-independent challenges are
    // safe to show; shift-targeted challenges wait until a journal provides
    // the shift.  The synthetic row makes that absence explicit via null.
    return {
      date: input.date,
      settingsActive: Boolean(settings),
      journals: [{
        id: 0,
        shiftType: null,
        challenges: mapChallengeProgress(
          eligibleChallenges.filter((challenge) => !challenge.shiftType),
          null,
          settings,
        ),
      }],
    };
  }

  return {
    date: input.date,
    settingsActive: Boolean(settings),
    journals: eligibleJournals.map((journal) => ({
      id: journal.id,
      shiftType: journal.shiftType ?? null,
      challenges: mapChallengeProgress(eligibleChallenges, journal, settings),
    })),
  };
}