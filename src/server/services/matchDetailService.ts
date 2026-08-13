import { prisma } from "@/lib/db";
import { compareToCohort, getMetricCohort } from "./benchmarkService";
import { extractMacroEvents, getParticipantId, type MacroEvent } from "./macroService";
import { computeMatchMetrics } from "./statsService";

export async function getMatchDetail(matchId: string, focusPuuid: string) {
  const match = await prisma.match.findUnique({
    where: { matchId },
    include: { participants: true },
  });
  if (!match) return null;

  const focus = match.participants.find((p) => p.puuid === focusPuuid);
  if (!focus) return null;

  const metrics = computeMatchMetrics(focus, match.participants, match.gameDuration);

  const cohort = await getMetricCohort("csPerMin", focus.championName, focus.teamPosition, match.gameVersion, focus.id);
  const csBenchmark = {
    insufficientData: cohort.insufficientData,
    cohortAverage: cohort.cohortAverage,
    sampleSize: cohort.sampleSize,
    diffPercent:
      cohort.cohortAverage !== null ? compareToCohort(metrics.csPerMin, cohort.cohortAverage).diffPercent : null,
  };

  const ownTeam = match.participants
    .filter((p) => p.teamId === focus.teamId)
    .sort((a, b) => a.teamPosition.localeCompare(b.teamPosition));
  const enemyTeam = match.participants
    .filter((p) => p.teamId !== focus.teamId)
    .sort((a, b) => a.teamPosition.localeCompare(b.teamPosition));

  const timelineRow = await prisma.matchTimeline.findUnique({ where: { matchId } });
  let macroEvents: MacroEvent[] = [];
  if (timelineRow) {
    const participantId = getParticipantId(match.rawData, focusPuuid);
    if (participantId !== null) {
      macroEvents = extractMacroEvents(timelineRow.rawData, participantId);
    }
  }

  return { match, focus, metrics, csBenchmark, ownTeam, enemyTeam, macroEvents, timelineAvailable: !!timelineRow };
}
