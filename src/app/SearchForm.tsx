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
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        <input
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          placeholder="gameName#tagLine"
          style={{ padding: 8, fontSize: 16 }}
        />
        <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} style={{ padding: 8, fontSize: 16 }}>
          {PLATFORM_ROUTES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading} style={{ padding: 10, fontSize: 16 }}>
          {loading ? "Aranıyor..." : "Ara"}
        </button>
      </form>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
    </>
  );
}
