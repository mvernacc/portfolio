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

/** Hold all other inputs fixed. Null points are infeasible, never silently zero cost.
 * Reference overrides follow the sweep, preserving 4% effective debt/equity and
 * fully billable inference even when one of those assumptions is being swept.
 */
export function sweepPrices(assumptions: AiDatacenterFinanceModelAssumptions, hurdle: number, key: SweepKey, values: number[]) {
  return values.map(value => {
    const selected = key === 'equityHurdle' ? assumptions : { ...assumptions, [key]: value };
    const selectedHurdle = key === 'equityHurdle' ? value : hurdle;
    const price = (a: AiDatacenterFinanceModelAssumptions, h: number) => {
      try { return calcPricePerMTokForTargetIrr(a, h); }
      catch { return null; }
    };
    return {
      value,
      selected: price(selected, selectedHurdle),
      reference: price({ ...selected, debtInterestRate: 12 * (1.04 ** (1 / 12) - 1), revenueFraction: 1 }, 0.04),
    };
  });
}
