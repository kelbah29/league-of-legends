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
    <main className="mx-auto max-w-md px-4 py-20">
      <h1 className="text-2xl font-bold text-text-primary">AI League Coach</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Riot ID&apos;ni gir, profilini ve son maçlarını çekelim.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        <SearchForm />
      </div>

      {recentPlayers.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-text-secondary">Son Aramalar</h2>
          <ul className="mt-2 overflow-hidden rounded-lg border border-border">
            {recentPlayers.map((p) => (
              <li key={p.puuid} className="border-b border-border last:border-b-0">
                <Link
                  href={`/player/${p.puuid}`}
                  className="flex items-center justify-between px-4 py-3 text-sm text-text-primary transition-colors hover:bg-surface-hover"
                >
                  <span>
                    {p.gameName}
                    <span className="text-text-muted">#{p.tagLine}</span>
                  </span>
                  <span className="text-xs text-text-muted">{p.platformRegion.toUpperCase()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
