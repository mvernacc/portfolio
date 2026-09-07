# AI datacenter project finance: working model specification

This is our shared methods and assumptions document, not draft blog prose.
`goal.md` describes the motivation. Python is the reference implementation;
`widgets/ai_datacenter_project_finance/src/model.ts` implements the same model.
All monetary inputs are USD. Values below are illustrative scenarios, not a
calibrated estimate of any particular provider's economics.

## 1. Question and accounting boundary

What initial token revenue would make a new inference project have zero equity
NPV at a chosen pre-tax return hurdle? With constant prices and throughput this
is a levelized revenue requirement. With trends it is the required **initial**
price for the specified future path, not a levelized constant price.

The base case is dedicated inference. It includes initial IT and facility
investment, electricity, other cash operating expenses, construction interest,
debt repayment, equity return, and terminal facility proceeds. It excludes model
training, research, data acquisition, and corporate overhead beyond any expenses
explicitly included in non-energy OPEX. API prices above this benchmark do not
establish whole-company profitability. Prices below it do not necessarily imply
operating losses: existing assets need not recover sunk investment to keep serving.

We retain `revenue_fraction` as an advanced allocation scenario. A value below
one allocates **all** project costs to the billable inference share, while the
remaining active capacity does internal work with no credited revenue. This is
not a measured training cost, and does not include the rest of a lab's R&D costs.
Internal activity is assumed to draw the same active power as inference.

## 2. Tokens, workloads, and the power denominator

### Token terminology

- **Input tokens / prompt tokens**: tokens supplied to the model, including
  context and conversation history. Use the model's actual tokenizer.
- **Prefill**: processing the input context to prepare the state used for
  generation. Cached prefixes can reuse that state; input tokens and newly
  computed prefill tokens therefore need not have the same count.
- **Output tokens / generated tokens**: accepted model-generated tokens. Include
  reasoning tokens when the provider bills them as output and the benchmark can
  count them consistently. Exclude rejected speculative draft tokens from output
  counts, but include their resource cost. Visible response text alone may not
  reproduce the billed output count.
- **Decode**: the generation phase. Prefill and decode are execution phases,
  not two interchangeable billing categories or necessarily separate machines.

We use **aggregate output-token throughput over the full serving interval**,
including prefill and decode time and resources. It is neither output divided
by decode-only time nor per-user streaming speed. The numerator sums output
across concurrent requests; latency/service-quality requirements constrain how
much concurrency is acceptable. Do not use total input-plus-output throughput
as output throughput.

These distinctions follow the serving/benchmark vocabulary in
[vLLM's serving benchmark](https://docs.vllm.ai/en/latest/cli/bench/serve/) and
[InferenceX's methodology](https://inferencex.semianalysis.com/about).
[vLLM's prefix caching documentation](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/)
explains reuse of input processing separately from generation.

### Installed IT capacity

Normalize all project quantities to **one MW of installed IT capacity**: the
active electrical capacity of the complete IT system, including accelerators,
CPUs, memory, storage, networking, and any separate prefill/decode pools.
Cooling and other facility overhead are outside this denominator and enter via
PUE. This toy model assumes fully active IT draws that one MW.

`throughput = T0` is initial output tok/s per MW installed IT during active
serving, before multiplying by fleet utilization. If a benchmark has aggregate
output rate B on an installation with K MW IT capacity, T0 = B/K. Measured
power-normalized tokens/J is not automatically installed-capacity-normalized
throughput. Convert using measured active draw relative to installed capacity;
account for missing non-GPU IT loads. If throughput already includes facility
power/PUE, first undo that normalization. Apply PUE exactly once.

### Revenue per output token

The financial model's price P is **total workload revenue per million billable
output tokens**. It includes the associated input revenue. It is not the API's
posted output-only tariff, nor a claim that input and output have equal cost.

For input/output ratio r, cached input fraction c, and tariffs per million tokens:

    P = p_output + r * [(1-c) * p_input + c * p_cached_input]

The price helper implements this identity (default r=3, c=0). Input counts are
mutually exclusive cached and uncached categories. This simple helper omits
separate cache-write/storage charges, batch discounts, tiering, and routing fees;
when applicable calculate actual workload revenue, then divide by output count.

Throughput must be measured for the **same workload** as that revenue estimate:
model/version/tokenizer, precision and quality, input/output lengths and their
distributions, caching, latency requirements, concurrency, hardware, and serving
stack. Changing r or caching changes both billing and the measured throughput;
the helper changes billing only and cannot infer the new throughput. Input work
is paid for in the throughput measurement, not magically covered by blending prices.

The previous frontier-model price examples are retained as dated May 2026
illustrations, not verified current prices or calibrated comparison points.
Their r=3 assumption is illustrative. Open-weight validation should use matched
provider/workload data with source, retrieval date, and benchmark configuration.

## 3. Inputs and provisional base case

Names are Python identifiers; TypeScript uses their camelCase equivalents.

| Parameter | Default | Meaning / qualification |
| --- | ---: | --- |
| `capex` | $50m/MW IT | Total initial IT + facility investment |
| `facility_capex_fraction` | 20% | Reusable facility share; provisional |
| `facility_residual_fraction` | 50% | Net terminal proceeds / original facility CAPEX; provisional at five years |
| `throughput` | 100,000 output tok/s/MW IT | Uncalibrated starting workload throughput |
| `throughput_annual_change` | 0% | Effective annual change in throughput at fixed installed capacity |
| `price_annual_erosion` | 0% | Effective annual decline in total workload revenue per output token |
| `utilization` | 90% | Active fraction of installed capacity-time |
| `revenue_fraction` | 100% | Dedicated inference; lower values are allocation scenarios |
| `pue` | 1.2 | Facility / IT power, constant at active and idle load |
| `idle_power_fraction` | 20% | Idle IT power / installed capacity; provisional |
| `energy_cost_per_MWh` | $90/MWh | Volumetric facility electricity tariff |
| `capacity_charge_per_kW_month` | $0/kW-month | Separate charge on reserved facility capacity |
| `non_energy_annual_opex` | $1m/year/MW IT | Cash OPEX excluding electricity and capital recovery; uncalibrated |
| `construction_years` | 2 | Equal end-of-month CAPEX installments |
| `operating_years` | 5 | Economic horizon before IT replacement |
| `debt_fraction` | 65% | Debt share of initial CAPEX, before capitalized interest |
| `debt_interest_rate` | 8.5% | Nominal annual debt rate, compounded monthly |
| Target equity return (function argument) | 15% | Effective annual pre-tax NPV hurdle |

The facility share is land, building, power/cooling infrastructure, and reusable
site works. The remaining share includes GPUs **and other IT equipment**, all
assigned zero terminal value for simplicity. This avoids treating every non-GPU
component as long-lived real estate. No replacement CAPEX occurs inside the horizon.

The $50m/MW starting point came from the
[Alpha Matica cost breakdown](https://www.alpha-matica.com/post/deconstructing-the-data-center-a-look-at-the-cost-structure-1).
It is a secondary estimate; its capacity denominator and component scope must
be checked against a chosen installation before empirical use. The 20% facility
share is an illustrative split, not a verified quote. Residual value and idle
power need their own calibration; they are not inferred from that article.

$90/MWh is retained as a rounded electricity-cost scenario. The earlier notes
used [EIA retail averages](https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=table_5_03)
as a broad anchor. Such averages are not an energy-only tariff quote. With zero
separate capacity charge, the headline rate can approximate an all-in bill at a
reference load factor. When entering an actual two-part tariff, replace $90 with
its volumetric component and enter the capacity component separately. Do not
add a capacity charge to an unchanged all-in rate and call that the same tariff.

The construction timeline was motivated by
[JLL's outlook](https://www.jll.com/en-us/insights/market-outlook/data-center-outlook).
Grid waiting time is not automatically a period of full CAPEX spending. We retain
equal spending as a simplification; hardware delivery near operation and phased
commissioning would require a different draw schedule.

## 4. Monthly timing and operating trends

Let C = construction months, N = operating months, H = C+N. Both durations must
be positive whole months. There is no cashflow at month 0. Construction spending
occurs at ends of months 1..C. Operation starts immediately thereafter, with
cash received/paid at ends of months C+1..H. Each month has 365.25*24/12 hours.

For operating month k=1..N, use age t_k=(k-1)/12 years. The first operating
month uses the initial price and throughput; month 13 is one annual step later.
We use beginning-of-month operating levels and end-of-month cash settlement.
There is no erosion/growth during construction: price and throughput are quoted
at the start of operations, not at the investment decision date.

With throughput annual change g and price erosion e:

    T_k = T0 * (1+g)^t_k
    P_k = P0 * (1-e)^t_k
    Q_k = utilization * revenue_fraction * T_k * seconds_per_year / (12 * 1e6)
    R_k = P_k * Q_k

Q_k is millions of output tokens per MW IT per month. g may be positive or
negative (> -100%); e is in [0,100%). Exponential compounding keeps quantities
positive, allows meaningful percentage comparisons, and avoids linear decline
crossing zero. A 20% erosion means multiplying price by 0.8 each year. Offsetting
it requires 25% annual throughput growth, not 20%.

Both rates are scenario parameters. Throughput change holds installed capacity,
active power, workload quality, and utilization fixed. It can represent software
efficiency gains or degraded effective performance; it does not buy new hardware
or model outages (those belong in utilization). Price erosion applies to the
combined workload revenue rate with a fixed workload mix. OPEX and tariffs are
constant nominal dollars; there is no automatic inflation escalator.

## 5. Electricity and other operating costs

Let u = utilization, i = idle fraction, v = volumetric USD/MWh, d = reserved
capacity USD/kW-month, and p = PUE. Per one MW installed IT:

    average_IT_power = u + (1-u)*i                       [MW]
    facility_energy_per_year = p * average_IT_power * hours_per_year [MWh]
    energy_annual_opex = v * facility_energy_per_year
    reserved_facility_capacity = 1000*p                 [kW]
    capacity_annual_opex = 12*d*1000*p
    monthly_operating_cost = (energy_annual_opex + capacity_annual_opex
                              + non_energy_annual_opex) / 12

The capacity charge is on reserved peak facility capacity, independent of
utilization. This is a simple contracted-capacity tariff, not a detailed monthly
metered-demand/ratchet model. No electricity/capacity expense is modeled during
construction. PUE is held constant across load levels. Idle power aggregates
unused-but-powered capacity and downtime; explicit powered-off outages would
need a separate term. These are deliberate toy-model simplifications.

Non-energy OPEX should cover the chosen site's cash expenses (staff, maintenance,
network connectivity, insurance, etc.). Do not include depreciation, amortized
hardware replacement, debt payments, or investor return again in this input.

## 6. Capital, debt, and terminal proceeds

Let A = total CAPEX/MW IT, L = debt fraction, and j = annual nominal debt rate/12.
Each construction month spends A/C; equity contributes (1-L)*A/C. Debt balance:

    B_0 = 0
    B_m = B_(m-1)*(1+j) + L*A/C, for m=1..C

Interest accrues on the previous balance; the current draw is at month end. All
construction interest is financed with additional debt. Consequently L is not
the final debt balance divided by initial CAPEX. There are no financing fees,
interest reserves, debt-service reserves, taxes, or working-capital requirements.

The construction balance converts to a fully amortizing N-month loan:

    D = B_C*j / [1-(1+j)^(-N)]     when j > 0
    D = B_C/N                     when j = 0

D is the monthly payment. The loan has zero remaining principal after the final
payment. Borrowing rate and debt fraction remain fixed, with no refinancing or
automatic credit-risk adjustment.

If f is facility CAPEX fraction and s is terminal facility residual fraction:

    V = A*f*s

V is received once, at month H, as net realizable proceeds after disposition
costs but before taxes (the entire model is pre-tax). It is not annual income,
depreciation, or a reduction in initial CAPEX/debt. No debt repayment is subtracted
again at sale because scheduled amortization has already retired the loan.
The residual fraction is specified **at the chosen horizon**, not an annual
retention rate. When sweeping operating life, holding s fixed is a conditional
comparison; reassess the terminal value for each life in calibrated scenarios.

## 7. Equity NPV, required initial revenue, and IRR

Equity cashflow F_m is:

    -(1-L)*A/C                         m=1..C
    R_k - monthly_operating_cost - D   m=C+k, k=1..N
    plus V                            only at m=H

At effective annual hurdle h, discount month m by w_m=(1+h)^(-m/12).
The nominal debt convention differs intentionally from effective annual equity
returns. To compare identical effective debt/equity rates h, set nominal debt
to 12*((1+h)^(1/12)-1).

Because R_k is linear in P0, solve directly:

    P0 = [sum_construction(equity_contribution*w_m)
          + sum_operations((monthly_operating_cost+D)*w_m) - V*w_H]
         / sum_operations(Q_k * (1-e)^t_k * w_(C+k))

The denominator includes both throughput change and price erosion. Discounting
output alone would solve the wrong initial price when prices change. The code
uses the revenue series at unit initial price as this coefficient, and evaluates
costs and proceeds from the same monthly components used by the cashflow chart.

For conventional negative-then-positive equity cashflows, the solved price
produces IRR h. Price erosion and terminal proceeds can create multiple sign
changes; then IRR may be absent or nonunique. The price solver still solves NPV=0
at h, while `calc_irr` returns NaN for nonconventional cashflows rather than picking
an arbitrary root. The widget should explain that state and show target-rate NPV.

Inputs must be finite, PUE >= 1, active/billable fractions in (0,1], debt fraction
in [0,1), and CAPEX/throughput positive. No-equity cases have no equity IRR and
are excluded. Negative-price solutions (terminal proceeds alone exceed discounted
costs) are outside this solver's domain and raise an error. Numeric overflow also
raises an error; the widget should display an explanation rather than a broken plot.

### Financing interpretation and sensitivities

Use 10%, 15%, and 20% as illustrative equity hurdles; 7%, 8.5%, 10%, and 12%
nominal debt rates; and 50%, 65%, and 80% debt shares. They are not an empirically
established capital stack for merchant inference. The previous notes' sector
return and commercial-property loan comparisons are indirect evidence, not a
basis for claiming 65% leverage or 15% pre-tax IRR is the industry standard.
[Foley's financing discussion](https://www.foley.com/insights/publications/2026/04/financing-the-data-center-boom-trends-structures-and-considerations-for-market-participants/)
ties high leverage to creditworthy tenants and contractual support. A GPU-heavy
merchant service has different risks. Leverage sweeps hold rates fixed and
therefore omit the feedback from leverage to required investor returns.

The gray plot reference uses 100% billable inference and 4% effective debt/equity
returns, with other assumptions held fixed. Label it **low-cost financing
reference**. It is neither a risk-free investment nor a universal token-price
floor, and the illustrative 4% is not a live Treasury quote. For debt-rate or
revenue-share sweeps, preserve those reference overrides after applying the sweep;
the reference should not silently lose its stated definition.

## 8. Widget presentation and remaining calibration

The only energy input initially visible should be **Electricity price
(USD/MWh)**. A collapsed **Further details** section contains PUE, idle-power
fraction, and capacity charge (USD/kW-month). Show enough help to prevent
capacity charges being added twice to an all-in rate. Facility split/residual,
nonbillable allocation, and the two trend rates also belong in further details.
The charts must use initial workload revenue per million output tokens, installed
IT capacity, and separate terminal proceeds from token revenue. The widget is
currently a model module and placeholder page; UI implementation is a later step.

Before drawing empirical conclusions:

1. Assemble a matched open-weight workload/hardware/provider comparison, including
   input/output counts, cache behavior, latency targets, and exact power boundary.
2. Calibrate installed system CAPEX and throughput together. Hardware changes can
   change both; sweeping throughput at fixed CAPEX is a conditional sensitivity.
3. Establish facility value, idle power, non-energy expenses, tariff components,
   and economic life from specific installations or clearly labeled ranges.
4. Compare operating-cost coverage separately from recovery of new investment.
5. Keep frontier lab profitability and future market-price predictions conditional
   on information this infrastructure model does not observe.

## 9. Reproducible checks

Run from the repository root (Python dependencies are isolated by uv):

```sh
uv run --no-project --with numpy --with numpy-financial python docs/blog/ai_datacenter_project_finance/test_model.py
npm --prefix widgets/ai_datacenter_project_finance test
npm --prefix widgets/ai_datacenter_project_finance run build
```

The Python tests generate reference cases in a temporary file and invoke Node
for cross-language comparisons of terms, prices, and every monthly cashflow
component. Node 24+ can execute the TypeScript model directly. Independent checks
cover capital/loan accounting, terminal discounting, annual trend timing, tariff
units, target-rate NPV, historical zero-trend behavior, and invalid inputs.

## 10. Public-data comparison

The first [open-weights comparison](open_weights_comparison.md) uses a saved
GPT-OSS-120B/B200 benchmark sweep, direct provider tariffs, and independent
server/construction evidence. Its plot, evidence JSON, derived CSV, and script
are separate from the generic model defaults. Refer to that document for the
measurement-to-installed-capacity conversion and remaining calibration gaps.

The second [Qwen3.5-397B-A17B comparison](qwen35_comparison.md) uses Alibaba's
February 2026 release, an FP8 four-GPU benchmark, and explicit regional API
tariffs. It reuses the first case's cost scenarios, with two TP4 replicas per
server replacing eight TP1 replicas. Its chunked streaming setting requires
a different interpretation of the latency panel.
