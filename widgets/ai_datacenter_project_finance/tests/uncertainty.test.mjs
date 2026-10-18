import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PRESETS, BENCHMARK_POLICY, benchmarkFor, scenarioPreset } from '../src/presets.ts';
import { Pcg32 } from '../src/random.ts';
import { CONTROLS, DEFAULT_SELECTION, axisValues } from '../src/config.ts';
import { buildUncertainty, sampleValue } from '../src/uncertainty.ts';

test('PCG32 matches official seed42 sequence54 reference vector', () => {
  const rng = new Pcg32(42n, 54n);
  assert.deepEqual(Array.from({length: 6}, () => rng.nextUint32().toString(16)), ['a15c02b7','7b47f409','ba1d3330','83d2f293','bfa4784b','cbed606e']);
});
test('configured ranges contain defaults and samples; durations stay whole months', () => {
  const rng = new Pcg32(42n, 54n);
  for (const c of CONTROLS) {
    const scale = c.scale ?? 1;
    assert.ok(c.min <= c.plausible[0] && c.plausible[0] <= c.plausible[1] && c.plausible[1] <= c.max);
    assert.ok(DEFAULT_SELECTION[c.key] / scale >= c.min && DEFAULT_SELECTION[c.key] / scale <= c.max);
    for (let i=0; i<100; i++) {
      const value = sampleValue(c, rng) / scale;
      assert.ok(value >= c.plausible[0] - 1e-9 && value <= c.plausible[1] + 1e-9);
      if(c.sampling === 'months') assert.ok(Math.abs(value-Math.round(value)) < 1e-9);
      if(c.key === 'revenueFraction') assert.equal(value,100);
    }
  }
});
test('conditional sampling is deterministic, finite, ordered, and independent of selected state', () => {
  const a = buildUncertainty(8), b = buildUncertainty(8);
  assert.deepEqual(a,b);
  for (const c of CONTROLS) {
    const axis = a.axes[c.key];
    assert.deepEqual(axis.x,axisValues(c));
    if (c.key === 'throughput') {
      for(let i=1; i<axis.x.length; i++) {
        assert.ok(Math.abs(axis.p05[i]*axis.x[i] / (axis.p05[0]*axis.x[0])-1)<1e-12);
        assert.ok(Math.abs(axis.p95[i]*axis.x[i] / (axis.p95[0]*axis.x[0])-1)<1e-12);
      }
    }
    axis.x.forEach((x,i) => {
      assert.ok(Number.isFinite(axis.p05[i]) && axis.p05[i] <= axis.p95[i]);
    });
  }
});
test('committed precomputation matches current configuration fingerprint', () => {
  const data=JSON.parse(readFileSync(new URL('../src/uncertainty.generated.json',import.meta.url)));
  assert.deepEqual(data.policy, BENCHMARK_POLICY);
  for (const p of PRESETS) {
    assert.equal(data.presets[p.id].metadata.configuration, JSON.stringify(p.controls));
    for (const c of p.controls) assert.deepEqual(data.presets[p.id].axes[c.key].x, axisValues(c));
  }
});

test('benchmark selection chooses the fastest eligible saved configuration, including tied Qwen targets', () => {
  for (const [model, target, concurrency] of [['gpt-oss',25,128],['gpt-oss',50,64],['gpt-oss',100,32],['qwen35',25,32],['qwen35',50,32],['qwen35',100,8]]) {
    const {row, throughput} = benchmarkFor(model,target);
    assert.equal(row.conc,concurrency);
    assert.ok(1/row.metrics.mean_tpot >= target);
    assert.ok(row.metrics.p99_ttft <= 10);
    assert.equal(throughput,row.metrics.output_tput_per_gpu*8/.015015);
  }
  assert.throws(() => benchmarkFor('gpt-oss', 10000), /No saved benchmark/);
});
test('preset ranges follow the selected benchmark, with independent uniform deployment allowance', () => {
  for (const p of PRESETS) {
    const c = p.controls.find(c=>c.key==='throughput');
    assert.equal(c.sampling,undefined);
    assert.equal(c.plausible[0],p.defaults.throughput*.75/1e6);
    assert.equal(c.plausible[1],p.defaults.throughput/1e6);
  }
  const low=buildUncertainty(8,scenarioPreset('qwen35',100).controls);
  const high=buildUncertainty(8,scenarioPreset('gpt-oss',100).controls);
  assert.ok(low.axes.capex.p05[10] > high.axes.capex.p05[10]);
});
