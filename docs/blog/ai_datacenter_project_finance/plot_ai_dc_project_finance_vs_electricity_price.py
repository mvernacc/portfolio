import matplotlib
import numpy as np
from ai_datacenter_project_finance_toy_model import (
    AiDatacenterFinanceModelAssumptions,
    calc_price_per_Mtok_for_target_irr,
)

matplotlib.use("Agg")
from matplotlib import pyplot as plt

electricity_prices = np.linspace(0, 200, 101)  # [USD / MWh]
construction_years = np.arange(6, 49) / 12  # [year]
capex = np.linspace(1e6, 100e6)  # [USD/MW]
THROUGHPUT = 1e5  # [Tok s^-1 MW^-1]

revenue_fraction_colors = [
    (0.5, "tab:blue"),
    (0.8, "tab:orange"),
]


def calc_prices_for_assumption_values(
    a: AiDatacenterFinanceModelAssumptions,
    field_name: str,
    field_values: np.ndarray,
    target_irr: float,
) -> np.ndarray:
    prices = np.zeros_like(field_values)
    for i in range(len(field_values)):
        setattr(a, field_name, field_values[i])
        prices[i] = calc_price_per_Mtok_for_target_irr(a, target_irr)
    return prices


def plot_prices_for_assumption_values(
    field_name: str,
    field_values: np.ndarray,
    xlabel: str,
    output_path: str,
) -> None:
    fig, ax = plt.subplots()

    # First, plot the price floor: debt and equity at risk-free rate, 100% revenue-generating use.
    risk_free_rate = 0.04  # [1/year] Typical 2025-2026 5-year US treasury rate.
    assumptions = AiDatacenterFinanceModelAssumptions()
    assumptions.throughput = THROUGHPUT
    assumptions.revenue_fraction = 1.0
    assumptions.debt_interest_rate = risk_free_rate
    min_prices = calc_prices_for_assumption_values(
        assumptions, field_name, field_values, risk_free_rate
    )
    ax.fill_between(
        field_values,
        np.zeros_like(field_values),
        min_prices,
        color="gray",
        alpha=0.5,
    )
    ax.text(
        x=0.05,
        y=0.02,
        s="Below model's risk-free-rate price floor",
        fontsize=8,
        ha="left",
        va="bottom",
        color="gray",
        transform=ax.transAxes,
    )

    target_irr_low = 0.10
    target_irr_mid = 0.15
    target_irr_high = 0.20
    assumptions = AiDatacenterFinanceModelAssumptions()
    assumptions.throughput = THROUGHPUT
    for rf, color in revenue_fraction_colors:
        assumptions.revenue_fraction = rf

        prices_low = calc_prices_for_assumption_values(
            assumptions, field_name, field_values, target_irr_low
        )
        prices_mid = calc_prices_for_assumption_values(
            assumptions, field_name, field_values, target_irr_mid
        )
        prices_high = calc_prices_for_assumption_values(
            assumptions, field_name, field_values, target_irr_high
        )

        ax.fill_between(
            field_values,
            prices_low,
            prices_high,
            color=color,
            alpha=0.2,
        )
        ax.plot(
            field_values,
            prices_mid,
            color=color,
            label=f"revenue fraction = {rf:.1f}, IRR = {100 * target_irr_mid:.0f}%",
        )

    ax.grid(True, which="major", axis="both", linewidth=0.5, color=(0.7, 0.7, 0.7))
    ax.legend(loc="upper right")
    ax.set_xlim(field_values[0], field_values[-1])
    ax.set_ylim(0.0, ax.get_ylim()[1])
    ax.set_ylabel("Inference price\ndollars / million output tokens")
    ax.set_xlabel(xlabel)
    ax.set_title(f"Assumed throughput: {THROUGHPUT:,.0f} output tokens / s / MW")
    fig.tight_layout()
    fig.savefig(output_path, dpi=200)
    print(f"Saved plot to {output_path}")


plot_prices_for_assumption_values(
    field_name="energy_cost_per_MWh",
    field_values=electricity_prices,
    xlabel="Electricity price\ndollars / megawatt-hour",
    output_path="ai_dc_project_finance_vs_electricity_price.png",
)
plot_prices_for_assumption_values(
    field_name="construction_years",
    field_values=construction_years,
    xlabel="Construction period\nyears",
    output_path="ai_dc_project_finance_vs_construction_years.png",
)

plot_prices_for_assumption_values(
    field_name="capex",
    field_values=capex,
    xlabel="CAPEX\ndollars per megawatt of compute",
    output_path="ai_dc_project_finance_vs_capex.png",
)
