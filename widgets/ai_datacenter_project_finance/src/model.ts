export interface AiDatacenterFinanceModelAssumptions {
  /** [USD / MW] Capital expenditures per MW of compute. */
  capex: number;
  /** [Tok s^-1 MW^-1] Output tokens per second per MW of compute. */
  throughput: number;
  /** [dimensionless] Power usage effectiveness. */
  pue: number;
  /** [dimensionless] Fraction of time datacenter is running at full capacity. */
  utilization: number;
  /** [dimensionless] Fraction of utilization for revenue-generating inference. */
  revenueFraction: number;
  /** [USD year^-1 MW^-1] Non-energy operating costs per MW of compute. */
  nonEnergyAnnualOpex: number;
  /** [USD / MWh] Delivered all-in electricity cost. */
  energyCostPerMWh: number;
  /** [year] Time from first major expenses and loan start to operations. */
  constructionYears: number;
  /** [year] Duration of revenue-generating operations. */
  operatingYears: number;
  /** [dimensionless] Fraction of CAPEX financed with debt. */
  debtFraction: number;
  /** [year^-1] Annual debt interest rate. */
  debtInterestRate: number;
}

export interface ProjectFinanceTerms {
  /** [USD year^-1 MW^-1] Annual energy costs per MW of compute. */
  energyAnnualOpex: number;
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
  /** [MTok year^-1 MW^-1] Annual billable token output per MW of compute. */
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
}

export const HOURS_PER_YEAR = 24 * 365.25;
export const SECONDS_PER_YEAR = 60 * 60 * HOURS_PER_YEAR;
export const MONTHS_PER_YEAR = 12;

export const DEFAULT_ASSUMPTIONS: AiDatacenterFinanceModelAssumptions = {
  capex: 50e6,
  throughput: 1e5,
  pue: 1.2,
  utilization: 0.9,
  revenueFraction: 0.5,
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
): number {
  return (
    priceExample.outputPricePerMTok +
    inputTokensPerOutputToken * priceExample.inputPricePerMTok
  );
}

export function cloneAssumptions(
  assumptions: AiDatacenterFinanceModelAssumptions = DEFAULT_ASSUMPTIONS,
): AiDatacenterFinanceModelAssumptions {
  return { ...assumptions };
}

export function yearsToMonths(years: number): number {
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
    assumptions.utilization *
    assumptions.pue *
    assumptions.energyCostPerMWh *
    HOURS_PER_YEAR;

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
    equityMonthlyConstructionCapex,
    debtBalanceAtOperationsStart,
    termLoanMonthlyPayment,
    constructionMonths,
    projectDurationMonths,
    cashflowDurationMonths,
    billableOutputAnnual,
  };
}

export function discountFactorSum(
  monthlyDiscountRate: number,
  firstMonth: number,
  lastMonth: number,
): number {
  if (lastMonth < firstMonth) {
    return 0.0;
  }

  const periods = lastMonth - firstMonth + 1;
  if (isClose(monthlyDiscountRate, 0.0)) {
    return periods;
  }

  const firstDiscountFactor = (1 + monthlyDiscountRate) ** -firstMonth;
  const discountFactorRatio = (1 + monthlyDiscountRate) ** -1;
  return (
    (firstDiscountFactor * (1 - discountFactorRatio ** periods)) /
    (1 - discountFactorRatio)
  );
}

export function calcIrr(
  assumptions: AiDatacenterFinanceModelAssumptions,
  pricePerMTok: number,
): number {
  const cashflows = calcMonthlyCashflows(assumptions, pricePerMTok);
  const monthlyIrr = calcIrrFromCashflows(cashflows.net);
  return (1 + monthlyIrr) ** MONTHS_PER_YEAR - 1;
}

export function calcPricePerMTokForTargetIrr(
  assumptions: AiDatacenterFinanceModelAssumptions,
  targetIrrAnnual: number,
): number {
  if (targetIrrAnnual <= -1) {
    throw new Error("Annual IRR target must be greater than -100%.");
  }

  const terms = calcProjectFinanceTerms(assumptions);
  if (terms.billableOutputAnnual <= 0) {
    throw new Error("Annual billable token output must be positive.");
  }

  const targetIrrMonthly =
    (1 + targetIrrAnnual) ** (1 / MONTHS_PER_YEAR) - 1;
  const constructionDiscountSum = discountFactorSum(
    targetIrrMonthly,
    1,
    terms.constructionMonths,
  );
  const operatingDiscountSum = discountFactorSum(
    targetIrrMonthly,
    terms.constructionMonths + 1,
    terms.projectDurationMonths,
  );
  if (operatingDiscountSum <= 0) {
    throw new Error("Discounted operating period must be positive.");
  }

  const annualOpex =
    assumptions.nonEnergyAnnualOpex + terms.energyAnnualOpex;
  const discountedCosts =
    terms.equityMonthlyConstructionCapex * constructionDiscountSum +
    (annualOpex / MONTHS_PER_YEAR + terms.termLoanMonthlyPayment) *
      operatingDiscountSum;
  const discountedBillableOutput =
    (terms.billableOutputAnnual / MONTHS_PER_YEAR) * operatingDiscountSum;

  return discountedCosts / discountedBillableOutput;
}

export function calcMonthlyCashflows(
  assumptions: AiDatacenterFinanceModelAssumptions,
  pricePerMTok: number,
): MonthlyCashflowSeries {
  const terms = calcProjectFinanceTerms(assumptions);
  const revenueAnnual = pricePerMTok * terms.billableOutputAnnual;

  const months = rangeInclusive(0, terms.cashflowDurationMonths);
  const revenue = new Array<number>(months.length).fill(0.0);
  const equityConstructionCapex = new Array<number>(months.length).fill(0.0);
  const nonEnergyOpex = new Array<number>(months.length).fill(0.0);
  const energyOpex = new Array<number>(months.length).fill(0.0);
  const debtService = new Array<number>(months.length).fill(0.0);
  const net = new Array<number>(months.length).fill(0.0);

  for (const month of months) {
    const isConstructionMonth =
      month > 0 && month <= terms.constructionMonths;
    const isOperatingMonth =
      month > terms.constructionMonths &&
      month <= terms.projectDurationMonths;

    if (isConstructionMonth) {
      equityConstructionCapex[month] =
        -terms.equityMonthlyConstructionCapex;
    }

    if (isOperatingMonth) {
      revenue[month] = revenueAnnual / MONTHS_PER_YEAR;
      nonEnergyOpex[month] = -assumptions.nonEnergyAnnualOpex / MONTHS_PER_YEAR;
      energyOpex[month] = -terms.energyAnnualOpex / MONTHS_PER_YEAR;
      debtService[month] = -terms.termLoanMonthlyPayment;
    }

    net[month] =
      revenue[month] +
      equityConstructionCapex[month] +
      nonEnergyOpex[month] +
      energyOpex[month] +
      debtService[month];
  }

  return {
    months,
    revenue,
    equityConstructionCapex,
    nonEnergyOpex,
    energyOpex,
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
  if (isClose(monthlyInterestRate, 0.0)) {
    return presentValue / numberOfPayments;
  }
  return (
    (monthlyInterestRate * presentValue) /
    (1 - (1 + monthlyInterestRate) ** -numberOfPayments)
  );
}

function validateAssumptions(
  assumptions: AiDatacenterFinanceModelAssumptions,
): void {
  if (assumptions.capex < 0) {
    throw new Error("CAPEX must be non-negative.");
  }
  if (assumptions.throughput < 0) {
    throw new Error("Throughput must be non-negative.");
  }
  if (assumptions.pue < 0) {
    throw new Error("PUE must be non-negative.");
  }
  if (assumptions.utilization < 0) {
    throw new Error("Utilization must be non-negative.");
  }
  if (assumptions.revenueFraction < 0) {
    throw new Error("Revenue fraction must be non-negative.");
  }
  if (assumptions.nonEnergyAnnualOpex < 0) {
    throw new Error("Non-energy annual OPEX must be non-negative.");
  }
  if (assumptions.energyCostPerMWh < 0) {
    throw new Error("Energy cost must be non-negative.");
  }
  if (assumptions.constructionYears <= 0) {
    throw new Error("Construction duration must be positive.");
  }
  if (assumptions.operatingYears <= 0) {
    throw new Error("Operating duration must be positive.");
  }
  if (assumptions.debtFraction < 0 || assumptions.debtFraction > 1) {
    throw new Error("Debt fraction must be between 0 and 1.");
  }
  if (assumptions.debtInterestRate <= -MONTHS_PER_YEAR) {
    throw new Error("Debt interest rate is too negative.");
  }
}

function calcIrrFromCashflows(cashflows: number[]): number {
  const hasPositiveCashflow = cashflows.some((cashflow) => cashflow > 0);
  const hasNegativeCashflow = cashflows.some((cashflow) => cashflow < 0);
  if (!hasPositiveCashflow || !hasNegativeCashflow) {
    return Number.NaN;
  }

  let low = -0.999999;
  let high = 1.0;
  let npvLow = netPresentValue(cashflows, low);
  let npvHigh = netPresentValue(cashflows, high);

  while (npvHigh > 0 && high < 1e6) {
    high *= 2;
    npvHigh = netPresentValue(cashflows, high);
  }

  if (!(npvLow > 0) || !(npvHigh < 0)) {
    return Number.NaN;
  }

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const mid = (low + high) / 2;
    const npvMid = netPresentValue(cashflows, mid);
    if (npvMid > 0) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
      npvHigh = npvMid;
    }
  }

  void npvLow;
  void npvHigh;
  return (low + high) / 2;
}

function netPresentValue(cashflows: number[], monthlyDiscountRate: number): number {
  const discountBase = 1 + monthlyDiscountRate;
  if (discountBase <= 0) {
    return Number.NaN;
  }

  let npv = 0.0;
  for (let month = 0; month < cashflows.length; month += 1) {
    npv += cashflows[month] / discountBase ** month;
  }
  return npv;
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
