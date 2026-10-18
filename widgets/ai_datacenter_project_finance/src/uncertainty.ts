import { DEFAULT_TRAJECTORY, trajectoryRates, type Trajectory } from './trajectories.ts';
/** Deterministic conditional scenario analysis; no browser or chart dependencies. */
import { CONTROLS, DEFAULT_SELECTION, MONTE_CARLO, axisValues, validateConfiguration, type Control } from './config.ts';
import { retirementPrice, RETIREMENT_POLICY } from './retirement.ts';
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

/** Common random scenarios across x reduce simulation noise between adjacent points.
 * Every sample must yield a finite price: generation fails instead of silently
 * conditioning the reported percentiles on successful scenarios.
 */
export function buildUncertainty(samples = MONTE_CARLO.samples, controls: readonly Control[] = CONTROLS, trajectory: Trajectory = DEFAULT_TRAJECTORY) {
  validateConfiguration(controls);
  if (!Number.isInteger(samples) || samples < 2) throw new Error("At least two samples required");
  const rng = new Pcg32(BigInt(MONTE_CARLO.seed), BigInt(MONTE_CARLO.sequence));
  const scenarios = Array.from({ length: samples }, () => {
    const scenario = { ...DEFAULT_SELECTION, ...trajectoryRates(trajectory) };
    for (const c of controls) scenario[c.key] = sampleValue(c, rng);
    return scenario;
  });
  const axes = {} as Record<Control['key'], { x: number[]; p05: number[]; p95: number[] }>;
  for (const c of controls) {
    const x = axisValues(c), p05: number[] = [], p95: number[] = [];
    for (const displayValue of x) {
      const value = displayValue * (c.scale ?? 1);
      const prices = scenarios.map(s => {
        const conditional = { ...s, [c.key]: value };
        const price = retirementPrice(conditional, conditional.equityHurdle);
        if (!Number.isFinite(price)) throw new Error(`Nonfinite scenario for ${c.key}=${value}`);
        return price;
      }).sort((a, b) => a - b);
      p05.push(quantile(prices, .05)); p95.push(quantile(prices, .95));
    }
    axes[c.key] = { x, p05, p95 };
  }
  return { metadata: { ...MONTE_CARLO, retirementPolicy: RETIREMENT_POLICY, trajectory, configuration: JSON.stringify(controls), samples, distribution: 'independent uniform; discrete-uniform months' }, axes };
}

/** With all costs independent of initial throughput, required initial price is
 * exactly K / throughput. Presets differ only in their throughput range. Reuse
 * the same draws and transform quantiles, without re-running identical finance.
 * Fail if another preset assumption changes; regression tests compare full runs.
 */
export function rescaleThroughputBands(base: ReturnType<typeof buildUncertainty>, controls: readonly Control[]) {
  const previous: Control[] = JSON.parse(base.metadata.configuration);
  const reference = previous.find(c => c.key === 'throughput')!;
  const target = controls.find(c => c.key === 'throughput')!;
  const rest = (items: readonly Control[]) => items.filter(c => c.key !== 'throughput');
  const ratio = reference.plausible[1] / target.plausible[1];
  if (JSON.stringify(rest(previous)) !== JSON.stringify(rest(controls)) ||
      Math.abs(reference.plausible[0] / target.plausible[0] / ratio - 1) > 1e-12 ||
      reference.sampling !== target.sampling || reference.scale !== target.scale) {
    throw new Error('Only proportionally scaled throughput ranges can reuse bands');
  }
  const axes = {} as typeof base.axes;
  for (const c of controls) {
    const original = base.axes[c.key];
    const x = axisValues(c);
    axes[c.key] = c.key === 'throughput'
      ? { x, p05: x.map(v => original.p05[0] * original.x[0] / v), p95: x.map(v => original.p95[0] * original.x[0] / v) }
      : { x, p05: original.p05.map(v => v * ratio), p95: original.p95.map(v => v * ratio) };
  }
  return { metadata: { ...base.metadata, configuration: JSON.stringify(controls) }, axes };
}
