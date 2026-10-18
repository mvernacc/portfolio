import { writeFileSync } from 'node:fs';
import { buildUncertainty } from '../src/uncertainty.ts';
writeFileSync(new URL('../src/uncertainty.generated.json', import.meta.url), JSON.stringify(buildUncertainty()) + '\n');
