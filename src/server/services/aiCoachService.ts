import { prisma } from "@/lib/db";
import type { PlayerDashboard } from "./playerService";

const MODEL_ID = "google.gemma-3-27b-it";

const SYSTEM_PROMPT = `Sen "AI League Coach" adlı bir League of Legends performans koçusun. Sana oyuncunun hesaplanmış istatistikleri, benzer oyunculara göre kıyaslaması, tespit edilen davranış alışkanlıkları ve macro-impact korelasyonları veriliyor.

Kurallar:
1. Yalnızca sana verilen verilere dayan, uydurma istatistik üretme.
2. Nedensellik iddia etme ("bu davranış maçı kazandırdı" deme) — yalnızca gözlemlenen ilişkilerden bahset ("... ile ilişkili görünüyor" gibi).
3. Çıktını iki bölüm halinde ver: kısa bir "AI Coach Summary" paragrafı, ardından "Recommended Focus" başlığı altında en fazla 3 maddelik numaralı bir liste.
4. Türkçe, kısa, doğal ve uygulanabilir öneriler ver. Jargon kullanma, oyuncunun anlayacağı şekilde yaz.
5. Veride yeterli örneklem yoksa bunu belirt, abartılı kesinlik iddia etme.`;

function buildUserPrompt(dashboard: PlayerDashboard): string {
  const { player, matches, aggregate, consistency, winRate, recentForm, mainChampion, mainRole, macroHabits } =
    dashboard;

  const lines: string[] = [];
  lines.push(`Oyuncu: ${player.gameName}#${player.tagLine} (${player.platformRegion.toUpperCase()})`);
  lines.push(`Son ${matches.length} maç — Win rate: %${winRate.toFixed(0)}, Recent form: ${recentForm}`);
  lines.push(`En çok oynanan: ${mainChampion ?? "-"} (${mainRole ?? "-"})`);
  lines.push("");
  lines.push("Performance Score (0-100):");
  lines.push(`- Farming: ${aggregate.farming.toFixed(0)}`);
  lines.push(`- Combat: ${aggregate.combat.toFixed(0)}`);
  lines.push(`- Vision: ${aggregate.vision.toFixed(0)}`);
  lines.push(`- Objective: ${aggregate.objective.toFixed(0)}`);
  lines.push(`- Consistency: ${consistency.toFixed(0)}`);
  lines.push(`- Overall: ${aggregate.overall.toFixed(0)}`);
  lines.push("");

  const benchmarked = matches.filter((m) => !m.csBenchmark.insufficientData && m.csBenchmark.diffPercent !== null);
  if (benchmarked.length > 0) {
    const avgDiff = benchmarked.reduce((sum, m) => sum + (m.csBenchmark.diffPercent ?? 0), 0) / benchmarked.length;
    lines.push(
      `CS/min, senkronize edilmiş maçlardaki benzer oyunculara göre ortalama %${avgDiff.toFixed(0)} fark gösteriyor (rank/region filtresiz cohort, örneklem küçük olabilir).`
    );
    lines.push("");
  }

  if (macroHabits.habits.length > 0) {
    lines.push("Tespit edilen alışkanlıklar:");
    for (const h of macroHabits.habits) lines.push(`- ${h.name}: ${h.description}`);
    lines.push("");
  }

  for (const impact of macroHabits.macroImpacts) {
    if (!impact.insufficientData) {
      lines.push(
        `${impact.label}: zamanında yapılan maçlarda win rate %${impact.groupAWinRate?.toFixed(0)} (${impact.groupASample} maç), geç/yok olan maçlarda %${impact.groupBWinRate?.toFixed(0)} (${impact.groupBSample} maç).`
      );
    }
  }

  lines.push("");
  lines.push(
    "Bu verilere dayanarak kısa bir 'AI Coach Summary' paragrafı ve altında numaralı 'Recommended Focus' (en fazla 3 madde) listesi üret."
  );

  return lines.join("\n");
}

interface BedrockConverseResponse {
  output?: { message?: { content?: { text?: string }[] } };
}

async function callBedrock(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.BEDROCK_API_KEY;
  const apiUrl = process.env.BEDROCK_API_URL;
  if (!apiKey || !apiUrl) {
    throw new Error("BEDROCK_API_KEY / BEDROCK_API_URL is not set. Add them to your .env file.");
  }

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/model/${MODEL_ID}/converse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      messages: [{ role: "user", content: [{ text: userPrompt }] }],
      system: [{ text: systemPrompt }],
      inferenceConfig: { maxTokens: 600, temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Bedrock isteği başarısız: ${res.status} ${detail}`);
  }

  const data = (await res.json()) as BedrockConverseResponse;
  const parts = data.output?.message?.content ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Bedrock boş yanıt döndü.");
  return text;
}

export async function generateAiCoachSummary(puuid: string, dashboard: PlayerDashboard): Promise<string> {
  const userPrompt = buildUserPrompt(dashboard);
  const summaryText = await callBedrock(SYSTEM_PROMPT, userPrompt);

  await prisma.aiCoachSummary.upsert({
    where: { puuid },
    create: { puuid, summaryText, basedOnMatchCount: dashboard.matches.length },
    update: { summaryText, basedOnMatchCount: dashboard.matches.length, generatedAt: new Date() },
  });

  return summaryText;
}

export async function getCachedAiCoachSummary(puuid: string) {
  return prisma.aiCoachSummary.findUnique({ where: { puuid } });
}
