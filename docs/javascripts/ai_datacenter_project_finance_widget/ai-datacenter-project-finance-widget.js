const M = {
  capex: 5e7,
  facilityCapexFraction: 0.2,
  facilityResidualFraction: 0.5,
  throughputAnnualChange: 0,
  priceAnnualErosion: 0,
  idlePowerFraction: 0.2,
  capacityChargePerKWMonth: 0,
  throughput: 1e5,
  pue: 1.2,
  utilization: 0.9,
  revenueFraction: 1,
  nonEnergyAnnualOpex: 1e6,
  energyCostPerMWh: 90,
  constructionYears: 2,
  operatingYears: 5,
  debtFraction: 0.65,
  debtInterestRate: 0.085
};
function w(n) {
  if (!Number.isFinite(n)) throw new Error("Duration must be finite.");
  const e = 12 * n, t = Math.round(e);
  if (!P(e, t))
    throw new Error(
      `Duration must be an integer number of months, got ${n} years.`
    );
  return t;
}
function $(n) {
  S(n);
  const e = (n.utilization + (1 - n.utilization) * n.idlePowerFraction) * n.pue * n.energyCostPerMWh * 8766, t = 1e3 * n.pue * n.capacityChargePerKWMonth * 12, r = n.capex * n.facilityCapexFraction * n.facilityResidualFraction, i = w(n.constructionYears), o = w(n.operatingYears), a = i + o, l = a, p = n.debtInterestRate / 12, d = n.capex / i, h = (1 - n.debtFraction) * d, s = n.debtFraction * d;
  let u = 0;
  for (let g = 0; g < i; g += 1)
    u *= 1 + p, u += s;
  const c = F(
    p,
    o,
    u
  ), y = n.utilization * n.throughput * 31557600, v = n.revenueFraction * y * 1e-6;
  return {
    energyAnnualOpex: e,
    capacityAnnualOpex: t,
    terminalFacilityValue: r,
    equityMonthlyConstructionCapex: h,
    debtBalanceAtOperationsStart: u,
    termLoanMonthlyPayment: c,
    constructionMonths: i,
    projectDurationMonths: a,
    cashflowDurationMonths: l,
    billableOutputAnnual: v
  };
}
function R(n, e) {
  const t = k(n, e);
  return (1 + T(t.net)) ** 12 - 1;
}
function E(n, e) {
  if (!Number.isFinite(e) || e <= -1)
    throw new Error("Annual IRR target must be finite and greater than -100%.");
  const t = k(n, 1);
  let r = 0, i = 0;
  for (const a of t.months) {
    const l = (1 + e) ** (-a / 12);
    r -= (t.equityConstructionCapex[a] + t.nonEnergyOpex[a] + t.energyOpex[a] + t.capacityOpex[a] + t.debtService[a] + t.terminalValue[a]) * l, i += t.revenue[a] * l;
  }
  if (!Number.isFinite(r) || !Number.isFinite(i) || i <= 0)
    throw new Error("Discounted cashflows exceed numerical range.");
  const o = r / i;
  if (!Number.isFinite(o) || o < 0)
    throw new Error(
      "No finite nonnegative price achieves exactly the target NPV."
    );
  return o;
}
function k(n, e) {
  const t = $(n);
  if (!Number.isFinite(e) || e < 0)
    throw new Error("Initial price must be finite and nonnegative.");
  const r = O(0, t.cashflowDurationMonths), i = new Array(r.length).fill(0), o = new Array(r.length).fill(0), a = new Array(r.length).fill(0), l = new Array(r.length).fill(0), p = new Array(r.length).fill(0), d = new Array(r.length).fill(0);
  d[t.projectDurationMonths] = t.terminalFacilityValue;
  const h = new Array(r.length).fill(0), s = new Array(r.length).fill(0);
  for (const c of r) {
    const y = c > 0 && c <= t.constructionMonths, v = c > t.constructionMonths && c <= t.projectDurationMonths;
    if (y && (o[c] = -t.equityMonthlyConstructionCapex), v) {
      const g = (c - t.constructionMonths - 1) / 12, A = t.billableOutputAnnual / 12 * (1 + n.throughputAnnualChange) ** g, C = e * (1 - n.priceAnnualErosion) ** g;
      i[c] = A * C, p[c] = -t.capacityAnnualOpex / 12, a[c] = -n.nonEnergyAnnualOpex / 12, l[c] = -t.energyAnnualOpex / 12, h[c] = -t.termLoanMonthlyPayment;
    }
    s[c] = i[c] + o[c] + a[c] + l[c] + h[c] + p[c] + d[c];
  }
  if ([
    i,
    o,
    a,
    l,
    p,
    h,
    d,
    s
  ].some((c) => c.some((y) => !Number.isFinite(y))))
    throw new Error(
      "Cashflows exceed numerical range; reduce rates or horizon."
    );
  return {
    months: r,
    revenue: i,
    equityConstructionCapex: o,
    nonEnergyOpex: a,
    energyOpex: l,
    capacityOpex: p,
    terminalValue: d,
    debtService: h,
    net: s
  };
}
function F(n, e, t) {
  if (e <= 0)
    throw new Error("Loan payment count must be positive.");
  return n === 0 ? t / e : n * t / -Math.expm1(-e * Math.log1p(n));
}
function S(n) {
  if (Object.values(n).some((e) => !Number.isFinite(e)))
    throw new Error("All assumptions must be finite.");
  for (const e of [
    "capex",
    "throughput",
    "constructionYears",
    "operatingYears"
  ])
    if (n[e] <= 0) throw new Error(`${e} must be positive.`);
  for (const e of [
    "facilityCapexFraction",
    "facilityResidualFraction",
    "idlePowerFraction"
  ])
    if (n[e] < 0 || n[e] > 1)
      throw new Error(`${e} must be between 0 and 1.`);
  for (const e of ["utilization", "revenueFraction"])
    if (n[e] <= 0 || n[e] > 1)
      throw new Error(`${e} must be greater than 0 and at most 1.`);
  for (const e of ["debtFraction", "priceAnnualErosion"])
    if (n[e] < 0 || n[e] >= 1)
      throw new Error(`${e} must be at least 0 and less than 1.`);
  for (const e of [
    "nonEnergyAnnualOpex",
    "energyCostPerMWh",
    "capacityChargePerKWMonth",
    "debtInterestRate"
  ])
    if (n[e] < 0) throw new Error(`${e} must be nonnegative.`);
  if (n.pue < 1 || n.throughputAnnualChange <= -1)
    throw new Error(
      "PUE must be >= 1 and throughput annual change must be > -1."
    );
  for (const e of [n.constructionYears, n.operatingYears])
    if (w(e) < 1)
      throw new Error("Each duration must be at least one whole month.");
}
function T(n) {
  const e = n.reduce((a, l) => Math.max(a, Math.abs(l)), 0), t = n.filter((a) => Math.abs(a) > e * 1e-12);
  let r = 0;
  for (let a = 1; a < t.length; a++)
    Math.sign(t[a]) !== Math.sign(t[a - 1]) && r++;
  if (t.length < 2 || t[0] >= 0 || r !== 1)
    return Number.NaN;
  let i = -0.999999, o = 1;
  for (; x(n, o) > 0 && o < 1e6; ) o *= 2;
  if (!(x(n, i) > 0) || !(x(n, o) < 0))
    return Number.NaN;
  for (let a = 0; a < 100; a++) {
    const l = (i + o) / 2;
    x(n, l) > 0 ? i = l : o = l;
  }
  return (i + o) / 2;
}
function x(n, e) {
  const t = n.findIndex((o) => o !== 0), r = e >= 0 ? t : n.length - 1, i = Math.log1p(e);
  return n.reduce(
    (o, a, l) => a === 0 ? o : o + a * Math.exp((r - l) * i),
    0
  );
}
function O(n, e) {
  const t = [];
  for (let r = n; r <= e; r += 1)
    t.push(r);
  return t;
}
function P(n, e) {
  return Math.abs(n - e) <= 1e-9 * Math.max(1, Math.abs(n), Math.abs(e));
}
function I(n, e) {
  const t = E(n, e), r = k(n, t), i = r.net.reduce((o, a, l) => o + a / (1 + e) ** (l / 12), 0);
  return { price: t, cashflows: r, npv: i, irr: R(n, t) };
}
function N(n, e, t, r) {
  return r.map((i) => {
    const o = t === "equityHurdle" ? n : { ...n, [t]: i }, a = t === "equityHurdle" ? i : e, l = (p, d) => {
      try {
        return E(p, d);
      } catch {
        return null;
      }
    };
    return {
      value: i,
      selected: l(o, a),
      reference: l({ ...o, debtInterestRate: 12 * (1.04 ** (1 / 12) - 1), revenueFraction: 1 }, 0.04)
    };
  });
}
const z = ":host{display:block;color:#263640;font:14px/1.5 system-ui,sans-serif;margin:1.5rem 0;container-type:inline-size}*{box-sizing:border-box}[hidden]{display:none!important}section{min-width:0}:host>section{padding:20px;border:1px solid #cbd7dd;border-radius:12px;background:#f9fbfc}header{display:flex;justify-content:space-between;gap:15px;align-items:center}h2{margin:0;font-size:23px;line-height:1.2;letter-spacing:-.5px}h3{font-size:17px;margin:0 0 10px}p{margin:10px 0}.eyebrow{text-transform:uppercase;color:#526a76;font-size:11px;font-weight:700;letter-spacing:1px;margin:0 0 7px}button,select,input{font:inherit;color:inherit}button{padding:8px 12px;background:#fff;border:1px solid #b4c5ce;border-radius:6px;cursor:pointer}button:hover{background:#edf4f8}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #2682ad;outline-offset:3px}.intro{color:#4f626d}.result{background:#e9f3f7;border-left:4px solid #006e9c;padding:12px 16px;margin:18px 0;display:grid;gap:2px}.result strong{font-size:34px;line-height:1.2;color:#005c83}.result small{margin-top:5px}.workspace{display:grid;grid-template-columns:minmax(0,1fr);gap:22px}form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px;align-content:start}.control{display:grid;grid-template-columns:minmax(0,1fr) 70px;align-items:start;column-gap:8px}.control label{font-weight:600;line-height:1.3}.control label span{display:block;font-weight:400;font-size:11px;color:#526a76;margin-top:3px}input[type=number]{width:100%;border:1px solid #b4c5ce;border-radius:4px;padding:4px;background:#fff}input[type=range]{grid-column:1 / -1;width:100%;margin:8px 0 0;accent-color:#006e9c;min-height:24px}.control small{grid-column:1 / -1;font-size:11px;color:#526a76}form>details{grid-column:1 / -1;border-top:1px solid #d8e2e7;padding-top:10px}summary{cursor:pointer;font-weight:600}form details .control{margin:14px 0}.charts{min-width:0;display:grid;gap:24px;align-content:start}.charts>section{background:#fff;border:1px solid #d8e2e7;border-radius:8px;padding:14px 10px}.sweep-label{display:flex;align-items:center;gap:8px}select{border:1px solid #b4c5ce;border-radius:5px;padding:5px;background:#fff;max-width:90%}.plot{width:100%;height:370px}.chart-note,.footnote{font-size:12px;color:#52616a}.footnote{border-top:1px solid #d8e2e7;padding-top:12px}.data{font-size:12px;margin-top:10px}.table-scroll{overflow:auto;max-height:260px;margin-top:8px}table{width:100%;border-collapse:collapse;font-size:11px;font-variant-numeric:tabular-nums}th,td{text-align:right;padding:6px 8px;border-bottom:1px solid #d8e2e7;white-space:nowrap}th{position:sticky;top:0;background:#edf4f8}#error{background:#fff1e9;border:1px solid #b54a21;padding:10px;color:#843318}[aria-invalid=true]{border-color:#b54a21!important}@container (min-width: 950px){.workspace{grid-template-columns:280px minmax(0,1fr)}form{grid-template-columns:minmax(0,1fr)}}@container (max-width: 460px){:host>section{padding:12px}header{align-items:flex-start;flex-direction:column}h2{font-size:21px}form{grid-template-columns:minmax(0,1fr)}.charts>section{padding:12px 2px}.plot{height:410px}}.js-plotly-plot .main-svg{position:absolute;top:0;left:0;pointer-events:none}.js-plotly-plot .main-svg .draglayer{pointer-events:all}.js-plotly-plot .crisp{shape-rendering:crispEdges}.js-plotly-plot .user-select-none{-webkit-user-select:none;user-select:none}.js-plotly-plot .cursor-crosshair{cursor:crosshair}.js-plotly-plot .cursor-pointer{cursor:pointer}", f = [
  { key: "throughput", label: "Output throughput", unit: "MTok/s/MW IT", min: 0.01, max: 10, step: 0.01, scale: 1e6, log: !0, help: "Aggregate output across requests, including prefill and decode resources, for a fixed workload." },
  { key: "capex", label: "Total capital cost", unit: "million USD/MW IT", min: 10, max: 100, step: 1, scale: 1e6 },
  { key: "utilization", label: "Utilization", unit: "%", min: 10, max: 100, step: 1, scale: 0.01 },
  { key: "energyCostPerMWh", label: "Electricity price", unit: "USD/MWh", min: 0, max: 300, step: 1 },
  { key: "nonEnergyAnnualOpex", label: "Other annual operating cost", unit: "million USD/MW IT/year", min: 0, max: 5, step: 0.1, scale: 1e6 },
  { key: "constructionYears", label: "Construction time", unit: "months", min: 1, max: 60, step: 1, scale: 1 / 12 },
  { key: "operatingYears", label: "Operating life", unit: "months", min: 12, max: 120, step: 1, scale: 1 / 12 },
  { key: "debtFraction", label: "Debt share of capital", unit: "%", min: 0, max: 95, step: 1, scale: 0.01 },
  { key: "debtInterestRate", label: "Annual debt interest", unit: "% nominal, monthly compounding", min: 0, max: 20, step: 0.5, scale: 0.01 },
  { key: "equityHurdle", label: "Equity return hurdle", unit: "% effective annual, pre-tax", min: 0, max: 30, step: 0.5, scale: 0.01 },
  { key: "pue", label: "Power usage effectiveness", unit: "facility / IT power", min: 1, max: 2, step: 0.05, advanced: !0 },
  { key: "idlePowerFraction", label: "Idle IT power", unit: "% of installed IT capacity", min: 0, max: 100, step: 1, scale: 0.01, advanced: !0 },
  { key: "capacityChargePerKWMonth", label: "Reserved power charge", unit: "USD/kW facility/month", min: 0, max: 50, step: 1, advanced: !0, help: "Use the volumetric electricity rate above when adding this charge. Do not add it again to an all-in tariff." },
  { key: "facilityCapexFraction", label: "Reusable facility share", unit: "% of total capital", min: 0, max: 100, step: 1, scale: 0.01, advanced: !0 },
  { key: "facilityResidualFraction", label: "Facility resale value", unit: "% of initial facility cost", min: 0, max: 100, step: 1, scale: 0.01, advanced: !0, help: "Net proceeds at the end of the selected life. IT equipment has zero resale value." },
  { key: "revenueFraction", label: "Billable share of active capacity", unit: "%", min: 10, max: 100, step: 1, scale: 0.01, advanced: !0 },
  { key: "priceAnnualErosion", label: "Annual price erosion", unit: "% decline", min: 0, max: 80, step: 1, scale: 0.01, advanced: !0 },
  { key: "throughputAnnualChange", label: "Annual throughput change", unit: "% change", min: -50, max: 100, step: 1, scale: 0.01, advanced: !0 }
], b = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 3 }), m = (n) => Number(n.toPrecision(7)).toString();
class q extends HTMLElement {
  root = this.attachShadow({ mode: "open" });
  assumptions = { ...M };
  hurdle = 0.15;
  plotly;
  observer;
  frame = 0;
  initialized = !1;
  connectedCallback() {
    this.initialized || (this.initialized = !0, this.root.innerHTML = `<style>${z}</style>
        <section aria-label="Interactive inference cost model">
          <header><div><p class="eyebrow">Explore the assumptions</p><h2>What would inference need to earn?</h2></div><button type="button" id="reset">Reset assumptions</button></header>
          <p class="intro">An illustrative inference-only project, per MW of installed IT capacity. Adjust assumptions to see the initial revenue needed to meet the equity return hurdle.</p>
          <div class="result" role="status" aria-live="polite"><strong id="price">Loading…</strong><span>per million output tokens, including associated input revenue</span><small id="accounting"></small></div>
          <p id="error" role="alert" hidden></p>
          <div class="workspace"><form aria-label="Project assumptions" novalidate>
            ${f.filter((e) => !e.advanced).map((e) => this.controlMarkup(e)).join("")}
            <details><summary>Further details</summary>${f.filter((e) => e.advanced).map((e) => this.controlMarkup(e)).join("")}</details>
          </form><div class="charts">
            <section><h3>Cost versus an assumption</h3><label class="sweep-label" for="sweep">Vary <select id="sweep">${f.map((e) => `<option value="${e.key}">${e.label}</option>`).join("")}</select></label>
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
        </section>`, this.root.querySelector("form").addEventListener("submit", (e) => e.preventDefault()), this.root.addEventListener("input", (e) => this.handleInput(e)), this.root.addEventListener("focusout", (e) => {
      const t = e.target;
      t instanceof HTMLInputElement && t.type === "number" && (t.dataset.key === "constructionYears" || t.dataset.key === "operatingYears") && !t.hasAttribute("aria-invalid") && (t.value = m(this.assumptions[t.dataset.key] * 12));
    }), this.root.querySelector("#sweep").addEventListener("change", () => this.scheduleRender()), this.root.querySelector("#reset").addEventListener("click", () => {
      this.assumptions = { ...M }, this.hurdle = 0.15, this.syncControls(), this.scheduleRender();
    }), this.syncControls()), this.observer = new ResizeObserver(() => {
      if (this.plotly) for (const e of ["sensitivity", "cashflow"]) this.plotly.Plots.resize(this.element(e)).catch(() => {
      });
    }), this.observer.observe(this), this.loadCharts();
  }
  disconnectedCallback() {
    if (this.observer?.disconnect(), cancelAnimationFrame(this.frame), this.plotly) for (const e of ["sensitivity", "cashflow"]) this.plotly.purge(this.element(e));
  }
  element(e) {
    return this.root.getElementById(e);
  }
  controlMarkup(e) {
    return `<div class="control"><label for="${e.key}-number">${e.label}<span>${e.unit}</span></label><input id="${e.key}-number" data-key="${e.key}" type="number" min="${e.min}" max="${e.max}" step="${e.step}" ${e.help ? `aria-describedby="${e.key}-help"` : ""}><input aria-label="${e.label} (${e.unit}) slider" data-key="${e.key}" type="range" min="${e.log ? Math.log10(e.min) : e.min}" max="${e.log ? Math.log10(e.max) : e.max}" step="${e.log ? 0.01 : e.step}">${e.help ? `<small id="${e.key}-help">${e.help}</small>` : ""}</div>`;
  }
  syncControls() {
    for (const e of f) {
      const t = (e.key === "equityHurdle" ? this.hurdle : this.assumptions[e.key]) / (e.scale ?? 1);
      for (const r of this.root.querySelectorAll(`input[data-key="${e.key}"]`))
        r.value = m(r.type === "range" && e.log ? Math.log10(t) : t), r.removeAttribute("aria-invalid"), r.type === "range" && r.setAttribute("aria-valuetext", `${m(t)} ${e.unit}`);
    }
  }
  handleInput(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.dataset.key) return;
    const r = f.find((o) => o.key === t.dataset.key);
    let i = t.valueAsNumber;
    if (t.type === "range" && r.log && (i = 10 ** i), !Number.isFinite(i) || i < r.min || i > r.max) {
      t.setAttribute("aria-invalid", "true"), this.showError(`${r.label} must be between ${r.min} and ${r.max} ${r.unit}.`);
      return;
    }
    (r.key === "constructionYears" || r.key === "operatingYears") && (i = Math.round(i)), r.key === "equityHurdle" ? this.hurdle = i * (r.scale ?? 1) : this.assumptions[r.key] = i * (r.scale ?? 1), t.removeAttribute("aria-invalid");
    for (const o of this.root.querySelectorAll(`input[data-key="${r.key}"]`))
      o !== t && (o.value = m(o.type === "range" && r.log ? Math.log10(i) : i)), o.type === "range" && o.setAttribute("aria-valuetext", `${m(i)} ${r.unit}`);
    this.scheduleRender();
  }
  async loadCharts() {
    try {
      this.plotly = (await import("./plotly.min-BqmqnvIb.js").then((e) => e.p)).default, this.isConnected && this.scheduleRender();
    } catch {
      this.showError("The charts could not load. Reload the page to try again.");
    }
  }
  scheduleRender() {
    cancelAnimationFrame(this.frame), this.frame = requestAnimationFrame(() => {
      this.render();
    });
  }
  showError(e) {
    this.element("error").textContent = e, this.element("error").hidden = !1, this.element("price").textContent = "Check assumptions", this.element("accounting").textContent = "", this.root.querySelector(".charts").hidden = !0;
  }
  async render() {
    if (!(!this.plotly || !this.isConnected || this.root.querySelector('[aria-invalid="true"]')))
      try {
        const e = I(this.assumptions, this.hurdle), t = f.find((s) => s.key === this.element("sweep").value), r = (t.key === "equityHurdle" ? this.hurdle : this.assumptions[t.key]) / (t.scale ?? 1), i = Array.from({ length: 61 }, (s, u) => {
          const c = t.log ? t.min * (t.max / t.min) ** (u / 60) : t.min + (t.max - t.min) * u / 60;
          return t.key === "constructionYears" || t.key === "operatingYears" ? Math.round(c) : c;
        });
        i.push(r);
        const o = [...new Set(i)].sort((s, u) => s - u), a = N(this.assumptions, this.hurdle, t.key, o.map((s) => s * (t.scale ?? 1)));
        this.element("error").hidden = !0, this.element("price").textContent = b.format(e.price), this.element("accounting").textContent = `Equity NPV at ${m(this.hurdle * 100)}%: ${b.format(Math.abs(e.npv) < 5e-3 ? 0 : e.npv)} / MW IT. ${Number.isFinite(e.irr) ? `Implied annual IRR: ${(e.irr * 100).toFixed(1)}%.` : "IRR unavailable: cashflow sign changes make it potentially ambiguous."}`, this.element("sweep-note").textContent = `${a.some((s) => s.selected === null || s.reference === null) ? "Gaps indicate no finite nonnegative price meets the return hurdle. " : ""}${t.key === "operatingYears" ? "Facility resale fraction is held fixed across operating lives; reassess it when calibrating a scenario." : ""}`, this.element("sweep-heading").textContent = `${t.label} (${t.unit})`, this.element("sweep-data").innerHTML = a.map((s, u) => `<tr><td>${m(o[u])}</td><td>${s.selected === null ? "Not feasible" : b.format(s.selected)}</td><td>${s.reference === null ? "Not feasible" : b.format(s.reference)}</td></tr>`).join("");
        const l = e.cashflows, p = [
          { key: "revenue", name: "Token revenue", color: "#17876b" },
          { key: "terminalValue", name: "Facility sale", color: "#95c9a6" },
          { key: "equityConstructionCapex", name: "Equity CAPEX", color: "#5b568f" },
          { key: "nonEnergyOpex", name: "Other OPEX", color: "#c58639" },
          { key: "energyOpex", name: "Electricity", color: "#dbb55e" },
          { key: "capacityOpex", name: "Power capacity", color: "#a76c52" },
          { key: "debtService", name: "Debt service", color: "#6389b2" }
        ];
        this.element("cashflow-data").innerHTML = l.months.slice(1).map((s) => `<tr><td>${s}</td>${[...p.map((u) => l[u.key][s]), l.net[s]].map((u) => `<td>${b.format(u)}</td>`).join("")}</tr>`).join("");
        const d = { autosize: !0, paper_bgcolor: "#ffffff", plot_bgcolor: "#ffffff", font: { family: "system-ui, sans-serif", color: "#263640", size: 12 }, margin: { l: 65, r: 18, t: 20, b: 115 }, legend: { orientation: "h", y: -0.27, x: 0, font: { size: 11 } }, hovermode: "closest" }, h = { responsive: !0, displayModeBar: !1, scrollZoom: !1 };
        this.root.querySelector(".charts").hidden = !1, await Promise.all([
          this.plotly.react(this.element("sensitivity"), [
            { x: o, y: a.map((s) => s.reference), type: "scatter", mode: "lines", name: "Low-cost financing", fill: "tozeroy", fillcolor: "rgba(130,140,150,.16)", line: { color: "#8b959d", width: 2 }, hovertemplate: "%{x:.3g}<br>$%{y:.3f}/MTok<extra>Low-cost financing</extra>" },
            { x: o, y: a.map((s) => s.selected), type: "scatter", mode: "lines", name: "Selected assumptions", line: { color: "#006e9c", width: 3 }, hovertemplate: "%{x:.3g}<br>$%{y:.3f}/MTok<extra>Selected assumptions</extra>" },
            { x: [r], y: [e.price], type: "scatter", mode: "markers", name: "Current value", marker: { color: "#d8592f", size: 11 }, hovertemplate: "%{x:.3g}<br>$%{y:.3f}/MTok<extra>Current value</extra>" }
          ], { ...d, xaxis: { title: { text: `${t.label}<br>${t.unit}` }, type: t.log ? "log" : "linear", automargin: !0 }, yaxis: { title: { text: "Initial revenue (USD / MTok output)" }, rangemode: "tozero", automargin: !0 } }, h),
          this.plotly.react(this.element("cashflow"), [
            ...p.map((s) => ({ x: l.months.slice(1), y: l[s.key].slice(1).map((u) => u / 1e6), type: "bar", name: s.name, marker: { color: s.color }, hovertemplate: "Month %{x}<br>$%{y:.3f}m / MW IT<extra>%{fullData.name}</extra>" })),
            { x: l.months.slice(1), y: l.net.slice(1).map((s) => s / 1e6), type: "scatter", mode: "lines", name: "Net equity cashflow", line: { color: "#20262c", width: 2 }, hovertemplate: "Month %{x}<br>$%{y:.3f}m / MW IT<extra>Net equity cashflow</extra>" }
          ], { ...d, barmode: "relative", bargap: 0.08, xaxis: { title: { text: "Month from construction start" } }, yaxis: { title: { text: "million USD / MW IT / month" }, zeroline: !0, zerolinewidth: 2, zerolinecolor: "#555", automargin: !0 }, shapes: [{ type: "line", x0: this.assumptions.constructionYears * 12 + 0.5, x1: this.assumptions.constructionYears * 12 + 0.5, y0: 0, y1: 1, yref: "paper", line: { color: "#777", dash: "dot" } }], annotations: [{ x: this.assumptions.constructionYears * 12 + 0.5, y: 1, yref: "paper", text: "Operations begin", showarrow: !1, xanchor: "left", font: { size: 10 } }] }, h)
        ]);
      } catch (e) {
        this.showError(e instanceof Error ? e.message : "Unable to calculate this scenario.");
      }
  }
}
customElements.get("ai-dc-project-finance-widget") || customElements.define("ai-dc-project-finance-widget", q);
