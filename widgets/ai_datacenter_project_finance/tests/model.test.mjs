import assert from "node:assert/strict";
import { test } from "node:test";
import * as m from "../src/model.ts";

const near = (a, b, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)),
    `${a} != ${b}`,
  );
const scenario = (patch) => ({ ...m.DEFAULT_ASSUMPTIONS, ...patch });

test("historical zero-trend, zero-residual, zero-idle result is preserved", () => {
  const a = scenario({
    revenueFraction: 0.5,
    facilityResidualFraction: 0,
    idlePowerFraction: 0,
  });
  near(m.calcPricePerMTokForTargetIrr(a, 0.15), 11.37426337099161);
});

test("target price gives zero equity NPV and IRR for conventional cashflows", () => {
  for (const patch of [
    {},
    { constructionYears: 4.5 },
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
  near(decay.revenue[37] / decay.revenue[25], 0.8);
});

test("capacity charges use reserved facility kW; idle energy remains", () => {
  const a = scenario({
    utilization: 0.5,
    idlePowerFraction: 0.2,
    capacityChargePerKWMonth: 10,
  });
  const t = m.calcProjectFinanceTerms(a);
  near(t.energyAnnualOpex, 0.6 * 1.2 * 90 * m.HOURS_PER_YEAR);
  near(t.capacityAnnualOpex, 144000);
  near(
    m.calcProjectFinanceTerms({ ...a, utilization: 0.9 }).capacityAnnualOpex,
    t.capacityAnnualOpex,
  );
});

test("terminal proceeds are distinct and occur only once", () => {
  const c = m.calcMonthlyCashflows(scenario({}), 10);
  near(
    c.terminalValue.reduce((a, b) => a + b, 0),
    5e6,
  );
  assert.equal(c.terminalValue.filter((x) => x !== 0).length, 1);
  near(c.terminalValue.at(-1), 5e6);
  for (const i of c.months)
    near(
      c.net[i],
      c.revenue[i] +
        c.equityConstructionCapex[i] +
        c.energyOpex[i] +
        c.capacityOpex[i] +
        c.nonEnergyOpex[i] +
        c.debtService[i] +
        c.terminalValue[i],
    );
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
    { constructionYears: 0.01 },
    { idlePowerFraction: -0.1 },
    { facilityResidualFraction: 1.1 },
    { capacityChargePerKWMonth: -1 },
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
