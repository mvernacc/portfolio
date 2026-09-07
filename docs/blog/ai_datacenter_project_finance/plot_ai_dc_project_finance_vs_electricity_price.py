from dataclasses import replace

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
    (1.0, "tab:blue"),
    (0.5, "tab:orange"),
]


def calc_prices_for_assumption_values(
    a: AiDatacenterFinanceModelAssumptions,
    field_name: str,
    field_values: np.ndarray,
    target_irr: float,
    overrides: dict[str, float] | None = None,
) -> np.ndarray:
    prices = np.zeros_like(field_values, dtype=float)
    for i in range(len(field_values)):
        scenario = replace(a, **{field_name: field_values[i], **(overrides or {})})
        prices[i] = calc_price_per_Mtok_for_target_irr(scenario, target_irr)
    return prices


def plot_prices_for_assumption_values(
    field_name: str,
    field_values: np.ndarray,
    xlabel: str,
    output_path: str,
) -> None:
    fig, ax = plt.subplots()

    # First, plot the low-cost financing reference: 4% effective debt/equity rates, all inference.
    reference_return = 0.04  # [1/year] Illustrative effective annual return, not a live Treasury quote.
    assumptions = AiDatacenterFinanceModelAssumptions()
    assumptions.throughput = THROUGHPUT
    assumptions.revenue_fraction = 1.0
    assumptions.debt_interest_rate = 12 * ((1 + reference_return) ** (1 / 12) - 1)
    min_prices = calc_prices_for_assumption_values(
        assumptions,
        field_name,
        field_values,
        reference_return,
        overrides={
            "revenue_fraction": 1.0,
            "debt_interest_rate": 12 * ((1 + reference_return) ** (1 / 12) - 1),
        },
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
        s="Low-cost financing reference",
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
    ax.set_ylabel("Initial workload revenue\nUSD / million output tokens")
    ax.set_xlabel(xlabel)
    ax.set_title(
        f"Assumed throughput: {THROUGHPUT:,.0f} output tokens / s / MW installed IT"
    )
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
    xlabel="CAPEX\ndollars per MW of installed IT capacity",
    output_path="ai_dc_project_finance_vs_capex.png",
)
