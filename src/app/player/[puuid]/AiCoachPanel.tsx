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
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ marginBottom: 8 }}>AI Coach</h2>
      {summary ? (
        <>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, background: "#f7f8fa", padding: 12, borderRadius: 6 }}>
            {summary}
          </div>
          {generatedAt && (
            <p style={{ color: "#999", fontSize: 12, marginTop: 6 }}>
              Oluşturulma: {new Date(generatedAt).toLocaleString("tr-TR")}
            </p>
          )}
        </>
      ) : (
        <p style={{ color: "#999", fontSize: 13 }}>Henüz bir AI Coach özeti oluşturulmadı.</p>
      )}
      <button onClick={handleGenerate} disabled={loading} style={{ padding: "8px 16px", fontSize: 14, marginTop: 8 }}>
        {loading ? "Oluşturuluyor..." : summary ? "Yeniden oluştur" : "AI Coach özeti oluştur"}
      </button>
      {error && <p style={{ color: "crimson", marginTop: 8, fontSize: 13 }}>{error}</p>}
    </section>
  );
}
