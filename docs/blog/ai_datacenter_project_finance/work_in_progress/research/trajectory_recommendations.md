# Price and throughput trajectories: evidence and proposed assumptions

Research date: 2026-10-18. Working research for the author, **not draft blog prose**. Research conclusions below were initially proposals. Implementation update: the three main paired scenarios now appear in the widget, with adaptation selected by default; historical figures are in the post with factual captions. The alternate harder-service-mix scenario and time-varying-rate refinement remain proposals.

## Decision and project boundary

One project owns one compute-hardware cohort. Its operating life is that cohort's economically useful life. No replacement GPUs or hidden reinvestment appear in throughput growth. At termination, reusable non-compute facility assets are sold/transferred to a successor project at the already-modeled net residual value. Compute equipment retains the existing zero residual assumption. Do not recognize successor-project revenue in this project's cashflows.

Keep the financial method. Interpret the selected model as an initial operating benchmark, and future price/throughput as the changing service mix on that hardware. The evidence supports nonzero erosion and some software gains, but **does not identify a statistically calibrated joint distribution**. A scenario selector is more defensible than independent price/growth uniforms or invented scenario probabilities.

## Evidence map

Detailed dated observations, direct links, and comparison limitations are in [price history](price_history.md) and [throughput history](throughput_history.md).

| Evidence | What it anchors | What it cannot establish |
|---|---|---|
| Dated provider tariff announcements, 2023–2025; current snapshots in 2026 | Large discrete repricing and migration events | Annual erosion for a fixed service basket, margins, or production costs |
| DeepSeek September 2025 sparse-attention release and 50%+ price cut | A concrete mechanism linking model migration and lower tariffs | A measured annual gain on our B200 workload |
| H100 software benchmark comparisons, 2024–2025 | Same-generation capacity gains on the order of tens of percent in longitudinal comparisons | Recurring orders-of-magnitude gains, or our exact latency/length conditions |
| Large vLLM/SGLang release improvements | Bottlenecks and architecture changes can produce jumps | Multipliable annual factors; baselines and latency tradeoffs differ |

The retrieved evidence is strongest in 2024–2025. A 2023 provider announcement supplies an older baseline; 2026 reports extend market-cost context. We did **not** obtain a matched, three-year, fixed-hardware, fixed-service-level throughput panel. Claims about a five-year future remain extrapolations.

### Quality-adjusted market cost: separate evidence

[Epoch's September 2026 analysis](https://epoch.ai/publications/the-plunging-price-of-thought) estimates about 13-fold annual reduction in the cost of a fixed performance level over the preceding three years. The decline varies by task and how recently that capability became available. Its cheapest-model frontier assumes switching more aggressively than many actual customers do. This supports strong competitive pressure; it does not estimate realized price erosion for a specific GPU cohort.

[Artificial Analysis's current methodology](https://artificialanalysis.ai/methodology/) defines task cost from actual input, cached-input and output consumption, weighted across evaluations. It distinguishes this from token tariffs and uses a 7:2:1 cached/input/output mix for its current blended-price metric. Our widget uses an uncached 8:1 input/output workload. Do not copy the slope of one metric into the other without a conversion. Current prices next to historical release dates are not necessarily historical prices.

The [AA 2025 year-end report, PDF page 23 / printed page 24](https://artificialanalysis.ai/downloads/state-of-ai/2025/2025-Year-End-Artificial-Analysis-State-of-AI-Highlights-Report.pdf) separately reports a 128-fold per-token price reduction for o1-level intelligence and distinguishes fixed-capability from frontier-model pricing. Preserve that report's index version and units; do not splice it into today's task-cost series as an unchanged measurement.

## How a changing model mix fits the existing equations

Let a_m(t) be the fraction of active capacity assigned to model/workload m, q_m(t) its output rate per active unit capacity, and p_m(t) its revenue per output token including associated input revenue. Then:

- q_eff(t) = sum_m a_m(t) q_m(t)
- p_eff(t) = sum_m a_m(t) q_m(t) p_m(t) / q_eff(t)
- revenue(t) = installed_capacity × utilization(t) × q_eff(t) × p_eff(t)

Thus price is output-volume weighted, while throughput is capacity weighted. Both must describe the same mix. If tokenizer, reasoning lengths, caching or input/output ratios change, include those effects consistently in effective revenue and throughput. The initial 8:1 comparison remains a baseline, not a promise that every future workload has that ratio.

With annual erosion e and growth g, our present approximation gives an annual revenue-per-active-capacity multiplier M = (1-e)(1+g). Revenue depends on this product; the current model holds power and other OPEX constant as efficiency changes. These rates cannot be separately inferred from revenue alone. Negative throughput growth can represent a harder service mix; it need not imply physically slowing GPUs.

## Proposed scenario anchors — judgments for discussion

These numbers are **author-chosen sensitivities**, informed in scale by the evidence, not measured joint rates or probability percentiles. Do not describe them as fitted, median, or equally likely. Rates apply from the start of operation; the quoted initial price and benchmark must refer to that same start date. A project commencing construction today would require a separate adjustment for market changes before commissioning.

| Scenario | Annual effective price erosion | Annual aggregate throughput growth | Annual revenue multiplier at fixed utilization | Intended interpretation |
|---|---:|---:|---:|---|
| Adaptation on existing hardware — proposed starting case | 30% | 20% | 0.84 | Partial capture of software/model gains; continuing migration and customer retention mean realized prices fall more slowly than fixed-capability frontier task costs |
| Faster repricing with strong adaptation | 60% | 50% | 0.60 | Substantial competitive cuts and successful migration; recurring 50% growth is already an optimistic capacity assumption |
| Rapid obsolescence — stress case | 90% | 50% | 0.15 | Market pressure far outruns this cohort's gains; mapping a 10× task-cost decline to token prices additionally assumes a stable task/token relationship |
| Harder service mix — alternate strategy | 10% | -10% | 0.81 | More capability per token preserves pricing but reduces tokens served per unit capacity; numerical pair is a strategy illustration without a measured joint anchor |

The starting 30% erosion is deliberately **slower** than quality-adjusted frontier cost decline. This is justified only by the explicitly changing capability/service mix, not by denying rapid market progress. If the business is specified to serve a fixed capability at the cheapest market price, it belongs closer to the obsolescence stress case unless evidence demonstrates much stronger same-hardware task-throughput growth.

At five elapsed operating years, the first three cases imply throughput multipliers of 2.49, 7.59 and 7.59; price multipliers of 0.168, 0.0102 and 0.00001; and revenue multipliers of 0.418, 0.0778 and 0.0000759. Those extremes are a reason to expose lifetime multipliers and avoid suggesting all rates can persist indefinitely. The 90% case exceeds the current widget's 80% erosion limit; a future implementation must change that limit deliberately.

A useful eventual refinement is front-loaded gains followed by a plateau. For example, +50% capacity in each of two years then flat gives 2.25× after five years, equivalent to 17.6% annual growth **at the endpoint**. It is not financially equivalent to a smooth 17.6% path: earlier production has greater discounted value. Keep constant rates for a simple first iteration, but call them a cashflow-path approximation, not a forecast of continual breakthroughs.

### Numerical check in the existing model

Holding all current Qwen 50-token/s preset defaults fixed except the paired rates, required initial revenue is approximately $1.96/MTok with static rates, $2.77 with adaptation, $4.66 with faster repricing, and $13.26 with obsolescence. These are calculated scenarios, not observed costs or new defaults. They retain the existing 90% utilization, 60-month operating life and 15% equity hurdle, so they do not constitute a broader reset of optimistic defaults.

The stress case should prompt exploration of a shorter economic life. Keep life an explicit scenario input for now; neither a historical GPU benchmark nor a tariff series identifies the optimal retirement date. Declining revenue can make continued operation uneconomic before a chosen terminal date; the current solver does not optimize retirement.

## Widget implications (main scenario selector now implemented)

- Select a trajectory before drawing other uncertain assumptions; keep price and throughput changes paired. Prefer separate bands per selected trajectory, rather than pooling them with arbitrary equal weights.
- For now fix the pair within a scenario and sample other parameters as before. Any within-scenario uncertainty needs an explicit joint rule; coupling is more than a positive correlation coefficient.
- Replace independent price/growth sweeps with trajectory selection or a clearly marked custom pair. Holding one fixed while varying the other can remain an exploratory override, not a sample from the scenario distribution.
- Label model selection as the starting benchmark. Retain the current-market overlay only as an initial-revenue comparison, not future contract prices.
- Retain residual facility value and the zero compute residual. No hardware-generation speedups without a new project.

## Material for the author's “Trends in the key factors” section

Suggested evidence/figure sequence, not drafted prose:

1. **Market history:** dated tariff events for named services, or one consistent quality-adjusted task-cost dataset on a log axis. Mark model switches. Separate token-tariff and task-cost charts; retain index version, cache treatment and access date. Use only actual dated observations, not prices backdated from release metadata.
2. **Existing hardware:** a small table or disconnected comparison arrows for the matched H100 observations. Label hardware, model, workload and latency requirement. Do not connect heterogeneous best-case release speedups into a continuous historical index.
3. **Project scenarios:** three small panels over operating age showing normalized price, throughput, and their product. Clearly mark them as assumed trajectories; show the terminal facility transfer separately. Highlight the proposed starting case, with stress cases selectable rather than all curves overwhelming one chart.
4. **Reader question to support:** which efficiency gains can an owner of already-installed hardware capture, and how quickly does competition pass them through to customers?

Use the source evidence to establish the direction and scale of changes, and scenario arithmetic to explain the consequences. Keep historical measurements visually distinct from extrapolations. Do not present market prices as proof of provider profitability or affordability of a new build.
