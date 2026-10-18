import snapshots from './market-prices.json' with { type: 'json' };

/** Normalize uncached text tariffs to the benchmark's nominal 8192:1024
 * workload. Provider prices are references, not inferred production costs.
 */
export const INPUT_TOKENS_PER_OUTPUT = 8;
export function marketComparison(modelId: string) {
  const snapshot = snapshots[modelId as keyof typeof snapshots];
  if (!snapshot) throw new Error(`No market snapshot for ${modelId}`);
  return { ...snapshot, providers: snapshot.providers.map(provider => ({
    ...provider,
    workloadRevenue: provider.outputPerMillion + INPUT_TOKENS_PER_OUTPUT * provider.inputPerMillion,
  })) };
}
