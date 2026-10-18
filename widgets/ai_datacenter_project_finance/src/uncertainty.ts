/** Deterministic conditional scenario analysis; no browser or chart dependencies. */
import { CONTROLS, DEFAULT_SELECTION, MONTE_CARLO, axisValues, validateConfiguration, type Control } from './config.ts';
import { calcPricePerMTokForTargetIrr } from './model.ts';
import { favorableReferencePrice, type SweepKey } from './scenario.ts';
import { Pcg32 } from './random.ts';

export function sampleValue(control: Control, rng: Pcg32): number {
  const [low, high] = control.plausible;
  if (low === high) return low * (control.scale ?? 1);
  const value = control.sampling === 'months' ? low + rng.integer(high - low + 1)
    : control.sampling === 'log' ? low * (high / low) ** rng.uniform()
    : low + (high - low) * rng.uniform();
  return value * (control.scale ?? 1);
}

/** Linear interpolation between ordered observations (R/NumPy type 7). */
export function quantile(sorted: number[], probability: number): number {
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index), weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[Math.ceil(index)] * weight;
}

export function referenceAt(key: SweepKey, value: number): number {
  const favorable = { ...DEFAULT_SELECTION };
  for (const c of CONTROLS) favorable[c.key] = c.plausible[c.favorable === 'min' ? 0 : 1] * (c.scale ?? 1);
  favorable[key] = value;
  return favorableReferencePrice(favorable);
}

/** Common random scenarios across x reduce simulation noise between adjacent points.
 * Every sample must yield a finite price: generation fails instead of silently
 * conditioning the reported percentiles on successful scenarios.
 */
export function buildUncertainty(samples = MONTE_CARLO.samples) {
  validateConfiguration();
  if (!Number.isInteger(samples) || samples < 2) throw new Error("At least two samples required");
  const rng = new Pcg32(BigInt(MONTE_CARLO.seed), BigInt(MONTE_CARLO.sequence));
  const scenarios = Array.from({ length: samples }, () => {
    const scenario = { ...DEFAULT_SELECTION };
    for (const c of CONTROLS) scenario[c.key] = sampleValue(c, rng);
    return scenario;
  });
  const axes = {} as Record<SweepKey, { x: number[]; p05: number[]; p95: number[]; reference: number[] }>;
  for (const c of CONTROLS) {
    const x = axisValues(c), p05: number[] = [], p95: number[] = [], reference: number[] = [];
    for (const displayValue of x) {
      const value = displayValue * (c.scale ?? 1);
      const prices = scenarios.map(s => {
        const conditional = { ...s, [c.key]: value };
        const price = calcPricePerMTokForTargetIrr(conditional, conditional.equityHurdle);
        if (!Number.isFinite(price)) throw new Error(`Nonfinite scenario for ${c.key}=${value}`);
        return price;
      }).sort((a, b) => a - b);
      p05.push(quantile(prices, .05)); p95.push(quantile(prices, .95));
      reference.push(referenceAt(c.key, value));
    }
    axes[c.key] = { x, p05, p95, reference };
  }
  return { metadata: { ...MONTE_CARLO, configuration: JSON.stringify(CONTROLS), samples, distribution: 'independent uniform; log-uniform throughput; discrete-uniform months' }, axes };
}
