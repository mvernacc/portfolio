// Receives Python-generated scenarios and emits browser-model results for comparison.
import { readFileSync } from "node:fs";
import * as m from "../src/model.ts";
const cases = JSON.parse(readFileSync(process.argv[2], "utf8"));
console.log(
  JSON.stringify(
    cases.map(({ assumptions: a, target }) => {
      const price = m.calcPricePerMTokForTargetIrr(a, target);
      const irr = m.calcIrr(a, price);
      return {
        price,
        irr: Number.isFinite(irr) ? irr : null,
        terms: m.calcProjectFinanceTerms(a),
        cashflows: m.calcMonthlyCashflows(a, price),
      };
    }),
  ),
);
