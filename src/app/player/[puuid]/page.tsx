import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedAiCoachSummary } from "@/server/services/aiCoachService";
import { getPlayerDashboard } from "@/server/services/playerService";
import AiCoachPanel from "./AiCoachPanel";
import Card from "./Card";
import RefreshButton from "./RefreshButton";
import ScoreBar from "./ScoreBar";
import TrendsChart, { type TrendPoint } from "./TrendsChart";

function DiffBadge({ diffPercent }: { diffPercent: number | null }) {
  if (diffPercent === null) return null;
  const positive = diffPercent >= 0;
  return (
    <span className={`ml-1.5 text-xs font-medium ${positive ? "text-win" : "text-loss"}`}>
      {positive ? "+" : ""}
      {diffPercent.toFixed(0)}% vs benzer
    </span>
  );
}

function ResultBadge({ win }: { win: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${
        win ? "bg-win/15 text-win" : "bg-loss/15 text-loss"
      }`}
    >
      {win ? "Victory" : "Defeat"}
    </span>
  );
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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {player.gameName}
            <span className="text-text-muted">#{player.tagLine}</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {player.platformRegion.toUpperCase()} · Seviye {player.summonerLevel}
          </p>

          {player.ranks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {player.ranks.map((rank) => (
                <span
                  key={rank.id}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-secondary"
                >
                  <span className="font-semibold text-text-primary">
                    {rank.tier} {rank.rank}
                  </span>{" "}
                  · {rank.leaguePoints} LP · {rank.wins}W {rank.losses}L
                </span>
              ))}
            </div>
          )}
        </div>

        <RefreshButton puuid={puuid} />
      </div>

      {matches.length > 0 && (
        <AiCoachPanel
          puuid={puuid}
          initialSummary={cachedAiCoach?.summaryText ?? null}
          initialGeneratedAt={cachedAiCoach?.generatedAt.toISOString() ?? null}
        />
      )}

      {matches.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card title="Overview">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-2xl font-bold text-text-primary">{winRate.toFixed(0)}%</p>
                  <p className="text-xs text-text-muted">Win rate ({matches.length} maç)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent">{aggregate.overall.toFixed(0)}</p>
                  <p className="text-xs text-text-muted">Overall score</p>
                </div>
                <div className="col-span-2">
                  <div className="flex gap-1">
                    {recentForm.split("").map((r, i) => (
                      <span
                        key={i}
                        className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                          r === "W" ? "bg-win/15 text-win" : "bg-loss/15 text-loss"
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">Recent form</p>
                </div>
              </div>
              <p className="mt-5 text-sm text-text-secondary">
                En çok oynanan: <span className="font-medium text-text-primary">{mainChampion ?? "-"}</span> (
                {mainRole ?? "-"})
              </p>
            </Card>

            <Card title="Performance">
              <ScoreBar label="Farming" value={aggregate.farming} />
              <ScoreBar label="Combat" value={aggregate.combat} />
              <ScoreBar label="Vision" value={aggregate.vision} />
              <ScoreBar label="Objective" value={aggregate.objective} />
              <ScoreBar label="Consistency" value={consistency} />
              <p className="mt-2 text-xs text-text-muted">Aşağıdaki &quot;Habits&quot; bölümüne bak.</p>
            </Card>
          </div>

          <Card title="Trends (CS/min)">
            <TrendsChart points={trendPoints} />
          </Card>

          <Card title="Champion & Role Analysis">
            <div className="mb-4 flex flex-wrap gap-2">
              {roleWinRates.map((r) => (
                <span
                  key={r.teamPosition}
                  className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary"
                >
                  <span className="font-medium text-text-primary">{r.teamPosition}</span>: {r.winRate.toFixed(0)}% (
                  {r.games})
                </span>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="pb-2 font-medium">Şampiyon</th>
                    <th className="pb-2 font-medium">Rol</th>
                    <th className="pb-2 font-medium">Maç</th>
                    <th className="pb-2 font-medium">Win Rate</th>
                    <th className="pb-2 font-medium">KDA</th>
                    <th className="pb-2 font-medium">CS/min</th>
                    <th className="pb-2 font-medium">Gold/min</th>
                    <th className="pb-2 font-medium">Vision/min</th>
                    <th className="pb-2 font-medium">Dmg/min</th>
                    <th className="pb-2 font-medium">Objective</th>
                  </tr>
                </thead>
                <tbody>
                  {championRoleBreakdown.map((c) => (
                    <tr
                      key={`${c.championName}-${c.teamPosition}`}
                      className="border-b border-border/60 text-text-primary last:border-b-0"
                    >
                      <td className="py-2 font-medium">{c.championName}</td>
                      <td className="py-2 text-text-secondary">{c.teamPosition || "-"}</td>
                      <td className="py-2 text-text-secondary">{c.games}</td>
                      <td className="py-2">
                        {c.winRate.toFixed(0)}%
                        {!c.winRateCohort.insufficientData && c.winRateCohort.cohortWinRate !== null && (
                          <span className="ml-1 text-xs text-text-muted">
                            (benzer: {c.winRateCohort.cohortWinRate.toFixed(0)}%)
                          </span>
                        )}
                      </td>
                      <td className="py-2">{c.avgKda.toFixed(1)}</td>
                      <td className="py-2">
                        {c.avgCsPerMin.toFixed(1)}
                        {!c.csCohort.insufficientData && <DiffBadge diffPercent={c.csCohort.diffPercent} />}
                      </td>
                      <td className="py-2 text-text-secondary">{c.avgGoldPerMin.toFixed(0)}</td>
                      <td className="py-2 text-text-secondary">{c.avgVisionScorePerMin.toFixed(2)}</td>
                      <td className="py-2 text-text-secondary">{c.avgDamagePerMin.toFixed(0)}</td>
                      <td className="py-2 text-text-secondary">{c.avgObjectiveParticipation.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-text-muted">
              &quot;benzer&quot; sütunları, DB&apos;de biriken diğer oyuncuların aynı şampiyon+rol verisine göre
              hesaplanır (rank/region filtresi yok, örneklem yetersizse gösterilmez).
            </p>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Habits">
              {macroHabits.sampleSize < macroHabits.minSampleRequired ? (
                <p className="text-sm text-text-muted">
                  Habit tespiti için en az {macroHabits.minSampleRequired} timeline&apos;lı maç gerekiyor (şu an{" "}
                  {macroHabits.sampleSize}). Daha fazla maç senkronize ettikçe burası dolacak.
                </p>
              ) : macroHabits.habits.length === 0 ? (
                <p className="text-sm text-text-muted">Belirgin bir tekrar eden davranış tespit edilmedi.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {macroHabits.habits.map((h) => (
                    <li key={h.name} className="rounded-md bg-bg p-3">
                      <p className="text-sm font-semibold text-accent">{h.name}</p>
                      <p className="mt-1 text-sm text-text-secondary">{h.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Macro Impact">
              <div className="flex flex-col gap-3">
                {macroHabits.macroImpacts.map((impact) => (
                  <div key={impact.label} className="rounded-md bg-bg p-3">
                    <p className="text-sm font-semibold text-text-primary">{impact.label}</p>
                    <p className="mt-1 text-xs text-text-muted">{impact.definition}</p>
                    {impact.insufficientData ? (
                      <p className="mt-2 text-sm text-text-muted">
                        Her iki grupta da yeterli örneklem yok (zamanında reset: {impact.groupASample}, geç/yok:{" "}
                        {impact.groupBSample}) — güvenilir bir karşılaştırma için daha fazla maç gerekiyor.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-text-secondary">
                        Zamanında reset attığın maçlarda win rate{" "}
                        <span className="font-semibold text-text-primary">{impact.groupAWinRate?.toFixed(0)}%</span>{" "}
                        ({impact.groupASample} maç), geç/hiç reset atmadığın maçlarda{" "}
                        <span className="font-semibold text-text-primary">{impact.groupBWinRate?.toFixed(0)}%</span>{" "}
                        ({impact.groupBSample} maç). Bu bir ilişki gözlemidir, nedensellik iddiası değildir.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      <Card title="Son Maçlar" className="mt-6">
        {matches.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Henüz senkronize edilmiş maç yok. &quot;Refresh matches&quot; ile çekebilirsin.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="pb-2 font-medium">Şampiyon</th>
                    <th className="pb-2 font-medium">Rol</th>
                    <th className="pb-2 font-medium">Sonuç</th>
                    <th className="pb-2 font-medium">KDA</th>
                    <th className="pb-2 font-medium">CS/min</th>
                    <th className="pb-2 font-medium">Gold/min</th>
                    <th className="pb-2 font-medium">Kill Part.</th>
                    <th className="pb-2 font-medium">Vision/min</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map(({ participant: p, metrics, csBenchmark }) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-b-0 hover:bg-surface-hover">
                      <td className="py-2">
                        <Link
                          href={`/player/${puuid}/match/${p.matchId}`}
                          className="font-medium text-text-primary hover:text-accent"
                        >
                          {p.championName}
                        </Link>
                      </td>
                      <td className="py-2 text-text-secondary">{p.teamPosition || "-"}</td>
                      <td className="py-2">
                        <ResultBadge win={p.win} />
                      </td>
                      <td className="py-2 text-text-secondary">
                        {p.kills}/{p.deaths}/{p.assists} ({metrics.kda.toFixed(1)})
                      </td>
                      <td className="py-2 text-text-secondary">
                        {metrics.csPerMin.toFixed(1)}
                        {!csBenchmark.insufficientData && <DiffBadge diffPercent={csBenchmark.diffPercent} />}
                      </td>
                      <td className="py-2 text-text-secondary">{metrics.goldPerMin.toFixed(0)}</td>
                      <td className="py-2 text-text-secondary">{metrics.killParticipationPercent.toFixed(0)}%</td>
                      <td className="py-2 text-text-secondary">{metrics.visionScorePerMin.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-text-muted">
              &quot;vs benzer&quot; karşılaştırması, senkronize edilmiş maçlardaki aynı şampiyon+rolü oynayan diğer
              oyunculara göre hesaplanır (rank/region filtresi yok). Yeterli örneklem yoksa gösterilmez.
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
