/** Owns benchmark selection and deployment-transfer assumptions. Neither the UI
 * nor Monte Carlo needs to know how replica counts or latency metrics are stored.
 */
import gpt from '../../../docs/blog/ai_datacenter_project_finance/work_in_progress/data/gpt_oss_120b_b200_benchmarks.json' with { type: 'json' };
import qwen from '../../../docs/blog/ai_datacenter_project_finance/work_in_progress/data/qwen35_b200_benchmarks.json' with { type: 'json' };
import { CONTROLS, DEFAULT_SELECTION, type Control } from './config.ts';

export const STREAMING_TARGETS = [25, 50, 100] as const;
export const BENCHMARK_POLICY = { maxP99FirstResponseSeconds: 10, installedMWPerServer: .015015, gpusPerServer: 8, deploymentFraction: [.75, 1] as const };
export const MODELS = [
  { id: 'gpt-oss', label: 'GPT-OSS-120B · B200 / FP4', rows: gpt.rows, source: gpt.source, description: 'vLLM, TP1; eight independent replicas per server. May 31, 2026 benchmark.' },
  { id: 'qwen35', label: 'Qwen3.5-397B-A17B · B200 / FP8', rows: qwen.rows, source: qwen.source, description: 'SGLang, TP4; two independent replicas per server. July 5, 2026 benchmark. Responses were chunked (stream interval 50): first response means first chunk, and streaming speed is an interval average, not smooth token delivery.' },
];

/** Highest aggregate measured throughput meeting both latency criteria. Speed
 * is inverse mean TPOT, not a per-request guarantee or inverse chunk interval.
 */
export function benchmarkFor(modelId: string, target: number) {
  const model = MODELS.find(m => m.id === modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  const eligible = model.rows.filter(r => 1 / r.metrics.mean_tpot >= target && r.metrics.p99_ttft <= BENCHMARK_POLICY.maxP99FirstResponseSeconds);
  const row = eligible.sort((a, b) => b.metrics.output_tput_per_gpu - a.metrics.output_tput_per_gpu)[0];
  if (!row) throw new Error(`No saved benchmark meets ${target} tokens/s`);
  const throughput = row.metrics.output_tput_per_gpu * BENCHMARK_POLICY.gpusPerServer / BENCHMARK_POLICY.installedMWPerServer;
  return { model, row, throughput };
}

export function scenarioPreset(modelId: string, target: number) {
  const { model, row, throughput } = benchmarkFor(modelId, target);
  const controls: Control[] = CONTROLS.map(c => c.key === 'throughput'
    ? { ...c, plausible: BENCHMARK_POLICY.deploymentFraction.map(f => f * throughput / 1e6) as [number, number] }
    : c.key === 'capex' ? { ...c, plausible: [38.70, 50.51] } : { ...c });
  return { id: `${modelId}-${target}`, model, row, controls,
    defaults: { ...DEFAULT_SELECTION, throughput, capex: 40.83e6, facilityCapexFraction: 12 / 40.83 } };
}
export const PRESETS = MODELS.flatMap(m => STREAMING_TARGETS.map(target => scenarioPreset(m.id, target)));
