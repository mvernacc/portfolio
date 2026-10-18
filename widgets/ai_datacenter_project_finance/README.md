# Inference project finance widget

A native `<ai-dc-project-finance-widget>` element. The blog loads its small entry
module globally; Plotly loads only when an element is connected. Styles live in
its shadow root. Built assets under `docs/javascripts/ai_datacenter_project_finance_widget`
are committed because site deployment does not run npm.

From the repository root (Node 24 or later for direct TypeScript tests):

```sh
npm --prefix widgets/ai_datacenter_project_finance ci
npm --prefix widgets/ai_datacenter_project_finance test
npm --prefix widgets/ai_datacenter_project_finance run build
uv run --no-project --with numpy --with numpy-financial python -m docs.blog.ai_datacenter_project_finance.work_in_progress.test_model
uv run zensical serve
```

For standalone UI development, use `npm --prefix widgets/ai_datacenter_project_finance run dev`.

## Design

Two designs were considered: a single element directly constructing financial
comparisons and charts, or a pure financial scenario boundary plus a rendering
element. The latter keeps financing conventions out of UI code. This follows
Ousterhout's deep modules and information hiding (APOSD §§4.3–4.4, 5.1–5.2),
with alternatives considered before implementation (chapter 11).

- `model.ts` owns monthly accounting, validation, and the required-price solver.
  The Python prototype remains the reference, checked by cross-language parity.
- `scenario.ts` evaluates the project and assumption sweeps, including the
  favorable reference calculation and infeasible points. No DOM or chart types
  cross this boundary.
- `widget.ts` owns display units, bounded controls, state, and the Plotly lifecycle.
  Shared configuration supplies numeric fields, sliders, and sweep options,
  avoiding repeated units/ranges. The element keeps related UI knowledge together
  instead of introducing one class per control or chart (APOSD §5.5).
- `styles.css` scopes layout and presentation. Container queries make the embed
  respond to the blog column rather than the viewport.

Defaults and equations are documented in the working `notes.md`. The plotted
price is initial **total workload revenue per million output tokens**, including
associated input revenue. No API tariff overlays are shown without matched
workload evidence. The sensitivity reference assumes zero financing costs and favorable plausible
endpoints. It is an illustrative scenario, not a universal floor.

Tables expose the same numeric results without relying on chart hover or color.
Invalid inputs hide results until corrected; infeasible sweep points are gaps.
Controls can be operated by keyboard or edited numerically. Reset restores all
assumptions while retaining the reader's selected sweep variable.

## Scenario uncertainty

`config.ts` owns hard slider limits, provisional plausible ranges, defaults,
unit conversion, slider scale, sampling scale, and favorable endpoint choices.
Ranges are illustrative working assumptions, **not empirically calibrated probability
bounds**. The configuration intentionally distinguishes a log slider from log sampling.
Throughput is log-uniform (equal probability per multiplicative interval); other
continuous inputs are uniform in displayed units. Durations are discrete-uniform
whole months, and billable inference share is fixed at 100% in sampling unless
it is the horizontal-axis parameter. All inputs
are sampled independently, including inputs that could be correlated in reality.

`uncertainty.ts` fixes each horizontal-axis value and varies every other input.
It reuses 2,048 sampled scenarios across x, calculates interpolated 5th and 95th
percentiles, and fails generation if any scenario is invalid instead of dropping
samples. The central 90% of stipulated scenarios is not a confidence interval.
PCG32 XSH RR in `random.ts` uses 64-bit BigInt state; seed 42 and sequence 54 match
the [official reference](https://www.pcg-random.org/using-pcg-c-basic.html).

`npm run build` regenerates `src/uncertainty.generated.json` before bundling. Tests
check its configuration fingerprint. No sampling is performed while dragging
sliders: the point, selected-input sweep, and cashflows update; changing the axis
chooses another precomputed conditional band. Selected inputs may lie outside the
plausible ranges. The values table uses exactly the precomputed axis grid.

The hatched region is **below the favorable reference scenario**, not below a
proven minimum or profitability threshold. It assumes 100% debt at 0% interest
with no required return on capital. The calculation is initial CAPEX plus total
operating expenses less terminal proceeds, divided by total billable output
weighted by the price-erosion factor. No equity IRR is calculated. All other inputs
use their documented favorable plausible endpoint, except the horizontal variable
is fixed at x. Debt share, debt rate and equity hurdle are always overridden, so
the reference is flat on those axes. Shorter construction is immaterial at zero
financing cost; longer operating life is a convention, not a claim of monotonicity
when prices erode. All curves measure required **initial workload revenue per
million output tokens**, including associated input revenue.

This separates statistical and financial policy from chart rendering (APOSD
chapters 4–5). The browser and build share configuration and the same monthly model,
rather than maintaining separate precomputation formulas for ordinary financing.
