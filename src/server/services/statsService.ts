import type { MatchParticipant } from "@prisma/client";

export interface MatchMetrics {
  csPerMin: number;
  goldPerMin: number;
  xpPerMin: number;
  kda: number;
  damagePerMin: number;
  damagePerDeath: number;
  damageShare: number;
  visionScorePerMin: number;
  killParticipationPercent: number;
  objectiveParticipation: number;
  csAdvantage: number | null;
  goldAdvantage: number | null;
  xpAdvantage: number | null;
}

/**
 * Computes derived performance metrics for one participant, using the other
 * 9 participants of the same match for team- and lane-opponent-relative stats
 * (damage share, CS/gold/XP advantage).
 */
export function computeMatchMetrics(
  target: MatchParticipant,
  allParticipantsInMatch: MatchParticipant[],
  gameDurationSeconds: number
): MatchMetrics {
  const minutes = Math.max(gameDurationSeconds / 60, 1);

  const teammates = allParticipantsInMatch.filter((p) => p.teamId === target.teamId);
  const teamTotalDamage = teammates.reduce((sum, p) => sum + p.totalDamageDealtToChampions, 0);

  const opponent = allParticipantsInMatch.find(
    (p) => p.teamPosition === target.teamPosition && p.teamId !== target.teamId && p.teamPosition !== ""
  );

  return {
    csPerMin: target.cs / minutes,
    goldPerMin: target.goldEarned / minutes,
    xpPerMin: target.champExperience / minutes,
    kda: target.deaths === 0 ? target.kills + target.assists : (target.kills + target.assists) / target.deaths,
    damagePerMin: target.totalDamageDealtToChampions / minutes,
    damagePerDeath:
      target.deaths === 0 ? target.totalDamageDealtToChampions : target.totalDamageDealtToChampions / target.deaths,
    damageShare: teamTotalDamage === 0 ? 0 : target.totalDamageDealtToChampions / teamTotalDamage,
    visionScorePerMin: target.visionScore / minutes,
    killParticipationPercent: target.killParticipation * 100,
    objectiveParticipation:
      target.dragonTakedowns + target.baronTakedowns + target.turretTakedowns + target.riftHeraldTakedowns,
    csAdvantage: opponent ? target.cs - opponent.cs : null,
    goldAdvantage: opponent ? target.goldEarned - opponent.goldEarned : null,
    xpAdvantage: opponent ? target.champExperience - opponent.champExperience : null,
  };
}
