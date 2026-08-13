import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchDetail } from "@/server/services/matchDetailService";
import type { MacroEventType } from "@/server/services/macroService";

const EVENT_LABELS: Record<MacroEventType, string> = {
  KILL: "Kill",
  DEATH: "Death",
  ASSIST: "Assist",
  DRAGON_TAKEDOWN: "Dragon",
  BARON_TAKEDOWN: "Baron",
  HERALD_TAKEDOWN: "Rift Herald",
  TURRET_TAKEDOWN: "Turret",
  LANE_PUSH: "Lane Push (plate)",
  RECALL_PROXY: "Recall (yaklaşık)",
  WARD_PLACED: "Ward",
};

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function TeamTable({ team, focusPuuid }: { team: { id: string; puuid: string; championName: string; teamPosition: string; win: boolean; kills: number; deaths: number; assists: number; cs: number; goldEarned: number; totalDamageDealtToChampions: number; visionScore: number }[]; focusPuuid: string }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
          <th>Şampiyon</th>
          <th>Rol</th>
          <th>KDA</th>
          <th>CS</th>
          <th>Gold</th>
          <th>Damage</th>
          <th>Vision</th>
        </tr>
      </thead>
      <tbody>
        {team.map((p) => (
          <tr
            key={p.id}
            style={{
              borderBottom: "1px solid #eee",
              fontWeight: p.puuid === focusPuuid ? 700 : 400,
              background: p.puuid === focusPuuid ? "#f5f8ff" : undefined,
            }}
          >
            <td>{p.championName}</td>
            <td>{p.teamPosition || "-"}</td>
            <td>
              {p.kills}/{p.deaths}/{p.assists}
            </td>
            <td>{p.cs}</td>
            <td>{p.goldEarned}</td>
            <td>{p.totalDamageDealtToChampions}</td>
            <td>{p.visionScore}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ puuid: string; matchId: string }>;
}) {
  const { puuid, matchId } = await params;
  const detail = await getMatchDetail(matchId, puuid);
  if (!detail) notFound();

  const { match, focus, metrics, csBenchmark, ownTeam, enemyTeam, macroEvents, timelineAvailable } = detail;

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <Link href={`/player/${puuid}`}>&larr; Profile&apos;e dön</Link>

      <h1 style={{ marginTop: 12 }}>
        {focus.championName} · {focus.win ? "Victory" : "Defeat"}
      </h1>
      <p style={{ color: "#666" }}>
        {new Date(Number(match.gameCreation)).toLocaleString("tr-TR")} · {Math.round(match.gameDuration / 60)} dk ·
        Patch {match.gameVersion.split(".").slice(0, 2).join(".")}
      </p>

      <section style={{ display: "flex", gap: 24, flexWrap: "wrap", margin: "16px 0", fontSize: 14 }}>
        <div>
          KDA: <strong>{focus.kills}/{focus.deaths}/{focus.assists}</strong> ({metrics.kda.toFixed(1)})
        </div>
        <div>
          CS/min: <strong>{metrics.csPerMin.toFixed(1)}</strong>
          {!csBenchmark.insufficientData && csBenchmark.diffPercent !== null && (
            <span style={{ color: csBenchmark.diffPercent >= 0 ? "green" : "crimson" }}>
              {" "}
              ({csBenchmark.diffPercent >= 0 ? "+" : ""}
              {csBenchmark.diffPercent.toFixed(0)}% vs benzer)
            </span>
          )}
        </div>
        <div>
          Gold/min: <strong>{metrics.goldPerMin.toFixed(0)}</strong>
        </div>
        <div>
          Damage share: <strong>{(metrics.damageShare * 100).toFixed(0)}%</strong>
        </div>
        <div>
          Kill Participation: <strong>{metrics.killParticipationPercent.toFixed(0)}%</strong>
        </div>
        <div>
          Vision/min: <strong>{metrics.visionScorePerMin.toFixed(2)}</strong>
        </div>
        <div>
          Objective participation: <strong>{metrics.objectiveParticipation}</strong>
        </div>
        {metrics.csAdvantage !== null && (
          <div>
            CS advantage (lane): <strong>{metrics.csAdvantage >= 0 ? "+" : ""}{metrics.csAdvantage}</strong>
          </div>
        )}
      </section>

      <h2>Senin Takımın</h2>
      <TeamTable team={ownTeam} focusPuuid={puuid} />

      <h2>Rakip Takım</h2>
      <TeamTable team={enemyTeam} focusPuuid={puuid} />

      <h2>Macro Timeline</h2>
      {!timelineAvailable ? (
        <p style={{ color: "#999", fontSize: 13 }}>
          Bu maç için timeline verisi yok (Faz 4 öncesinde senkronize edilmiş olabilir). &quot;Refresh
          matches&quot; timeline&apos;ı yalnızca yeni maçlar için çeker.
        </p>
      ) : macroEvents.length === 0 ? (
        <p style={{ color: "#999", fontSize: 13 }}>Bu maçta önemli bir macro olayı tespit edilmedi.</p>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, fontSize: 13 }}>
            {macroEvents.map((e, i) => (
              <li key={i} style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                <strong>{formatTimestamp(e.timestampMs)}</strong> — {EVENT_LABELS[e.type]}
                {e.detail ? ` (${e.detail})` : ""}
              </li>
            ))}
          </ul>
          <p style={{ color: "#999", fontSize: 12, marginTop: 8 }}>
            &quot;Recall (yaklaşık)&quot; Riot timeline&apos;ında ayrı bir olay tipi değildir; aynı 1 dakikalık
            çerçevede 2+ item satın alımı reset olarak yaklaşık olarak işaretlenir.
          </p>
        </>
      )}
    </main>
  );
}
