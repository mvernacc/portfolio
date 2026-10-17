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
  low-cost reference's overrides and infeasible points. No DOM or chart types
  cross this boundary.
- `widget.ts` owns display units, bounded controls, state, and the Plotly lifecycle.
  One control definition supplies numeric fields, sliders, and sweep options,
  avoiding repeated units/ranges. The element keeps related UI knowledge together
  instead of introducing one class per control or chart (APOSD §5.5).
- `styles.css` scopes layout and presentation. Container queries make the embed
  respond to the blog column rather than the viewport.

Defaults and equations are documented in the working `notes.md`. The plotted
price is initial **total workload revenue per million output tokens**, including
associated input revenue. No API tariff overlays are shown without matched
workload evidence. The sensitivity reference uses 4% effective annual debt and
equity returns, with all active capacity billable. It is not a universal floor.

Tables expose the same numeric results without relying on chart hover or color.
Invalid inputs hide results until corrected; infeasible sweep points are gaps.
Controls can be operated by keyboard or edited numerically. Reset restores all
assumptions while retaining the reader's selected sweep variable.
