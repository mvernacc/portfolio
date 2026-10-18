import { optimizeRetirement, retirementPrice } from './retirement.ts';
/** Finance results for presentation, independent of controls and chart libraries. */
import {
  calcIrr, calcMonthlyCashflows,
  type AiDatacenterFinanceModelAssumptions,
} from './model.ts';

export type AssumptionKey = keyof AiDatacenterFinanceModelAssumptions;
export type SweepKey = AssumptionKey | 'equityHurdle';

/** Evaluate a project at its required initial price. NPV uses effective annual returns. */
export function evaluateProject(assumptions: AiDatacenterFinanceModelAssumptions, hurdle: number) {
  const retirement = optimizeRetirement(assumptions, hurdle);
  const { price, retirementMonths } = retirement;
  const cashflows = calcMonthlyCashflows(assumptions, price, retirementMonths);
  const npv = cashflows.net.reduce((sum, value, month) => sum + value / (1 + hurdle) ** (month / 12), 0);
  return { ...retirement, cashflows, npv, irr: calcIrr(assumptions, price, retirementMonths) };
}

/** Hold all other selected inputs fixed; null marks an infeasible price. */
export function sweepPrices(assumptions: AiDatacenterFinanceModelAssumptions, hurdle: number, key: SweepKey, values: number[]) {
  return values.map(value => {
    try {
      return { value, selected: retirementPrice(
        key === 'equityHurdle' ? assumptions : { ...assumptions, [key]: value },
        key === 'equityHurdle' ? value : hurdle) };
    } catch { return { value, selected: null }; }
  });
}
