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
    <div style={{ marginBottom: 24 }}>
      <button onClick={handleClick} disabled={loading} style={{ padding: "8px 16px", fontSize: 14 }}>
        {loading ? "Senkronize ediliyor..." : "Refresh matches"}
      </button>
      {message && <p style={{ color: "#666", marginTop: 8 }}>{message}</p>}
    </div>
  );
}
