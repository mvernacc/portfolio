"""Pre-tax equity cashflows per MW of installed IT capacity.

See notes.md for definitions, equations, source qualifications, and exclusions.
The price solver returns initial revenue per million output tokens, including
associated input revenue, at a specified equity discount rate.
"""

from dataclasses import dataclass, asdict
from math import isfinite, isclose
from typing import Self

import numpy as np
import numpy_financial as npf


@dataclass
class AiDatacenterFinanceModelAssumptions:
    capex: float = 50e6
    """[USD / MW IT] Total initial IT and facility CAPEX."""
    facility_capex_fraction: float = 0.2
    """Reusable facility share of CAPEX; remaining IT hardware has zero residual."""
    facility_residual_fraction: float = 0.5
    """Net terminal facility value / initial facility CAPEX, at the chosen horizon."""
    throughput: float = 1e5
    """Initial aggregate output tok/s/MW installed IT during active serving.

    Includes prefill and decode resources over the full benchmark interval.
    Workload, caching, hardware, and latency requirements must be matched to price.
    """
    throughput_annual_change: float = 0.0
    """Effective annual fractional change at fixed IT capacity and active power; > -1."""
    price_annual_erosion: float = 0.0
    """Effective annual fractional decline in revenue per output token; [0, 1)."""
    pue: float = 1.2
    """Facility power / IT power, assumed constant at active and idle load."""
    utilization: float = 0.9
    """Fraction of capacity-time actively serving; idle remainder still draws power."""
    revenue_fraction: float = 1.0
    """Active capacity share producing billable inference; 1 means inference-only.

    Lower values allocate all costs to billable inference despite internal usage.
    This is a capacity-allocation scenario, not a full training/R&D cost model.
    """
    idle_power_fraction: float = 0.2
    """Idle IT power / installed IT capacity (active power is 1 MW per MW IT)."""
    non_energy_annual_opex: float = 1e6
    """[USD / year / MW IT] Cash costs excluding energy and capital recovery."""
    energy_cost_per_MWh: float = 90.0
    """[USD / MWh facility electricity] Volumetric tariff, excluding separate capacity charge."""
    capacity_charge_per_kW_month: float = 0.0
    """[USD / kW facility / month] Charge on reserved peak facility capacity."""
    construction_years: float = 2.0
    """Equal monthly CAPEX draws, then immediate operations; whole months."""
    operating_years: float = 5.0
    """Economic horizon before IT replacement; whole months."""
    debt_fraction: float = 0.65
    """Debt / initial CAPEX, excluding capitalized interest; [0, 1)."""
    debt_interest_rate: float = 0.085
    """Nominal annual debt rate, compounded monthly, nonnegative."""


@dataclass(frozen=True)
class ProjectFinanceTerms:
    energy_annual_opex: float
    """[USD / year / MW IT] Volumetric electricity expense."""
    capacity_annual_opex: float
    """[USD / year / MW IT] Reserved facility power expense."""
    terminal_facility_value: float
    """[USD / MW IT] Net proceeds received with final operating cashflow."""
    equity_monthly_construction_capex: float
    debt_balance_at_operations_start: float
    term_loan_monthly_payment: float
    construction_months: int
    project_duration_months: int
    cashflow_duration_months: int
    billable_output_annual: float
    """[million output tokens / year / MW IT] Initial annualized output, before trend."""


HOURS_PER_YEAR = 24 * 365.25
SECONDS_PER_YEAR = 60 * 60 * HOURS_PER_YEAR
MONTHS_PER_YEAR = 12


def years_to_months(years: float) -> int:
    if not isfinite(years):
        raise ValueError("Duration must be finite.")
    months = 12 * years
    rounded = round(months)
    if not isclose(months, rounded, rel_tol=1e-9, abs_tol=1e-9):
        raise ValueError("Duration must be an integer number of months.")
    return rounded


def validate_assumptions(a: AiDatacenterFinanceModelAssumptions) -> None:
    if not all(isfinite(v) for v in asdict(a).values()):
        raise ValueError("All assumptions must be finite.")
    for name in ("capex", "throughput", "construction_years", "operating_years"):
        if getattr(a, name) <= 0:
            raise ValueError(f"{name} must be positive.")
    for name in (
        "facility_capex_fraction",
        "facility_residual_fraction",
        "idle_power_fraction",
    ):
        if not 0 <= getattr(a, name) <= 1:
            raise ValueError(f"{name} must be between 0 and 1.")
    for name in ("utilization", "revenue_fraction"):
        if not 0 < getattr(a, name) <= 1:
            raise ValueError(f"{name} must be greater than 0 and at most 1.")
    for name in ("debt_fraction", "price_annual_erosion"):
        if not 0 <= getattr(a, name) < 1:
            raise ValueError(f"{name} must be at least 0 and less than 1.")
    for name in (
        "non_energy_annual_opex",
        "energy_cost_per_MWh",
        "capacity_charge_per_kW_month",
        "debt_interest_rate",
    ):
        if getattr(a, name) < 0:
            raise ValueError(f"{name} must be nonnegative.")
    if a.pue < 1 or a.throughput_annual_change <= -1:
        raise ValueError("PUE must be >= 1 and throughput annual change must be > -1.")
    for years in (a.construction_years, a.operating_years):
        if years_to_months(years) < 1:
            raise ValueError("Each duration must be at least one whole month.")


def calc_project_finance_terms(
    a: AiDatacenterFinanceModelAssumptions,
) -> ProjectFinanceTerms:
    validate_assumptions(a)
    average_it_power = a.utilization + (1 - a.utilization) * a.idle_power_fraction
    energy_annual_opex = (
        average_it_power * a.pue * a.energy_cost_per_MWh * HOURS_PER_YEAR
    )
    capacity_annual_opex = 1000 * a.pue * a.capacity_charge_per_kW_month * 12
    terminal_facility_value = (
        a.capex * a.facility_capex_fraction * a.facility_residual_fraction
    )
    construction_months = years_to_months(a.construction_years)
    operating_months = years_to_months(a.operating_years)
    monthly_rate = a.debt_interest_rate / 12
    monthly_capex = a.capex / construction_months
    debt_balance = 0.0
    for _ in range(construction_months):
        debt_balance = (
            debt_balance * (1 + monthly_rate) + a.debt_fraction * monthly_capex
        )
    payment = float(-npf.pmt(monthly_rate, operating_months, debt_balance))
    return ProjectFinanceTerms(
        energy_annual_opex=energy_annual_opex,
        capacity_annual_opex=capacity_annual_opex,
        terminal_facility_value=terminal_facility_value,
        equity_monthly_construction_capex=(1 - a.debt_fraction) * monthly_capex,
        debt_balance_at_operations_start=debt_balance,
        term_loan_monthly_payment=payment,
        construction_months=construction_months,
        project_duration_months=construction_months + operating_months,
        cashflow_duration_months=construction_months + operating_months,
        billable_output_annual=a.utilization
        * a.revenue_fraction
        * a.throughput
        * SECONDS_PER_YEAR
        * 1e-6,
    )


def calc_monthly_cashflows(
    a: AiDatacenterFinanceModelAssumptions, price_per_Mtok: float
) -> dict[str, np.ndarray]:
    """Price is initial total workload revenue per million billable output tokens.

    Operating month k uses trends at (k-1)/12 years; payment arrives at month end.
    Facility sale occurs only at the end of the final operating month.
    """
    if not isfinite(price_per_Mtok) or price_per_Mtok < 0:
        raise ValueError("Initial price must be finite and nonnegative.")
    t = calc_project_finance_terms(a)
    months = np.arange(t.cashflow_duration_months + 1)
    c = {
        key: np.zeros(len(months))
        for key in (
            "revenue",
            "equity_construction_capex",
            "non_energy_opex",
            "energy_opex",
            "capacity_opex",
            "debt_service",
            "terminal_value",
            "net",
        )
    }
    c["months"] = months
    c["equity_construction_capex"][
        1 : t.construction_months + 1
    ] = -t.equity_monthly_construction_capex
    for month in range(t.construction_months + 1, t.project_duration_months + 1):
        age = (month - t.construction_months - 1) / 12
        output = t.billable_output_annual / 12 * (1 + a.throughput_annual_change) ** age
        price = price_per_Mtok * (1 - a.price_annual_erosion) ** age
        c["revenue"][month] = output * price
        c["non_energy_opex"][month] = -a.non_energy_annual_opex / 12
        c["energy_opex"][month] = -t.energy_annual_opex / 12
        c["capacity_opex"][month] = -t.capacity_annual_opex / 12
        c["debt_service"][month] = -t.term_loan_monthly_payment
    c["terminal_value"][-1] = t.terminal_facility_value
    c["net"] = sum(values for key, values in c.items() if key not in ("months", "net"))
    if not all(np.isfinite(v).all() for v in c.values()):
        raise ValueError("Cashflows exceed numerical range; reduce rates or horizon.")
    return c


def calc_price_per_Mtok_for_target_irr(
    a: AiDatacenterFinanceModelAssumptions, target_irr_annual: float
) -> float:
    """Solve equity NPV=0 for initial price at an effective annual discount rate.

    With nonconventional cashflows this defines the discount-rate hurdle, not a
    claim of a unique IRR. Negative-price solutions are outside the model domain.
    """
    if not isfinite(target_irr_annual) or target_irr_annual <= -1:
        raise ValueError("Annual IRR target must be finite and greater than -100%.")
    # Revenue at unit initial price is the coefficient of the unknown price.
    c = calc_monthly_cashflows(a, 1.0)
    discounts = (1 + target_irr_annual) ** (-c["months"] / 12)
    costs = sum(-v for key, v in c.items() if key not in ("months", "revenue", "net"))
    denominator = float(np.dot(c["revenue"], discounts))
    numerator = float(np.dot(costs, discounts))
    if not isfinite(denominator) or denominator <= 0 or not isfinite(numerator):
        raise ValueError("Discounted cashflows exceed numerical range.")
    price = numerator / denominator
    if not isfinite(price) or price < 0:
        raise ValueError("No finite nonnegative price achieves exactly the target NPV.")
    return price


def calc_irr(
    a: AiDatacenterFinanceModelAssumptions,
    price_per_Mtok: float,
    print_operating_cashflows: bool = True,
) -> float:
    """Effective annual equity IRR; NaN for absent or multiple cashflow sign changes.

    Price erosion plus terminal proceeds can make cashflows nonconventional;
    report NPV at the target instead of selecting an arbitrary IRR in that case.
    """
    c = calc_monthly_cashflows(a, price_per_Mtok)
    net = c["net"]
    meaningful = net[np.abs(net) > np.max(np.abs(net)) * 1e-12]
    signs = np.sign(meaningful)
    if len(signs) < 2 or signs[0] >= 0 or np.count_nonzero(np.diff(signs)) != 1:
        annual = float("nan")
    else:
        annual = float((1 + npf.irr(net)) ** 12 - 1)
    if print_operating_cashflows:
        print(
            f"Initial workload revenue: {price_per_Mtok:.4f} USD / million output tokens"
        )
        print(f"Annual pre-tax equity IRR: {annual:.2%}")
    return annual


# Price examples
@dataclass
class PriceExample:
    provider: str
    model: str
    year: int
    month: str
    output_price_per_MTok: float  # [USD / MTok]
    input_price_per_MTok: float  # [USD / MTok]
    cached_input_price_per_MTok: float | None = None

    def effective_price_per_Mtok_output(
        self: Self,
        input_tokens_per_output_token: float = 3.0,
        cached_input_fraction: float = 0.0,
    ) -> float:
        """Total workload revenue / million output tokens; throughput must match workload."""
        r, c = input_tokens_per_output_token, cached_input_fraction
        if not isfinite(r) or r < 0 or not isfinite(c) or not 0 <= c <= 1:
            raise ValueError(
                "Input/output ratio must be nonnegative and cache fraction in [0,1]."
            )
        if c > 0 and self.cached_input_price_per_MTok is None:
            raise ValueError("Cached input tariff is required for cached input.")
        tariffs = [self.output_price_per_MTok, self.input_price_per_MTok]
        if self.cached_input_price_per_MTok is not None:
            tariffs.append(self.cached_input_price_per_MTok)
        if any(not isfinite(v) or v < 0 for v in tariffs):
            raise ValueError("Tariffs must be finite and nonnegative.")
        return self.output_price_per_MTok + r * (
            (1 - c) * self.input_price_per_MTok
            + c * (self.cached_input_price_per_MTok or 0)
        )


PRICE_EXAMPLES = [
    PriceExample(
        provider="OpenAI",
        model="GPT-5.5",
        year=2026,
        month="May",
        output_price_per_MTok=30.0,
        input_price_per_MTok=5.0,
    ),
    PriceExample(
        provider="Anthropic",
        model="Claude Sonnet 4.6",
        year=2026,
        month="May",
        output_price_per_MTok=15.0,
        input_price_per_MTok=3.0,
    ),
    PriceExample(
        provider="Google",
        model="Gemini 3 Flash Preview",
        year=2026,
        month="May",
        output_price_per_MTok=3.0,
        input_price_per_MTok=0.5,
    ),
]

if __name__ == "__main__":
    assumptions = AiDatacenterFinanceModelAssumptions()
    target_irr = 0.15  # [year^-1]
    required_price_per_Mtok = calc_price_per_Mtok_for_target_irr(
        assumptions, target_irr_annual=target_irr
    )
    print(
        f"Initial price required for {100 * target_irr:.1f}% annual equity IRR: "
        f"{required_price_per_Mtok:.2f} USD / MTok\n"
    )
    calc_irr(assumptions, price_per_Mtok=required_price_per_Mtok)
