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

The UI has shared controls and Cost sensitivity / Cashflows tabs. Five sliders
are initially visible: aggregate throughput, IT equipment cost, electricity price, colocation rent and
maximum operating life. Additional parameters expands into page flow on desktop, with the chart sticky below the site header. On narrow screens, the additional inputs have a bounded scroll area above the chart. Selected results
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

IT equipment cost is $29m/MW IT by default, with $28.7–34.5m plausible endpoints:
whole-server purchase prices plus networking/deployment allowances, with facility
capital removed. See `work_in_progress/notes.md` for formulas and source qualifications.
Rent is $275 per reserved IT kW-month by default (illustrative $175–300 range),
independent of utilization and PUE. Electricity is billed separately: PUE multiplies
active-plus-idle IT energy. Rent starts during commissioning and ends at retirement
without a termination charge or remaining commitment, an explicit simplification.
Equipment is paid at month 0, with debt interest accruing over a default three-month
commissioning delay. Electricity and other operating expenses start at operation.
All IT salvage is zero. There is no facility ownership, construction or resale.

See the research `open_weights_comparison.md` and `qwen35_comparison.md` for sources,
quote exclusions, precision, replication, and normalization limitations.
Changing model or speed resets throughput and its range; other financial edits
remain. Reset restores the current preset's defaults.

## Conditional sampling

Within each fixed trajectory, the remaining uncertain inputs are independent, including parameters that could correlate in reality.
Continuous parameters are uniform in displayed units, durations discrete-uniform
whole months, and billable share fixed at 100% unless it is the swept input.
A logarithmic throughput **slider** does not imply logarithmic sampling.
Non-throughput plausible ranges remain provisional scenario assumptions.

The build reuses 2,048 PCG32 draws across each axis, with seed 42 and sequence 54
verified against the official reference vector. It fixes the horizontal parameter
and samples the remaining uncertain inputs, keeping the trajectory pair fixed. Quantiles interpolate ordered observations; invalid samples
fail generation rather than being silently dropped. Bands are the central 90%
of stipulated scenarios, **not confidence intervals**. Tests verify fingerprints
for every preset's generated data. Sliders do not trigger sampling.

The throughput viewport uses a linear axis spanning roughly 0.25–2× the benchmark,
clipped to hard limits, to reveal the inverse relationship. Other axes use the
plausible range. All viewports include the selected value. A green vertical strip
marks the plausible horizontal interval;
slider exploration limits remain wider. All plotted quantities use initial total
workload revenue per million output tokens including associated input revenue,
not an output-only API tariff. Cashflows use the selected state and required price.


## Market references

`market-prices.json` is a curated snapshot of three illustrative active
OpenRouter provider routes per model, retrieved October 18, 2026. It is maintained
from the public endpoint API, not regenerated during build. Source URL, date,
route tag, precision and tariffs are retained. `market.ts` converts uncached input
tariff ×8 + output tariff into USD per million output tokens, matching nominal
8192/1024 lengths. Dashed horizontal lines show these references on every
sensitivity view; provider details and tariffs are in the assumptions disclosure.

These examples are not a full market range or filtered for the selected speed.
Hardware, precision, service conditions and margins differ. Tariffs exclude cache
discounts, taxes and extra fees; actual sampled token ratios may differ. Posted
prices do not establish production costs or validate assumptions. Cashflows still
use the model-required price. `presentation.ts` owns viewport policy separately
from slider geometry and sampling. This iteration leaves Monte Carlo unchanged;
`npx tsc && npx vite build` rebuilds presentation without redoing precomputation.

## Coupled operating trajectories

`trajectories.ts` owns three illustrative annual pairs: adaptation (30% effective
price erosion, 20% aggregate throughput growth; default), faster repricing
(60%, 50%), and rapid obsolescence (90%, 50%; stress case). These are judgments
informed by the research memos, not fitted rates, scenario probabilities, or a
forecast that the same model runs for the entire project. The starting benchmark
anchors an evolving workload mix on one compute cohort. The facility is rented; all IT equipment has zero salvage value.

The selector fixes both rates in selected cashflows and each conditional Monte
Carlo band. Neither is independently sampled or offered as a slider/sweep. Other
inputs retain their provisional independent ranges. The selector preserves slider
edits; Reset restores defaults within the current model, speed and trajectory.
Fine print shows lifetime multipliers and distinguishes the initial provider-price
comparison from future contracts.

Precomputation runs once for each trajectory. Benchmark presets differ only in
initial throughput ranges: the solver has throughput-independent costs and revenue
linear in initial throughput, so required price is exactly proportional to its
reciprocal. `rescaleThroughputBands` transforms each trajectory's bands for the
other benchmarks and evaluates the reciprocal throughput curve at their grid
points. It rejects other configuration differences. Regression tests compare this
transformation with full independent Monte Carlo runs across all 18 presets. If
costs begin depending on throughput, remove this reuse or derive and test a new rule.

## Retirement and initial price

The maximum operating life also sets the original loan amortization period.
For each candidate retirement month from 1 through that limit, the solver computes
the initial price meeting the equity hurdle and chooses the lowest feasible price.
Scheduled payments remain unchanged between candidates; remaining principal is
paid at retirement after that month's payment. Rent ends without penalty. IT resale,
replacement CAPEX, shutdown fees and operating costs after retirement are zero.

Retirement is optimized independently in every Monte Carlo draw and selected
sweep point. This assumes perfect foreknowledge of each scenario's price and
throughput trajectory, an optimistic adaptation assumption rather than a policy
under uncertainty. Cashflows end at the chosen date, identify it on the plot, and
separate terminal debt payoff from scheduled debt service in bars and the table.
The sensitivity axis for maximum life changes loan maturity too; it is not purely
a comparison of retirement dates under one unchanged loan.

The initial-throughput scaling used in precomputation remains valid: all candidate
required prices scale by the same reciprocal throughput factor, so their minimum
does too. Any change making costs or retirement eligibility depend on initial
throughput requires revisiting that reuse.

The widget's retirement solver is `src/retirement.ts`. The fixed-horizon
`calcPricePerMTokForTargetIrr` helper in `model.ts` evaluates the current colocation
model at its maximum horizon; the earlier Python prototype remains a historical
owner-developed-facility research artifact. For the current model, the widget, sweeps and Monte Carlo all use the
retirement solver. `calcMonthlyCashflows` accepts the chosen operating-month
count without changing original loan terms. Exact price ties choose the earlier retirement month.
