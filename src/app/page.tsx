import Link from "next/link";
import { prisma } from "@/lib/db";
import SearchForm from "./SearchForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const recentPlayers = await prisma.player.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>AI League Coach</h1>
      <p style={{ color: "#666" }}>Riot ID&apos;ni gir, profilini ve son maçlarını çekelim.</p>

      <SearchForm />

      {recentPlayers.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 16 }}>Son Aramalar</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {recentPlayers.map((p) => (
              <li key={p.puuid} style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
                <Link href={`/player/${p.puuid}`}>
                  {p.gameName}#{p.tagLine} · {p.platformRegion.toUpperCase()}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
