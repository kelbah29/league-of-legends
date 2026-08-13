import { NextResponse } from "next/server";
import { RiotApiError } from "@/lib/riot/client";
import { isPlatformRoute } from "@/lib/riot/regions";
import { searchAndSyncPlayer } from "@/server/services/playerService";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const gameName = body?.gameName?.trim();
  const tagLine = body?.tagLine?.trim();
  const platform = body?.platform?.trim();

  if (!gameName || !tagLine || !platform) {
    return NextResponse.json({ error: "gameName, tagLine and platform are required" }, { status: 400 });
  }
  if (!isPlatformRoute(platform)) {
    return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
  }

  try {
    const player = await searchAndSyncPlayer(gameName, tagLine, platform);
    return NextResponse.json({ puuid: player.puuid });
  } catch (err) {
    if (err instanceof RiotApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status === 404 ? 404 : 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
