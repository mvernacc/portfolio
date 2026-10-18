# What are the costs of serving a language model?

!!! abstract "Summary: TODO one sentence summary"
    - TODO summary bullets

As LLMs become useful tools for research and engineering,
questions of cost become important:

> - Might prices rise as providers pursue profitability, squeezing customers who become reliant?
> - Might declining costs make these tools more accessible in lower-purchasing-power regions?
> - How might changes in compute hardware, algorithms, energy, and financing change costs?

We can't know for sure, particularly looking at frontier models from public data.

Instead, this post helps you explore the cost factors for yourself.
We'll make a simple estimate of the costs of building an AI datacenter and serving inference on a language model (assuming the model is already trained).
We'll then compare this estimate to actual market prices for inference on open-weights models.

This post is meant for technical- or business-minded readers seeking an introduction to the infrastructure behind their chat / coding agent interface, and what it costs to run.

## A simple estimate of datacenter project finance

<ai-dc-project-finance-widget>Enable JavaScript to explore the interactive cost model. The model and its assumptions are described below.</ai-dc-project-finance-widget>

TODO "visual abstract" diagram explaining the cost-estimate method to a reader at a glance.

To understand the factors that influence cost, we'll use a *project finance*
model of an AI datacenter. The project starts with capital expenses (CAPEX: GPUs,
networking equipment, land, concrete, construction worker's wages, etc.).
During the construction period the project makes no revenue, so CAPEX is
covered by a mix of cash from the project's equity investors and loans.

Then, in the operational period, the project makes revenue by selling
inference (tokens) and pays operating costs, like electricity and
maintenance work. The *throughput* and *utilization* of the computing equipment
determine how many tokens the project serves each month.

Finally, the IT equipment reaches the end of its useful life and the project ends.
We assume investors sell off the project's remaining assets (perhaps to another project
that will re-use the site).
To keep the model simple, it neglects taxes and government incentives.

We set up the above cashflows as a system of equations, and solve for one unknown:
the price-per-token needed to cover operating costs, make debt payments, and pay back investors at their expected *internal rate of return* (IRR).

This method is based on [Lazard's Levelized-Cost-of-Energy (LCOE)](https://www.lazard.com/research-insights/levelized-cost-of-energyplus-lcoeplus/) analysis,
the industry-standard method for modeling the cost of energy generation.
Lazard's LCOE estimates USD/MW-hr to pay back an energy project;
this post estimates USD/MTok to pay back a datacenter project.

??? info "Training costs not included"
    This method only accounts for the costs of inference, not the costs of research and model training.
    That's accurate for open-weights inference providers: they get the model weights for free.
    Within this method, one way to simulate paying back training costs is to require a higher IRR.
    Another way is to assume only a fraction of the datacenter's operating capacity is sold for revenue, with the remainder used internally for training.

### Key factors: throughput and cost of computing hardware

*Throughput* measures how many tokens can be served per second per unit-power-rating of IT capacity, with units of MTok/s/MW. Token cost scales like `1 / throughput`. Of our estimate's parameters, throughput has the biggest influence on cost, and is the least constrained from public data.

Throughput depends on model architecture and the inference engine that executes it, together called *algorithmic efficiency*, and hardware efficiency.

- *Architecture's* first-order effect: bigger models have lower throughput (holding constant compute and memory resources). Some architectures, like mixture-of-experts, make models faster by evaluating sections of the model in parallel, or only using some sections to predict each token.
- The *inference engine* is the software running the model to generate token predictions. A better inference engine can run the same model faster on the same hardware.
- As *hardware* improves, more efficient GPUs do more computation per second per installed capacity. (In this post, throughput is normalized per power-rating of installed IT capacity, not per the power the GPU actually consumes in a given moment.)

Architecture, inference engine, and hardware are coupled. For example, some GPUs can do many more operations per second on number representations with fewer bits (e.g. [BF16](https://en.wikipedia.org/wiki/Bfloat16_floating-point_format) or 8-bit integers). This requires *quantization*: making the model and inference engine use fewer-bit representations.

Even for the same LLM architecture and same inference engine on the same hardware, throughput is not a single number. *Concurrency*, how many users the hardware serves at once, creates a trade-off between throughput and per-user latency.

There is public benchmark data for throughput of open-weights models, on open-source inference engines, on modern hardware (e.g. [InferenceX](https://inferencex.semianalysis.com/)), and this post's estimates are calibrated with it [below](#simple-cost-estimates-vs-actual-price-of-open-weights-llms).
Recent public benchmarks have throughput on the order of 0.1-10 MTok/s/MW (benchmarks run in mid-2026 on late-2024 B200 hardware).
However, it is not publicly known how the architecture of these open models compares to frontier models. We should assume open inference engines (like vLLM) provide a lower bound on performance for frontier providers, who have both the incentive and resources to develop more efficient inference engines.

*Capital expense* also has a large impact on cost, and is better-constrained by public data than throughput. Token cost scales linearly with CAPEX. CAPEX is dominated by GPU costs: B200 GPUs (released late 2024) cost about $26M/MW, the rest of the datacenter might cost around $10-16M/MW.

### Electricity availability matters more than cost

TODO free vs highest US grid rates changes price by TODO percent.

### Financing costs

TODO sensitivity to interest rates.
How might rising interest rates increase the break-even price of projects wiht very front-loaded costs?

## Simple cost estimates vs actual price of open-weights LLMs

TODO

Competitive commodity market --> prices likely reflect costs.

## Trends in the key factors

<!-- Historical figures and factual captions; interpretation to be written by the author. -->

![Reconstructed GPQA Diamond cost frontier at two chance-adjusted score thresholds, by model release date.](../assets/images/ai_datacenter_project_finance/historical_capability_cost.svg)

*Retrospective benchmark costs assigned to model release dates, not archived launch tariffs. Thresholds are chance-adjusted accuracy; on four-choice GPQA, 25% and 75% correspond to 43.75% and 81.25% raw accuracy. Includes model switching and token-budget estimates. Source: [Epoch AI report](https://epoch.ai/publications/the-plunging-price-of-thought) and [published Figure 2 data](https://github.com/droodman/inference-cost/blob/9163c17ee7217b9f09ac51bcc71ed64c18c04bc8/output/slides/Figure%202.csv).*

![Selected Together and DeepSeek API tariffs from 2023 to 2026, normalized to eight uncached input tokens per output token.](../assets/images/ai_datacenter_project_finance/historical_provider_tariffs.svg)

*Dated quotes for different models and services, not a fixed-capability price index. Each value is output tariff + 8 × input tariff. The final Together point is an October 18, 2026 snapshot, not its release price. Sources: Together [2023](https://www.together.ai/blog/august-2023-pricing-update), [2024](https://www.together.ai/blog/together-inference-engine-2), [current model page](https://www.together.ai/models/llama-3-3-70b); DeepSeek [V3.1 effective-date announcement](https://api-docs.deepseek.com/news/news250821/) and [V3.2 price table](https://api-docs.deepseek.com/img/v3_2_price_en.jpeg).*

![Reported Llama 2 70B throughput improvements on existing H100 hardware: 5 percent server and 12 percent offline over March to August 2024, and up to 50 percent over the year to April 2025.](../assets/images/ai_datacenter_project_finance/historical_h100_software.svg)

*Separate, overlapping comparisons; do not compound these gains. The 2024 comparison uses eight H100 GPUs at 700 W each; server and offline benchmarks have different latency requirements. The annual maximum is vendor-reported, not a fleet average, and its source includes an unverified-results caveat. Sources: NVIDIA [August 2024, Table 3](https://developer.nvidia.com/blog/nvidia-blackwell-platform-sets-new-llm-inference-records-in-mlperf-inference-v4-1/) and [April 2025](https://developer.nvidia.com/blog/nvidia-blackwell-delivers-massive-performance-leaps-in-mlperf-inference-v5-0/).*

TODO author interpretation. Related: [Artificial Analysis cost-per-task trends](https://artificialanalysis.ai/trends#language-model-cost-per-intelligence-index-task-by-intelligence-index-threshold-over-time).

---

TODO footnote on use of AI in this blog post

TODO final editing pass per *Style: Lessons in Clarity and Grace*.
