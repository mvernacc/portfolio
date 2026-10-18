import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pcg32 } from '../src/random.ts';
import { CONTROLS, DEFAULT_SELECTION, axisValues } from '../src/config.ts';
import { buildUncertainty, sampleValue, referenceAt } from '../src/uncertainty.ts';

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
test('reference is flat for financing axes and respects non-financing x', () => {
  for (const key of ['debtInterestRate', 'debtFraction', 'equityHurdle']) assert.equal(referenceAt(key,0),referenceAt(key,.9));
  assert.ok(Math.abs(referenceAt('throughput',1e5)/referenceAt('throughput',2e5)-2)<1e-12);
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
      assert.equal(axis.reference[i],referenceAt(c.key,x*(c.scale??1)));
    });
  }
});
test('committed precomputation matches current configuration fingerprint', () => {
  const data=JSON.parse(readFileSync(new URL('../src/uncertainty.generated.json',import.meta.url)));
  assert.equal(data.metadata.configuration, JSON.stringify(CONTROLS));
});
