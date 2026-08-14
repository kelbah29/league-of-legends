"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AiCoachPanel({
  puuid,
  initialSummary,
  initialGeneratedAt,
}: {
  puuid: string;
  initialSummary: string | null;
  initialGeneratedAt: string | null;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${puuid}/ai-coach`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI Coach özeti oluşturulamadı");
      setSummary(data.summaryText);
      setGeneratedAt(new Date().toISOString());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Coach özeti oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8 rounded-lg border border-accent/40 bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
        <span aria-hidden>✦</span> AI Coach
      </h2>
      {summary ? (
        <>
          <div className="whitespace-pre-wrap rounded-md bg-bg p-4 text-sm leading-relaxed text-text-primary">
            {summary}
          </div>
          {generatedAt && (
            <p className="mt-2 text-xs text-text-muted">
              Oluşturulma: {new Date(generatedAt).toLocaleString("tr-TR")}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-text-secondary">Henüz bir AI Coach özeti oluşturulmadı.</p>
      )}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Oluşturuluyor..." : summary ? "Yeniden oluştur" : "AI Coach özeti oluştur"}
      </button>
      {error && <p className="mt-2 text-sm text-loss">{error}</p>}
    </section>
  );
}
