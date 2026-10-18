import { writeFileSync } from 'node:fs';
import { buildUncertainty, rescaleThroughputBands } from '../src/uncertainty.ts';
import { PRESETS, BENCHMARK_POLICY } from '../src/presets.ts';
const bases = new Map();
const presets = {};
for (const p of PRESETS) {
  if (!bases.has(p.trajectory.id)) {
    console.log(`Computing ${p.trajectory.label}`);
    bases.set(p.trajectory.id, buildUncertainty(undefined, p.controls, p.trajectory));
  }
  presets[p.id] = rescaleThroughputBands(bases.get(p.trajectory.id), p.controls);
}
writeFileSync(new URL('../src/uncertainty.generated.json', import.meta.url), JSON.stringify({ policy: BENCHMARK_POLICY, presets }) + '\n');
