# Interactive Plot Widget Design Plan

Use a framework-free custom Web Component written in TypeScript, bundled by Vite, and rendered with Plotly.js. The widget should port the existing Python toy model into a small pure TypeScript model module, then expose the assumptions through form controls and redraw two Plotly charts whenever an assumption changes.

## Resolved Questions

- Should the Node/Vite project live at the repo root, or should it be a self-contained widget package?
  - In a self-contained package under `widgets/ai_datacenter_project_finance/` so the current Zensical setup remains uncluttered.
- Should Plotly load on every page or only when this widget is present?
  - Lazy loading, only on the page where this widget is used. Because Plotly is large, the widget will only be used
  on a single page, and we don't want to make the other pages slower to load.
- Should the TypeScript model be manually ported from Python, or generated from a shared source?
  - Manual port plus tests against Python-generated reference outputs.

## Tool Choice

- TypeScript for all widget source code.
- Vite for local development and bundling. Vite's library build mode is designed for browser-oriented libraries, and Zensical can load module scripts through `extra_javascript`.
- Plotly.js via npm, preferably `plotly.js-dist-min` unless custom bundle size becomes a problem.
- Native Web Components instead of React/Vue/Svelte/Lit. The UI is small, and a custom element embeds cleanly in Markdown as `<ai-dc-project-finance-widget></ai-dc-project-finance-widget>`.
- No backend or Python-in-the-browser runtime. The finance equations are simple enough to port directly.

References:

- Zensical supports additional JavaScript files and module script configuration: <https://zensical.org/docs/customization/#additional-javascript>
- Vite supports library builds with `build.lib`: <https://vite.dev/guide/build#library-mode>
- Plotly.js supports npm installation through `plotly.js-dist`: <https://plotly.com/javascript/getting-started/#npm>

## Proposed Files

- `widgets/ai_datacenter_project_finance/package.json`: npm scripts and widget dependencies.
- `widgets/ai_datacenter_project_finance/tsconfig.json`: strict TypeScript configuration.
- `widgets/ai_datacenter_project_finance/vite.config.ts`: builds the widget module into `docs/javascripts/ai_datacenter_project_finance_widget/`.
- `widgets/ai_datacenter_project_finance/index.html`: local demo page for Vite dev.
- `widgets/ai_datacenter_project_finance/src/model.ts`: TypeScript port of `AiDatacenterFinanceModelAssumptions`, `calc_project_finance_terms`, and `calc_price_per_Mtok_for_target_irr`.
- `widgets/ai_datacenter_project_finance/src/widget.ts`: custom element, controls, state management, and Plotly rendering.
- `widgets/ai_datacenter_project_finance/src/styles.css`: scoped widget styling.
- `docs/javascripts/ai_datacenter_project_finance_widget/`: built JavaScript and CSS assets committed for Zensical/GitHub Pages.
- `zensical.toml`: add the built module to `extra_javascript` with `type = "module"`.
- `docs/blog/ai_datacenter_project_finance.md`: include the custom element where the interactive plot should appear.

## Widget Behavior

The widget contains assumption sliders, a cashflow plot, and a price-vs-assumption-sweep plot.

Layout: Assumption sliders on the left, cashflow plot on the top right, sweep plot on the bottom right.

### Assumption sliders

- Follow `notes.md` for the model definition and provisional defaults. Use installed IT capacity consistently.
- Main controls: total CAPEX, initial workload throughput, utilization, non-energy annual OPEX, electricity price (USD/MWh), construction/operating years, debt fraction/rate, and pre-tax equity hurdle.
- A collapsed native `<details>` with summary **Further details** contains PUE, idle-power fraction, and reserved capacity charge (USD/kW-month). Electricity price is the only initially visible energy control. Help text must distinguish volumetric from all-in tariffs to prevent double counting capacity charges.
- Put facility CAPEX share, terminal facility residual fraction, revenue fraction (default 100% inference-only), annual price erosion, and annual throughput change in Further details too. Both trend defaults are zero; throughput change can be positive or negative.
- Use logarithmic controls for positive values spanning orders of magnitude. Allow exact zero for OPEX and other nonnegative costs.
- Snap durations to whole months. Bound fractions/rates to the model's valid domains; exclude 100% debt.
- Explain that throughput includes prefill and decode for a fixed workload, while the displayed price includes the input revenue associated with each output token. API comparison inputs must describe that same workload.

### Cashflow plot

- Use signed stacked monthly cashflow bars at the required price for the selected target IRR, plus a net cashflow line.
- Plot revenue as positive/upward bars and expenses as negative/downward bars. Use Plotly's `barmode: "relative"` so positive and negative components stack naturally away from zero.
- Suggested bar categories:
  - Positive: token revenue and a separate terminal facility proceeds series.
  - Negative: equity-funded construction CAPEX, non-energy OPEX, volumetric energy OPEX, capacity charges, and debt service.
- Overlay a black line with markers for net equity cashflow on the same y-axis. Keep the same axis unless readability becomes poor, because the shared axis makes the accounting relationship clear.
- Add a strong horizontal zero line and a vertical marker at commercial operation date to separate construction from operations.
- Use `USD / MW installed IT / month` for the y-axis and month number for the x-axis.
- Do not show debt draws as positive cashflow. In this model the plot should show equity cashflows: equity contributions during construction, then revenue, operating expenses, and debt service during operations.
- Consider a cumulative undiscounted equity cashflow line only as a later optional addition. The main chart should stay focused on monthly component cashflows and net monthly cashflow.

### Sweep plot

- Show a dropdown for the sweep variable. Initial options should include `throughput`, `energy_cost_per_MWh`, `construction_years`, `capex`, `debt_interest_rate`, `debt_fraction`, `revenue_fraction`, and `operating_years`.
- Plot required initial workload revenue per million output tokens (`price_per_MTok`) versus the selected sweep variable, holding all other slider assumptions fixed. Highlight the current slider value on the sweep curve.
- Gray-fill a **Low-cost financing reference** using 4% effective annual debt/equity returns and 100% billable inference. Convert effective debt return to nominal annual monthly-compounded rate. Apply these overrides after the sweep value so debt-rate and revenue-share sweeps preserve the reference definition. This is a conditional scenario, not a universal price floor.
- With trends, use actual changing monthly revenue. Show NPV at the selected hurdle; report IRR as unavailable/ambiguous when cashflows are nonconventional. Catch invalid-input/numeric errors and explain them inline.
- Optionally overlay the dated API price examples as horizontal reference lines, but keep them easy to update because public prices change.

## Implementation Plan

[x] Add the self-contained Vite/TypeScript widget package under `widgets/ai_datacenter_project_finance/`.
[x] Port the Python finance equations to `src/model.ts`, using a closed-form loan payment function instead of `numpy_financial`.
[x] Add accounting tests and 40 live Python/TypeScript reference comparisons, including each monthly component.
[ ] Build the custom element with native controls, accessible labels, responsive layout, and Plotly resize handling.
[ ] Implement lazy Plotly import inside the custom element so non-widget pages do not load Plotly.
[x] Configure Vite to emit built assets into `docs/javascripts/ai_datacenter_project_finance_widget/`.
[ ] Register the built module in `zensical.toml` as an `extra_javascript` module.
[ ] Insert `<ai-dc-project-finance-widget></ai-dc-project-finance-widget>` into `docs/blog/ai_datacenter_project_finance.md`.
[x] Validate the model build with `npm --prefix widgets/ai_datacenter_project_finance run build`.
[ ] Validate the integrated widget with `uv run zensical serve`.
[ ] Check the widget manually at desktop and mobile widths, including dropdown changes, extreme slider values, and plot resizing.

## Risks And Decisions

- Bundle size: Plotly is the largest dependency. Lazy loading keeps the global site impact small; a custom Plotly bundle can be a later optimization if needed.
- Model drift: A manual TypeScript port can diverge from the Python educational model. Reference tests should pin default assumptions and several sensitivity cases.
- Zensical navigation: current config does not enable instant navigation, but the Web Component approach should still work if it is enabled later because newly inserted custom elements upgrade automatically.
- Numeric edge cases: zero interest, zero/near-zero billable output, and invalid monthly durations should be explicitly handled in the TypeScript model.
- Publish workflow: built widget assets should be committed unless the GitHub Pages workflow is updated to run the npm build before `zensical build`.
