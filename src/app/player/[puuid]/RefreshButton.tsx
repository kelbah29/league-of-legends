"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshButton({ puuid }: { puuid: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/players/${puuid}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Senkronizasyon başarısız");
      setMessage(`${data.newlySynced} yeni maç eklendi (toplam ${data.totalFound} bulundu).`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Senkronizasyon başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Senkronize ediliyor..." : "Refresh matches"}
      </button>
      {message && <p className="text-sm text-text-secondary">{message}</p>}
    </div>
  );
}
