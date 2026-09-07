import matplotlib
import numpy as np
from ai_datacenter_project_finance_toy_model import (
    PRICE_EXAMPLES,
    AiDatacenterFinanceModelAssumptions,
    calc_price_per_Mtok_for_target_irr,
)

matplotlib.use("Agg")
from matplotlib import pyplot as plt

default_assumptions = AiDatacenterFinanceModelAssumptions()
throughputs = np.logspace(4, 6)  # [Tok/s/MW]
OUTPUT_PATH = "ai_dc_project_finance.png"

revenue_fraction_colors = [
    (1.0, "tab:blue"),
    (0.5, "tab:orange"),
]


def calc_prices_for_throughputs(
    a: AiDatacenterFinanceModelAssumptions,
    throughputs: np.ndarray,
    target_irr: float,
) -> np.ndarray:
    prices = np.zeros_like(throughputs)
    for i in range(len(throughputs)):
        a.throughput = throughputs[i]
        prices[i] = calc_price_per_Mtok_for_target_irr(a, target_irr)
    return prices


fig, ax = plt.subplots()

# First, plot the low-cost financing reference: 4% effective debt/equity rates, all inference.
reference_return = (
    0.04  # [1/year] Illustrative effective annual return, not a live Treasury quote.
)
assumptions = AiDatacenterFinanceModelAssumptions()
assumptions.revenue_fraction = 1.0
assumptions.debt_interest_rate = 12 * ((1 + reference_return) ** (1 / 12) - 1)
min_prices = calc_prices_for_throughputs(assumptions, throughputs, reference_return)
ax.fill_between(
    throughputs,
    np.zeros_like(throughputs),
    min_prices,
    color="gray",
    alpha=0.5,
)
ax.text(
    x=0.05,
    y=0.10,
    s="Low-cost financing\nreference",
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
for rf, color in revenue_fraction_colors:
    assumptions.revenue_fraction = rf

    prices_low = calc_prices_for_throughputs(assumptions, throughputs, target_irr_low)
    prices_mid = calc_prices_for_throughputs(assumptions, throughputs, target_irr_mid)
    prices_high = calc_prices_for_throughputs(assumptions, throughputs, target_irr_high)

    ax.fill_between(
        throughputs,
        prices_low,
        prices_high,
        color=color,
        alpha=0.2,
    )
    ax.plot(
        throughputs,
        prices_mid,
        color=color,
        label=f"revenue fraction = {rf:.1f}, IRR = {100 * target_irr_mid:.0f}%",
    )

for p in PRICE_EXAMPLES:
    price = p.effective_price_per_Mtok_output()
    ax.axhline(price, color="black", linestyle=":")
    ax.text(
        x=0.98,
        y=price,
        s=p.model,
        fontsize=8,
        ha="right",
        va="bottom",
        transform=ax.get_yaxis_transform(),
    )
ax.text(
    x=0.98,
    y=0.80,
    s="May 2026 tariff examples; input = 3x output",
    fontsize=8,
    ha="right",
    va="bottom",
    transform=ax.transAxes,
)

ax.set_xscale("log")
ax.grid(True, which="major", axis="x", linewidth=0.5, color=(0.7, 0.7, 0.7))
ax.grid(True, which="minor", axis="x", linewidth=0.2, color=(0.7, 0.7, 0.7))
ax.legend(loc="upper right")
ax.set_xlim(throughputs[0], throughputs[-1])
ax.set_ylim(0.0, 75.0)
ax.set_ylabel("Initial workload revenue\nUSD / million output tokens")
ax.set_xlabel("Throughput\noutput tokens / second / MW of installed IT capacity")
fig.tight_layout()
fig.savefig(OUTPUT_PATH, dpi=200)
print(f"Saved plot to {OUTPUT_PATH}")
