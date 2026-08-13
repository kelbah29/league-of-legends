import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RiotApiError } from "@/lib/riot/client";
import { isPlatformRoute } from "@/lib/riot/regions";
import { syncRecentMatches } from "@/server/services/matchService";

export async function POST(_request: Request, { params }: { params: Promise<{ puuid: string }> }) {
  const { puuid } = await params;

  const player = await prisma.player.findUnique({ where: { puuid } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  if (!isPlatformRoute(player.platformRegion)) {
    return NextResponse.json({ error: `Unsupported platform: ${player.platformRegion}` }, { status: 500 });
  }

  try {
    const result = await syncRecentMatches(puuid, player.platformRegion, 20);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RiotApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
