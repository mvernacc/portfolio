const v = 8766, T = 31557600, x = 12, A = {
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
}, _ = [
  {
    provider: "OpenAI",
    model: "GPT-5.5",
    year: 2026,
    month: "May",
    outputPricePerMTok: 30,
    inputPricePerMTok: 5
  },
  {
    provider: "Anthropic",
    model: "Claude Sonnet 4.6",
    year: 2026,
    month: "May",
    outputPricePerMTok: 15,
    inputPricePerMTok: 3
  },
  {
    provider: "Google",
    model: "Gemini 3 Flash Preview",
    year: 2026,
    month: "May",
    outputPricePerMTok: 3,
    inputPricePerMTok: 0.5
  }
];
function S(t, e = 3, n = 0) {
  const o = e, i = n;
  if (!Number.isFinite(o) || o < 0 || !Number.isFinite(i) || i < 0 || i > 1)
    throw new Error(
      "Input/output ratio must be nonnegative and cache fraction in [0,1]."
    );
  if (i > 0 && t.cachedInputPricePerMTok === void 0)
    throw new Error("Cached input tariff is required for cached input.");
  const c = [
    t.outputPricePerMTok,
    t.inputPricePerMTok
  ];
  if (t.cachedInputPricePerMTok !== void 0 && c.push(t.cachedInputPricePerMTok), c.some((r) => !Number.isFinite(r) || r < 0))
    throw new Error("Tariffs must be finite and nonnegative.");
  return t.outputPricePerMTok + o * ((1 - i) * t.inputPricePerMTok + i * (t.cachedInputPricePerMTok ?? 0));
}
function k(t = A) {
  return { ...t };
}
function d(t) {
  if (!Number.isFinite(t)) throw new Error("Duration must be finite.");
  const e = 12 * t, n = Math.round(e);
  if (!N(e, n))
    throw new Error(
      `Duration must be an integer number of months, got ${t} years.`
    );
  return n;
}
function m(t) {
  F(t);
  const e = (t.utilization + (1 - t.utilization) * t.idlePowerFraction) * t.pue * t.energyCostPerMWh * 8766, n = 1e3 * t.pue * t.capacityChargePerKWMonth * 12, o = t.capex * t.facilityCapexFraction * t.facilityResidualFraction, i = d(t.constructionYears), c = d(t.operatingYears), r = i + c, u = r, h = t.debtInterestRate / 12, s = t.capex / i, l = (1 - t.debtFraction) * s, f = t.debtFraction * s;
  let g = 0;
  for (let p = 0; p < i; p += 1)
    g *= 1 + h, g += f;
  const a = C(
    h,
    c,
    g
  ), M = t.utilization * t.throughput * 31557600, P = t.revenueFraction * M * 1e-6;
  return {
    energyAnnualOpex: e,
    capacityAnnualOpex: n,
    terminalFacilityValue: o,
    equityMonthlyConstructionCapex: l,
    debtBalanceAtOperationsStart: g,
    termLoanMonthlyPayment: a,
    constructionMonths: i,
    projectDurationMonths: r,
    cashflowDurationMonths: u,
    billableOutputAnnual: P
  };
}
function Y(t, e) {
  const n = w(t, e);
  return (1 + R(n.net)) ** 12 - 1;
}
function I(t, e) {
  if (!Number.isFinite(e) || e <= -1)
    throw new Error("Annual IRR target must be finite and greater than -100%.");
  const n = w(t, 1);
  let o = 0, i = 0;
  for (const r of n.months) {
    const u = (1 + e) ** (-r / 12);
    o -= (n.equityConstructionCapex[r] + n.nonEnergyOpex[r] + n.energyOpex[r] + n.capacityOpex[r] + n.debtService[r] + n.terminalValue[r]) * u, i += n.revenue[r] * u;
  }
  if (!Number.isFinite(o) || !Number.isFinite(i) || i <= 0)
    throw new Error("Discounted cashflows exceed numerical range.");
  const c = o / i;
  if (!Number.isFinite(c) || c < 0)
    throw new Error(
      "No finite nonnegative price achieves exactly the target NPV."
    );
  return c;
}
function w(t, e) {
  const n = m(t);
  if (!Number.isFinite(e) || e < 0)
    throw new Error("Initial price must be finite and nonnegative.");
  const o = O(0, n.cashflowDurationMonths), i = new Array(o.length).fill(0), c = new Array(o.length).fill(0), r = new Array(o.length).fill(0), u = new Array(o.length).fill(0), h = new Array(o.length).fill(0), s = new Array(o.length).fill(0);
  s[n.projectDurationMonths] = n.terminalFacilityValue;
  const l = new Array(o.length).fill(0), f = new Array(o.length).fill(0);
  for (const a of o) {
    const M = a > 0 && a <= n.constructionMonths, P = a > n.constructionMonths && a <= n.projectDurationMonths;
    if (M && (c[a] = -n.equityMonthlyConstructionCapex), P) {
      const p = (a - n.constructionMonths - 1) / 12, b = n.billableOutputAnnual / 12 * (1 + t.throughputAnnualChange) ** p, E = e * (1 - t.priceAnnualErosion) ** p;
      i[a] = b * E, h[a] = -n.capacityAnnualOpex / 12, r[a] = -t.nonEnergyAnnualOpex / 12, u[a] = -n.energyAnnualOpex / 12, l[a] = -n.termLoanMonthlyPayment;
    }
    f[a] = i[a] + c[a] + r[a] + u[a] + l[a] + h[a] + s[a];
  }
  if ([
    i,
    c,
    r,
    u,
    h,
    l,
    s,
    f
  ].some((a) => a.some((M) => !Number.isFinite(M))))
    throw new Error(
      "Cashflows exceed numerical range; reduce rates or horizon."
    );
  return {
    months: o,
    revenue: i,
    equityConstructionCapex: c,
    nonEnergyOpex: r,
    energyOpex: u,
    capacityOpex: h,
    terminalValue: s,
    debtService: l,
    net: f
  };
}
function C(t, e, n) {
  if (e <= 0)
    throw new Error("Loan payment count must be positive.");
  return t === 0 ? n / e : t * n / -Math.expm1(-e * Math.log1p(t));
}
function F(t) {
  if (Object.values(t).some((e) => !Number.isFinite(e)))
    throw new Error("All assumptions must be finite.");
  for (const e of [
    "capex",
    "throughput",
    "constructionYears",
    "operatingYears"
  ])
    if (t[e] <= 0) throw new Error(`${e} must be positive.`);
  for (const e of [
    "facilityCapexFraction",
    "facilityResidualFraction",
    "idlePowerFraction"
  ])
    if (t[e] < 0 || t[e] > 1)
      throw new Error(`${e} must be between 0 and 1.`);
  for (const e of ["utilization", "revenueFraction"])
    if (t[e] <= 0 || t[e] > 1)
      throw new Error(`${e} must be greater than 0 and at most 1.`);
  for (const e of ["debtFraction", "priceAnnualErosion"])
    if (t[e] < 0 || t[e] >= 1)
      throw new Error(`${e} must be at least 0 and less than 1.`);
  for (const e of [
    "nonEnergyAnnualOpex",
    "energyCostPerMWh",
    "capacityChargePerKWMonth",
    "debtInterestRate"
  ])
    if (t[e] < 0) throw new Error(`${e} must be nonnegative.`);
  if (t.pue < 1 || t.throughputAnnualChange <= -1)
    throw new Error(
      "PUE must be >= 1 and throughput annual change must be > -1."
    );
  for (const e of [t.constructionYears, t.operatingYears])
    if (d(e) < 1)
      throw new Error("Each duration must be at least one whole month.");
}
function R(t) {
  const e = t.reduce((r, u) => Math.max(r, Math.abs(u)), 0), n = t.filter((r) => Math.abs(r) > e * 1e-12);
  let o = 0;
  for (let r = 1; r < n.length; r++)
    Math.sign(n[r]) !== Math.sign(n[r - 1]) && o++;
  if (n.length < 2 || n[0] >= 0 || o !== 1)
    return Number.NaN;
  let i = -0.999999, c = 1;
  for (; y(t, c) > 0 && c < 1e6; ) c *= 2;
  if (!(y(t, i) > 0) || !(y(t, c) < 0))
    return Number.NaN;
  for (let r = 0; r < 100; r++) {
    const u = (i + c) / 2;
    y(t, u) > 0 ? i = u : c = u;
  }
  return (i + c) / 2;
}
function y(t, e) {
  const n = t.findIndex((c) => c !== 0), o = e >= 0 ? n : t.length - 1, i = Math.log1p(e);
  return t.reduce(
    (c, r, u) => r === 0 ? c : c + r * Math.exp((o - u) * i),
    0
  );
}
function O(t, e) {
  const n = [];
  for (let o = t; o <= e; o += 1)
    n.push(o);
  return n;
}
function N(t, e) {
  return Math.abs(t - e) <= 1e-9 * Math.max(1, Math.abs(t), Math.abs(e));
}
export {
  A as DEFAULT_ASSUMPTIONS,
  v as HOURS_PER_YEAR,
  x as MONTHS_PER_YEAR,
  _ as PRICE_EXAMPLES,
  T as SECONDS_PER_YEAR,
  Y as calcIrr,
  w as calcMonthlyCashflows,
  I as calcPricePerMTokForTargetIrr,
  m as calcProjectFinanceTerms,
  k as cloneAssumptions,
  S as effectivePricePerMTokOutput,
  d as yearsToMonths
};
