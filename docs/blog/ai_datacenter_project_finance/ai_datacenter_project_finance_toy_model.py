"""A toy model of project finance for an AI datacenter.

Key question: at what price per token can the project deliver an adequate
return to investors? How sensitive is this to various assumptions?

During construction, CAPEX is spent evenly. The debt-financed share is drawn monthly
and interest is capitalized into the loan balance. At commercial operation, the
construction loan converts into an amortizing term loan repaid over the operating
life.
"""

from dataclasses import dataclass
from typing import Self

import numpy as np
import numpy_financial as npf

# Scale everything per megawatt of compute


@dataclass
class AiDatacenterFinanceModelAssumptions:
    capex: float = 50e6
    """[USD / MW] Capital expenditures per MW of compute: includes GPUs and the balance-of-system
    Source for default value: $3.4B - $5.5B+ for 100 MW,
    https://www.alpha-matica.com/post/deconstructing-the-data-center-a-look-at-the-cost-structure-1
    """

    throughput: float = 1e5
    """[TPS / MW] or [Tok / MJ] output tokens per second per MW of compute.

    Effective billable (or internally used) output/decode token throughput per MW of compute
    at the target service quality.

    Input/prefill tokens are accounted for on the pricing side by blending API input
    and output token prices using an assumed input_tokens_per_output_token ratio.
    
    Throughput is in terms of *output* tokens because generating output tokens is typically the computational bottleneck.
    Prefilling input tokens is typically less intensive and more parallelizable.
    Most public throughput benchmarks are reported as output tokens / s, e.g.
    "LLM Inference Performance of NVIDIA Data Center Products",
    https://developer.nvidia.com/deep-learning-performance-training-inference/ai-inference, "LLM Inference" tab.

    Even with the same model on the same hardware, the throughput can vary depending on the context length
    and the choice of throughput vs latency tradeoff (driven by batch size).

    This value is not publicly available for the frontier labs.
    Some public sources indicate the rough order-of-magnitude range to consider:

    * [NVIDIA GTC 2025 Keynote](https://medium.com/@chenwuperth/test-time-compute-balancing-throughput-speed-and-quality-in-llm-thinking-8428c5cf757c)
        1e6 TPS/MW is the middle of the ranges listed for different model size and inference speed values.

    * [TokenPowerBench](https://arxiv.org/abs/2512.03024v1)
        100 J/Tok = 1e4 Tok/MJ is the order of magnitude for several-100-billion parameter open-weights models without
        particular performance-engineering effort. We should consider this a lower bound for the throughput of systems
        built by serious performance engineering teams.
    """

    pue: float = 1.2
    """[dimensionless] power usage effectiveness.

    Total facility electric power / compute power.
    """

    # Operations
    utilization: float = 0.9
    """[dimensionless] Utilization: fraction of time datacenter is running at full capacity.
    Includes outages, maintenance, and times of low demand.
    """
    revenue_fraction: float = 0.5
    """[dimensionless] Fraction of utilization for revenue-generating inference versus internal uses like training, research, etc."""

    non_energy_annual_opex: float = 1e6
    """[USD year^-1 MW^-1] Non-energy operating costs like staff, maintenance, etc, per MW of compute."""

    energy_cost_per_MWh: float = 90.0
    """[USD / MWh] electricity cost (delivered, all-in).

    EIA's 2025 U.S. average industrial retail electricity price was 8.62 cents/kWh, i.e. $86.20/MWh; commercial was 13.41 cents/kWh, i.e. $134.10/MWh.
    Data centers are large high-voltage loads, so industrial is the better anchor than commercial, but the commercial number is useful as an upper sensitivity.
    Source: EIA Electric Power Monthly Table 5.3 (https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=table_5_03).
    """

    # Timeline
    construction_years: float = 2.0
    """[year] Time from first major expenses and loan start to revenue-generating operations.

    Sensitivity range:
    - 1.5 years: powered site, fast-track build, equipment already secured.
    - 2.0-2.5 years: realistic base case for a 50-100 MW AI data center project.
    - 4+ years: greenfield project where utility interconnection is gating.

    JLL's 2026 Global Data Center Outlook says the average build time for a 50 MW data center is 18 months, but also says U.S. equipment lead time averages 42 weeks, developers preorder materials up to 24 months ahead, and 57% of projects had delays of at least three months in 2025. JLL also reports grid connection timelines averaging four years or longer in North America.
    Sources: JLL 2026 Global Data Center Outlook (https://www.jll.com/content/dam/jllcom/en/global/documents/reports/research-reports/26-research-global-data-center-outlook-new.pdf), JLL North America year-end 2025 release (https://www.jll.com/en-us/newsroom/jll-north-america-data-center-report-year-end-2025).
    """

    operating_years: float = 5.0
    """[year] Duration of revenue-generating operations.

    As the GPUs are a majority of the capital cost, this is set by the lifetime of the GPUs
    under the assumed utilization.
    Replacing the GPUs is the end horizon for this project finance model.
    """

    # Financing
    debt_fraction: float = 0.65
    """[dimensionless] Fraction of CAPEX financed with debt (vs equity investment)."""
    debt_interest_rate: float = 0.085
    """[1 / year]"""


@dataclass(frozen=True)
class ProjectFinanceTerms:
    energy_annual_opex: float
    """[USD year^-1 MW^-1] Annual energy costs per MW of compute."""

    equity_monthly_construction_capex: float
    """[USD month^-1 MW^-1] Equity-funded monthly construction CAPEX."""

    debt_balance_at_operations_start: float
    """[USD / MW] Debt balance at start of revenue-generating operations."""

    term_loan_monthly_payment: float
    """[USD month^-1 MW^-1] Monthly term loan payment during revenue-generating operations."""

    construction_months: int
    """[month] Time from first major expenses and loan start to revenue-generating operations."""

    project_duration_months: int
    """[month] Time from first major expenses to end of revenue-generating operations."""

    cashflow_duration_months: int
    """[month] Modeled cashflow duration."""

    billable_output_annual: float
    """[MTok year^-1 MW^-1] Annual billable token output per MW of compute."""


def years_to_months(years: float) -> int:
    """Convert years to an integer number of monthly periods.

    Args:
        years: [year] duration.

    Returns:
        [month] number of monthly periods.
    """
    months = 12 * years  # [month]
    rounded_months = round(months)  # [month]
    if not np.isclose(months, rounded_months):
        raise ValueError(
            f"Duration must be an integer number of months, got {years} years."
        )
    return rounded_months


HOURS_PER_YEAR = 24 * 365.25
SECONDS_PER_YEAR = 60 * 60 * HOURS_PER_YEAR
MONTHS_PER_YEAR = 12


def calc_project_finance_terms(
    a: AiDatacenterFinanceModelAssumptions,
) -> ProjectFinanceTerms:
    """Calculate intermediate project finance terms that do not depend on token price.

    Args:
        a: [dimensionless] assumptions.

    Returns:
        [dimensionless] Intermediate project finance terms.
    """
    # [USD year^-1 MW^-1] Annual energy costs per MW of compute
    energy_annual_opex = a.utilization * a.pue * a.energy_cost_per_MWh * HOURS_PER_YEAR

    construction_months = years_to_months(a.construction_years)  # [month]
    operating_months = years_to_months(a.operating_years)  # [month]
    project_duration_months = construction_months + operating_months  # [month]
    cashflow_duration_months = project_duration_months  # [month]
    debt_monthly_interest_rate = a.debt_interest_rate / MONTHS_PER_YEAR  # [month^-1]

    monthly_construction_capex = a.capex / construction_months  # [USD month^-1 MW^-1]
    equity_monthly_construction_capex = (
        1 - a.debt_fraction
    ) * monthly_construction_capex
    debt_monthly_construction_draw = (
        a.debt_fraction * monthly_construction_capex
    )  # [USD month^-1 MW^-1]
    debt_balance_at_operations_start = 0.0  # [USD / MW]
    for _ in range(construction_months):
        debt_balance_at_operations_start *= 1 + debt_monthly_interest_rate
        debt_balance_at_operations_start += debt_monthly_construction_draw

    term_loan_monthly_payment = abs(
        npf.pmt(
            debt_monthly_interest_rate,
            operating_months,
            debt_balance_at_operations_start,
        )
    )

    # [Tok year^-1 MW^-1] Annual token output per MW of compute
    output_annual = a.utilization * a.throughput * SECONDS_PER_YEAR
    billable_output_annual = a.revenue_fraction * output_annual * 1e-6

    return ProjectFinanceTerms(
        energy_annual_opex=energy_annual_opex,
        equity_monthly_construction_capex=equity_monthly_construction_capex,
        debt_balance_at_operations_start=debt_balance_at_operations_start,
        term_loan_monthly_payment=term_loan_monthly_payment,
        construction_months=construction_months,
        project_duration_months=project_duration_months,
        cashflow_duration_months=cashflow_duration_months,
        billable_output_annual=billable_output_annual,
    )


def discount_factor_sum(
    monthly_discount_rate: float, first_month: int, last_month: int
) -> float:
    """Sum monthly discount factors over a closed interval.

    Args:
        monthly_discount_rate: [month^-1] discount rate.
        first_month: [month] first discounted month.
        last_month: [month] last discounted month.

    Returns:
        [dimensionless] Sum of discount factors.
    """
    if last_month < first_month:
        return 0.0

    periods = last_month - first_month + 1  # [month]
    if np.isclose(monthly_discount_rate, 0.0):
        return float(periods)

    first_discount_factor = (1 + monthly_discount_rate) ** -first_month
    discount_factor_ratio = (1 + monthly_discount_rate) ** -1
    return float(
        first_discount_factor
        * (1 - discount_factor_ratio**periods)
        / (1 - discount_factor_ratio)
    )


def calc_irr(
    a: AiDatacenterFinanceModelAssumptions,
    price_per_Mtok: float,
    print_operating_cashflows: bool = True,
) -> float:
    """Calculate the equity internal rate of return (IRR) for the project.

    Args:
        a: [dimensionless] assumptions.
        price_per_Mtok: [USD / MTok] Price per million output tokens at which revenue-generating inference services are sold.
        print_operating_cashflows: [dimensionless] Whether to print operating cashflows.

    Returns:
        [year^-1] Annualized IRR.
    """
    terms = calc_project_finance_terms(a)
    revenue_annual = (
        price_per_Mtok * terms.billable_output_annual
    )  # [USD year^-1 MW^-1]

    net_annual_cashflow = (
        revenue_annual
        - a.non_energy_annual_opex
        - terms.energy_annual_opex
        - MONTHS_PER_YEAR * terms.term_loan_monthly_payment
    )

    if print_operating_cashflows:
        print(
            "Annual expenses and revenue per MW compute\nduring revenue-generating operations"
        )
        print(f"  Revenue:          {revenue_annual:,.0f} USD")
        print(f"  Non-energy OPEX: ({a.non_energy_annual_opex:,.0f}) USD")
        print(f"  Energy OPEX:     ({terms.energy_annual_opex:,.0f}) USD")
        print(
            f"  Debt payments:   ({MONTHS_PER_YEAR * terms.term_loan_monthly_payment:,.0f}) USD"
        )
        print("  ---------------------------------")
        print(f"  Net:             {net_annual_cashflow:,.0f} USD\n")

    period_months = np.arange(terms.cashflow_duration_months + 1)  # [month]
    monthly_cashflow = np.zeros(
        terms.cashflow_duration_months + 1, dtype=float
    )  # [USD / MW]
    construction_period_months = (period_months > 0) & (
        period_months <= terms.construction_months
    )
    operating_period_months = (period_months > terms.construction_months) & (
        period_months <= terms.project_duration_months
    )
    monthly_cashflow[construction_period_months] -= (
        terms.equity_monthly_construction_capex
    )
    monthly_cashflow[operating_period_months] += revenue_annual / MONTHS_PER_YEAR
    monthly_cashflow[operating_period_months] -= (
        a.non_energy_annual_opex / MONTHS_PER_YEAR
    )
    monthly_cashflow[operating_period_months] -= (
        terms.energy_annual_opex / MONTHS_PER_YEAR
    )
    monthly_cashflow[operating_period_months] -= terms.term_loan_monthly_payment

    irr_monthly = npf.irr(monthly_cashflow)
    irr_annual = (1 + irr_monthly) ** MONTHS_PER_YEAR - 1
    if print_operating_cashflows:
        print(f"Annual equity IRR = {100 * irr_annual:.1f}%")

    return irr_annual


def calc_price_per_Mtok_for_target_irr(
    a: AiDatacenterFinanceModelAssumptions, target_irr_annual: float
) -> float:
    """Calculate token price needed to achieve a target equity IRR.

    Args:
        a: [dimensionless] assumptions.
        target_irr_annual: [year^-1] Target annual equity IRR.

    Returns:
        [USD / MTok] Price for revenue-generating inference services.
    """
    if target_irr_annual <= -1:
        raise ValueError("Annual IRR target must be greater than -100%.")

    terms = calc_project_finance_terms(a)
    if terms.billable_output_annual <= 0:
        raise ValueError("Annual billable token output must be positive.")

    target_irr_monthly = (1 + target_irr_annual) ** (1 / MONTHS_PER_YEAR) - 1
    construction_discount_sum = discount_factor_sum(
        monthly_discount_rate=target_irr_monthly,
        first_month=1,
        last_month=terms.construction_months,
    )
    operating_discount_sum = discount_factor_sum(
        monthly_discount_rate=target_irr_monthly,
        first_month=terms.construction_months + 1,
        last_month=terms.project_duration_months,
    )
    if operating_discount_sum <= 0:
        raise ValueError("Discounted operating period must be positive.")

    annual_opex = a.non_energy_annual_opex + terms.energy_annual_opex
    discounted_costs = (
        terms.equity_monthly_construction_capex * construction_discount_sum
        + (annual_opex / MONTHS_PER_YEAR + terms.term_loan_monthly_payment)
        * operating_discount_sum
    )
    discounted_billable_output = (
        terms.billable_output_annual / MONTHS_PER_YEAR * operating_discount_sum
    )

    return discounted_costs / discounted_billable_output


# Price examples
@dataclass
class PriceExample:
    provider: str
    model: str
    year: int
    month: str
    output_price_per_MTok: float  # [USD / MTok]
    input_price_per_MTok: float  # [USD / MTok]

    def effective_price_per_Mtok_output(
        self: Self, input_tokens_per_output_token: float = 3.0
    ) -> float:
        return (
            self.output_price_per_MTok
            + input_tokens_per_output_token * self.input_price_per_MTok
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
        f"Price required for {100 * target_irr:.1f}% annual equity IRR: "
        f"{required_price_per_Mtok:.2f} USD / MTok\n"
    )
    calc_irr(assumptions, price_per_Mtok=required_price_per_Mtok)
