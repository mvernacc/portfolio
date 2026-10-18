import { DEFAULT_ASSUMPTIONS, type AiDatacenterFinanceModelAssumptions } from './model';
import { evaluateProject, sweepPrices } from './scenario';
import styles from './styles.css?inline';

import { CONTROLS, DEFAULT_HURDLE, type Control } from './config';
import uncertainty from './uncertainty.generated.json';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 3 });
const display = (value: number) => Number(value.toPrecision(7)).toString();

/** Self-contained blog embed: owns state, controls, chart lifecycle, and styling.
 * The finance boundary supplies results; this element only converts display units.
 */
class FinanceWidget extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' });
  private assumptions: AiDatacenterFinanceModelAssumptions = { ...DEFAULT_ASSUMPTIONS };
  private hurdle = DEFAULT_HURDLE;
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
              <p class="chart-note">Blue line: vary only the horizontal-axis assumption. Shaded band: central 90% (5th–95th percentiles) of independently sampled scenarios, conditional on each horizontal-axis value. Ranges are provisional assumptions, not measured probabilities or a confidence interval. Moving sliders changes the point, line, and cashflows; the band and hatched reference stay fixed.</p>
              <p class="chart-note">Hatching: below the favorable reference scenario, with zero interest and zero required capital return, and favorable plausible endpoints for other inputs. This is an illustrative scenario, not a proven minimum. Financing axes do not change it. Selected values outside the plausible ranges can fall inside the hatching.</p><details class="data"><summary>Sampling and reference assumptions</summary><p class="chart-note">${uncertainty.metadata.samples.toLocaleString()} reproducible scenarios per axis value. Uniform sampling in the displayed units, except throughput is uniform on a logarithmic scale and durations are uniform over whole months. All inputs are independent; billable share is fixed at 100% unless it is the horizontal-axis parameter. The same draws are reused across each curve. Reference endpoints favor lower costs, shorter construction, longer operation, higher utilization and throughput, and greater facility resale proceeds; longer life is a stipulated favorable endpoint, not always an optimum when prices erode.</p></details><p id="sweep-note" class="chart-note"></p>
              <details class="data"><summary>View sensitivity values</summary><div class="table-scroll"><table><thead><tr><th id="sweep-heading">Assumption</th><th>Selected sweep<br>USD/MTok</th><th>5th percentile<br>USD/MTok</th><th>95th percentile<br>USD/MTok</th><th>Favorable reference<br>USD/MTok</th></tr></thead><tbody id="sweep-data"></tbody></table></div></details>
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
        this.assumptions = { ...DEFAULT_ASSUMPTIONS }; this.hurdle = DEFAULT_HURDLE;
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
    const position = (v: number) => 100 * (c.log ? Math.log(v / c.min) / Math.log(c.max / c.min) : (v - c.min) / (c.max - c.min));
    const [lo, hi] = c.plausible;
    return `<div class="control"><label for="${c.key}-number">${c.label}<span>${c.unit}</span></label><input id="${c.key}-number" data-key="${c.key}" type="number" min="${c.min}" max="${c.max}" step="${c.step}" aria-describedby="${c.key}-plausible ${c.help ? `${c.key}-help` : ''}"><div class="slider-track" style="--plausible-start:${position(lo)}%;--plausible-width:${position(hi) - position(lo)}%"><span class="plausible-track" aria-hidden="true"><span class="plausible-marker"></span></span><input aria-label="${c.label} (${c.unit}) slider" aria-describedby="${c.key}-plausible" data-key="${c.key}" type="range" min="${c.log ? Math.log10(c.min) : c.min}" max="${c.log ? Math.log10(c.max) : c.max}" step="${c.log ? .01 : c.step}"></div><small id="${c.key}-plausible" class="plausible-label">Plausible: ${display(lo)}–${display(hi)} ${c.unit}${lo === hi ? ' (fixed in sampling)' : ''}</small>${c.help ? `<small id="${c.key}-help">${c.help}</small>` : ''}</div>`;
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
      const band = uncertainty.axes[control.key];
      const xs = [...new Set([...band.x, current])].sort((a, b) => a - b);
      const sweep = sweepPrices(this.assumptions, this.hurdle, control.key, xs.map(v => v * (control.scale ?? 1)));
      const tableSweep = sweepPrices(this.assumptions, this.hurdle, control.key, band.x.map(v => v * (control.scale ?? 1)));
      this.element('error').hidden = true;
      this.element('price').textContent = money.format(project.price);
      this.element('accounting').textContent = `Equity NPV at ${display(this.hurdle * 100)}%: ${money.format(Math.abs(project.npv) < .005 ? 0 : project.npv)} / MW IT. ${Number.isFinite(project.irr) ? `Implied annual IRR: ${(project.irr * 100).toFixed(1)}%.` : 'IRR unavailable: cashflow sign changes make it potentially ambiguous.'}`;
      this.element('sweep-note').textContent = `${sweep.some(p => p.selected === null) ? 'Gaps indicate no finite nonnegative price meets the return hurdle. ' : ''}${control.key === 'operatingYears' ? 'Facility resale fraction is held fixed across operating lives; reassess it when calibrating a scenario.' : ''}`;
      this.element('sweep-heading').textContent = `${control.label} (${control.unit})`;
      this.element('sweep-data').innerHTML = tableSweep.map((p, i) => `<tr><td>${display(band.x[i])}</td><td>${p.selected === null ? 'Not feasible' : money.format(p.selected)}</td><td>${money.format(band.p05[i])}</td><td>${money.format(band.p95[i])}</td><td>${money.format(band.reference[i])}</td></tr>`).join('');
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
          { x: band.x, y: band.reference, type: 'scatter', mode: 'lines', name: 'Below favorable reference', fill: 'tozeroy', fillcolor: 'rgba(130,140,150,.07)', fillpattern: { shape: '/', fgcolor: '#8b959d', bgcolor: 'rgba(255,255,255,0)', size: 8, solidity: .15 }, line: { color: '#8b959d', width: 1 }, hovertemplate: '%{x:.3g}<br>$%{y:.3f}/MTok<extra>Favorable reference</extra>' },
          { x: band.x, y: band.p05, type: 'scatter', mode: 'lines', showlegend: false, line: { color: 'rgba(0,110,156,.3)', width: 1 }, hovertemplate: '%{x:.3g}<br>$%{y:.3f}/MTok<extra>5th percentile</extra>' },
          { x: band.x, y: band.p95, type: 'scatter', mode: 'lines', name: 'Other assumptions: 5th–95th percentiles', fill: 'tonexty', fillcolor: 'rgba(0,110,156,.18)', line: { color: 'rgba(0,110,156,.3)', width: 1 }, hovertemplate: '%{x:.3g}<br>$%{y:.3f}/MTok<extra>95th percentile</extra>' },
          { x: xs, y: sweep.map(p => p.selected), type: 'scatter', mode: 'lines', name: 'Vary only horizontal assumption', line: { color: '#006e9c', width: 3 }, hovertemplate: '%{x:.3g}<br>$%{y:.3f}/MTok<extra>Vary only horizontal assumption</extra>' },
          { x: [current], y: [project.price], type: 'scatter', mode: 'markers', name: 'Selected values', marker: { color: '#d8592f', size: 11 }, hovertemplate: '%{x:.3g}<br>$%{y:.3f}/MTok<extra>Selected values</extra>' },
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
