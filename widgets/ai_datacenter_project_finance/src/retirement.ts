/** Perfect-foresight retirement for one compute cohort, with fixed loan maturity.
 * Evaluate each month in O(maximum life), sharing discounted cashflow prefixes.
 * The legacy fixed-horizon solver in model.ts remains a reference calculation.
 */
import { calcProjectFinanceTerms, yearsToMonths, type AiDatacenterFinanceModelAssumptions } from './model.ts';

export const RETIREMENT_POLICY = 'colocation-upfront-monthly-v2';

export function optimizeRetirement(a: AiDatacenterFinanceModelAssumptions, hurdle: number) {
  if (!Number.isFinite(hurdle) || hurdle <= -1) throw new Error('Equity hurdle must be finite and greater than -100%.');
  const terms = calcProjectFinanceTerms(a);
  const maximumOperatingMonths = yearsToMonths(a.operatingYears);
  const discountStep = (1 + hurdle) ** (-1 / 12);
  let discount = 1, costs = terms.initialEquityCapex;
  for (let month = 1; month <= terms.commissioningMonths; month++) {
    discount *= discountStep;
    costs += terms.rentAnnualOpex / 12 * discount;
  }
  let balance = terms.debtBalanceAtOperationsStart;
  let revenueCoefficient = 0;
  let monthlyUnitRevenue = terms.billableOutputAnnual / 12;
  const revenueStep = ((1 - a.priceAnnualErosion) * (1 + a.throughputAnnualChange)) ** (1 / 12);
  const monthlyExpenses = (terms.energyAnnualOpex + terms.rentAnnualOpex + a.nonEnergyAnnualOpex) / 12 + terms.termLoanMonthlyPayment;
  let bestPrice = Infinity, retirementMonths = maximumOperatingMonths;
  for (let t = 1; t <= maximumOperatingMonths; t++) {
    discount *= discountStep;
    costs += monthlyExpenses * discount;
    revenueCoefficient += monthlyUnitRevenue * discount;
    balance = Math.max(0, balance * (1 + a.debtInterestRate / 12) - terms.termLoanMonthlyPayment);
    // The final scheduled payment extinguishes floating-point rounding residue.
    const payoff = t === maximumOperatingMonths ? 0 : balance;
    const netCosts = costs + payoff * discount;
    const price = netCosts / revenueCoefficient;
    if (!Number.isFinite(price) || !(revenueCoefficient > 0) || !Number.isFinite(netCosts))
      throw new Error('Retirement cashflows exceed numerical range.');
    // Ascending scan keeps the earliest month on exact ties.
    if (price < bestPrice) {
      bestPrice = price;
      retirementMonths = t;
    }
    monthlyUnitRevenue *= revenueStep;
  }
  return { price: bestPrice, retirementMonths, maximumOperatingMonths };
}

export function retirementPrice(a: AiDatacenterFinanceModelAssumptions, hurdle: number) {
  return optimizeRetirement(a, hurdle).price;
}
