import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedAiCoachSummary } from "@/server/services/aiCoachService";
import { getPlayerDashboard } from "@/server/services/playerService";
import AiCoachPanel from "./AiCoachPanel";
import RefreshButton from "./RefreshButton";
import ScoreBar from "./ScoreBar";
import TrendsChart, { type TrendPoint } from "./TrendsChart";

function formatDiff(diffPercent: number | null): string {
  if (diffPercent === null) return "";
  const sign = diffPercent >= 0 ? "+" : "";
  return ` (${sign}${diffPercent.toFixed(0)}% vs benzer)`;
}

export default async function PlayerPage({ params }: { params: Promise<{ puuid: string }> }) {
  const { puuid } = await params;
  const dashboard = await getPlayerDashboard(puuid);
  if (!dashboard) notFound();
  const cachedAiCoach = await getCachedAiCoachSummary(puuid);

  const {
    player,
    matches,
    aggregate,
    consistency,
    winRate,
    recentForm,
    mainChampion,
    mainRole,
    macroHabits,
    roleWinRates,
    championRoleBreakdown,
  } = dashboard;

  const trendPoints: TrendPoint[] = [...matches]
    .reverse()
    .map((m, i) => ({ label: `#${i + 1}`, csPerMin: m.metrics.csPerMin }));

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>
        {player.gameName}#{player.tagLine}
      </h1>
      <p style={{ color: "#666" }}>
        {player.platformRegion.toUpperCase()} · Seviye {player.summonerLevel}
      </p>

      {player.ranks.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, display: "flex", gap: 16 }}>
          {player.ranks.map((rank) => (
            <li key={rank.id}>
              <strong>{rank.queueType}</strong>: {rank.tier} {rank.rank} ({rank.leaguePoints} LP) —{" "}
              {rank.wins}W {rank.losses}L
            </li>
          ))}
        </ul>
      )}

      <RefreshButton puuid={puuid} />

      {matches.length > 0 && (
        <AiCoachPanel
          puuid={puuid}
          initialSummary={cachedAiCoach?.summaryText ?? null}
          initialGeneratedAt={cachedAiCoach?.generatedAt.toISOString() ?? null}
        />
      )}

      {matches.length > 0 && (
        <>
          <section style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 24 }}>
            <div>
              <h2 style={{ marginBottom: 8 }}>Overview</h2>
              <p style={{ margin: "4px 0" }}>
                Senkronize edilmiş son {matches.length} maç — Win rate: <strong>{winRate.toFixed(0)}%</strong>
              </p>
              <p style={{ margin: "4px 0" }}>
                Recent form:{" "}
                {recentForm.split("").map((r, i) => (
                  <span key={i} style={{ color: r === "W" ? "green" : "crimson", fontWeight: 600 }}>
                    {r}
                  </span>
                ))}
              </p>
              <p style={{ margin: "4px 0" }}>
                En çok oynanan: <strong>{mainChampion ?? "-"}</strong> ({mainRole ?? "-"})
              </p>
              <p style={{ margin: "4px 0" }}>
                Overall Performance Score: <strong>{aggregate.overall.toFixed(0)}/100</strong>
              </p>
            </div>

            <div style={{ minWidth: 220 }}>
              <h2 style={{ marginBottom: 8 }}>Performance</h2>
              <ScoreBar label="Farming" value={aggregate.farming} />
              <ScoreBar label="Combat" value={aggregate.combat} />
              <ScoreBar label="Vision" value={aggregate.vision} />
              <ScoreBar label="Objective" value={aggregate.objective} />
              <ScoreBar label="Consistency" value={consistency} />
              <p style={{ color: "#999", fontSize: 12 }}>Aşağıdaki &quot;Habits&quot; bölümüne bak.</p>
            </div>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2 style={{ marginBottom: 8 }}>Trends (CS/min)</h2>
            <TrendsChart points={trendPoints} />
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2 style={{ marginBottom: 8 }}>Champion & Role Analysis</h2>

            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              {roleWinRates.map((r) => (
                <div key={r.teamPosition} style={{ fontSize: 13 }}>
                  <strong>{r.teamPosition}</strong>: {r.winRate.toFixed(0)}% ({r.games} maç)
                </div>
              ))}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                  <th>Şampiyon</th>
                  <th>Rol</th>
                  <th>Maç</th>
                  <th>Win Rate</th>
                  <th>KDA</th>
                  <th>CS/min</th>
                  <th>Gold/min</th>
                  <th>Vision/min</th>
                  <th>Dmg/min</th>
                  <th>Objective</th>
                </tr>
              </thead>
              <tbody>
                {championRoleBreakdown.map((c) => (
                  <tr key={`${c.championName}-${c.teamPosition}`} style={{ borderBottom: "1px solid #eee" }}>
                    <td>{c.championName}</td>
                    <td>{c.teamPosition || "-"}</td>
                    <td>{c.games}</td>
                    <td>
                      {c.winRate.toFixed(0)}%
                      {!c.winRateCohort.insufficientData && c.winRateCohort.cohortWinRate !== null && (
                        <span style={{ color: "#999" }}>
                          {" "}
                          (benzer: {c.winRateCohort.cohortWinRate.toFixed(0)}%)
                        </span>
                      )}
                    </td>
                    <td>{c.avgKda.toFixed(1)}</td>
                    <td>
                      {c.avgCsPerMin.toFixed(1)}
                      {!c.csCohort.insufficientData && (
                        <span style={{ color: (c.csCohort.diffPercent ?? 0) >= 0 ? "green" : "crimson" }}>
                          {formatDiff(c.csCohort.diffPercent)}
                        </span>
                      )}
                    </td>
                    <td>{c.avgGoldPerMin.toFixed(0)}</td>
                    <td>{c.avgVisionScorePerMin.toFixed(2)}</td>
                    <td>{c.avgDamagePerMin.toFixed(0)}</td>
                    <td>{c.avgObjectiveParticipation.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ color: "#999", fontSize: 12, marginTop: 8 }}>
              &quot;benzer&quot; sütunları, DB&apos;de biriken diğer oyuncuların aynı şampiyon+rol verisine göre
              hesaplanır (rank/region filtresi yok, örneklem yetersizse gösterilmez).
            </p>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2 style={{ marginBottom: 8 }}>Habits</h2>
            {macroHabits.sampleSize < macroHabits.minSampleRequired ? (
              <p style={{ color: "#999", fontSize: 13 }}>
                Habit tespiti için en az {macroHabits.minSampleRequired} timeline&apos;lı maç gerekiyor (şu an{" "}
                {macroHabits.sampleSize}). Daha fazla maç senkronize ettikçe burası dolacak.
              </p>
            ) : macroHabits.habits.length === 0 ? (
              <p style={{ color: "#999", fontSize: 13 }}>Belirgin bir tekrar eden davranış tespit edilmedi.</p>
            ) : (
              <ul style={{ padding: 0, listStyle: "none" }}>
                {macroHabits.habits.map((h) => (
                  <li key={h.name} style={{ marginBottom: 8 }}>
                    <strong>{h.name}</strong>
                    <p style={{ margin: "2px 0", color: "#555", fontSize: 13 }}>{h.description}</p>
                  </li>
                ))}
              </ul>
            )}

            <h3 style={{ marginTop: 16, fontSize: 15 }}>Macro Impact</h3>
            {macroHabits.macroImpacts.map((impact) => (
              <div key={impact.label} style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>{impact.label}</strong>
                <p style={{ margin: "2px 0", color: "#555" }}>{impact.definition}</p>
                {impact.insufficientData ? (
                  <p style={{ color: "#999" }}>
                    Her iki grupta da yeterli örneklem yok (zamanında reset: {impact.groupASample}, geç/yok:{" "}
                    {impact.groupBSample}) — güvenilir bir karşılaştırma için daha fazla maç gerekiyor.
                  </p>
                ) : (
                  <p style={{ color: "#555" }}>
                    Zamanında reset attığın maçlarda win rate <strong>{impact.groupAWinRate?.toFixed(0)}%</strong>{" "}
                    ({impact.groupASample} maç), geç/hiç reset atmadığın maçlarda{" "}
                    <strong>{impact.groupBWinRate?.toFixed(0)}%</strong> ({impact.groupBSample} maç). Bu bir ilişki
                    gözlemidir, nedensellik iddiası değildir.
                  </p>
                )}
              </div>
            ))}
          </section>
        </>
      )}

      <h2>Son Maçlar</h2>
      {matches.length === 0 ? (
        <p>Henüz senkronize edilmiş maç yok. &quot;Refresh matches&quot; ile çekebilirsin.</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>Şampiyon</th>
                <th>Rol</th>
                <th>Sonuç</th>
                <th>KDA</th>
                <th>CS/min</th>
                <th>Gold/min</th>
                <th>Kill Part.</th>
                <th>Vision/min</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(({ participant: p, metrics, csBenchmark }) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>
                    <Link href={`/player/${puuid}/match/${p.matchId}`}>{p.championName}</Link>
                  </td>
                  <td>{p.teamPosition || "-"}</td>
                  <td style={{ color: p.win ? "green" : "crimson" }}>{p.win ? "Victory" : "Defeat"}</td>
                  <td>
                    {p.kills}/{p.deaths}/{p.assists} ({metrics.kda.toFixed(1)})
                  </td>
                  <td>
                    {metrics.csPerMin.toFixed(1)}
                    {!csBenchmark.insufficientData && (
                      <span style={{ color: (csBenchmark.diffPercent ?? 0) >= 0 ? "green" : "crimson" }}>
                        {formatDiff(csBenchmark.diffPercent)}
                      </span>
                    )}
                  </td>
                  <td>{metrics.goldPerMin.toFixed(0)}</td>
                  <td>{metrics.killParticipationPercent.toFixed(0)}%</td>
                  <td>{metrics.visionScorePerMin.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "#999", fontSize: 12, marginTop: 12 }}>
            &quot;vs benzer&quot; karşılaştırması, senkronize edilmiş maçlardaki aynı şampiyon+rolü oynayan diğer
            oyunculara göre hesaplanır (rank/region filtresi yok). Yeterli örneklem yoksa gösterilmez.
          </p>
        </>
      )}
    </main>
  );
}
