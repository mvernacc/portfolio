/** Pre-tax finance per MW of installed IT capacity. See the model notes.md. */
export interface AiDatacenterFinanceModelAssumptions {
  /** [USD / MW] Capital expenditures per MW of installed IT capacity. */
  capex: number;
  /** Reusable facility share of total CAPEX; remaining IT has zero residual. */
  facilityCapexFraction: number;
  /** Net terminal facility proceeds / initial facility CAPEX. */
  facilityResidualFraction: number;
  /** Effective annual output growth at fixed capacity and active power; > -1. */
  throughputAnnualChange: number;
  /** Effective annual decline in total revenue per output token; [0, 1). */
  priceAnnualErosion: number;
  /** Idle IT power / installed IT capacity. */
  idlePowerFraction: number;
  /** [USD / kW facility / month] Reserved peak power charge. */
  capacityChargePerKWMonth: number;
  /** [Tok s^-1 MW^-1] Initial aggregate output tok/s/MW installed IT, including prefill and decode resources over the full serving interval. */
  throughput: number;
  /** [dimensionless] Power usage effectiveness. */
  pue: number;
  /** [dimensionless] Active capacity-time fraction; the remainder consumes idle power. */
  utilization: number;
  /** [dimensionless] Fraction of utilization for revenue-generating inference. */
  revenueFraction: number;
  /** [USD year^-1 MW^-1] Non-energy operating costs per MW of installed IT capacity. */
  nonEnergyAnnualOpex: number;
  /** [USD / MWh] Volumetric facility electricity tariff, excluding separate capacity charges. */
  energyCostPerMWh: number;
  /** [year] Time from first major expenses and loan start to operations. */
  constructionYears: number;
  /** [year] Duration of revenue-generating operations. */
  operatingYears: number;
  /** [dimensionless] Fraction of CAPEX financed with debt. */
  debtFraction: number;
  /** [year^-1] Nominal annual debt rate, compounded monthly. */
  debtInterestRate: number;
}

export interface ProjectFinanceTerms {
  /** [USD year^-1 MW^-1] Annual energy costs per MW of installed IT capacity. */
  energyAnnualOpex: number;
  /** [USD / year / MW IT] Reserved peak facility capacity expense. */
  capacityAnnualOpex: number;
  /** [USD / MW IT] Net proceeds at the final operating month end. */
  terminalFacilityValue: number;
  /** [USD month^-1 MW^-1] Equity-funded monthly construction CAPEX. */
  equityMonthlyConstructionCapex: number;
  /** [USD / MW] Debt balance at start of revenue-generating operations. */
  debtBalanceAtOperationsStart: number;
  /** [USD month^-1 MW^-1] Monthly term loan payment during operations. */
  termLoanMonthlyPayment: number;
  /** [month] Time from first major expenses to revenue-generating operations. */
  constructionMonths: number;
  /** [month] Time from first major expenses to end of operations. */
  projectDurationMonths: number;
  /** [month] Modeled cashflow duration. */
  cashflowDurationMonths: number;
  /** [MTok year^-1 MW^-1] Initial annualized billable output before throughput trend. */
  billableOutputAnnual: number;
}

export interface MonthlyCashflowSeries {
  /** [month] Month index. Month 0 has no cashflow, matching the Python model. */
  months: number[];
  /** [USD month^-1 MW^-1] Positive revenue cashflow. */
  revenue: number[];
  /** [USD month^-1 MW^-1] Negative equity-funded construction CAPEX. */
  equityConstructionCapex: number[];
  /** [USD month^-1 MW^-1] Negative non-energy OPEX. */
  nonEnergyOpex: number[];
  /** [USD month^-1 MW^-1] Negative energy OPEX. */
  energyOpex: number[];
  /** Negative reserved facility power expense. */
  capacityOpex: number[];
  /** Positive terminal facility proceeds, separate from token revenue. */
  terminalValue: number[];
  /** [USD month^-1 MW^-1] Negative debt service. */
  debtService: number[];
  /** [USD month^-1 MW^-1] Net equity cashflow. */
  net: number[];
}

export interface PriceExample {
  provider: string;
  model: string;
  year: number;
  month: string;
  /** [USD / MTok] */
  outputPricePerMTok: number;
  /** [USD / MTok] */
  inputPricePerMTok: number;
  cachedInputPricePerMTok?: number;
}

export const HOURS_PER_YEAR = 24 * 365.25;
export const SECONDS_PER_YEAR = 60 * 60 * HOURS_PER_YEAR;
export const MONTHS_PER_YEAR = 12;

export const DEFAULT_ASSUMPTIONS: AiDatacenterFinanceModelAssumptions = {
  capex: 50e6,
  facilityCapexFraction: 0.2,
  facilityResidualFraction: 0.5,
  throughputAnnualChange: 0.0,
  priceAnnualErosion: 0.0,
  idlePowerFraction: 0.2,
  capacityChargePerKWMonth: 0.0,
  throughput: 1e5,
  pue: 1.2,
  utilization: 0.9,
  revenueFraction: 1.0,
  nonEnergyAnnualOpex: 1e6,
  energyCostPerMWh: 90.0,
  constructionYears: 2.0,
  operatingYears: 5.0,
  debtFraction: 0.65,
  debtInterestRate: 0.085,
};

export const PRICE_EXAMPLES: PriceExample[] = [
  {
    provider: "OpenAI",
    model: "GPT-5.5",
    year: 2026,
    month: "May",
    outputPricePerMTok: 30.0,
    inputPricePerMTok: 5.0,
  },
  {
    provider: "Anthropic",
    model: "Claude Sonnet 4.6",
    year: 2026,
    month: "May",
    outputPricePerMTok: 15.0,
    inputPricePerMTok: 3.0,
  },
  {
    provider: "Google",
    model: "Gemini 3 Flash Preview",
    year: 2026,
    month: "May",
    outputPricePerMTok: 3.0,
    inputPricePerMTok: 0.5,
  },
];

export function effectivePricePerMTokOutput(
  priceExample: PriceExample,
  inputTokensPerOutputToken = 3.0,
  cachedInputFraction = 0.0,
): number {
  const r = inputTokensPerOutputToken,
    c = cachedInputFraction;
  if (!Number.isFinite(r) || r < 0 || !Number.isFinite(c) || c < 0 || c > 1) {
    throw new Error(
      "Input/output ratio must be nonnegative and cache fraction in [0,1].",
    );
  }
  if (c > 0 && priceExample.cachedInputPricePerMTok === undefined) {
    throw new Error("Cached input tariff is required for cached input.");
  }
  const tariffs = [
    priceExample.outputPricePerMTok,
    priceExample.inputPricePerMTok,
  ];
  if (priceExample.cachedInputPricePerMTok !== undefined)
    tariffs.push(priceExample.cachedInputPricePerMTok);
  if (tariffs.some((v) => !Number.isFinite(v) || v < 0))
    throw new Error("Tariffs must be finite and nonnegative.");
  return (
    priceExample.outputPricePerMTok +
    r *
      ((1 - c) * priceExample.inputPricePerMTok +
        c * (priceExample.cachedInputPricePerMTok ?? 0))
  );
}

export function cloneAssumptions(
  assumptions: AiDatacenterFinanceModelAssumptions = DEFAULT_ASSUMPTIONS,
): AiDatacenterFinanceModelAssumptions {
  return { ...assumptions };
}

export function yearsToMonths(years: number): number {
  if (!Number.isFinite(years)) throw new Error("Duration must be finite.");
  const months = MONTHS_PER_YEAR * years;
  const roundedMonths = Math.round(months);
  if (!isClose(months, roundedMonths)) {
    throw new Error(
      `Duration must be an integer number of months, got ${years} years.`,
    );
  }
  return roundedMonths;
}

export function calcProjectFinanceTerms(
  assumptions: AiDatacenterFinanceModelAssumptions,
): ProjectFinanceTerms {
  validateAssumptions(assumptions);

  const energyAnnualOpex =
    (assumptions.utilization +
      (1 - assumptions.utilization) * assumptions.idlePowerFraction) *
    assumptions.pue *
    assumptions.energyCostPerMWh *
    HOURS_PER_YEAR;

  const capacityAnnualOpex =
    1000 * assumptions.pue * assumptions.capacityChargePerKWMonth * 12;
  const terminalFacilityValue =
    assumptions.capex *
    assumptions.facilityCapexFraction *
    assumptions.facilityResidualFraction;
  const constructionMonths = yearsToMonths(assumptions.constructionYears);
  const operatingMonths = yearsToMonths(assumptions.operatingYears);
  const projectDurationMonths = constructionMonths + operatingMonths;
  const cashflowDurationMonths = projectDurationMonths;
  const debtMonthlyInterestRate =
    assumptions.debtInterestRate / MONTHS_PER_YEAR;

  const monthlyConstructionCapex = assumptions.capex / constructionMonths;
  const equityMonthlyConstructionCapex =
    (1 - assumptions.debtFraction) * monthlyConstructionCapex;
  const debtMonthlyConstructionDraw =
    assumptions.debtFraction * monthlyConstructionCapex;

  let debtBalanceAtOperationsStart = 0.0;
  for (let month = 0; month < constructionMonths; month += 1) {
    debtBalanceAtOperationsStart *= 1 + debtMonthlyInterestRate;
    debtBalanceAtOperationsStart += debtMonthlyConstructionDraw;
  }

  const termLoanMonthlyPayment = loanPayment(
    debtMonthlyInterestRate,
    operatingMonths,
    debtBalanceAtOperationsStart,
  );

  const outputAnnual =
    assumptions.utilization * assumptions.throughput * SECONDS_PER_YEAR;
  const billableOutputAnnual =
    assumptions.revenueFraction * outputAnnual * 1e-6;

  return {
    energyAnnualOpex,
    capacityAnnualOpex,
    terminalFacilityValue,
    equityMonthlyConstructionCapex,
    debtBalanceAtOperationsStart,
    termLoanMonthlyPayment,
    constructionMonths,
    projectDurationMonths,
    cashflowDurationMonths,
    billableOutputAnnual,
  };
}

export function calcIrr(
  assumptions: AiDatacenterFinanceModelAssumptions,
  pricePerMTok: number,
): number {
  const cashflows = calcMonthlyCashflows(assumptions, pricePerMTok);
  const monthlyIrr = calcIrrFromCashflows(cashflows.net);
  return (1 + monthlyIrr) ** MONTHS_PER_YEAR - 1;
}

/** Solve equity NPV=0 for initial workload revenue per million output tokens.
 * With multiple cashflow sign changes this is a discount-rate hurdle, not a unique IRR.
 */
export function calcPricePerMTokForTargetIrr(
  assumptions: AiDatacenterFinanceModelAssumptions,
  targetIrrAnnual: number,
): number {
  if (!Number.isFinite(targetIrrAnnual) || targetIrrAnnual <= -1) {
    throw new Error("Annual IRR target must be finite and greater than -100%.");
  }
  const c = calcMonthlyCashflows(assumptions, 1.0);
  let costs = 0;
  let revenueCoefficient = 0;
  for (const month of c.months) {
    const discount = (1 + targetIrrAnnual) ** (-month / 12);
    costs -=
      (c.equityConstructionCapex[month] +
        c.nonEnergyOpex[month] +
        c.energyOpex[month] +
        c.capacityOpex[month] +
        c.debtService[month] +
        c.terminalValue[month]) *
      discount;
    revenueCoefficient += c.revenue[month] * discount;
  }
  if (
    !Number.isFinite(costs) ||
    !Number.isFinite(revenueCoefficient) ||
    revenueCoefficient <= 0
  ) {
    throw new Error("Discounted cashflows exceed numerical range.");
  }
  const price = costs / revenueCoefficient;
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(
      "No finite nonnegative price achieves exactly the target NPV.",
    );
  }
  return price;
}

/** Initial price includes associated input revenue; trends start in operating month 1. */
export function calcMonthlyCashflows(
  assumptions: AiDatacenterFinanceModelAssumptions,
  pricePerMTok: number,
): MonthlyCashflowSeries {
  const terms = calcProjectFinanceTerms(assumptions);
  if (!Number.isFinite(pricePerMTok) || pricePerMTok < 0) {
    throw new Error("Initial price must be finite and nonnegative.");
  }

  const months = rangeInclusive(0, terms.cashflowDurationMonths);
  const revenue = new Array<number>(months.length).fill(0.0);
  const equityConstructionCapex = new Array<number>(months.length).fill(0.0);
  const nonEnergyOpex = new Array<number>(months.length).fill(0.0);
  const energyOpex = new Array<number>(months.length).fill(0.0);
  const capacityOpex = new Array<number>(months.length).fill(0.0);
  const terminalValue = new Array<number>(months.length).fill(0.0);
  terminalValue[terms.projectDurationMonths] = terms.terminalFacilityValue;
  const debtService = new Array<number>(months.length).fill(0.0);
  const net = new Array<number>(months.length).fill(0.0);

  for (const month of months) {
    const isConstructionMonth = month > 0 && month <= terms.constructionMonths;
    const isOperatingMonth =
      month > terms.constructionMonths && month <= terms.projectDurationMonths;

    if (isConstructionMonth) {
      equityConstructionCapex[month] = -terms.equityMonthlyConstructionCapex;
    }

    if (isOperatingMonth) {
      const age = (month - terms.constructionMonths - 1) / 12;
      const output =
        (terms.billableOutputAnnual / 12) *
        (1 + assumptions.throughputAnnualChange) ** age;
      const price = pricePerMTok * (1 - assumptions.priceAnnualErosion) ** age;
      revenue[month] = output * price;
      capacityOpex[month] = -terms.capacityAnnualOpex / 12;
      nonEnergyOpex[month] = -assumptions.nonEnergyAnnualOpex / MONTHS_PER_YEAR;
      energyOpex[month] = -terms.energyAnnualOpex / MONTHS_PER_YEAR;
      debtService[month] = -terms.termLoanMonthlyPayment;
    }

    net[month] =
      revenue[month] +
      equityConstructionCapex[month] +
      nonEnergyOpex[month] +
      energyOpex[month] +
      debtService[month] +
      capacityOpex[month] +
      terminalValue[month];
  }

  const series = [
    revenue,
    equityConstructionCapex,
    nonEnergyOpex,
    energyOpex,
    capacityOpex,
    debtService,
    terminalValue,
    net,
  ];
  if (
    series.some((values) => values.some((value) => !Number.isFinite(value)))
  ) {
    throw new Error(
      "Cashflows exceed numerical range; reduce rates or horizon.",
    );
  }
  return {
    months,
    revenue,
    equityConstructionCapex,
    nonEnergyOpex,
    energyOpex,
    capacityOpex,
    terminalValue,
    debtService,
    net,
  };
}

function loanPayment(
  monthlyInterestRate: number,
  numberOfPayments: number,
  presentValue: number,
): number {
  if (numberOfPayments <= 0) {
    throw new Error("Loan payment count must be positive.");
  }
  if (monthlyInterestRate === 0) {
    return presentValue / numberOfPayments;
  }
  return (
    (monthlyInterestRate * presentValue) /
    -Math.expm1(-numberOfPayments * Math.log1p(monthlyInterestRate))
  );
}

function validateAssumptions(a: AiDatacenterFinanceModelAssumptions): void {
  if (Object.values(a).some((v) => !Number.isFinite(v)))
    throw new Error("All assumptions must be finite.");
  for (const key of [
    "capex",
    "throughput",
    "constructionYears",
    "operatingYears",
  ] as const) {
    if (a[key] <= 0) throw new Error(`${key} must be positive.`);
  }
  for (const key of [
    "facilityCapexFraction",
    "facilityResidualFraction",
    "idlePowerFraction",
  ] as const) {
    if (a[key] < 0 || a[key] > 1)
      throw new Error(`${key} must be between 0 and 1.`);
  }
  for (const key of ["utilization", "revenueFraction"] as const) {
    if (a[key] <= 0 || a[key] > 1)
      throw new Error(`${key} must be greater than 0 and at most 1.`);
  }
  for (const key of ["debtFraction", "priceAnnualErosion"] as const) {
    if (a[key] < 0 || a[key] >= 1)
      throw new Error(`${key} must be at least 0 and less than 1.`);
  }
  for (const key of [
    "nonEnergyAnnualOpex",
    "energyCostPerMWh",
    "capacityChargePerKWMonth",
    "debtInterestRate",
  ] as const) {
    if (a[key] < 0) throw new Error(`${key} must be nonnegative.`);
  }
  if (a.pue < 1 || a.throughputAnnualChange <= -1) {
    throw new Error(
      "PUE must be >= 1 and throughput annual change must be > -1.",
    );
  }
  for (const years of [a.constructionYears, a.operatingYears]) {
    if (yearsToMonths(years) < 1)
      throw new Error("Each duration must be at least one whole month.");
  }
}

function calcIrrFromCashflows(cashflows: number[]): number {
  const scale = cashflows.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  const significant = cashflows.filter((x) => Math.abs(x) > scale * 1e-12);
  let changes = 0;
  for (let i = 1; i < significant.length; i++) {
    if (Math.sign(significant[i]) !== Math.sign(significant[i - 1])) changes++;
  }
  // Erosion and terminal proceeds can introduce multiple IRRs. Do not choose one.
  if (significant.length < 2 || significant[0] >= 0 || changes !== 1)
    return Number.NaN;

  let low = -0.999999;
  let high = 1.0;
  while (scaledNpv(cashflows, high) > 0 && high < 1e6) high *= 2;
  if (!(scaledNpv(cashflows, low) > 0) || !(scaledNpv(cashflows, high) < 0))
    return Number.NaN;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (scaledNpv(cashflows, mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Positive rescaling preserves NPV's sign without overflow near -100% rates. */
function scaledNpv(cashflows: number[], rate: number): number {
  const first = cashflows.findIndex((x) => x !== 0);
  const anchor = rate >= 0 ? first : cashflows.length - 1;
  const logBase = Math.log1p(rate);
  return cashflows.reduce(
    (npv, x, month) =>
      x === 0 ? npv : npv + x * Math.exp((anchor - month) * logBase),
    0,
  );
}

function rangeInclusive(start: number, end: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += 1) {
    values.push(value);
  }
  return values;
}

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}
