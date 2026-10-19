# Inference project finance in rented colocation space

Working specification for us, not draft blog prose. The current implementation is
`widgets/ai_datacenter_project_finance/src/model.ts`, with retirement in
`src/retirement.ts`. Earlier Python prototypes, comparison plots, and saved
comparison assumptions describe the historical owner-developed-facility model;
they are research artifacts, not the current widget's accounting specification.
All monetary amounts are USD per MW of installed IT capacity unless noted.

## Accounting boundary

An inference provider buys a cohort of GPU servers and associated IT equipment,
rents existing datacenter capacity, commissions the equipment, and operates it
until economic retirement or a maximum useful life. No facility is purchased,
built, or sold. All IT equipment has zero residual value. Hardware replacement
would be a new project and is outside this model.

Costs include equipment and deployment, rent, consumed electricity, other operating
expenses, debt interest and repayment, and equity's required return. Training,
research, taxes, incentives, and corporate costs outside the other-OPEX allowance
are excluded. Meeting this project's hurdle does not establish whole-company
profitability. An initial price below the revenue requirement need not imply an
operating loss: recovering sunk capital is different from continuing operation.

The lease can end at any retirement date without penalty, notice-period charges,
or remaining rent. This is an explicit simplifying, optimistic assumption, not a
claim about normal wholesale lease terms. There are no shutdown costs, deposits,
or terminal asset proceeds. Capacity is assumed available when equipment is paid;
commissioning is a payment-to-operation delay, not a forecast of market availability.

## Tokens, throughput, and capacity

- Input/prompt tokens are context processed in prefill. Output/generated tokens are
  produced during decode. These are separately billed by API providers.
- Throughput is **aggregate generated output tokens/s/MW of installed IT capacity**,
  measured over the full serving workload including prefill and decode resource use.
  It is not isolated decode throughput or the speed of one user's response.
- Initial price `P0` is **total workload revenue per million output tokens**, including
  associated input revenue. For uncached input/output token ratio `r`, an API tariff
  corresponds to `p_output + r*p_input`. With cached input fraction `c`, use
  `p_output + r*((1-c)*p_input + c*p_cached)`. No cache discount is assumed in the widget.
- The saved benchmark mix is nominally 8 input tokens per output token. Market
  comparisons normalize to that mix; this is not an output-only API price.
- Installed IT capacity is a fixed rating, not actual average consumption and not
  facility/grid capacity. The B200 proxy is 14.3 kW per eight-GPU server plus 5%
  ancillary IT capacity: 0.015015 MW per server. PUE never changes this denominator.

Utilization `u` is the active capacity-time fraction. Billable inference share `b`
is the fraction of active work credited with revenue; default and plausible range
are 100%. Lower values charge all project costs against only the billable share.
Unbilled work still consumes active power and does not itself model training costs.

Benchmark selection uses the highest measured aggregate throughput satisfying the
selected inverse-mean-TPOT streaming target (25/50/100 output tok/s/request) and
p99 first response <=10 seconds. The latter is fine print, not a market SLA.
Eight GPT-OSS TP1 or two Qwen TP4 replicas fill a server by assumption; full-node
concurrent replication was not measured. Qwen's chunked responses make the speed
an interval average, not smooth delivery. Throughput's plausible range is uniform
75–100% of the selected benchmark, an assumed deployment allowance rather than
observed statistical variation. See the saved benchmark evidence for details.

## Capital and commissioning

Let `K` be installed IT equipment/deployment cost, `d` the debt fraction, `i` nominal
annual debt interest, `C` commissioning months, and `N` maximum operating months.

At month 0 all equipment is paid for: equity contributes `(1-d)*K` and debt draws
`d*K`. Equity cashflow is `-(1-d)*K`; the matching debt draw/purchase cancel from
the equity account. There is no evenly spread construction expenditure.

Months 1 through C are commissioning. Rent is paid at each month end from equity.
No revenue, electricity, other OPEX, or scheduled debt payments are modeled during
this interval. Commissioning power is neglected. Interest capitalizes on equipment
debt, so the balance entering operation is `D0 = d*K*(1+i/12)^C`.
Commissioning defaults to 3 months, with a provisional 1–6 month plausible range.

Equipment cost defaults to **$29 million/MW IT**. The plausible range is rounded
to $28.7–34.5 million/MW IT, obtained from saved whole-server prices $390,000–430,000
plus 10–20% networking/deployment allowance, divided by 0.015015 MW/server. The
central saved quote $391,737.50 plus 10% gives $28.83 million/MW, rounded to 29.
The high server price and ancillary allowances are scenarios, not independent
market quotes. This retains server CPUs, memory, NICs and external IT costs while
removing facility construction. Quote source:
[Exxact B200 configuration](https://configurator.exxactcorp.com/configure/TS4-142487900),
with saved detail in `data/qwen35_evidence.json` and the comparison research memos.

## Rent and electricity: separate expenses

Rent `R` is USD per **reserved IT kW-month**, excluding electricity. Per modeled MW,
monthly rent is `1000*R`, regardless of utilization or PUE. It starts in commissioning
and stops after the last operating month. Rent stays constant in nominal dollars.
It covers facility space, electrical/cooling infrastructure and its provision;
it does not cover electricity consumed by cooling or the IT equipment.

The illustrative range is **$175–300/kW-month**, default **$275** toward the upper
end to allow for density and flexible exit. This is not an observed cancel-anytime
quote or a fitted market distribution. Public anchors, checked October 18, 2026:

- [CBRE's 2026 discussion](https://www.cbre.com/insights/podcasts/2026-ep26-can-data-centers-keep-up-with-ai)
  describes turnkey colocation at roughly $175/kW-month plus consumed electricity.
- [CBRE H2 2025](https://www.cbre.com/insights/books/north-america-data-center-trends-h2-2025)
  reports $196.25/kW-month average asking rent for 250–500 kW primary-market
  requirements and premiums for AI-ready facilities. These are asking rents, not
  a quote for our density, scale, term, or termination rights.

Do not use a bundled electricity-inclusive quote as rent and also add electricity.
The PUE assumption is kept explicit, rather than embedded in rent. With idle-power
fraction `f`, PUE `p`, volumetric energy price `e` in USD/MWh, and
`H = 365.25*24` hours/year:

```
average IT load per installed MW = u + (1-u)*f
annual facility energy (MWh/MW IT) = H*p*(u + (1-u)*f)
monthly electricity cost = e*H*p*(u + (1-u)*f)/12
```

Default PUE is 1.2, plausible 1.1–1.4. It scales actual active-plus-idle electricity
consumption, never rent or output. Electricity defaults to $90/MWh, plausible
$40–150/MWh. There is no additional utility capacity-charge parameter: any utility
charges passed through to the tenant are assumed allocated in the effective energy
rate. Rent and electricity represent different services and are not substitutes.
Other OPEX covers the inference operator's maintenance, networking services and
staffing allowance, excluding both facility rent and all electricity; the retained
$1 million/MW-year default and $0.5–2 million range are provisional.

## Revenue trajectories

Let `q` be initial aggregate output tokens/s/MW IT, `S = 3600*H`, price erosion `e_p`,
and annual throughput change `g`. In operating month `t` (1-based):

```
output_MTok(t) = u*b*q*S/12/1e6 * (1+g)^((t-1)/12)
price(t) = P0*(1-e_p)^((t-1)/12)
revenue(t) = P0*output_MTok(t)*(1-e_p)^((t-1)/12)
```

The starting benchmark anchors an evolving service mix on unchanged hardware.
The trajectory is a paired assumption, not independent price/growth draws:
adaptation (30% price erosion, 20% throughput growth), faster repricing (60%, 50%),
and rapid obsolescence (90%, 50%). Their annual revenue multipliers are 0.84, 0.60,
and 0.15. These are illustrative sensitivities, not forecasts fitted from history.
Power, rent and other OPEX remain constant while output changes. Long-run software
improvements on aging equipment are uncertain; faster output is not assumed to
increase installed power. Historical evidence and its limitations are in the
research memos and trends plots. No scenario probabilities are assigned.

## Debt, cashflows and joint retirement/price solution

The loan is amortized over N operating months, independent of candidate retirement.
For monthly interest `j=i/12`, scheduled payment is
`A = D0*j/(1-(1+j)^(-N))`, or `D0/N` for zero interest.
After payment in operating month t: `D_t = max(0, D_(t-1)*(1+j)-A)`.
At t=N the balance is set to zero to remove floating-point residue. At earlier
retirement T, all remaining `D_T` is repaid after the scheduled payment.

Operating equity cashflow is revenue minus electricity, rent, other OPEX and
scheduled debt service; the final month additionally deducts remaining debt.
There is no asset sale. No cashflows occur after retirement.

For effective annual equity hurdle h, discount month m by `v_m=(1+h)^(-m/12)`.
For each candidate T=1,...,N define:

```
a_T = sum(t=1..T, v_(C+t) * revenue(t) evaluated at P0=1)
b_T = upfront equity + discounted commissioning rent
      + discounted operating rent, electricity, other OPEX and loan payments
      + v_(C+T)*D_T
NPV(P0,T) = a_T*P0 - b_T
required_price(T) = b_T/a_T
T_star = argmin(T=1..N, required_price(T))
P0_star = required_price(T_star)
```

Costs are positive and there are no asset proceeds, so required prices are positive.
Exact ties use the earliest retirement month. At P0_star the chosen retirement has
zero NPV and all other retirement dates have NPV <=0. This is a perfect-foreknowledge
calculation within each scenario, not a stopping policy under uncertain future
prices. Equity NPV at a hurdle is the objective; multiple-sign-change cashflows
may have ambiguous IRRs, so no arbitrary IRR root is chosen.

The prefix-sum solver evaluates all dates in O(N); it does not repeatedly construct
full cashflow arrays. The tests independently enumerate those arrays as an oracle.
Changing the maximum-life slider also changes original loan maturity, whereas
choosing retirement within one scenario does not. Initial throughput enters only
as a revenue multiplier: doubling it halves required price without changing the
chosen retirement. This property supports exact precomputation reuse.

## Conditional uncertainty and presentation

Configuration owns hard limits, plausible ranges, defaults and units separately
from computation. Each trajectory fixes its price/growth pair. Other inputs are
sampled independently and uniformly in displayed units, durations in whole months.
This independence is a simplifying assumption, including for potentially correlated
rent, electricity, PUE and equipment costs. Zero-width ranges are allowed.
A logarithmic slider does not imply logarithmic sampling.

Each sweep fixes its horizontal-axis value and samples all other uncertain inputs.
Every draw solves its own initial price and retirement with perfect foreknowledge.
The band shows 5th–95th percentiles of stipulated scenarios, not a confidence
interval. PCG32 seed 42, sequence 54, 2,048 reused draws give deterministic curves.
Selected sliders affect the point and line, not the precomputed conditional band.
Cashflows use selected values and show equipment at month 0, separate rent and
electricity, and any terminal debt payoff. There is no favorable-reference region.

## Research artifacts and historical figures

[Trajectory recommendations](research/trajectory_recommendations.md) collect dated
price and benchmark evidence, distinguishing observed improvements from scenario
judgments. The three main scenarios are implemented; the harder-service-mix
alternative is not. The post's Trends section retains historical figures and factual
captions, with interpretation left to the author.

`plot_historical_trends.py` regenerates SVG/PNG figures from saved CSV/JSON inputs
in `data/` without network access (requires matplotlib). Epoch's source is pinned
to a repository commit; its cost records are retrospective release-date comparisons,
not archived launch tariffs. Provider tariff observations and separate H100 gains
retain their own dates and comparison qualifications. These historical evidence
plots are independent of the switch from facility ownership to colocation.

Earlier deterministic comparison plots and Python calculations retain their original
facility-ownership assumptions for reproducibility. Their price estimates must not
be presented as current widget outputs. Current numerical checks run with
`npm --prefix widgets/ai_datacenter_project_finance test`; generated conditional bands
are rebuilt with `npm --prefix widgets/ai_datacenter_project_finance run precompute`.
