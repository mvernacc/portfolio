import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ASSUMPTIONS } from '../src/model.ts';
import { evaluateProject, sweepPrices } from '../src/scenario.ts';

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
