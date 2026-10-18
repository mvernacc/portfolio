import { writeFileSync } from 'node:fs';
import { buildUncertainty } from '../src/uncertainty.ts';
import { PRESETS, BENCHMARK_POLICY } from '../src/presets.ts';
const data = { policy: BENCHMARK_POLICY, presets: Object.fromEntries(PRESETS.map(p => [p.id, buildUncertainty(undefined, p.controls)])) };
writeFileSync(new URL('../src/uncertainty.generated.json', import.meta.url), JSON.stringify(data) + '\n');
