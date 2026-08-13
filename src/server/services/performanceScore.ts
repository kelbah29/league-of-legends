import type { MatchMetrics } from "./statsService";

export interface CategoryScores {
  farming: number;
  combat: number;
  vision: number;
  objective: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 0-100 indicators derived from Faz 2 metrics — NOT a claim of true skill
 * level, just a normalized view of the raw numbers. Farming prefers the
 * cohort-relative diff (centered at 50 = cohort average) when available,
 * falling back to an absolute CS/min scale otherwise.
 */
export function computeMatchCategoryScores(metrics: MatchMetrics, csDiffPercent: number | null): CategoryScores {
  const farming =
    csDiffPercent !== null ? clamp(50 + csDiffPercent / 2) : clamp((metrics.csPerMin / 8) * 100);

  const kdaComponent = clamp((metrics.kda / 5) * 100);
  const killParticipationComponent = clamp(metrics.killParticipationPercent);
  const damageShareComponent = clamp((metrics.damageShare / 0.4) * 100);
  const combat = (kdaComponent + killParticipationComponent + damageShareComponent) / 3;

  const vision = clamp((metrics.visionScorePerMin / 1.5) * 100);

  const objective = clamp((metrics.objectiveParticipation / 4) * 100);

  return { farming, combat, vision, objective };
}

export function averageCategoryScores(scores: CategoryScores[]): CategoryScores & { overall: number } {
  if (scores.length === 0) {
    return { farming: 0, combat: 0, vision: 0, objective: 0, overall: 0 };
  }
  const sum = scores.reduce(
    (acc, s) => ({
      farming: acc.farming + s.farming,
      combat: acc.combat + s.combat,
      vision: acc.vision + s.vision,
      objective: acc.objective + s.objective,
    }),
    { farming: 0, combat: 0, vision: 0, objective: 0 }
  );
  const n = scores.length;
  const avg = { farming: sum.farming / n, combat: sum.combat / n, vision: sum.vision / n, objective: sum.objective / n };
  const overall = (avg.farming + avg.combat + avg.vision + avg.objective) / 4;
  return { ...avg, overall };
}

/** Coefficient-of-variation based: tighter spread across matches = higher score. */
export function computeConsistencyScore(values: number[]): number {
  if (values.length < 2) return 100;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 100;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  return clamp(100 - coefficientOfVariation * 100);
}
