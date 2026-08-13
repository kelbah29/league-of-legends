import { NextResponse } from "next/server";
import { generateAiCoachSummary } from "@/server/services/aiCoachService";
import { getPlayerDashboard } from "@/server/services/playerService";

export async function POST(_request: Request, { params }: { params: Promise<{ puuid: string }> }) {
  const { puuid } = await params;

  const dashboard = await getPlayerDashboard(puuid);
  if (!dashboard) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  if (dashboard.matches.length === 0) {
    return NextResponse.json({ error: "AI Coach için önce en az birkaç maç senkronize etmelisin." }, { status: 400 });
  }

  try {
    const summaryText = await generateAiCoachSummary(puuid, dashboard);
    return NextResponse.json({ summaryText });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
