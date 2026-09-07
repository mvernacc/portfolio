"""Accounting checks and full monthly Python/TypeScript parity; run as a script."""

from dataclasses import asdict, replace
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import numpy as np
from ai_datacenter_project_finance_toy_model import (
    AiDatacenterFinanceModelAssumptions as Assumptions,
    calc_project_finance_terms,
    calc_price_per_Mtok_for_target_irr,
    calc_monthly_cashflows,
    calc_irr,
    PriceExample,
)

ROOT = Path(__file__).resolve().parents[3]


def camel(name):
    special = {
        "energy_cost_per_MWh": "energyCostPerMWh",
        "capacity_charge_per_kW_month": "capacityChargePerKWMonth",
    }
    first, *rest = name.split("_")
    return special.get(name, first + "".join(p.title() for p in rest))


class FinanceTests(unittest.TestCase):
    def test_historical_price(self):
        a = Assumptions(
            revenue_fraction=0.5, facility_residual_fraction=0, idle_power_fraction=0
        )
        self.assertAlmostEqual(
            calc_price_per_Mtok_for_target_irr(a, 0.15), 11.37426337099161
        )

    def test_debt_and_capital_accounting(self):
        a = Assumptions()
        t = calc_project_finance_terms(a)
        balance = t.debt_balance_at_operations_start
        for _ in range(60):
            balance = (
                balance * (1 + a.debt_interest_rate / 12) - t.term_loan_monthly_payment
            )
        self.assertAlmostEqual(balance, 0, places=5)
        self.assertAlmostEqual(
            t.equity_monthly_construction_capex * 24, a.capex * (1 - a.debt_fraction)
        )
        zero = calc_project_finance_terms(replace(a, debt_interest_rate=0))
        self.assertAlmostEqual(
            zero.debt_balance_at_operations_start, a.capex * a.debt_fraction
        )
        self.assertAlmostEqual(
            zero.term_loan_monthly_payment * 60, a.capex * a.debt_fraction
        )

    def test_terminal_value_discount(self):
        a = Assumptions()
        with_sale = calc_price_per_Mtok_for_target_irr(a, 0.15)
        without_sale = calc_price_per_Mtok_for_target_irr(
            replace(a, facility_residual_fraction=0), 0.15
        )
        t = calc_project_finance_terms(a)
        output_pv = sum(
            t.billable_output_annual / 12 / 1.15 ** (m / 12) for m in range(25, 85)
        )
        self.assertAlmostEqual(without_sale - with_sale, 5e6 / 1.15**7 / output_pv)

    def test_tariff_and_trends(self):
        a = Assumptions(
            utilization=0.5, idle_power_fraction=0.2, capacity_charge_per_kW_month=10
        )
        t = calc_project_finance_terms(a)
        self.assertAlmostEqual(t.energy_annual_opex, 0.6 * 1.2 * 90 * 8766)
        self.assertAlmostEqual(t.capacity_annual_opex, 144000)
        c = calc_monthly_cashflows(
            replace(a, price_annual_erosion=0.2, throughput_annual_change=0.25), 10
        )
        self.assertAlmostEqual(c["revenue"][25], c["revenue"][37])
        c = calc_monthly_cashflows(replace(a, throughput_annual_change=-0.2), 10)
        self.assertAlmostEqual(c["revenue"][37] / c["revenue"][25], 0.8)

    def test_invalid_and_billing(self):
        for patch in [
            {"debt_fraction": 1},
            {"pue": 0.5},
            {"throughput": float("nan")},
            {"utilization": 1.1},
            {"operating_years": 0.01},
            {"price_annual_erosion": 1},
        ]:
            with self.assertRaises(ValueError):
                calc_price_per_Mtok_for_target_irr(
                    replace(Assumptions(), **patch), 0.15
                )
        example = PriceExample("test", "test", 2026, "September", 10, 2, 0.5)
        self.assertAlmostEqual(example.effective_price_per_Mtok_output(3, 0.5), 13.75)

    def test_cross_language_cashflows_and_npv(self):
        patches = [
            {},
            {"construction_years": 4.5},
            {"debt_fraction": 0},
            {"debt_interest_rate": 0},
            {"price_annual_erosion": 0.05, "throughput_annual_change": 0.03},
            {"price_annual_erosion": 0.8},
            {"throughput_annual_change": -0.2},
            {"facility_residual_fraction": 0},
            {"capacity_charge_per_kW_month": 15, "utilization": 0.4},
            {"construction_years": 1 / 12, "operating_years": 1 / 12},
        ]
        cases = [
            (replace(Assumptions(), **patch), h)
            for patch in patches
            for h in (0, 0.1, 0.15, 0.2)
        ]
        payload = [
            {"assumptions": {camel(k): v for k, v in asdict(a).items()}, "target": h}
            for a, h in cases
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cases.json"
            path.write_text(json.dumps(payload))
            completed = subprocess.run(
                [
                    "node",
                    str(
                        ROOT / "widgets/ai_datacenter_project_finance/tests/parity.mjs"
                    ),
                    str(path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
        outputs = json.loads(completed.stdout)
        for (a, h), actual in zip(cases, outputs, strict=True):
            price = calc_price_per_Mtok_for_target_irr(a, h)
            self.assertAlmostEqual(actual["price"], price, places=7)
            c = calc_monthly_cashflows(a, price)
            npv = sum(c["net"] / (1 + h) ** (c["months"] / 12))
            self.assertAlmostEqual(npv, 0, places=5)
            for key, values in c.items():
                np.testing.assert_allclose(
                    actual["cashflows"][camel(key)], values, rtol=1e-9, atol=1e-7
                )
            for key, value in asdict(calc_project_finance_terms(a)).items():
                np.testing.assert_allclose(
                    actual["terms"][camel(key)], value, rtol=1e-9, atol=1e-7
                )
            irr = calc_irr(a, price, False)
            if np.isfinite(irr):
                self.assertAlmostEqual(actual["irr"], irr, places=7)
                self.assertAlmostEqual(irr, h, places=7)
            else:
                self.assertIsNone(actual["irr"])


if __name__ == "__main__":
    unittest.main()
