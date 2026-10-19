import assert from "node:assert/strict";
import { test } from "node:test";
import * as m from "../src/model.ts";

const near = (a, b, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)),
    `${a} != ${b}`,
  );
const scenario = (patch) => ({ ...m.DEFAULT_ASSUMPTIONS, ...patch });

test("upfront equipment and commissioning interest follow payment timing", () => {
  const a = scenario({ commissioningYears: 3/12 });
  const terms = m.calcProjectFinanceTerms(a), c = m.calcMonthlyCashflows(a, 1);
  near(c.equityCapex[0], -(1-a.debtFraction)*a.capex);
  assert.equal(c.equityCapex.filter(v=>v!==0).length, 1);
  near(terms.debtBalanceAtOperationsStart, a.capex*a.debtFraction*(1+a.debtInterestRate/12)**3);
  for(let month=1; month<=3; month++) {
    near(c.net[month], -1000*a.coloRentPerKWMonth);
    assert.equal(c.revenue[month], 0);
    assert.equal(c.energyOpex[month], 0);
  }
  assert.ok(c.revenue[4]>0);
  assert.ok(c.energyOpex[4]<0);
});

test("target price gives zero equity NPV and IRR for conventional cashflows", () => {
  for (const patch of [
    {},
    { commissioningYears: 4.5 },
    { debtFraction: 0 },
    { debtInterestRate: 0 },
    { priceAnnualErosion: 0.05, throughputAnnualChange: 0.03 },
    { throughputAnnualChange: -0.03 },
  ]) {
    const a = scenario(patch);
    const p = m.calcPricePerMTokForTargetIrr(a, 0.15);
    const c = m.calcMonthlyCashflows(a, p);
    const npv = c.net.reduce((sum, v, i) => sum + v / 1.15 ** (i / 12), 0);
    near(npv, 0, 1e-6);
    near(m.calcIrr(a, p), 0.15);
  }
});

test("annual trend timing and multiplicative offset", () => {
  const a = scenario({ throughputAnnualChange: 0.25, priceAnnualErosion: 0.2 });
  const flat = m.calcMonthlyCashflows(scenario({}), 10);
  const c = m.calcMonthlyCashflows(a, 10);
  c.revenue.forEach((v, i) => near(v, flat.revenue[i]));
  const decay = m.calcMonthlyCashflows(
    scenario({ priceAnnualErosion: 0.2 }),
    10,
  );
  near(decay.revenue[16] / decay.revenue[4], 0.8);
});

test("rent uses reserved IT kW; PUE applies only to consumed electricity", () => {
  const a = scenario({
    utilization: 0.5,
    idlePowerFraction: 0.2,
    coloRentPerKWMonth: 10,
  });
  const t = m.calcProjectFinanceTerms(a);
  near(t.energyAnnualOpex, 0.6 * 1.2 * 90 * m.HOURS_PER_YEAR);
  near(t.rentAnnualOpex, 120000);
  near(
    m.calcProjectFinanceTerms({ ...a, utilization: 0.9, pue: 1.8 }).rentAnnualOpex,
    t.rentAnnualOpex,
  );
});

test("rent stops at retirement with no salvage or lease penalty", () => {
  const a=scenario({}), c=m.calcMonthlyCashflows(a, 10, 2);
  assert.equal(c.months.at(-1),5);
  near(c.rentOpex.reduce((x,y)=>x+y,0), -5*1000*a.coloRentPerKWMonth);
  assert.ok(!('terminalValue' in c));
  for(const i of c.months) near(c.net[i], c.revenue[i]+c.equityCapex[i]+c.energyOpex[i]+c.rentOpex[i]+c.nonEnergyOpex[i]+c.debtService[i]+c.debtPayoff[i]);
});

test("nonconventional cashflows do not return an arbitrary IRR", () => {
  const a = scenario({ priceAnnualErosion: 0.8 });
  const p = m.calcPricePerMTokForTargetIrr(a, 0.15);
  assert.ok(Number.isNaN(m.calcIrr(a, p)));
  near(
    m
      .calcMonthlyCashflows(a, p)
      .net.reduce((s, v, i) => s + v / 1.15 ** (i / 12), 0),
    0,
    1e-6,
  );
});

test("invalid inputs are rejected", () => {
  for (const patch of [
    { pue: 0.9 },
    { utilization: 1.1 },
    { revenueFraction: 0 },
    { debtFraction: 1 },
    { capex: 0 },
    { throughput: NaN },
    { operatingYears: Infinity },
    { commissioningYears: 0.01 },
    { idlePowerFraction: -0.1 },
    { coloRentPerKWMonth: -1 },
    { priceAnnualErosion: 1 },
    { throughputAnnualChange: -1 },
  ]) {
    assert.throws(() => m.calcPricePerMTokForTargetIrr(scenario(patch), 0.15));
  }
  assert.throws(() => m.calcPricePerMTokForTargetIrr(scenario({}), NaN));
});

test("billing helper separates cached input and output", () => {
  const example = {
    provider: "test",
    model: "test",
    year: 2026,
    month: "September",
    inputPricePerMTok: 2,
    outputPricePerMTok: 10,
    cachedInputPricePerMTok: 0.5,
  };
  near(m.effectivePricePerMTokOutput(example, 3, 0.5), 13.75);
  assert.throws(() =>
    m.effectivePricePerMTokOutput(
      { ...example, cachedInputPricePerMTok: undefined },
      3,
      0.5,
    ),
  );
});
