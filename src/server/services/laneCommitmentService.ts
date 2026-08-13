import type { MatchTimelineDto } from "@/lib/riot/types";

const LANE_COMMITMENT_WINDOW_MS = 20 * 60 * 1000;
// Generous radius (map is ~14800x14800 units) — this is a coarse corridor,
// not precise lane geometry, since Riot doesn't publish lane boundaries.
const LANE_RADIUS = 5000;

// Rough anchor point per role, used only to estimate "stayed near their lane"
// vs. "roamed away". JUNGLE has no fixed lane, so it's excluded.
const LANE_ANCHORS: Record<string, { x: number; y: number }> = {
  TOP: { x: 3000, y: 11500 },
  MIDDLE: { x: 7500, y: 7500 },
  BOTTOM: { x: 12000, y: 3000 },
  UTILITY: { x: 11000, y: 2500 },
};

/**
 * Fraction (0-1) of timeline frames up to the 20-minute mark where the
 * participant's position stayed within a generous radius of their role's
 * approximate lane anchor. This is a coarse, documented approximation (no
 * real lane-corridor geometry) — used only to flag a directional tendency,
 * not to make precise claims about roaming behavior. Returns null when the
 * role has no fixed lane (jungle) or no position data is available.
 */
export function computeLaneCommitmentRatio(
  timelineRawData: unknown,
  participantId: number,
  teamPosition: string
): number | null {
  const anchor = LANE_ANCHORS[teamPosition];
  if (!anchor) return null;

  const timeline = timelineRawData as MatchTimelineDto;
  let inLaneFrames = 0;
  let totalFrames = 0;

  for (const frame of timeline.info.frames) {
    if (frame.timestamp > LANE_COMMITMENT_WINDOW_MS) continue;
    const position = frame.participantFrames?.[String(participantId)]?.position;
    if (!position) continue;

    totalFrames += 1;
    const dx = position.x - anchor.x;
    const dy = position.y - anchor.y;
    if (Math.sqrt(dx * dx + dy * dy) <= LANE_RADIUS) {
      inLaneFrames += 1;
    }
  }

  return totalFrames === 0 ? null : inLaneFrames / totalFrames;
}
