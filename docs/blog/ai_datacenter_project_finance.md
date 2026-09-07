# What are the costs of serving a language model?

TODO summary bullets
TODO motivating question

## A simple estimate of datacenter project finance

To understand the factors that influence cost, we'll use a *project finance*
model of an AI datacenter. The project starts with capital expenses (CAPEX: GPUs,
networking equipment, land, concrete, construction worker's wages, etc.).
During the construction period the project makes no revenue, so CAPEX is
covered by a mix of cash put in by the project's equity investors and loans.

Then, the operational period, in which the project makes revenue by selling
inference services (tokens) and pays operating costs, like electricity and
maintenance work. The *throughput* and *utilization* of the computing equipment
determine how many tokens the project serves each month.

Finally, the IT equipment reaches the end of its useful life and the project ends.
We assume investors sell off the project's remaining assets (perhaps to another project
that will re-use the site).
To keep the model simple, it neglects taxes and government incentives.

We set up the above cashflows as a system of equations, and solve for one unknown:
what price-per-token would the project need to charge
to cover its operating costs, make its debt payments, and pay back
its investors at their expected *internal rate of return*(IRR)?

This method is based on [Lazard's Levelized-Cost-of-Energy (LCOE)](https://www.lazard.com/research-insights/levelized-cost-of-energyplus-lcoeplus/) analysis,
the industry-standard method for modeling the cost of energy generation.
Lazard's LCOE estimates USD/MW-hr to pay back an energy project;
this post estimates USD/MTok to pay back a datacenter project.

### Key factors: throughput and cost of computing hardware

*Throughput* measures how many tokens can be served per second per unit-power-rating of IT capacity, with units of MTok/s/MW. Token cost scales like `1 / throughput`. Of our estimate's parameters, throughput has the biggest influence on cost, and is the least constrained from public data.

Throughput depends on model architecture and the inference engine that executes it, together called *algorithmic efficiency*, and hardware efficiency.

- *Architecture's* first-order effect: bigger models have lower throughput (holding constant hardware compute and memory resources). Some architectures, like mixture-of-experts, make models faster by evaluating sections of the model in parallel, or only using some sections to predict each token.
- The *inference engine* is the software running the model to generate token predictions. A better inference engine can run the same model faster on the same hardware.
- As *Hardware* improves, more efficient GPUs do more computation per second per installed capacity. (In this post, throughput is normalized per power-rating of installed IT capacity, not per the power the GPU actually consumes in a given moment.)

Architecture, inference engine, and hardware are coupled. For example, recent GPUs can do many more floating-point operations per second, but only on smaller number representations (FP16, FP8 or FP4). Taking advantage of this capability requires a model and inference engine that can use small floats.

Even for the same LLM architecture and same inference engine on the same hardware, throughput is not a single number. Concurrency, how many users the hardware serves at once, creates a trade-off between throughput and per-user latency.

There is public benchmark data for throughput of open-weights models, on open-source inference engines, on modern hardware (e.g. [InferenceX](https://inferencex.semianalysis.com/)), and this post's estimates are calibrated with it [below](#simple-cost-estimates-vs-actual-price-of-open-weights-llms).
Recent public benchmarks have throughput on the order of 0.1-10 MTok/s/MW (benchmarks run in mid-2026 on late-2024 B200 hardware).
However, it is not publicly known how the architecture of these open models compares to frontier models. We should assume open inference engines (like vLLM) provide a lower bound on performance for frontier providers, who have both the incentive and resources to develop more efficient inference engines.


*Capital expense* also has a large impact on cost, and is better-constrained by public data than throughput. Token cost scales linearly with CAPEX. CAPEX is dominated by GPU costs: B200 GPUs (released late 2024) cost about $26M/MW, the rest of the datacenter might cost around $10-16M/MW.


### Electricity availability matters more than cost

TODO free vs highest US grid rates changes price by TODO percent.

## Simple cost estimates vs actual price of open-weights LLMs

## Trends in the key factors


TODO footnote on use of AI in this blog post