/**
 * Cost accounting for eval runs. Anthropic rates are per million tokens, taken
 * from the published pricing table (checked 20 Aug 2026). Sonnet 5 is inside
 * its introductory period until 2026-08-31 — `sonnetIntro: false` prices a run
 * at the standard rate instead.
 */

export type Rate = { input: number; output: number };

export const ANTHROPIC_RATES: Record<string, Rate> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 }, // intro pricing through 2026-08-31; standard is 3 / 15
  "claude-sonnet-5-standard": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/**
 * Voyage is billed per million tokens too, but the rate is not bundled here —
 * set VOYAGE_RATE_PER_MTOK from the current voyageai.com/pricing figure to
 * include embedding spend in the totals. Unset, embedding tokens are reported
 * but priced at zero and flagged in the report.
 */
export function voyageRate(): number | null {
  const raw = process.env.VOYAGE_RATE_PER_MTOK;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export type UsageRow = {
  provider: "anthropic" | "voyage";
  operation: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type CostBreakdown = {
  anthropicInputTokens: number;
  anthropicOutputTokens: number;
  voyageTokens: number;
  anthropicUsd: number;
  voyageUsd: number | null;
  totalUsd: number;
  /** True when embedding spend is missing from totalUsd. */
  voyageUnpriced: boolean;
};

export function costOf(rows: UsageRow[], model: string): CostBreakdown {
  const rate = ANTHROPIC_RATES[model] ?? ANTHROPIC_RATES["claude-sonnet-5"];
  const vRate = voyageRate();

  let anthropicInputTokens = 0;
  let anthropicOutputTokens = 0;
  let voyageTokens = 0;

  for (const row of rows) {
    if (row.provider === "anthropic") {
      anthropicInputTokens += row.inputTokens ?? 0;
      anthropicOutputTokens += row.outputTokens ?? 0;
    } else {
      voyageTokens += row.totalTokens ?? 0;
    }
  }

  const anthropicUsd =
    (anthropicInputTokens / 1_000_000) * rate.input + (anthropicOutputTokens / 1_000_000) * rate.output;
  const voyageUsd = vRate === null ? null : (voyageTokens / 1_000_000) * vRate;

  return {
    anthropicInputTokens,
    anthropicOutputTokens,
    voyageTokens,
    anthropicUsd,
    voyageUsd,
    totalUsd: anthropicUsd + (voyageUsd ?? 0),
    voyageUnpriced: voyageUsd === null && voyageTokens > 0,
  };
}
