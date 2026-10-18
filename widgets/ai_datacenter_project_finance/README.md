# Inference project finance widget

A native `<ai-dc-project-finance-widget>` element. The blog loads its entry module;
Plotly loads only when an element is connected. Shadow-root styles keep the
embed self-contained. Built assets in `docs/javascripts/ai_datacenter_project_finance_widget`
are committed because site deployment does not run npm.

From the repository root (Node 24 or later):

```sh
npm --prefix widgets/ai_datacenter_project_finance ci
npm --prefix widgets/ai_datacenter_project_finance test
npm --prefix widgets/ai_datacenter_project_finance run build
uv run zensical serve
```

Use `npm --prefix widgets/ai_datacenter_project_finance run dev` for standalone development.
The build precomputes conditional Monte Carlo bands and can take several minutes.

## Design

The UI has shared controls and Cost sensitivity / Cashflows tabs. Four sliders
are initially visible: aggregate throughput, capital cost, electricity price and
operating life. Further details expands into normal page flow. Selected results
appear on the chart and in optional tables, rounded to two significant figures;
there is no precise headline price or favorable-reference region.

Following Ousterhout's information hiding and deep modules (APOSD §§4.3–4.4,
5.1–5.2), benchmark selection lives in `presets.ts`, rather than being duplicated
in the browser and precomputation. `config.ts` owns slider constraints and generic
scenario ranges; `model.ts` owns monthly accounting and the price solver;
`scenario.ts` exposes selected project and sweep results; `uncertainty.ts` owns
sampling and quantiles. `widget.ts` owns interaction and presentation. Related
control/rendering knowledge stays together, avoiding one class per control
(APOSD §5.5). Direct benchmark choices in UI handlers were considered and rejected
because changing service criteria would otherwise affect build and UI independently.

## Benchmark presets

Both presets use saved InferenceX evidence in
`docs/blog/ai_datacenter_project_finance/work_in_progress/data/` (imported at build
time; the published widget does not fetch excluded research documents).

- GPT-OSS-120B: B200, vLLM, FP4, TP1, May 31 2026 sweep.
- Qwen3.5-397B-A17B: B200, SGLang, FP8, TP4, July 5 2026 sweep.

Workload is text-only, nominal 8192 input / 1024 output tokens, sampled lengths.
For a selected minimum benchmark streaming target (25, 50 or 100 tok/s/request),
choose the **highest measured aggregate throughput** whose inverse mean TPOT
meets the target and p99 first client response is at most 10 seconds. This
latency constraint is an illustrative fixed assumption, not a market SLA.
The mean-speed criterion is not a per-request guaranteed floor. Qwen responses
use stream interval 50: first response is the first chunk; inverse mean TPOT
is a whole-stream average, not inverse inter-chunk latency or smooth delivery.

| Model | Target 25 | Target 50 | Target 100 |
| --- | ---: | ---: | ---: |
| GPT-OSS concurrency per TP1 replica | 128 | 64 | 32 |
| Qwen concurrency per TP4 replica | 32 | 32 | 8 |

The Qwen tie is intentional: no faster measured configuration satisfies the
first-response condition. These are best points within the saved sweep, not
claims of optimal current serving performance.

Aggregate tok/s/MW IT = saved output tok/s/GPU ×8 /0.015015 MW. Installed power
uses the DGX B200 14.3kW capacity proxy plus 5% ancillary allowance. Eight TP1
or two TP4 replicas are assumed per server; their concurrent replication is
not measured. Uniform plausible throughput ranges are **75–100% of this selected
benchmark**, an unmeasured deployment-transfer allowance, not empirical bounds.
This penalty describes aggregate replication efficiency, not a per-request
slowdown. Service quality under replication still needs measurement. Editing
throughput explores custom deviations without certifying the streaming target.
The benchmark anchor is the default selected value.

Capital cost is $40.83m/MW IT by default, with $38.70–50.51m plausible endpoints
from the existing purchase/facility scenarios; facility share defaults to 12/40.83.
See the research `open_weights_comparison.md` and `qwen35_comparison.md` for sources,
quote exclusions, precision, replication, and normalization limitations.
Changing model or speed resets throughput and its range; other financial edits
remain. Reset restores the current preset's defaults.

## Conditional sampling

All inputs are independent, including parameters that could correlate in reality.
Continuous parameters are uniform in displayed units, durations discrete-uniform
whole months, and billable share fixed at 100% unless it is the swept input.
A logarithmic throughput **slider** does not imply logarithmic sampling.
Non-throughput plausible ranges remain provisional scenario assumptions.

The build reuses 2,048 PCG32 draws across each axis, with seed 42 and sequence 54
verified against the official reference vector. It fixes the horizontal parameter
and samples all others. Quantiles interpolate ordered observations; invalid samples
fail generation rather than being silently dropped. Bands are the central 90%
of stipulated scenarios, **not confidence intervals**. Tests verify fingerprints
for every preset's generated data. Sliders do not trigger sampling.

The viewport shows the plausible axis range plus any selected out-of-range value;
slider exploration limits remain wider. All plotted quantities use initial total
workload revenue per million output tokens including associated input revenue,
not an output-only API tariff. Cashflows use the selected state and required price.
