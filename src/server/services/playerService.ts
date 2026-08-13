import { prisma } from "@/lib/db";
import { platformUrl, regionalUrl, riotClient } from "@/lib/riot/client";
import { toRegionalRoute, type PlatformRoute } from "@/lib/riot/regions";
import type { LeagueEntryDto, RiotAccountDto, SummonerDto } from "@/lib/riot/types";
import { compareToCohort, getMetricCohort, getMetricCohortByPlayer, getWinRateCohort } from "./benchmarkService";
import { analyzePlayerMacroHabits } from "./habitService";
import {
  averageCategoryScores,
  computeConsistencyScore,
  computeMatchCategoryScores,
  type CategoryScores,
} from "./performanceScore";
import { computeMatchMetrics, type MatchMetrics } from "./statsService";

export async function searchAndSyncPlayer(
  gameName: string,
  tagLine: string,
  platform: PlatformRoute
) {
  const regional = toRegionalRoute(platform);

  const account = await riotClient.get<RiotAccountDto>(
    regionalUrl(regional, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`)
  );

  const summoner = await riotClient.get<SummonerDto>(
    platformUrl(platform, `/lol/summoner/v4/summoners/by-puuid/${account.puuid}`)
  );

  const leagueEntries = await riotClient.get<LeagueEntryDto[]>(
    platformUrl(platform, `/lol/league/v4/entries/by-puuid/${account.puuid}`)
  );

  const player = await prisma.player.upsert({
    where: { puuid: account.puuid },
    create: {
      puuid: account.puuid,
      gameName: account.gameName,
      tagLine: account.tagLine,
      platformRegion: platform,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
    },
    update: {
      gameName: account.gameName,
      tagLine: account.tagLine,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
    },
  });

  for (const entry of leagueEntries) {
    await prisma.rank.upsert({
      where: { playerPuuid_queueType: { playerPuuid: player.puuid, queueType: entry.queueType } },
      create: {
        playerPuuid: player.puuid,
        queueType: entry.queueType,
        tier: entry.tier,
        rank: entry.rank,
        leaguePoints: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
      },
      update: {
        tier: entry.tier,
        rank: entry.rank,
        leaguePoints: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
      },
    });
  }

  return player;
}

export interface CsBenchmark {
  insufficientData: boolean;
  cohortAverage: number | null;
  sampleSize: number;
  diffPercent: number | null;
}

export async function getPlayerWithMatches(puuid: string, matchLimit = 20) {
  const player = await prisma.player.findUnique({
    where: { puuid },
    include: { ranks: true },
  });
  if (!player) return null;

  const ownParticipants = await prisma.matchParticipant.findMany({
    where: { puuid },
    include: { match: true },
    orderBy: { match: { gameCreation: "desc" } },
    take: matchLimit,
  });

  if (ownParticipants.length === 0) {
    return { player, matches: [] };
  }

  const matchIds = ownParticipants.map((p) => p.matchId);
  const allParticipants = await prisma.matchParticipant.findMany({
    where: { matchId: { in: matchIds } },
  });

  const siblingsByMatchId = new Map<string, typeof allParticipants>();
  for (const p of allParticipants) {
    const list = siblingsByMatchId.get(p.matchId) ?? [];
    list.push(p);
    siblingsByMatchId.set(p.matchId, list);
  }

  const matches: {
    participant: (typeof ownParticipants)[number];
    metrics: MatchMetrics;
    csBenchmark: CsBenchmark;
  }[] = [];

  for (const participant of ownParticipants) {
    const siblings = siblingsByMatchId.get(participant.matchId) ?? [participant];
    const metrics = computeMatchMetrics(participant, siblings, participant.match.gameDuration);

    const cohort = await getMetricCohort(
      "csPerMin",
      participant.championName,
      participant.teamPosition,
      participant.match.gameVersion,
      participant.id
    );
    const csBenchmark: CsBenchmark = {
      insufficientData: cohort.insufficientData,
      cohortAverage: cohort.cohortAverage,
      sampleSize: cohort.sampleSize,
      diffPercent:
        cohort.cohortAverage !== null ? compareToCohort(metrics.csPerMin, cohort.cohortAverage).diffPercent : null,
    };

    matches.push({ participant, metrics, csBenchmark });
  }

  return { player, matches };
}

function topEntry(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export interface RoleWinRate {
  teamPosition: string;
  games: number;
  wins: number;
  winRate: number;
}

function computeRoleWinRates(matches: { participant: { teamPosition: string; win: boolean } }[]): RoleWinRate[] {
  const byRole = new Map<string, { games: number; wins: number }>();
  for (const m of matches) {
    if (!m.participant.teamPosition) continue;
    const entry = byRole.get(m.participant.teamPosition) ?? { games: 0, wins: 0 };
    entry.games += 1;
    if (m.participant.win) entry.wins += 1;
    byRole.set(m.participant.teamPosition, entry);
  }
  return [...byRole.entries()]
    .map(([teamPosition, { games, wins }]) => ({ teamPosition, games, wins, winRate: (wins / games) * 100 }))
    .sort((a, b) => b.games - a.games);
}

export interface ChampionRoleBreakdownEntry {
  championName: string;
  teamPosition: string;
  games: number;
  wins: number;
  winRate: number;
  avgKda: number;
  avgCsPerMin: number;
  avgGoldPerMin: number;
  avgVisionScorePerMin: number;
  avgDamagePerMin: number;
  avgObjectiveParticipation: number;
  winRateCohort: { insufficientData: boolean; cohortWinRate: number | null; sampleSize: number };
  csCohort: { insufficientData: boolean; cohortAverage: number | null; sampleSize: number; diffPercent: number | null };
}

async function computeChampionRoleBreakdown(
  puuid: string,
  matches: { participant: { championName: string; teamPosition: string; win: boolean; match: { gameVersion: string } }; metrics: MatchMetrics }[]
): Promise<ChampionRoleBreakdownEntry[]> {
  const groups = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = `${m.participant.championName}::${m.participant.teamPosition}`;
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }

  const entries: ChampionRoleBreakdownEntry[] = [];
  for (const rows of groups.values()) {
    const { championName, teamPosition } = rows[0].participant;
    const games = rows.length;
    const wins = rows.filter((r) => r.participant.win).length;
    const avg = (select: (r: (typeof rows)[number]) => number) => rows.reduce((sum, r) => sum + select(r), 0) / games;
    const gameVersion = rows[0].participant.match.gameVersion;

    let winRateCohort: ChampionRoleBreakdownEntry["winRateCohort"] = {
      insufficientData: true,
      cohortWinRate: null,
      sampleSize: 0,
    };
    let csCohort: ChampionRoleBreakdownEntry["csCohort"] = {
      insufficientData: true,
      cohortAverage: null,
      sampleSize: 0,
      diffPercent: null,
    };

    if (teamPosition) {
      const wrCohort = await getWinRateCohort(championName, teamPosition, gameVersion, puuid);
      winRateCohort = {
        insufficientData: wrCohort.insufficientData,
        cohortWinRate: wrCohort.cohortWinRate,
        sampleSize: wrCohort.sampleSize,
      };

      const avgCsPerMin = avg((r) => r.metrics.csPerMin);
      const cCohort = await getMetricCohortByPlayer("csPerMin", championName, teamPosition, gameVersion, puuid);
      csCohort = {
        insufficientData: cCohort.insufficientData,
        cohortAverage: cCohort.cohortAverage,
        sampleSize: cCohort.sampleSize,
        diffPercent:
          cCohort.cohortAverage !== null ? compareToCohort(avgCsPerMin, cCohort.cohortAverage).diffPercent : null,
      };
    }

    entries.push({
      championName,
      teamPosition,
      games,
      wins,
      winRate: (wins / games) * 100,
      avgKda: avg((r) => r.metrics.kda),
      avgCsPerMin: avg((r) => r.metrics.csPerMin),
      avgGoldPerMin: avg((r) => r.metrics.goldPerMin),
      avgVisionScorePerMin: avg((r) => r.metrics.visionScorePerMin),
      avgDamagePerMin: avg((r) => r.metrics.damagePerMin),
      avgObjectiveParticipation: avg((r) => r.metrics.objectiveParticipation),
      winRateCohort,
      csCohort,
    });
  }

  return entries.sort((a, b) => b.games - a.games);
}

export async function getPlayerDashboard(puuid: string, matchLimit = 20) {
  const base = await getPlayerWithMatches(puuid, matchLimit);
  if (!base) return null;
  const { player, matches } = base;

  const matchesWithScores = matches.map((m) => ({
    ...m,
    categoryScores: computeMatchCategoryScores(m.metrics, m.csBenchmark.diffPercent),
  }));

  const aggregate = averageCategoryScores(matchesWithScores.map((m) => m.categoryScores));
  const consistency = computeConsistencyScore(matches.map((m) => m.metrics.kda));

  const wins = matches.filter((m) => m.participant.win).length;
  const winRate = matches.length > 0 ? (wins / matches.length) * 100 : 0;
  const recentForm = matches.map((m) => (m.participant.win ? "W" : "L")).join("");

  const championCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  for (const m of matches) {
    championCounts.set(m.participant.championName, (championCounts.get(m.participant.championName) ?? 0) + 1);
    if (m.participant.teamPosition) {
      roleCounts.set(m.participant.teamPosition, (roleCounts.get(m.participant.teamPosition) ?? 0) + 1);
    }
  }

  const macroHabits = await analyzePlayerMacroHabits(puuid, matchLimit);
  const roleWinRates = computeRoleWinRates(matches);
  const championRoleBreakdown = await computeChampionRoleBreakdown(puuid, matches);

  return {
    player,
    matches: matchesWithScores,
    aggregate,
    consistency,
    winRate,
    recentForm,
    mainChampion: topEntry(championCounts),
    mainRole: topEntry(roleCounts),
    macroHabits,
    roleWinRates,
    championRoleBreakdown,
  };
}

export type PlayerDashboard = NonNullable<Awaited<ReturnType<typeof getPlayerDashboard>>>;
export type CategoryScoresType = CategoryScores;
