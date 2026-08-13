import { prisma } from "@/lib/db";
import { regionalUrl, riotClient } from "@/lib/riot/client";
import { toRegionalRoute, type PlatformRoute, type RegionalRoute } from "@/lib/riot/regions";
import type { MatchDto, MatchTimelineDto } from "@/lib/riot/types";

export async function syncRecentMatches(puuid: string, platform: PlatformRoute, count = 20) {
  const regional = toRegionalRoute(platform);

  const matchIds = await riotClient.get<string[]>(
    regionalUrl(regional, `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`)
  );

  const existing = await prisma.match.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true },
  });
  const existingIds = new Set(existing.map((m) => m.matchId));
  const newIds = matchIds.filter((id) => !existingIds.has(id));

  let synced = 0;
  for (const matchId of newIds) {
    const match = await riotClient.get<MatchDto>(regionalUrl(regional, `/lol/match/v5/matches/${matchId}`));
    await storeMatch(match);
    await syncMatchTimeline(matchId, regional);
    synced += 1;
  }

  return { totalFound: matchIds.length, newlySynced: synced };
}

async function syncMatchTimeline(matchId: string, regional: RegionalRoute) {
  const timeline = await riotClient.get<MatchTimelineDto>(
    regionalUrl(regional, `/lol/match/v5/matches/${matchId}/timeline`)
  );
  await prisma.matchTimeline.create({
    data: { matchId, rawData: timeline as unknown as object },
  });
}

async function storeMatch(match: MatchDto) {
  const { metadata, info } = match;

  await prisma.match.create({
    data: {
      matchId: metadata.matchId,
      gameCreation: BigInt(info.gameCreation),
      gameDuration: info.gameDuration,
      gameVersion: info.gameVersion,
      queueId: info.queueId,
      platformId: info.platformId,
      rawData: match as unknown as object,
      participants: {
        create: info.participants.map((p) => ({
          puuid: p.puuid,
          championName: p.championName,
          teamPosition: p.teamPosition,
          teamId: p.teamId,
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          cs: p.totalMinionsKilled + p.neutralMinionsKilled,
          goldEarned: p.goldEarned,
          totalDamageDealtToChampions: p.totalDamageDealtToChampions,
          visionScore: p.visionScore,
          champExperience: p.champExperience,
          wardsPlaced: p.wardsPlaced,
          wardsKilled: p.wardsKilled,
          killParticipation: p.challenges?.killParticipation ?? 0,
          dragonTakedowns: p.challenges?.dragonTakedowns ?? 0,
          baronTakedowns: p.challenges?.baronTakedowns ?? 0,
          turretTakedowns: p.challenges?.turretTakedowns ?? 0,
          riftHeraldTakedowns: p.challenges?.riftHeraldTakedowns ?? 0,
        })),
      },
    },
  });
}
