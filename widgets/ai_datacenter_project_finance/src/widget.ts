import { DEFAULT_ASSUMPTIONS, type AiDatacenterFinanceModelAssumptions } from './model';
import { evaluateProject, sweepPrices, type SweepKey } from './scenario';
import styles from './styles.css?inline';

// One definition owns labels, units, valid ranges, and display-to-model conversion.
// Log sliders use exponent positions; numeric fields always show physical units.
interface Control {
  key: SweepKey; label: string; unit: string; min: number; max: number;
  step: number; scale?: number; log?: boolean; advanced?: boolean; help?: string;
}
const CONTROLS: Control[] = [
  { key: 'throughput', label: 'Output throughput', unit: 'MTok/s/MW IT', min: .01, max: 10, step: .01, scale: 1e6, log: true, help: 'Aggregate output across requests, including prefill and decode resources, for a fixed workload.' },
  { key: 'capex', label: 'Total capital cost', unit: 'million USD/MW IT', min: 10, max: 100, step: 1, scale: 1e6 },
  { key: 'utilization', label: 'Utilization', unit: '%', min: 10, max: 100, step: 1, scale: .01 },
  { key: 'energyCostPerMWh', label: 'Electricity price', unit: 'USD/MWh', min: 0, max: 300, step: 1 },
  { key: 'nonEnergyAnnualOpex', label: 'Other annual operating cost', unit: 'million USD/MW IT/year', min: 0, max: 5, step: .1, scale: 1e6 },
  { key: 'constructionYears', label: 'Construction time', unit: 'months', min: 1, max: 60, step: 1, scale: 1 / 12 },
  { key: 'operatingYears', label: 'Operating life', unit: 'months', min: 12, max: 120, step: 1, scale: 1 / 12 },
  { key: 'debtFraction', label: 'Debt share of capital', unit: '%', min: 0, max: 95, step: 1, scale: .01 },
  { key: 'debtInterestRate', label: 'Annual debt interest', unit: '% nominal, monthly compounding', min: 0, max: 20, step: .5, scale: .01 },
  { key: 'equityHurdle', label: 'Equity return hurdle', unit: '% effective annual, pre-tax', min: 0, max: 30, step: .5, scale: .01 },
  { key: 'pue', label: 'Power usage effectiveness', unit: 'facility / IT power', min: 1, max: 2, step: .05, advanced: true },
  { key: 'idlePowerFraction', label: 'Idle IT power', unit: '% of installed IT capacity', min: 0, max: 100, step: 1, scale: .01, advanced: true },
  { key: 'capacityChargePerKWMonth', label: 'Reserved power charge', unit: 'USD/kW facility/month', min: 0, max: 50, step: 1, advanced: true, help: 'Use the volumetric electricity rate above when adding this charge. Do not add it again to an all-in tariff.' },
  { key: 'facilityCapexFraction', label: 'Reusable facility share', unit: '% of total capital', min: 0, max: 100, step: 1, scale: .01, advanced: true },
  { key: 'facilityResidualFraction', label: 'Facility resale value', unit: '% of initial facility cost', min: 0, max: 100, step: 1, scale: .01, advanced: true, help: 'Net proceeds at the end of the selected life. IT equipment has zero resale value.' },
  { key: 'revenueFraction', label: 'Billable share of active capacity', unit: '%', min: 10, max: 100, step: 1, scale: .01, advanced: true },
  { key: 'priceAnnualErosion', label: 'Annual price erosion', unit: '% decline', min: 0, max: 80, step: 1, scale: .01, advanced: true },
  { key: 'throughputAnnualChange', label: 'Annual throughput change', unit: '% change', min: -50, max: 100, step: 1, scale: .01, advanced: true },
];
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 3 });
const display = (value: number) => Number(value.toPrecision(7)).toString();

/** Self-contained blog embed: owns state, controls, chart lifecycle, and styling.
 * The finance boundary supplies results; this element only converts display units.
 */
class FinanceWidget extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' });
  private assumptions: AiDatacenterFinanceModelAssumptions = { ...DEFAULT_ASSUMPTIONS };
  private hurdle = .15;
  private plotly?: typeof import('plotly.js-dist-min')['default'];
  private observer?: ResizeObserver;
  private frame = 0;
  private initialized = false;

  connectedCallback() {
    if (!this.initialized) {
      this.initialized = true;
      this.root.innerHTML = `<style>${styles}</style>
        <section aria-label="Interactive inference cost model">
          <header><div><p class="eyebrow">Explore the assumptions</p><h2>What would inference need to earn?</h2></div><button type="button" id="reset">Reset assumptions</button></header>
          <p class="intro">An illustrative inference-only project, per MW of installed IT capacity. Adjust assumptions to see the initial revenue needed to meet the equity return hurdle.</p>
          <div class="result" role="status" aria-live="polite"><strong id="price">Loading…</strong><span>per million output tokens, including associated input revenue</span><small id="accounting"></small></div>
          <p id="error" role="alert" hidden></p>
          <div class="workspace"><form aria-label="Project assumptions" novalidate>
            ${CONTROLS.filter(c => !c.advanced).map(c => this.controlMarkup(c)).join('')}
            <details><summary>Further details</summary>${CONTROLS.filter(c => c.advanced).map(c => this.controlMarkup(c)).join('')}</details>
          </form><div class="charts">
            <section><h3>Cost versus an assumption</h3><label class="sweep-label" for="sweep">Vary <select id="sweep">${CONTROLS.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}</select></label>
              <div id="sensitivity" class="plot" role="img" aria-label="Required initial revenue versus the selected assumption"></div>
              <p class="chart-note">All other assumptions held fixed. Gray: low-cost financing reference, with 4% effective annual debt and equity returns and 100% billable inference. This is a conditional scenario, not a universal price floor.</p>
              <p id="sweep-note" class="chart-note"></p>
              <details class="data"><summary>View sensitivity values</summary><div class="table-scroll"><table><thead><tr><th id="sweep-heading">Assumption</th><th>Selected financing<br>USD/MTok</th><th>Low-cost reference<br>USD/MTok</th></tr></thead><tbody id="sweep-data"></tbody></table></div></details>
            </section>
            <section><h3>Monthly equity cashflows</h3><div id="cashflow" class="plot" role="img" aria-label="Monthly revenue, terminal proceeds, expenses, and net equity cashflow"></div><p class="chart-note">Construction uses equity contributions; debt draws are excluded. During operation, costs include debt service. Facility sale proceeds arrive in the last month. Values are per MW of installed IT capacity.</p>
              <details class="data"><summary>View monthly cashflows</summary><div class="table-scroll"><table><thead><tr><th>Month</th><th>Revenue</th><th>Facility sale</th><th>Equity CAPEX</th><th>Other OPEX</th><th>Energy</th><th>Capacity</th><th>Debt service</th><th>Net</th></tr></thead><tbody id="cashflow-data"></tbody></table></div><p class="chart-note">USD per MW IT per month; expenses are negative.</p></details>
            </section>
          </div></div>
          <p class="footnote">Throughput counts aggregate generated tokens over the whole serving interval, including input processing (prefill). It is not per-user streaming speed. The result is total workload revenue divided by output tokens, not an output-only API tariff. Price erosion and throughput change compound annually from the start of operations. Taxes and training costs are excluded.</p>
        </section>`;
      this.root.querySelector('form')!.addEventListener('submit', event => event.preventDefault());
      this.root.addEventListener('input', event => this.handleInput(event));
      this.root.addEventListener('focusout', event => {
        const input = event.target;
        if (input instanceof HTMLInputElement && input.type === 'number' &&
            (input.dataset.key === 'constructionYears' || input.dataset.key === 'operatingYears') &&
            !input.hasAttribute('aria-invalid')) {
          input.value = display(this.assumptions[input.dataset.key] * 12);
        }
      });
      this.root.querySelector('#sweep')!.addEventListener('change', () => this.scheduleRender());
      this.root.querySelector('#reset')!.addEventListener('click', () => {
        this.assumptions = { ...DEFAULT_ASSUMPTIONS }; this.hurdle = .15;
        this.syncControls(); this.scheduleRender();
      });
      this.syncControls();
    }
    this.observer = new ResizeObserver(() => {
      if (this.plotly) for (const id of ['sensitivity', 'cashflow']) void this.plotly.Plots.resize(this.element(id)).catch(() => {});
    });
    this.observer.observe(this);
    void this.loadCharts();
  }
  disconnectedCallback() {
    this.observer?.disconnect(); cancelAnimationFrame(this.frame);
    if (this.plotly) for (const id of ['sensitivity', 'cashflow']) this.plotly.purge(this.element(id));
  }
  private element(id: string) { return this.root.getElementById(id)!; }
  private controlMarkup(c: Control) {
    return `<div class="control"><label for="${c.key}-number">${c.label}<span>${c.unit}</span></label><input id="${c.key}-number" data-key="${c.key}" type="number" min="${c.min}" max="${c.max}" step="${c.step}" ${c.help ? `aria-describedby="${c.key}-help"` : ''}><input aria-label="${c.label} (${c.unit}) slider" data-key="${c.key}" type="range" min="${c.log ? Math.log10(c.min) : c.min}" max="${c.log ? Math.log10(c.max) : c.max}" step="${c.log ? .01 : c.step}">${c.help ? `<small id="${c.key}-help">${c.help}</small>` : ''}</div>`;
  }
  private syncControls() {
    for (const c of CONTROLS) {
      const value = (c.key === 'equityHurdle' ? this.hurdle : this.assumptions[c.key]) / (c.scale ?? 1);
      for (const input of this.root.querySelectorAll<HTMLInputElement>(`input[data-key="${c.key}"]`)) {
        input.value = display(input.type === 'range' && c.log ? Math.log10(value) : value);
        input.removeAttribute('aria-invalid');
        if (input.type === 'range') input.setAttribute('aria-valuetext', `${display(value)} ${c.unit}`);
      }
    }
  }
  private handleInput(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.key) return;
    const c = CONTROLS.find(c => c.key === input.dataset.key)!;
    let value = input.valueAsNumber;
    if (input.type === 'range' && c.log) value = 10 ** value;
    // Keep partially typed numbers intact, but never plot stale results as current.
    if (!Number.isFinite(value) || value < c.min || value > c.max) {
      input.setAttribute('aria-invalid', 'true');
      this.showError(`${c.label} must be between ${c.min} and ${c.max} ${c.unit}.`); return;
    }
    if (c.key === 'constructionYears' || c.key === 'operatingYears') value = Math.round(value);
    if (c.key === 'equityHurdle') this.hurdle = value * (c.scale ?? 1);
    else this.assumptions[c.key] = value * (c.scale ?? 1);
    input.removeAttribute('aria-invalid');
    for (const peer of this.root.querySelectorAll<HTMLInputElement>(`input[data-key="${c.key}"]`)) {
      if (peer !== input) peer.value = display(peer.type === 'range' && c.log ? Math.log10(value) : value);
      if (peer.type === 'range') peer.setAttribute('aria-valuetext', `${display(value)} ${c.unit}`);
    }
    this.scheduleRender();
  }
  private async loadCharts() {
    try {
      this.plotly = (await import('plotly.js-dist-min')).default;
      if (this.isConnected) this.scheduleRender();
    } catch { this.showError('The charts could not load. Reload the page to try again.'); }
  }
  private scheduleRender() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => { void this.render(); });
  }
  private showError(message: string) {
    this.element('error').textContent = message; this.element('error').hidden = false;
    this.element('price').textContent = 'Check assumptions'; this.element('accounting').textContent = '';
    (this.root.querySelector('.charts') as HTMLElement).hidden = true;
  }
  private async render() {
    if (!this.plotly || !this.isConnected || this.root.querySelector('[aria-invalid="true"]')) return;
    try {
      const project = evaluateProject(this.assumptions, this.hurdle);
      const control = CONTROLS.find(c => c.key === (this.element('sweep') as HTMLSelectElement).value)!;
      const current = (control.key === 'equityHurdle' ? this.hurdle : this.assumptions[control.key]) / (control.scale ?? 1);
      const values = Array.from({ length: 61 }, (_, i) => {
        const value = control.log ? control.min * (control.max / control.min) ** (i / 60) : control.min + (control.max - control.min) * i / 60;
        return control.key === 'constructionYears' || control.key === 'operatingYears' ? Math.round(value) : value;
      });
      values.push(current);
      const xs = [...new Set(values)].sort((a, b) => a - b);
      const sweep = sweepPrices(this.assumptions, this.hurdle, control.key, xs.map(v => v * (control.scale ?? 1)));
      this.element('error').hidden = true;
      this.element('price').textContent = money.format(project.price);
      this.element('accounting').textContent = `Equity NPV at ${display(this.hurdle * 100)}%: ${money.format(Math.abs(project.npv) < .005 ? 0 : project.npv)} / MW IT. ${Number.isFinite(project.irr) ? `Implied annual IRR: ${(project.irr * 100).toFixed(1)}%.` : 'IRR unavailable: cashflow sign changes make it potentially ambiguous.'}`;
      this.element('sweep-note').textContent = `${sweep.some(p => p.selected === null || p.reference === null) ? 'Gaps indicate no finite nonnegative price meets the return hurdle. ' : ''}${control.key === 'operatingYears' ? 'Facility resale fraction is held fixed across operating lives; reassess it when calibrating a scenario.' : ''}`;
      this.element('sweep-heading').textContent = `${control.label} (${control.unit})`;
      this.element('sweep-data').innerHTML = sweep.map((p, i) => `<tr><td>${display(xs[i])}</td><td>${p.selected === null ? 'Not feasible' : money.format(p.selected)}</td><td>${p.reference === null ? 'Not feasible' : money.format(p.reference)}</td></tr>`).join('');
      const c = project.cashflows;
      const series = [
        { key: 'revenue', name: 'Token revenue', color: '#17876b' },
        { key: 'terminalValue', name: 'Facility sale', color: '#95c9a6' },
        { key: 'equityConstructionCapex', name: 'Equity CAPEX', color: '#5b568f' },
        { key: 'nonEnergyOpex', name: 'Other OPEX', color: '#c58639' },
        { key: 'energyOpex', name: 'Electricity', color: '#dbb55e' },
        { key: 'capacityOpex', name: 'Power capacity', color: '#a76c52' },
        { key: 'debtService', name: 'Debt service', color: '#6389b2' },
      ] as const;
      this.element('cashflow-data').innerHTML = c.months.slice(1).map(month => `<tr><td>${month}</td>${[...series.map(s => c[s.key][month]), c.net[month]].map(v => `<td>${money.format(v)}</td>`).join('')}</tr>`).join('');
      const common = { autosize: true, paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff', font: { family: 'system-ui, sans-serif', color: '#263640', size: 12 }, margin: { l: 65, r: 18, t: 20, b: 115 }, legend: { orientation: 'h', y: -.27, x: 0, font: { size: 11 } }, hovermode: 'closest' };
      const config = { responsive: true, displayModeBar: false, scrollZoom: false };
      (this.root.querySelector('.charts') as HTMLElement).hidden = false;
      await Promise.all([
        this.plotly.react(this.element('sensitivity'), [
          { x: xs, y: sweep.map(p => p.reference), type: 'scatter', mode: 'lines', name: 'Low-cost financing', fill: 'tozeroy', fillcolor: 'rgba(130,140,150,.16)', line: { color: '#8b959d', width: 2 }, hovertemplate: '%{x:.3g}<br>$%{y:.3f}/MTok<extra>Low-cost financing</extra>' },
          { x: xs, y: sweep.map(p => p.selected), type: 'scatter', mode: 'lines', name: 'Selected assumptions', line: { color: '#006e9c', width: 3 }, hovertemplate: '%{x:.3g}<br>$%{y:.3f}/MTok<extra>Selected assumptions</extra>' },
          { x: [current], y: [project.price], type: 'scatter', mode: 'markers', name: 'Current value', marker: { color: '#d8592f', size: 11 }, hovertemplate: '%{x:.3g}<br>$%{y:.3f}/MTok<extra>Current value</extra>' },
        ], { ...common, xaxis: { title: { text: `${control.label}<br>${control.unit}` }, type: control.log ? 'log' : 'linear', automargin: true }, yaxis: { title: { text: 'Initial revenue (USD / MTok output)' }, rangemode: 'tozero', automargin: true } }, config),
        this.plotly.react(this.element('cashflow'), [
          ...series.map(s => ({ x: c.months.slice(1), y: c[s.key].slice(1).map(v => v / 1e6), type: 'bar', name: s.name, marker: { color: s.color }, hovertemplate: 'Month %{x}<br>$%{y:.3f}m / MW IT<extra>%{fullData.name}</extra>' })),
          { x: c.months.slice(1), y: c.net.slice(1).map(v => v / 1e6), type: 'scatter', mode: 'lines', name: 'Net equity cashflow', line: { color: '#20262c', width: 2 }, hovertemplate: 'Month %{x}<br>$%{y:.3f}m / MW IT<extra>Net equity cashflow</extra>' },
        ], { ...common, barmode: 'relative', bargap: .08, xaxis: { title: { text: 'Month from construction start' } }, yaxis: { title: { text: 'million USD / MW IT / month' }, zeroline: true, zerolinewidth: 2, zerolinecolor: '#555', automargin: true }, shapes: [{ type: 'line', x0: this.assumptions.constructionYears * 12 + .5, x1: this.assumptions.constructionYears * 12 + .5, y0: 0, y1: 1, yref: 'paper', line: { color: '#777', dash: 'dot' } }], annotations: [{ x: this.assumptions.constructionYears * 12 + .5, y: 1, yref: 'paper', text: 'Operations begin', showarrow: false, xanchor: 'left', font: { size: 10 } }] }, config),
      ]);
    } catch (error) { this.showError(error instanceof Error ? error.message : 'Unable to calculate this scenario.'); }
  }
}
if (!customElements.get('ai-dc-project-finance-widget')) customElements.define('ai-dc-project-finance-widget', FinanceWidget);
