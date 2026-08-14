import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getMatchDetail } from "@/server/services/matchDetailService";
import type { MacroEventType } from "@/server/services/macroService";
import Card from "../../Card";

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

interface TeamRow {
  id: string;
  puuid: string;
  championName: string;
  teamPosition: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  visionScore: number;
}

function TeamTable({ title, team, focusPuuid }: { title: string; team: TeamRow[]; focusPuuid: string }) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-muted">
              <th className="pb-2 font-medium">Şampiyon</th>
              <th className="pb-2 font-medium">Rol</th>
              <th className="pb-2 font-medium">KDA</th>
              <th className="pb-2 font-medium">CS</th>
              <th className="pb-2 font-medium">Gold</th>
              <th className="pb-2 font-medium">Damage</th>
              <th className="pb-2 font-medium">Vision</th>
            </tr>
          </thead>
          <tbody>
            {team.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-border/60 last:border-b-0 ${
                  p.puuid === focusPuuid ? "bg-accent/10 font-medium text-text-primary" : "text-text-secondary"
                }`}
              >
                <td className="py-2">{p.championName}</td>
                <td className="py-2">{p.teamPosition || "-"}</td>
                <td className="py-2">
                  {p.kills}/{p.deaths}/{p.assists}
                </td>
                <td className="py-2">{p.cs}</td>
                <td className="py-2">{p.goldEarned}</td>
                <td className="py-2">{p.totalDamageDealtToChampions}</td>
                <td className="py-2">{p.visionScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatTile({ label, value, badge }: { label: string; value: string; badge?: ReactNode }) {
  return (
    <div>
      <p className="text-lg font-bold text-text-primary">
        {value}
        {badge}
      </p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
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
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/player/${puuid}`} className="text-sm text-text-secondary hover:text-accent">
        &larr; Profile&apos;e dön
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">{focus.championName}</h1>
        <span
          className={`rounded px-2 py-1 text-xs font-semibold ${
            focus.win ? "bg-win/15 text-win" : "bg-loss/15 text-loss"
          }`}
        >
          {focus.win ? "Victory" : "Defeat"}
        </span>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        {new Date(Number(match.gameCreation)).toLocaleString("tr-TR")} · {Math.round(match.gameDuration / 60)} dk ·
        Patch {match.gameVersion.split(".").slice(0, 2).join(".")}
      </p>

      <Card className="mt-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="KDA" value={`${focus.kills}/${focus.deaths}/${focus.assists}`} />
          <StatTile
            label="CS/min"
            value={metrics.csPerMin.toFixed(1)}
            badge={
              !csBenchmark.insufficientData &&
              csBenchmark.diffPercent !== null && (
                <span className={`ml-1 text-xs font-medium ${csBenchmark.diffPercent >= 0 ? "text-win" : "text-loss"}`}>
                  {csBenchmark.diffPercent >= 0 ? "+" : ""}
                  {csBenchmark.diffPercent.toFixed(0)}%
                </span>
              )
            }
          />
          <StatTile label="Gold/min" value={metrics.goldPerMin.toFixed(0)} />
          <StatTile label="Damage share" value={`${(metrics.damageShare * 100).toFixed(0)}%`} />
          <StatTile label="Kill Participation" value={`${metrics.killParticipationPercent.toFixed(0)}%`} />
          <StatTile label="Vision/min" value={metrics.visionScorePerMin.toFixed(2)} />
          <StatTile label="Objective participation" value={String(metrics.objectiveParticipation)} />
          {metrics.csAdvantage !== null && (
            <StatTile
              label="CS advantage (lane)"
              value={`${metrics.csAdvantage >= 0 ? "+" : ""}${metrics.csAdvantage}`}
            />
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TeamTable title="Senin Takımın" team={ownTeam} focusPuuid={puuid} />
        <TeamTable title="Rakip Takım" team={enemyTeam} focusPuuid={puuid} />
      </div>

      <Card title="Macro Timeline" className="mt-6">
        {!timelineAvailable ? (
          <p className="text-sm text-text-muted">
            Bu maç için timeline verisi yok (Faz 4 öncesinde senkronize edilmiş olabilir). &quot;Refresh
            matches&quot; timeline&apos;ı yalnızca yeni maçlar için çeker.
          </p>
        ) : macroEvents.length === 0 ? (
          <p className="text-sm text-text-muted">Bu maçta önemli bir macro olayı tespit edilmedi.</p>
        ) : (
          <>
            <ol className="ml-1.5 border-l border-border">
              {macroEvents.map((e, i) => (
                <li key={i} className="relative pb-4 pl-5 last:pb-0">
                  <span className="absolute top-1 -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
                  <p className="text-sm">
                    <span className="font-mono text-text-muted">{formatTimestamp(e.timestampMs)}</span>{" "}
                    <span className="font-medium text-text-primary">{EVENT_LABELS[e.type]}</span>
                    {e.detail && <span className="text-text-secondary"> ({e.detail})</span>}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-text-muted">
              &quot;Recall (yaklaşık)&quot; Riot timeline&apos;ında ayrı bir olay tipi değildir; aynı 1 dakikalık
              çerçevede 2+ item satın alımı reset olarak yaklaşık olarak işaretlenir.
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
