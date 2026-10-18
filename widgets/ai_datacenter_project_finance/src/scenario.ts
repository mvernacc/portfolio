/** Finance results for presentation, independent of controls and chart libraries. */
import {
  calcIrr, calcMonthlyCashflows, calcPricePerMTokForTargetIrr,
  type AiDatacenterFinanceModelAssumptions,
} from './model.ts';

export type AssumptionKey = keyof AiDatacenterFinanceModelAssumptions;
export type SweepKey = AssumptionKey | 'equityHurdle';

/** Evaluate a project at its required initial price. NPV uses effective annual returns. */
export function evaluateProject(assumptions: AiDatacenterFinanceModelAssumptions, hurdle: number) {
  const price = calcPricePerMTokForTargetIrr(assumptions, hurdle);
  const cashflows = calcMonthlyCashflows(assumptions, price);
  const npv = cashflows.net.reduce((sum, value, month) => sum + value / (1 + hurdle) ** (month / 12), 0);
  return { price, cashflows, npv, irr: calcIrr(assumptions, price) };
}

/** Hold all other selected inputs fixed; null marks an infeasible price. */
export function sweepPrices(assumptions: AiDatacenterFinanceModelAssumptions, hurdle: number, key: SweepKey, values: number[]) {
  return values.map(value => {
    try {
      return { value, selected: calcPricePerMTokForTargetIrr(
        key === 'equityHurdle' ? assumptions : { ...assumptions, [key]: value },
        key === 'equityHurdle' ? value : hurdle) };
    } catch { return { value, selected: null }; }
  });
}
