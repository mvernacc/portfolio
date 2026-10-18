# Provider tariff and efficiency evidence (retrieved 2026-10-18)

Purpose: anchor trajectory scenarios for one installed hardware cohort, with no compute replacement. These observations establish mechanisms and magnitudes of individual changes; they do not identify a stationary annual decay rate for one datacenter.

## Best primary, dated anchors

| Date | Observation | Relevance and qualification |
|---|---|---|
| 2023-08-11 | Together announced up to 5x tariff reductions. Its new 40.1–70B tier cost $0.003/1K tokens = $3/MTok; 3.1–7B $0.20/MTok. | Provider explicitly links greater transactions/GPU to price cuts; model-size tiers, not equal-capability basket. Slightly outside strict 3-year window, useful baseline. https://www.together.ai/blog/august-2023-pricing-update |
| 2024-03-01 | Fireworks changed separate input/output rates to one flat token rate; estimated ~20% saving for median user, but not for input/output ratios above ~10:1. | Strong warning that blended prices require a constant workload mix. Do not apply their median saving to our 8:1 workload without old rate table. https://fireworks.ai/blog/spring-update-faster-models-dedicated-deployments-postpaid-pricing |
| 2024-04-20 | Groq Llama 3 70B launch tariff: $0.59/MTok input, $0.79 output. AA measured ~284 output tokens/s/request (not aggregate GPU/MW capacity). | 8:1 normalized workload price = 8*0.59+0.79 = $5.51 per MTok output. Different accelerator architecture, so market price anchor only. https://groq.com/blog/12-hours-later-groq-is-running-llama-3-instruct-8-70b-by-meta-ai-on-its-lpu-inference-enginge |
| 2024-07-18 | Together engine 2 launch: Llama 3 Turbo8B $0.18/MTok and70B $0.88/MTok; Lite8B $0.10/MTok. | Same post reports4xH100 Turbo achieves decoding throughput within8% of8xH100 full-precision Reference, and up to7x vLLM0.5.1 capacity. This supports software/quantization gains on a hardware generation but is cross-stack comparison, not an annual rate or independent benchmark. https://www.together.ai/blog/together-inference-engine-2 |
| 2024-09-25 | Fireworks Llama3.2 launch:1B/3B $0.10/MTok;11B vision $0.20;90B vision $0.90. | Supports migration to smaller capable models, not proof of equal capability. Vision tokens/contexts make careless comparisons misleading. https://fireworks.ai/blog/llama32-with-fireworks |
| 2025-01-20 | DeepSeek-R1 launch: cache-hit input$0.14/MTok; uncached$0.55; output$2.19. | 8:1 uncached workload revenue = $6.59/MTok output. Reasoning token consumption changes cost per task. https://api-docs.deepseek.com/news/news250120/ |
| 2025-08-21 announcement, effective2025-09-05 16:00UTC | DeepSeek-V3.1 unifies thinking/nonthinking around one model; changes pricing and ends off-peak discounts. | Direct evidence that successor tariff paths include service/discount changes. Numeric table is image, not independently extracted in this session. https://api-docs.deepseek.com/news/news250821/ |
| 2025-09-29 | DeepSeek-V3.2-Exp cuts API prices by50%+ with sparse attention, claiming similar benchmark quality toV3.1-Terminus. | Best compact example of coupled price/efficiency improvement through model migration. Gains chiefly concern long-context operation; do not transfer magnitude blindly to our8K/1K benchmark. https://api-docs.deepseek.com/news/news250929/ |
| 2026-10-18 snapshot | Together Llama3.3-70B Turbo model page currently lists$1.04/MTok input/output. | Do not date this price December2024 just because same page says releasedDecember5,2024. Multiple old secondary catalogs still say$0.88. Exact change date not primary-verified, so do not chart as dated price increase. https://www.together.ai/models/llama-3-3-70b |

The 2023 Together70B-tier $3 toJuly2024 Llama3Turbo70B $0.88 change is70.7% lower over342days (~73% annualized), but model, precision, stack and hosting package changed. It is an illustrative cross-product comparison, NOT a measured fixed-model price time series.8:1 normalized figures are$27 to$7.92/MTok output. This slower decline than quality-adjusted frontier series is unsurprising.

## DeepSeek sparse attention comparison detail

Primary model repository: https://github.com/deepseek-ai/DeepSeek-V3.2-Exp . ReportsV3.1-Terminus versusV3.2-Exp MMLU-Pro85.0/85.0, GPQA80.7/79.9, SWEVerified68.4/67.8; not exactly equal capability on every task. Deliberate matching of training configurations helps isolate architecture effect. Published comparison is not a power-normalized throughput series. Public kernels andH200 launch instructions make portability to an existing hardware generation plausible, but not guaranteed for the project'sB200 configuration/workload.

Implementation verification: the [announcement price image](https://api-docs.deepseek.com/img/v3_2_price_en.jpeg) was visually checked. Uncached input fell from $0.56 to $0.28/MTok, and output from $1.68 to $0.42/MTok, effective September 29, 2025 at 10:00 UTC. The 8:1 uncached workload price is therefore $6.16 before and $2.66 after (56.8% lower). These values are saved in historical_observations.json.

## Interpretation constraints

- Public retail tariffs include margin, competition, service quality, capacity scarcity, subsidies and contract choices. Hardware efficiency is not inferable from tariff changes alone.
- Distinguish (a) fixed weights/endpoint tariff history; (b) upgraded model family tariffs; (c) cheapest task cost at a capability threshold; (d) actual fixed-hardware aggregate throughput. Only(d) directly calibratesq(t); (b/c) inform demand-facingp(t) conditional on strategy.
- Keep cached/uncached, input/output, batch/off-peak, precision, latency and tokenizer consistent. Do not combine all promotional discounts into a general annual rate.
- Many apparent historical catalogs stamp release date next to current price; many retain dead endpoints and obsolete prices. Dated provider announcements are stronger than current model-page release metadata.
- A handful of provider changes cannot support statistical confidence intervals or probabilities for scenario weights.

## Proposed trajectory constraints (judgment, not estimated parameters)

1. Show coupled paths with a measurable net revenue-per-capacity multiplier(1-e)*(1+g). Examples are scenarios, not fits.
2. Fixed-capability migrations can combine steep market task-price decline with faster useful-work throughput, but cannot transplant a task-cost slope directly into$/token when output lengths change.
3. Follow-capability scenario allows rising compute per task/changedmodelmix, weaker price erosion, and potentially zero/negative token throughput growth.
4. Limited-adaptation scenario: substantial price competition with modest software gains; no automatic offset or hardware-generation upgrade.
5. Avoid independent uniform draws over high erosion and highgrowth without a coupling story. Prefer choose scenario then uncertainty around paired first2–3year gains; taper beyond observation window. A90% erosion rate held5years implies100,000x lower token prices and needs explicit stress-case labeling, not a central calibration.
6. Suggested visual material for user's ownTrendswriting: two separate indexed plots (quality-adjusted task cost vs calendar time; fixed-hardware benchmark throughput vs calendar time), plus paired scenario paths and their revenueproduct. Do not overlay them as if directly commensurate.
