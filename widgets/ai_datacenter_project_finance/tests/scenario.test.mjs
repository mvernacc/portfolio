import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ASSUMPTIONS, SECONDS_PER_YEAR, HOURS_PER_YEAR } from '../src/model.ts';
import { evaluateProject, sweepPrices, favorableReferencePrice } from '../src/scenario.ts';

test('finance summary closes NPV and doubling throughput halves required revenue', () => {
  const a = evaluateProject(DEFAULT_ASSUMPTIONS, .15);
  assert.ok(Math.abs(a.npv) < 1e-6);
  const b = evaluateProject({ ...DEFAULT_ASSUMPTIONS, throughput: DEFAULT_ASSUMPTIONS.throughput * 2 }, .15);
  assert.ok(Math.abs(a.price / b.price - 2) < 1e-12);
});
test('sweep preserves assumptions and marks infeasible results as gaps', () => {
  const before = { ...DEFAULT_ASSUMPTIONS };
  const points = sweepPrices(DEFAULT_ASSUMPTIONS, .15, 'throughput', [0, 1e5]);
  assert.equal(points[0].selected, null);
  assert.ok(points[1].selected > 0);
  assert.deepEqual(DEFAULT_ASSUMPTIONS, before);
});
test('zero-return reference recovers all investment plus operation net of resale', () => {
  const a = { ...DEFAULT_ASSUMPTIONS, capacityChargePerKWMonth: 12 };
  const energy = (a.utilization + (1-a.utilization)*a.idlePowerFraction) * a.pue * a.energyCostPerMWh * HOURS_PER_YEAR;
  const costs = a.capex * (1-a.facilityCapexFraction*a.facilityResidualFraction) + a.operatingYears * (a.nonEnergyAnnualOpex + energy + 12000*a.pue*a.capacityChargePerKWMonth);
  const revenue = a.operatingYears * a.utilization * a.revenueFraction * a.throughput * SECONDS_PER_YEAR / 1e6;
  assert.ok(Math.abs(favorableReferencePrice(a) - costs/revenue) < 1e-12);
  assert.equal(favorableReferencePrice(a), favorableReferencePrice({...a, debtFraction: .95, debtInterestRate: .2}));
});
