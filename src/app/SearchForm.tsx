"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PLATFORM_ROUTES } from "@/lib/riot/regions";

export default function SearchForm() {
  const router = useRouter();
  const [riotId, setRiotId] = useState("");
  const [platform, setPlatform] = useState(PLATFORM_ROUTES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const [gameName, tagLine] = riotId.split("#").map((s) => s.trim());
    if (!gameName || !tagLine) {
      setError("Riot ID formatı: gameName#tagLine (örn. Faker#KR1)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/players/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName, tagLine, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bir hata oluştu");
      router.push(`/player/${data.puuid}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          placeholder="gameName#tagLine"
          className="rounded-md border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as typeof platform)}
          className="rounded-md border border-border bg-bg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
        >
          {PLATFORM_ROUTES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bg/40 border-t-bg"
            />
          )}
          {loading ? "Aranıyor..." : "Ara"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-loss">{error}</p>}
    </>
  );
}
