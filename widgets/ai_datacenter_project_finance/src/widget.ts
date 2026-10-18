import { type AiDatacenterFinanceModelAssumptions } from './model';
import { evaluateProject, sweepPrices } from './scenario';
import styles from './styles.css?inline';

import { DEFAULT_HURDLE, MONTE_CARLO, type Control } from './config';
import { MODELS, STREAMING_TARGETS, scenarioPreset } from './presets';
import { marketComparison } from './market';
import { sensitivityAxis } from './presentation';
import uncertainty from './uncertainty.generated.json';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 2 });
const display = (value: number) => Number(value.toPrecision(7)).toString();

/** Self-contained blog embed: owns state, controls, chart lifecycle, and styling.
 * The finance boundary supplies results; this element only converts display units.
 */
class FinanceWidget extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' });
  private preset = scenarioPreset('gpt-oss', 50);
  private assumptions: AiDatacenterFinanceModelAssumptions = { ...this.preset.defaults };
  private get controls() { return this.preset.controls; }
  private activeTab = 'sensitivity';
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
          <header><h2>Explore inference costs</h2><button type="button" id="reset">Reset</button></header>
          <p class="intro">How do assumptions change the initial workload revenue needed to recover investment?</p>
          <div class="preset-controls"><label for="model">Model and hardware<select id="model">${MODELS.map(m => `<option value="${m.id}">${m.label}</option>`).join('')}</select></label><label for="streaming">Minimum benchmark streaming speed<select id="streaming">${STREAMING_TARGETS.map(v => `<option value="${v}" ${v === 50 ? 'selected' : ''}>${v} output tokens/s/request</option>`).join('')}</select></label></div>
          <p id="error" role="alert" hidden></p>
          <div class="workspace"><form aria-label="Project assumptions" novalidate>
            <div id="main-controls">${this.controls.filter(c => !c.advanced).map(c => this.controlMarkup(c)).join('')}</div>
            <details><summary>Additional parameters</summary><div id="advanced-controls">${this.controls.filter(c => c.advanced).map(c => this.controlMarkup(c)).join('')}</div></details>
          </form><div class="charts">
            <div role="tablist" aria-label="Finance views"><button type="button" role="tab" id="tab-sensitivity" aria-controls="panel-sensitivity" aria-selected="true" data-tab="sensitivity">Cost sensitivity</button><button type="button" role="tab" id="tab-cashflow" aria-controls="panel-cashflow" aria-selected="false" tabindex="-1" data-tab="cashflow">Cashflows</button></div>
            <section id="panel-sensitivity" role="tabpanel" aria-labelledby="tab-sensitivity">
              <label class="sweep-label" for="sweep">Vary <select id="sweep">${this.controls.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}</select></label>
              <div id="sensitivity" class="plot" role="img" aria-label="Required initial revenue versus the selected assumption"></div>
              <div class="plot-key" aria-label="Chart key"><span><i class="point-key"></i> Selected values</span><span><i class="line-key"></i> Vary horizontal input</span><span><i class="market-key"></i> Provider prices</span><span><i class="plausible-key"></i> Plausible horizontal range</span><span><i class="band-key"></i> Other inputs: 5th–95th percentiles</span></div><p class="chart-note">Independent plausible-range scenarios; not a confidence interval. Model and speed set the band; sliders move the point and line.</p>
              <p id="market-status" class="chart-note"></p>
              <p id="sweep-note" class="chart-note"></p>
              <details class="data"><summary>View sensitivity values</summary><div class="table-scroll"><table><thead><tr><th id="sweep-heading">Assumption</th><th>Selected sweep<br>USD/MTok</th><th>5th percentile<br>USD/MTok</th><th>95th percentile<br>USD/MTok</th></tr></thead><tbody id="sweep-data"></tbody></table></div></details>
            </section>
            <section id="panel-cashflow" role="tabpanel" aria-labelledby="tab-cashflow" hidden><div id="cashflow" class="plot" role="img" aria-label="Monthly revenue, terminal proceeds, expenses, and net equity cashflow"></div><p class="chart-note">Cashflows use your selected assumptions and the initial revenue that meets the equity hurdle. Construction uses equity contributions; operating costs include debt service. Facility proceeds arrive in the last month.</p>
              <details class="data"><summary>View monthly cashflows</summary><div class="table-scroll"><table><thead><tr><th>Month</th><th>Revenue</th><th>Facility sale</th><th>Equity CAPEX</th><th>Other OPEX</th><th>Energy</th><th>Capacity</th><th>Debt service</th><th>Net</th></tr></thead><tbody id="cashflow-data"></tbody></table></div><p class="chart-note">USD per MW IT per month; expenses are negative.</p></details>
            </section>
          </div></div>
          <details class="method"><summary>Benchmark and modeling assumptions</summary><p id="benchmark-note"></p><div id="market-note"></div>
            <p>Text-only workload: nominal 8,192 input / 1,024 output tokens (sampled lengths). The highest aggregate-throughput saved configuration meeting the speed target and p99 first-response time ≤10 seconds is selected. Streaming speed means reciprocal mean time per output token, not a minimum guaranteed for every request. First response may include hidden reasoning. Qwen's 25 and 50 targets select the same measured configuration.</p>
            <p>Installed capacity: eight B200 GPUs per 15.015 kW IT (14.3 kW server plus 5% ancillary allowance). Throughput samples are uniform from 75–100% of the selected benchmark's aggregate output. This is an assumed deployment/replication allowance, not observed variation. It does not assert a 25% slowdown per request; service quality under replication remains unverified. Edited throughput values explore deviations from the benchmark and do not certify the streaming target.</p>
            <p>Capital cost range: $38.70–50.51 million/MW IT, default $40.83 million, based on the saved server quote and facility scenarios. Other ranges are provisional assumptions. All inputs are sampled independently, even where real-world correlations are likely. ${MONTE_CARLO.samples.toLocaleString()} reproducible PCG32 draws; uniform in displayed units, discrete-uniform whole months, billable inference share fixed at 100% unless it is the horizontal-axis input. The same draws are reused across each curve. The highlighted slider strips show plausible ranges; selections may lie outside them. Changing model or speed resets throughput to its benchmark; other edits remain.</p>
            <p>Revenue includes associated input revenue per million generated output tokens; it is not an output-only API tariff. Aggregate throughput includes prefill and decode over the full serving interval. Price erosion and throughput changes compound annually from operation start. All costs are per MW of installed IT capacity. Taxes and training costs are excluded.</p>
          </details>
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
        this.assumptions = { ...this.preset.defaults }; this.hurdle = DEFAULT_HURDLE;
        this.syncControls(); this.scheduleRender();
      });
      for (const id of ['model', 'streaming']) this.element(id).addEventListener('change', () => this.changePreset());
      this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => {
        button.addEventListener('click', () => this.selectTab(button.dataset.tab!));
        button.addEventListener('keydown', event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 'sensitivity' : event.key === 'End' ? 'cashflow' : this.activeTab === 'sensitivity' ? 'cashflow' : 'sensitivity';
            this.selectTab(next); this.element(`tab-${next}`).focus();
          }
        });
      });
      this.syncControls(); this.updateBenchmarkNote();
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
  private selectTab(tab: string) {
    this.activeTab = tab;
    for (const id of ['sensitivity', 'cashflow']) {
      this.element(`panel-${id}`).hidden = id !== tab;
      const button = this.element(`tab-${id}`);
      button.setAttribute('aria-selected', String(id === tab)); button.tabIndex = id === tab ? 0 : -1;
    }
    this.scheduleRender();
  }
  private changePreset() {
    this.preset = scenarioPreset((this.element('model') as HTMLSelectElement).value, Number((this.element('streaming') as HTMLSelectElement).value));
    this.assumptions.throughput = this.preset.defaults.throughput;
    this.element('main-controls').innerHTML = this.controls.filter(c => !c.advanced).map(c => this.controlMarkup(c)).join('');
    this.element('advanced-controls').innerHTML = this.controls.filter(c => c.advanced).map(c => this.controlMarkup(c)).join('');
    this.syncControls(); this.updateBenchmarkNote(); this.scheduleRender();
  }
  private updateBenchmarkNote() {
    const {model, row} = this.preset;
    const market = marketComparison(model.id);
    this.element('market-note').innerHTML = `<p>Illustrative provider prices via <a href="${market.source}" target="_blank" rel="noopener">OpenRouter (${market.model})</a>, snapshot ${market.retrieved}; not a full market range. Standard uncached text tariffs in USD per million tokens:</p><ul>${market.providers.map(p => `<li>${p.provider} (${p.tag}; ${p.precision}): input ${money.format(p.inputPerMillion)}, output ${money.format(p.outputPerMillion)} → ${money.format(p.workloadRevenue)} per million output tokens including associated input revenue.</li>`).join('')}</ul><p>Comparison assumes 8 uncached input tokens per output token (the nominal benchmark mix): output tariff + 8 × input tariff. Sampled benchmark lengths can differ. Discounts, cache hits, taxes and additional fees are excluded. These routes are not filtered for the selected streaming target; hardware, precision, service performance and provider margins differ. Posted prices do not establish production costs or validate the financial assumptions. References stay fixed when sliders or streaming targets change. Cashflows continue to use the model-required revenue.</p>`;
    this.element('benchmark-note').innerHTML = `${model.description} Selected concurrency: ${row.conc} per replica; measured streaming speed ~${Math.round(1 / row.metrics.mean_tpot)} output tokens/s/request and p99 first response ${row.metrics.p99_ttft.toFixed(1)}s. <a href="${model.source}" target="_blank" rel="noopener">InferenceX source</a>, row ${row.id}.`;
  }
  private controlMarkup(c: Control) {
    const position = (v: number) => 100 * (c.log ? Math.log(v / c.min) / Math.log(c.max / c.min) : (v - c.min) / (c.max - c.min));
    const [lo, hi] = c.plausible;
    return `<div class="control"><label for="${c.key}-number">${c.label}<span>${c.unit}</span></label><input id="${c.key}-number" data-key="${c.key}" type="number" min="${c.min}" max="${c.max}" step="${c.step}" aria-describedby="${c.key}-plausible ${c.help ? `${c.key}-help` : ''}"><div class="slider-track" style="--plausible-start:${position(lo)}%;--plausible-width:${position(hi) - position(lo)}%"><span class="plausible-track" aria-hidden="true"><span class="plausible-marker"></span></span><input aria-label="${c.label} (${c.unit}) slider" aria-describedby="${c.key}-plausible" data-key="${c.key}" type="range" min="${c.log ? Math.log10(c.min) : c.min}" max="${c.log ? Math.log10(c.max) : c.max}" step="${c.log ? .01 : c.step}"></div><small id="${c.key}-plausible" class="plausible-label">Plausible: ${Number(lo.toPrecision(2))}–${Number(hi.toPrecision(2))} ${c.unit}${lo === hi ? ' (fixed in sampling)' : ''}</small>${c.help ? `<small id="${c.key}-help">${c.help}</small>` : ''}</div>`;
  }
  private syncControls() {
    for (const c of this.controls) {
      const value = (c.key === 'equityHurdle' ? this.hurdle : this.assumptions[c.key]) / (c.scale ?? 1);
      for (const input of this.root.querySelectorAll<HTMLInputElement>(`input[data-key="${c.key}"]`)) {
        input.value = input.type === 'number' && c.key === 'throughput' ? Number(value.toPrecision(3)).toString() : display(input.type === 'range' && c.log ? Math.log10(value) : value);
        input.removeAttribute('aria-invalid');
        if (input.type === 'range') input.setAttribute('aria-valuetext', `${display(value)} ${c.unit}`);
      }
    }
  }
  private handleInput(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.key) return;
    const c = this.controls.find(c => c.key === input.dataset.key)!;
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
      if (peer !== input) peer.value = peer.type === 'number' && c.key === 'throughput' ? Number(value.toPrecision(3)).toString() : display(peer.type === 'range' && c.log ? Math.log10(value) : value);
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
    (this.root.querySelector('.charts') as HTMLElement).hidden = true;
  }
  private async render() {
    if (!this.plotly || !this.isConnected || this.root.querySelector('[aria-invalid="true"]')) return;
    try {
      const project = evaluateProject(this.assumptions, this.hurdle);
      const market = marketComparison(this.preset.model.id);
      const prices = market.providers.map(p => p.workloadRevenue);
      const position = project.price < Math.min(...prices) ? 'below' : project.price > Math.max(...prices) ? 'above' : 'within';
      this.element('market-status').textContent = `Selected estimate is ${position} these provider prices (8:1 uncached input/output mix). Sources and qualifications below.`;
      const control = this.controls.find(c => c.key === (this.element('sweep') as HTMLSelectElement).value)!;
      const current = (control.key === 'equityHurdle' ? this.hurdle : this.assumptions[control.key]) / (control.scale ?? 1);
      const data = uncertainty.presets[this.preset.id as keyof typeof uncertainty.presets];
      const all = data.axes[control.key];
      const axis = sensitivityAxis(control, current);
      const bounds = axis.bounds;
      const indices = all.x.map((_, i) => i).filter(i => (all.x[i + 1] ?? all.x[i]) >= bounds[0] && (all.x[i - 1] ?? all.x[i]) <= bounds[1]);
      const band = { x: indices.map(i => all.x[i]), p05: indices.map(i => all.p05[i]), p95: indices.map(i => all.p95[i]) };
      const xs = [...new Set([...band.x, current])].sort((a, b) => a - b);
      const sweep = sweepPrices(this.assumptions, this.hurdle, control.key, xs.map(v => v * (control.scale ?? 1)));
      const tableSweep = sweepPrices(this.assumptions, this.hurdle, control.key, band.x.map(v => v * (control.scale ?? 1)));
      this.element('error').hidden = true;
      this.element('sweep-note').textContent = `${sweep.some(p => p.selected === null) ? 'Gaps indicate no finite nonnegative price meets the return hurdle. ' : ''}${control.key === 'operatingYears' ? 'Facility resale fraction is held fixed across operating lives; reassess it when calibrating a scenario.' : ''}`;
      this.element('sweep-heading').textContent = `${control.label} (${control.unit})`;
      this.element('sweep-data').innerHTML = tableSweep.map((p, i) => `<tr><td>${Number(band.x[i].toPrecision(2))}</td><td>${p.selected === null ? 'Not feasible' : money.format(p.selected)}</td><td>${money.format(band.p05[i])}</td><td>${money.format(band.p95[i])}</td></tr>`).join('');
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
      const common = { autosize: true, paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff', font: { family: 'system-ui, sans-serif', color: '#263640', size: 12 }, margin: { l: 62, r: 12, t: 16, b: 110 }, legend: { orientation: 'h', y: -.27, x: 0, font: { size: 11 } }, hovermode: 'closest' };
      const config = { responsive: true, displayModeBar: false, scrollZoom: false };
      (this.root.querySelector('.charts') as HTMLElement).hidden = false;
      if (this.activeTab === 'sensitivity') await this.plotly.react(this.element('sensitivity'), [
          { x: band.x, y: band.p05, type: 'scatter', mode: 'lines', showlegend: false, line: { color: 'rgba(0,110,156,.3)', width: 1 }, hovertemplate: '%{x:.2g}<br>$%{y:.2g}/MTok<extra>5th percentile</extra>' },
          { x: band.x, y: band.p95, type: 'scatter', mode: 'lines', name: 'Other assumptions: 5th–95th', fill: 'tonexty', fillcolor: 'rgba(0,110,156,.18)', line: { color: 'rgba(0,110,156,.3)', width: 1 }, hovertemplate: '%{x:.2g}<br>$%{y:.2g}/MTok<extra>95th percentile</extra>' },
          { x: xs, y: sweep.map(p => p.selected), type: 'scatter', mode: 'lines', name: 'Vary only horizontal assumption', line: { color: '#006e9c', width: 3 }, hovertemplate: '%{x:.2g}<br>$%{y:.2g}/MTok<extra>Vary only horizontal assumption</extra>' },
          ...market.providers.map((p, i) => ({ x: bounds, y: [p.workloadRevenue, p.workloadRevenue], type: 'scatter', mode: 'lines', name: p.provider, line: { color: ['#a36b21', '#806128', '#b0844d'][i], width: 1.5, dash: 'dash' }, hovertemplate: `$%{y:.2g}/MTok output including input revenue<extra>${p.provider} · ${market.retrieved}</extra>` })),
          { x: [current], y: [project.price], type: 'scatter', mode: 'markers', name: 'Selected values', marker: { color: '#d8592f', size: 11 }, hovertemplate: '%{x:.2g}<br>$%{y:.2g}/MTok<extra>Selected values</extra>' },
        ], { ...common, showlegend: false, margin: { l: 62, r: 12, t: 12, b: 65 }, xaxis: { title: { text: `${control.label}<br>${control.unit}` }, type: axis.type, automargin: true, range: axis.range }, yaxis: { title: { text: 'Initial revenue (USD / MTok output)' }, rangemode: 'tozero', automargin: true }, shapes: [{ type: 'rect', x0: control.plausible[0], x1: control.plausible[1], y0: 0, y1: 1, yref: 'paper', fillcolor: 'rgba(23,135,107,.10)', line: { width: 0 }, layer: 'below' }] }, config);
      else await this.plotly.react(this.element('cashflow'), [
          ...series.map(s => ({ x: c.months.slice(1), y: c[s.key].slice(1).map(v => v / 1e6), type: 'bar', name: s.name, marker: { color: s.color }, hovertemplate: 'Month %{x}<br>$%{y:.2g}m / MW IT<extra>%{fullData.name}</extra>' })),
          { x: c.months.slice(1), y: c.net.slice(1).map(v => v / 1e6), type: 'scatter', mode: 'lines', name: 'Net equity cashflow', line: { color: '#20262c', width: 2 }, hovertemplate: 'Month %{x}<br>$%{y:.2g}m / MW IT<extra>Net equity cashflow</extra>' },
        ], { ...common, barmode: 'relative', bargap: .08, xaxis: { title: { text: 'Month from construction start' } }, yaxis: { title: { text: 'million USD / MW IT / month' }, zeroline: true, zerolinewidth: 2, zerolinecolor: '#555', automargin: true }, shapes: [{ type: 'line', x0: this.assumptions.constructionYears * 12 + .5, x1: this.assumptions.constructionYears * 12 + .5, y0: 0, y1: 1, yref: 'paper', line: { color: '#777', dash: 'dot' } }], annotations: [{ x: this.assumptions.constructionYears * 12 + .5, y: 1, yref: 'paper', text: 'Operations begin', showarrow: false, xanchor: 'left', font: { size: 10 } }] }, config);
    } catch (error) { this.showError(error instanceof Error ? error.message : 'Unable to calculate this scenario.'); }
  }
}
if (!customElements.get('ai-dc-project-finance-widget')) customElements.define('ai-dc-project-finance-widget', FinanceWidget);
