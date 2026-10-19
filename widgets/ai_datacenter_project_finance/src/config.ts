import { DEFAULT_TRAJECTORY, trajectoryRates } from './trajectories.ts';
import { DEFAULT_ASSUMPTIONS } from './model.ts';
import type { SweepKey } from './scenario.ts';

/** Display-unit limits and provisional scenario ranges; not empirically calibrated. */
// One definition owns labels, units, valid ranges, and display-to-model conversion.
// Log sliders use exponent positions; numeric fields always show physical units.
export interface Control {
  key: Exclude<SweepKey, 'priceAnnualErosion' | 'throughputAnnualChange'>; label: string; unit: string; min: number; max: number;
  plausible: readonly [number, number]; sampling?: "log" | "months";
  step: number; scale?: number; log?: boolean; advanced?: boolean; help?: string;
}
export const CONTROLS: Control[] = [
  { key: 'throughput', plausible: [.03, 1],   label: 'Output throughput', unit: 'MTok/s/MW IT', min: .01, max: 10, step: .01, scale: 1e6, log: true, help: 'Aggregate output across requests, including prefill and decode resources, for a fixed workload.' },
  { key: 'capex', plausible: [28.7, 34.5],  label: 'IT equipment cost', unit: 'million USD/MW IT', min: 10, max: 100, step: 1, scale: 1e6 },
  { key: 'utilization', advanced: true, plausible: [50, 95],  label: 'Utilization', unit: '%', min: 10, max: 100, step: 1, scale: .01 },
  { key: 'energyCostPerMWh', plausible: [40, 150],  label: 'Electricity price', unit: 'USD/MWh', min: 0, max: 300, step: 1 },
  { key: 'coloRentPerKWMonth', plausible: [175, 300], label: 'Colocation rent', unit: 'USD/kW IT/month', min: 0, max: 600, step: 5, help: 'Reserved IT capacity, independent of utilization. Electricity is separate. Lease may end at retirement without penalty.' },
  { key: 'nonEnergyAnnualOpex', advanced: true, plausible: [.5, 2],  label: 'Other annual operating cost', unit: 'million USD/MW IT/year', min: 0, max: 5, step: .1, scale: 1e6 },
  { key: 'commissioningYears', advanced: true, plausible: [1, 6], sampling: 'months',  label: 'Commissioning delay', unit: 'months', min: 1, max: 12, step: 1, scale: 1 / 12 },
  { key: 'operatingYears', plausible: [36, 84], sampling: 'months',  label: 'Maximum operating life', unit: 'months', min: 12, max: 120, step: 1, scale: 1 / 12, help: 'Retirement is chosen within this limit. Loan payments amortize over the full maximum life.' },
  { key: 'debtFraction', advanced: true, plausible: [40, 80],  label: 'Debt share of capital', unit: '%', min: 0, max: 95, step: 1, scale: .01 },
  { key: 'debtInterestRate', advanced: true, plausible: [5, 12],  label: 'Annual debt interest', unit: '% nominal, monthly compounding', min: 0, max: 20, step: .5, scale: .01 },
  { key: 'equityHurdle', advanced: true, plausible: [10, 25],  label: 'Equity return hurdle', unit: '% effective annual, pre-tax', min: 0, max: 30, step: .5, scale: .01 },
  { key: 'pue', plausible: [1.1, 1.4],  label: 'Power usage effectiveness', unit: 'facility / IT power', help: 'Multiplies consumed IT electricity, including idle power; never multiplies rent.', min: 1, max: 2, step: .05, advanced: true },
  { key: 'idlePowerFraction', plausible: [10, 40],  label: 'Idle IT power', unit: '% of installed IT capacity', min: 0, max: 100, step: 1, scale: .01, advanced: true },
  { key: 'revenueFraction', plausible: [100, 100],  label: 'Billable share of active capacity', unit: '%', min: 10, max: 100, step: 1, scale: .01, advanced: true },
];

export const DEFAULT_HURDLE = .15;
export const DEFAULT_SELECTION = { ...DEFAULT_ASSUMPTIONS, ...trajectoryRates(DEFAULT_TRAJECTORY), equityHurdle: DEFAULT_HURDLE };
export const MONTE_CARLO = { samples: 2048, seed: '42', sequence: '54', points: 61 };

export function axisValues(c: Control): number[] {
  return [...new Set([...c.plausible, ...Array.from({ length: MONTE_CARLO.points }, (_, i) => {
    const t = i / (MONTE_CARLO.points - 1);
    const value = c.log ? c.min * (c.max / c.min) ** t : c.min + (c.max - c.min) * t;
    return c.sampling === 'months' ? Math.round(value) : value;
  })])].sort((a, b) => a - b);
}

/** Reject malformed ranges before generating or presenting statistical results. */
export function validateConfiguration(controls: readonly Control[] = CONTROLS): void {
  const keys = new Set<string>();
  for (const c of controls) {
    const [low, high] = c.plausible;
    const selected = DEFAULT_SELECTION[c.key] / (c.scale ?? 1);
    if (keys.has(c.key) || ![c.min, c.max, low, high, selected].every(Number.isFinite)
      || !(c.min <= low && low <= high && high <= c.max && c.min < c.max)
      || selected < c.min || selected > c.max || !(c.step > 0) || !((c.scale ?? 1) > 0)
      || ((c.log || c.sampling === 'log') && c.min <= 0)
      || (c.sampling === 'months' && ![c.min, c.max, low, high].every(Number.isInteger))) {
      throw new Error(`Invalid parameter configuration: ${c.key}`);
    }
    keys.add(c.key);
  }
  if (keys.size + 2 !== Object.keys(DEFAULT_SELECTION).length) throw new Error('Missing parameter configuration');
}

/** Wider linear throughput plot reveals the inverse relationship; slider stays log. */
export const THROUGHPUT_VIEW = { lowerBenchmarkFraction: .25, upperBenchmarkFraction: 2 };
