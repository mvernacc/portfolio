import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRESETS } from '../src/presets.ts';
import { sensitivityAxis } from '../src/presentation.ts';
import { marketComparison } from '../src/market.ts';

test('every throughput preset has a wide linear viewport containing plausible and selected values', () => {
  for (const preset of PRESETS) {
    const c = preset.controls.find(c => c.key === 'throughput');
    for (const selected of [c.min, c.plausible[1], c.max]) {
      const axis = sensitivityAxis(c, selected);
      assert.equal(axis.type, 'linear');
      assert.ok(axis.bounds[0] <= Math.min(selected, c.plausible[0]));
      assert.ok(axis.bounds[1] >= Math.max(selected, c.plausible[1]));
      assert.ok(axis.bounds[0] >= c.min && axis.bounds[1] <= c.max);
      assert.ok(axis.bounds[1] / axis.bounds[0] >= 8);
    }
  }
});

test('market tariffs include associated uncached input revenue and match nominal benchmark mix', () => {
  const gpt = marketComparison('gpt-oss');
  const qwen = marketComparison('qwen35');
  assert.ok(Math.abs(gpt.providers[0].workloadRevenue - .39) < 1e-12);
  assert.ok(Math.abs(qwen.providers[0].workloadRevenue - 5.46) < 1e-12);
  for (const preset of PRESETS) {
    const market = marketComparison(preset.model.id);
    assert.equal(market.providers.length, 3);
    assert.ok(market.providers.every(p => p.workloadRevenue > p.outputPerMillion));
  }
  assert.throws(() => marketComparison('missing'));
});
