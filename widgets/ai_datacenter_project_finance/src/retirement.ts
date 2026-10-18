/** Perfect-foresight retirement for one compute cohort, with fixed loan maturity.
 * Evaluate each month in O(maximum life), sharing discounted cashflow prefixes.
 * The legacy fixed-horizon solver in model.ts remains a reference calculation.
 */
import { calcProjectFinanceTerms, yearsToMonths, type AiDatacenterFinanceModelAssumptions } from './model.ts';

export const RETIREMENT_POLICY = 'monthly-perfect-foresight-v1';

export function optimizeRetirement(a: AiDatacenterFinanceModelAssumptions, hurdle: number) {
  if (!Number.isFinite(hurdle) || hurdle <= -1) throw new Error('Equity hurdle must be finite and greater than -100%.');
  const terms = calcProjectFinanceTerms(a);
  const maximumOperatingMonths = yearsToMonths(a.operatingYears);
  const discountStep = (1 + hurdle) ** (-1 / 12);
  let discount = 1, costs = 0;
  for (let month = 1; month <= terms.constructionMonths; month++) {
    discount *= discountStep;
    costs += terms.equityMonthlyConstructionCapex * discount;
  }
  let balance = terms.debtBalanceAtOperationsStart;
  let revenueCoefficient = 0;
  let monthlyUnitRevenue = terms.billableOutputAnnual / 12;
  const revenueStep = ((1 - a.priceAnnualErosion) * (1 + a.throughputAnnualChange)) ** (1 / 12);
  const monthlyExpenses = (terms.energyAnnualOpex + terms.capacityAnnualOpex + a.nonEnergyAnnualOpex) / 12 + terms.termLoanMonthlyPayment;
  let bestPrice = Infinity, retirementMonths = maximumOperatingMonths, bestZeroPriceNpv = -Infinity;
  for (let t = 1; t <= maximumOperatingMonths; t++) {
    discount *= discountStep;
    costs += monthlyExpenses * discount;
    revenueCoefficient += monthlyUnitRevenue * discount;
    balance = Math.max(0, balance * (1 + a.debtInterestRate / 12) - terms.termLoanMonthlyPayment);
    // The final scheduled payment extinguishes floating-point rounding residue.
    const payoff = t === maximumOperatingMonths ? 0 : balance;
    const netCosts = costs + (payoff - terms.terminalFacilityValue) * discount;
    const price = Math.max(0, netCosts / revenueCoefficient);
    if (!Number.isFinite(price) || !(revenueCoefficient > 0) || !Number.isFinite(netCosts))
      throw new Error('Retirement cashflows exceed numerical range.');
    // Ascending scan keeps the earliest month on exact ties. If no token revenue
    // is needed, choose the largest NPV at zero price rather than a negative price.
    if (price < bestPrice || (price === 0 && bestPrice === 0 && -netCosts > bestZeroPriceNpv)) {
      bestPrice = price;
      retirementMonths = t;
      bestZeroPriceNpv = -netCosts;
    }
    monthlyUnitRevenue *= revenueStep;
  }
  return { price: bestPrice, retirementMonths, maximumOperatingMonths };
}

export function retirementPrice(a: AiDatacenterFinanceModelAssumptions, hurdle: number) {
  return optimizeRetirement(a, hurdle).price;
}
