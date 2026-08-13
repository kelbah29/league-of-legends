import { prisma } from "@/lib/db";

const MIN_SAMPLE_WITH_PATCH = 5;
const MIN_SAMPLE_WITHOUT_PATCH = 3;

export type BenchmarkMetric = "csPerMin" | "goldPerMin" | "kda" | "visionScorePerMin" | "damagePerMin" | "objectiveParticipation";

export interface MetricCohort {
  insufficientData: boolean;
  cohortAverage: number | null;
  sampleSize: number;
  patchFiltered: boolean;
}

export interface WinRateCohort {
  insufficientData: boolean;
  cohortWinRate: number | null;
  sampleSize: number;
  patchFiltered: boolean;
}

export function patchPrefix(gameVersion: string): string {
  return gameVersion.split(".").slice(0, 2).join(".");
}

interface CohortRow {
  cs: number;
  goldEarned: number;
  kills: number;
  deaths: number;
  assists: number;
  visionScore: number;
  totalDamageDealtToChampions: number;
  dragonTakedowns: number;
  baronTakedowns: number;
  turretTakedowns: number;
  riftHeraldTakedowns: number;
  match: { gameDuration: number };
}

function computeMetricValue(row: CohortRow, metric: BenchmarkMetric): number {
  const minutes = Math.max(row.match.gameDuration / 60, 1);
  switch (metric) {
    case "csPerMin":
      return row.cs / minutes;
    case "goldPerMin":
      return row.goldEarned / minutes;
    case "kda":
      return row.deaths === 0 ? row.kills + row.assists : (row.kills + row.assists) / row.deaths;
    case "visionScorePerMin":
      return row.visionScore / minutes;
    case "damagePerMin":
      return row.totalDamageDealtToChampions / minutes;
    case "objectiveParticipation":
      return row.dragonTakedowns + row.baronTakedowns + row.turretTakedowns + row.riftHeraldTakedowns;
  }
}

interface CohortExclusion {
  participantId?: string;
  puuid?: string;
}

async function fetchCohortRows(
  championName: string,
  teamPosition: string,
  patch: string | null,
  exclude: CohortExclusion
): Promise<CohortRow[]> {
  return prisma.matchParticipant.findMany({
    where: {
      championName,
      teamPosition,
      ...(exclude.participantId ? { id: { not: exclude.participantId } } : {}),
      ...(exclude.puuid ? { puuid: { not: exclude.puuid } } : {}),
      ...(patch ? { match: { gameVersion: { startsWith: patch } } } : {}),
    },
    select: {
      cs: true,
      goldEarned: true,
      kills: true,
      deaths: true,
      assists: true,
      visionScore: true,
      totalDamageDealtToChampions: true,
      dragonTakedowns: true,
      baronTakedowns: true,
      turretTakedowns: true,
      riftHeraldTakedowns: true,
      match: { select: { gameDuration: true } },
    },
    take: 500,
  });
}

/**
 * Cohort = other synced participants with the same champion+role. Falls back
 * from patch-filtered to all-patch if the patch-specific sample is too small.
 * There is no rank/region filter — we only have that data for players who've
 * been searched directly, not for every participant in every synced match.
 */
async function computeMetricCohort(
  metric: BenchmarkMetric,
  championName: string,
  teamPosition: string,
  gameVersion: string,
  exclude: CohortExclusion
): Promise<MetricCohort> {
  if (!teamPosition) {
    return { insufficientData: true, cohortAverage: null, sampleSize: 0, patchFiltered: false };
  }

  const patch = patchPrefix(gameVersion);
  const withPatch = await fetchCohortRows(championName, teamPosition, patch, exclude);
  const withPatchValues = withPatch.filter((r) => r.match.gameDuration > 0).map((r) => computeMetricValue(r, metric));
  if (withPatchValues.length >= MIN_SAMPLE_WITH_PATCH) {
    return {
      insufficientData: false,
      cohortAverage: average(withPatchValues),
      sampleSize: withPatchValues.length,
      patchFiltered: true,
    };
  }

  const anyPatch = await fetchCohortRows(championName, teamPosition, null, exclude);
  const anyPatchValues = anyPatch.filter((r) => r.match.gameDuration > 0).map((r) => computeMetricValue(r, metric));
  if (anyPatchValues.length >= MIN_SAMPLE_WITHOUT_PATCH) {
    return {
      insufficientData: false,
      cohortAverage: average(anyPatchValues),
      sampleSize: anyPatchValues.length,
      patchFiltered: false,
    };
  }

  return { insufficientData: true, cohortAverage: null, sampleSize: anyPatchValues.length, patchFiltered: false };
}

/** Per-match usage: excludes just the one participant row being evaluated. */
export function getMetricCohort(
  metric: BenchmarkMetric,
  championName: string,
  teamPosition: string,
  gameVersion: string,
  excludeParticipantId: string
): Promise<MetricCohort> {
  return computeMetricCohort(metric, championName, teamPosition, gameVersion, { participantId: excludeParticipantId });
}

/** Aggregate usage (e.g. champion/role breakdown): excludes ALL of this player's own rows. */
export function getMetricCohortByPlayer(
  metric: BenchmarkMetric,
  championName: string,
  teamPosition: string,
  gameVersion: string,
  excludePuuid: string
): Promise<MetricCohort> {
  return computeMetricCohort(metric, championName, teamPosition, gameVersion, { puuid: excludePuuid });
}

async function fetchCohortWinRows(
  championName: string,
  teamPosition: string,
  patch: string | null,
  excludePuuid: string
) {
  return prisma.matchParticipant.findMany({
    where: {
      championName,
      teamPosition,
      puuid: { not: excludePuuid },
      ...(patch ? { match: { gameVersion: { startsWith: patch } } } : {}),
    },
    select: { win: true },
    take: 500,
  });
}

function winRatePercent(rows: { win: boolean }[]): number {
  if (rows.length === 0) return 0;
  return (rows.filter((r) => r.win).length / rows.length) * 100;
}

/**
 * Same cohort definition as getMetricCohort, but excludes the searched
 * player's own puuid entirely (not just one match row) since win rate is
 * inherently an aggregate across that player's own history on this
 * champion+role, compared against everyone else's.
 */
export async function getWinRateCohort(
  championName: string,
  teamPosition: string,
  gameVersion: string,
  excludePuuid: string
): Promise<WinRateCohort> {
  if (!teamPosition) {
    return { insufficientData: true, cohortWinRate: null, sampleSize: 0, patchFiltered: false };
  }

  const patch = patchPrefix(gameVersion);
  const withPatch = await fetchCohortWinRows(championName, teamPosition, patch, excludePuuid);
  if (withPatch.length >= MIN_SAMPLE_WITH_PATCH) {
    return { insufficientData: false, cohortWinRate: winRatePercent(withPatch), sampleSize: withPatch.length, patchFiltered: true };
  }

  const anyPatch = await fetchCohortWinRows(championName, teamPosition, null, excludePuuid);
  if (anyPatch.length >= MIN_SAMPLE_WITHOUT_PATCH) {
    return { insufficientData: false, cohortWinRate: winRatePercent(anyPatch), sampleSize: anyPatch.length, patchFiltered: false };
  }

  return { insufficientData: true, cohortWinRate: null, sampleSize: anyPatch.length, patchFiltered: false };
}

export function compareToCohort(value: number, cohortAverage: number): { diffPercent: number } {
  if (cohortAverage === 0) return { diffPercent: 0 };
  return { diffPercent: ((value - cohortAverage) / cohortAverage) * 100 };
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
