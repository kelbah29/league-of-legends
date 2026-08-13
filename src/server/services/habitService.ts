import { prisma } from "@/lib/db";
import type { MatchTimelineDto } from "@/lib/riot/types";
import { computeLaneCommitmentRatio } from "./laneCommitmentService";
import { extractMacroEvents, getParticipantId } from "./macroService";

const EARLY_DRAGON_THRESHOLD_MS = 10 * 60 * 1000;
const LATE_RESET_THRESHOLD_MS = 4 * 60 * 1000;
const OBJECTIVE_RESET_WINDOW_MS = 3 * 60 * 1000;
const MIN_HABIT_SAMPLE = 5;
const MIN_IMPACT_GROUP_SAMPLE = 3;
const HABIT_FREQUENCY_THRESHOLD = 0.4;
const LATE_RESET_FREQUENCY_THRESHOLD = 0.6;
const LANE_COMMITMENT_MATCH_THRESHOLD = 0.7;
const LANE_COMMITMENT_FREQUENCY_THRESHOLD = 0.5;

export interface DetectedHabit {
  name: string;
  description: string;
  occurrences: number;
  sampleSize: number;
}

export interface MacroImpact {
  label: string;
  definition: string;
  groupAWinRate: number | null;
  groupASample: number;
  groupBWinRate: number | null;
  groupBSample: number;
  insufficientData: boolean;
}

export interface MacroHabitAnalysis {
  habits: DetectedHabit[];
  macroImpacts: MacroImpact[];
  sampleSize: number;
  minSampleRequired: number;
}

function getFirstDragonTimestamp(timelineRawData: unknown): number | null {
  const timeline = timelineRawData as MatchTimelineDto;
  for (const frame of timeline.info.frames) {
    for (const e of frame.events) {
      if (e.type === "ELITE_MONSTER_KILL" && e.monsterType === "DRAGON") {
        return e.timestamp;
      }
    }
  }
  return null;
}

/**
 * Scans a player's recent synced matches (that have timeline data) for
 * repeated behavioral patterns and reports the correlation between one of
 * them (reset timing before the first dragon) and win rate. This is
 * observational, not causal — we report "a relationship was observed", never
 * "this caused a win", matching the spec's framing.
 */
export async function analyzePlayerMacroHabits(puuid: string, matchLimit = 30): Promise<MacroHabitAnalysis> {
  const participants = await prisma.matchParticipant.findMany({
    where: { puuid },
    include: { match: { include: { timeline: true } } },
    orderBy: { match: { gameCreation: "desc" } },
    take: matchLimit,
  });

  const withTimeline = participants.filter((p) => p.match.timeline);
  const n = withTimeline.length;
  if (n < MIN_HABIT_SAMPLE) {
    return { habits: [], macroImpacts: [], sampleSize: n, minSampleRequired: MIN_HABIT_SAMPLE };
  }

  let earlyDragonCount = 0;
  let lateResetCount = 0;
  let timelyResetWins = 0;
  let timelyResetTotal = 0;
  let lateOrNoResetWins = 0;
  let lateOrNoResetTotal = 0;
  let laneCommittedCount = 0;
  let laneCommitmentSample = 0;

  for (const p of withTimeline) {
    if (!p.match.timeline) continue;
    const participantId = getParticipantId(p.match.rawData, puuid);
    if (participantId === null) continue;

    const events = extractMacroEvents(p.match.timeline.rawData, participantId);
    const recalls = events.filter((e) => e.type === "RECALL_PROXY");

    const laneCommitmentRatio = computeLaneCommitmentRatio(p.match.timeline.rawData, participantId, p.teamPosition);
    if (laneCommitmentRatio !== null) {
      laneCommitmentSample += 1;
      if (laneCommitmentRatio >= LANE_COMMITMENT_MATCH_THRESHOLD) laneCommittedCount += 1;
    }

    const firstDragonByPlayer = events.find((e) => e.type === "DRAGON_TAKEDOWN");
    if (firstDragonByPlayer && firstDragonByPlayer.timestampMs < EARLY_DRAGON_THRESHOLD_MS) {
      earlyDragonCount += 1;
    }

    const firstRecall = recalls[0];
    if (firstRecall && firstRecall.timestampMs > LATE_RESET_THRESHOLD_MS) {
      lateResetCount += 1;
    }

    const firstDragonTimestamp = getFirstDragonTimestamp(p.match.timeline.rawData);
    if (firstDragonTimestamp !== null) {
      const timelyReset = recalls.some(
        (r) => r.timestampMs <= firstDragonTimestamp && r.timestampMs >= firstDragonTimestamp - OBJECTIVE_RESET_WINDOW_MS
      );
      if (timelyReset) {
        timelyResetTotal += 1;
        if (p.win) timelyResetWins += 1;
      } else {
        lateOrNoResetTotal += 1;
        if (p.win) lateOrNoResetWins += 1;
      }
    }
  }

  const habits: DetectedHabit[] = [];
  if (earlyDragonCount / n >= HABIT_FREQUENCY_THRESHOLD) {
    habits.push({
      name: "Early Dragon Tendency",
      description: `Son ${n} maçının ${earlyDragonCount} tanesinde 10 dakikadan önce dragon takedown'a katıldın.`,
      occurrences: earlyDragonCount,
      sampleSize: n,
    });
  }
  if (lateResetCount / n >= LATE_RESET_FREQUENCY_THRESHOLD) {
    habits.push({
      name: "Late Reset Tendency",
      description: `Son ${n} maçının ${lateResetCount} tanesinde ilk reset'in 4. dakikadan sonra gerçekleşti.`,
      occurrences: lateResetCount,
      sampleSize: n,
    });
  }
  if (laneCommitmentSample > 0 && laneCommittedCount / laneCommitmentSample >= LANE_COMMITMENT_FREQUENCY_THRESHOLD) {
    habits.push({
      name: "Lane Commitment",
      description: `Son ${laneCommitmentSample} maçının ${laneCommittedCount} tanesinde 20. dakikaya kadar büyük ölçüde lane bölgende kaldın (pozisyon verisine dayanan yaklaşık bir ölçüm).`,
      occurrences: laneCommittedCount,
      sampleSize: laneCommitmentSample,
    });
  }

  const macroImpacts: MacroImpact[] = [
    {
      label: "Dragon Öncesi Reset Zamanlaması",
      definition:
        "İlk dragon takedown'ından önceki 3 dakika içinde reset atmak 'zamanında', atmamak 'geç/yok' olarak sınıflandırılır.",
      groupAWinRate: timelyResetTotal > 0 ? (timelyResetWins / timelyResetTotal) * 100 : null,
      groupASample: timelyResetTotal,
      groupBWinRate: lateOrNoResetTotal > 0 ? (lateOrNoResetWins / lateOrNoResetTotal) * 100 : null,
      groupBSample: lateOrNoResetTotal,
      insufficientData: timelyResetTotal < MIN_IMPACT_GROUP_SAMPLE || lateOrNoResetTotal < MIN_IMPACT_GROUP_SAMPLE,
    },
  ];

  return { habits, macroImpacts, sampleSize: n, minSampleRequired: MIN_HABIT_SAMPLE };
}
