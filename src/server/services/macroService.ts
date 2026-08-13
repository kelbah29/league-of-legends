import type { MatchTimelineDto } from "@/lib/riot/types";

export type MacroEventType =
  | "KILL"
  | "DEATH"
  | "ASSIST"
  | "DRAGON_TAKEDOWN"
  | "BARON_TAKEDOWN"
  | "HERALD_TAKEDOWN"
  | "TURRET_TAKEDOWN"
  | "LANE_PUSH"
  | "RECALL_PROXY"
  | "WARD_PLACED";

export interface MacroEvent {
  type: MacroEventType;
  timestampMs: number;
  detail?: string;
}

/**
 * Timeline events reference participants by a 1-10 integer (`participantId`),
 * not puuid. The integer is just the participant's index (1-based) in the
 * match's `metadata.participants` puuid array, which we already have stored
 * on `Match.rawData`.
 */
export function getParticipantId(matchRawData: unknown, puuid: string): number | null {
  const data = matchRawData as { metadata?: { participants?: string[] } };
  const idx = data.metadata?.participants?.indexOf(puuid) ?? -1;
  return idx === -1 ? null : idx + 1;
}

const MONSTER_TO_EVENT: Record<string, MacroEventType> = {
  DRAGON: "DRAGON_TAKEDOWN",
  BARON_NASHOR: "BARON_TAKEDOWN",
  RIFTHERALD: "HERALD_TAKEDOWN",
};

/**
 * Riot's timeline has no explicit "recall" event type. As a documented
 * approximation, 2+ ITEM_PURCHASED events by the same participant within one
 * timeline frame (default: 1 minute) are treated as a recall/reset — a
 * player only buys multiple items back at their base. This will miss single
 * -item recalls and can't be perfectly precise given 1-minute frame
 * granularity.
 */
export function extractMacroEvents(timelineRawData: unknown, participantId: number): MacroEvent[] {
  const timeline = timelineRawData as MatchTimelineDto;
  const events: MacroEvent[] = [];

  for (const frame of timeline.info.frames) {
    const purchases = frame.events.filter((e) => e.type === "ITEM_PURCHASED" && e.participantId === participantId);
    if (purchases.length >= 2) {
      events.push({
        type: "RECALL_PROXY",
        timestampMs: purchases[0].timestamp,
        detail: `${purchases.length} item alındı (yaklaşık reset)`,
      });
    }

    for (const e of frame.events) {
      if (e.type === "CHAMPION_KILL") {
        if (e.killerId === participantId) events.push({ type: "KILL", timestampMs: e.timestamp });
        if (e.victimId === participantId) events.push({ type: "DEATH", timestampMs: e.timestamp });
        if (e.assistingParticipantIds?.includes(participantId)) {
          events.push({ type: "ASSIST", timestampMs: e.timestamp });
        }
      } else if (e.type === "ELITE_MONSTER_KILL") {
        const involved = e.killerId === participantId || (e.assistingParticipantIds?.includes(participantId) ?? false);
        const eventType = e.monsterType ? MONSTER_TO_EVENT[e.monsterType] : undefined;
        if (involved && eventType) {
          events.push({ type: eventType, timestampMs: e.timestamp, detail: e.monsterType });
        }
      } else if (e.type === "BUILDING_KILL" && e.buildingType === "TOWER_BUILDING") {
        const involved = e.killerId === participantId || (e.assistingParticipantIds?.includes(participantId) ?? false);
        if (involved) {
          events.push({ type: "TURRET_TAKEDOWN", timestampMs: e.timestamp, detail: e.towerType });
        }
      } else if (e.type === "TURRET_PLATE_DESTROYED" && e.killerId === participantId) {
        // Proxy for "lane push": Riot has no dedicated push event, but knocking
        // a turret plate off is the concrete, attributable result of one.
        events.push({ type: "LANE_PUSH", timestampMs: e.timestamp, detail: e.laneType });
      } else if (e.type === "WARD_PLACED" && e.creatorId === participantId) {
        events.push({ type: "WARD_PLACED", timestampMs: e.timestamp });
      }
    }
  }

  return events.sort((a, b) => a.timestampMs - b.timestampMs);
}
