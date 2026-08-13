// Temporary dev-only fixture: seeds one player + 6 matches (with timelines) so the
// full pipeline (stats/benchmark/performance score/macro/habits/AI coach) can be
// exercised end-to-end without a real Riot account that has match history.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PUUID = "fixture-target-puuid-0001";
const PLATFORM = "tr1";
const CHAMPION = "Ahri";
const ROLE = "MIDDLE";
const PATCH = "25.1.1.100";
const POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

const LANE_ANCHOR = { x: 7500, y: 7500 }; // MIDDLE role anchor, must match laneCommitmentService.ts

const matches = [
  { win: false, cs: 140, gold: 9500, k: 3, d: 5, a: 4, dmg: 15000, vis: 22, xp: 11000, wp: 6, wk: 1, kp: 0.45, dragonKiller: false, recallTs: 500000, dragonTs: 650000, oppCs: 150, laneCommitted: true, lanePush: true },
  { win: true, cs: 180, gold: 12000, k: 7, d: 2, a: 6, dmg: 22000, vis: 28, xp: 13500, wp: 8, wk: 2, kp: 0.65, dragonKiller: true, recallTs: 450000, dragonTs: 580000, oppCs: 155, laneCommitted: true, lanePush: false },
  { win: true, cs: 165, gold: 11000, k: 5, d: 3, a: 5, dmg: 19000, vis: 25, xp: 12500, wp: 7, wk: 1, kp: 0.55, dragonKiller: false, recallTs: 100000, dragonTs: 700000, oppCs: 160, laneCommitted: false, lanePush: true },
  { win: false, cs: 130, gold: 9000, k: 2, d: 6, a: 3, dmg: 13000, vis: 18, xp: 10500, wp: 5, wk: 0, kp: 0.35, dragonKiller: true, recallTs: 280000, dragonTs: 550000, oppCs: 145, laneCommitted: true, lanePush: false },
  { win: true, cs: 190, gold: 12500, k: 8, d: 1, a: 7, dmg: 24000, vis: 30, xp: 14000, wp: 9, wk: 2, kp: 0.72, dragonKiller: false, recallTs: 500000, dragonTs: 620000, oppCs: 165, laneCommitted: false, lanePush: true },
  { win: true, cs: 175, gold: 11500, k: 6, d: 2, a: 5, dmg: 20000, vis: 26, xp: 13000, wp: 7, wk: 1, kp: 0.6, dragonKiller: true, recallTs: 150000, dragonTs: 590000, oppCs: 158, laneCommitted: true, lanePush: false },
];

function buildParticipantFrames(participantId, committed) {
  // 5 samples up to the 20-minute mark. Committed = tight cluster around the
  // lane anchor (within the 5000-unit radius); not-committed = mostly far away.
  const near = [
    { x: LANE_ANCHOR.x - 100, y: LANE_ANCHOR.y + 50 },
    { x: LANE_ANCHOR.x + 100, y: LANE_ANCHOR.y - 50 },
    { x: LANE_ANCHOR.x + 50, y: LANE_ANCHOR.y + 100 },
    { x: LANE_ANCHOR.x - 50, y: LANE_ANCHOR.y - 100 },
    { x: LANE_ANCHOR.x, y: LANE_ANCHOR.y },
  ];
  const far = [
    { x: 2000, y: 2000 },
    { x: 13000, y: 13000 },
    { x: LANE_ANCHOR.x, y: LANE_ANCHOR.y },
    { x: 1000, y: 1000 },
    { x: 13500, y: 1500 },
  ];
  const positions = committed ? near : far;
  const timestamps = [0, 240000, 480000, 720000, 960000];
  return timestamps.map((timestamp, idx) => ({
    timestamp,
    events: [],
    participantFrames: { [String(participantId)]: { participantId, position: positions[idx] } },
  }));
}

function fillerParticipant(puuid, teamId, position, championName, blueTeamWin) {
  return {
    puuid,
    championName,
    teamPosition: position,
    teamId,
    win: teamId === 100 ? blueTeamWin : !blueTeamWin,
    kills: 4,
    deaths: 4,
    assists: 4,
    totalMinionsKilled: 100,
    neutralMinionsKilled: 10,
    goldEarned: 9000,
    totalDamageDealtToChampions: 14000,
    visionScore: 20,
    champExperience: 11000,
    wardsPlaced: 5,
    wardsKilled: 1,
    challenges: { killParticipation: 0.5, dragonTakedowns: 0, baronTakedowns: 0, turretTakedowns: 1, riftHeraldTakedowns: 0 },
  };
}

async function main() {
  // Delete + recreate rather than upsert-update: Match.update({}) intentionally
  // doesn't touch nested participants, so re-running this script with changed
  // fixture values would otherwise silently keep stale rows.
  const matchIds = matches.map((_, i) => `TESTFIX_${i + 1}`);
  await prisma.match.deleteMany({ where: { matchId: { in: matchIds } } });

  await prisma.player.upsert({
    where: { puuid: PUUID },
    create: {
      puuid: PUUID,
      gameName: "TestOyuncu",
      tagLine: "TEST",
      platformRegion: PLATFORM,
      profileIconId: 1,
      summonerLevel: 150,
    },
    update: {},
  });

  await prisma.rank.upsert({
    where: { playerPuuid_queueType: { playerPuuid: PUUID, queueType: "RANKED_SOLO_5x5" } },
    create: {
      playerPuuid: PUUID,
      queueType: "RANKED_SOLO_5x5",
      tier: "GOLD",
      rank: "II",
      leaguePoints: 45,
      wins: 40,
      losses: 35,
    },
    update: {},
  });

  const now = Date.now();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const matchId = `TESTFIX_${i + 1}`;
    const gameCreation = now - (matches.length - i) * 86400000;
    const gameDuration = 1800;

    const targetPuuid = PUUID;
    const enemyMirrorPuuid = `fixture-enemy-mirror-${i}`;

    const blueTeam = POSITIONS.map((pos, idx) => {
      if (idx === 2) {
        return {
          puuid: targetPuuid,
          championName: CHAMPION,
          teamPosition: ROLE,
          teamId: 100,
          win: m.win,
          kills: m.k,
          deaths: m.d,
          assists: m.a,
          totalMinionsKilled: m.cs - 15,
          neutralMinionsKilled: 15,
          goldEarned: m.gold,
          totalDamageDealtToChampions: m.dmg,
          visionScore: m.vis,
          champExperience: m.xp,
          wardsPlaced: m.wp,
          wardsKilled: m.wk,
          challenges: {
            killParticipation: m.kp,
            dragonTakedowns: m.dragonKiller ? 1 : 0,
            baronTakedowns: 0,
            turretTakedowns: 1,
            riftHeraldTakedowns: 0,
          },
        };
      }
      return fillerParticipant(`fixture-blue-${i}-${idx}`, 100, pos, "Garen", m.win);
    });

    const redTeam = POSITIONS.map((pos, idx) => {
      if (idx === 2) {
        return fillerParticipant(enemyMirrorPuuid, 200, ROLE, CHAMPION, m.win);
      }
      return fillerParticipant(`fixture-red-${i}-${idx}`, 200, pos, "Malphite", m.win);
    });
    // Override the mirror opponent's CS so the benchmark cohort has spread.
    redTeam[2].totalMinionsKilled = m.oppCs - 15;
    redTeam[2].neutralMinionsKilled = 15;

    const allParticipants = [...blueTeam, ...redTeam];
    const participantPuuids = allParticipants.map((p) => p.puuid);

    const matchDto = {
      metadata: { matchId, participants: participantPuuids },
      info: {
        gameCreation,
        gameDuration,
        gameVersion: PATCH,
        queueId: 420,
        platformId: PLATFORM.toUpperCase(),
        participants: allParticipants,
      },
    };

    await prisma.match.upsert({
      where: { matchId },
      create: {
        matchId,
        gameCreation: BigInt(gameCreation),
        gameDuration,
        gameVersion: PATCH,
        queueId: 420,
        platformId: PLATFORM.toUpperCase(),
        rawData: matchDto,
        participants: {
          create: allParticipants.map((p) => ({
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
            killParticipation: p.challenges.killParticipation,
            dragonTakedowns: p.challenges.dragonTakedowns,
            baronTakedowns: p.challenges.baronTakedowns,
            turretTakedowns: p.challenges.turretTakedowns,
            riftHeraldTakedowns: p.challenges.riftHeraldTakedowns,
          })),
        },
      },
      update: {},
    });

    const targetParticipantId = 3; // index 2 (0-based) + 1
    const timelineDto = {
      metadata: { matchId, participants: participantPuuids },
      info: {
        frameInterval: 60000,
        frames: [
          {
            timestamp: 0,
            events: [
              { type: "WARD_PLACED", timestamp: 60000, creatorId: targetParticipantId },
              { type: "ITEM_PURCHASED", timestamp: m.recallTs, participantId: targetParticipantId },
              { type: "ITEM_PURCHASED", timestamp: m.recallTs + 5000, participantId: targetParticipantId },
              ...(m.lanePush
                ? [{ type: "TURRET_PLATE_DESTROYED", timestamp: 400000, killerId: targetParticipantId, laneType: "MID_LANE" }]
                : []),
            ],
          },
          {
            timestamp: 600000,
            events: [
              {
                type: "ELITE_MONSTER_KILL",
                timestamp: m.dragonTs,
                monsterType: "DRAGON",
                killerId: m.dragonKiller ? targetParticipantId : 8,
                assistingParticipantIds: m.dragonKiller ? [1, 2] : [],
              },
              {
                type: "CHAMPION_KILL",
                timestamp: 200000 + i * 1000,
                killerId: targetParticipantId,
                victimId: 8,
                assistingParticipantIds: [1, 2],
              },
            ],
          },
          ...buildParticipantFrames(targetParticipantId, m.laneCommitted),
        ],
      },
    };

    await prisma.matchTimeline.upsert({
      where: { matchId },
      create: { matchId, rawData: timelineDto },
      update: { rawData: timelineDto },
    });

    console.log(`Seeded ${matchId}`);
  }

  console.log(`\nDone. Player puuid: ${PUUID}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
