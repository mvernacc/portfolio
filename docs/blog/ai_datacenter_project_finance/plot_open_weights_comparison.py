"""Reproduce an open-weights comparison from checked-in public evidence.

Run with: uv run --no-project --with numpy --with numpy-financial --with matplotlib
          python docs/blog/ai_datacenter_project_finance/plot_open_weights_comparison.py
No network requests, live tariff lookup, or model-default changes occur here.
"""

import argparse
from datetime import date
from dataclasses import asdict
import csv
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
from matplotlib import pyplot as plt
from matplotlib.ticker import FuncFormatter
import numpy as np

from ai_datacenter_project_finance_toy_model import (
    AiDatacenterFinanceModelAssumptions,
    PriceExample,
    calc_monthly_cashflows,
    calc_price_per_Mtok_for_target_irr,
)

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
OUTPUT = HERE.parents[1] / "assets/images/ai_datacenter_project_finance"
TARGET_IRR = 0.15


def assumptions_for(scenario, hardware, throughput, common):
    capacity_mw = (
        hardware["installed_server_kW_proxy"]
        * (1 + hardware["ancillary_IT_power_fraction"])
        / 1000
    )
    it_capex = (
        (scenario["server_usd"] + hardware["nic_usd"])
        * (1 + scenario["extra_IT_cost_fraction"])
        / capacity_mw
    )
    facility_capex = scenario["facility_usd_per_MW_IT"]
    return AiDatacenterFinanceModelAssumptions(
        **common,
        capex=it_capex + facility_capex,
        facility_capex_fraction=facility_capex / (it_capex + facility_capex),
        throughput=throughput,
        utilization=scenario["utilization"],
        operating_years=scenario["operating_years"],
    )


def build_comparison(evidence_file="open_weights_evidence.json"):
    evidence = json.loads((DATA / evidence_file).read_text())
    config = evidence["comparison"]
    benchmarks = json.loads((DATA / config["benchmark_file"]).read_text())
    assert [r["conc"] for r in benchmarks["rows"]] == config["concurrencies"]
    assert all(r["date"] == config["benchmark_date"] for r in benchmarks["rows"])
    hardware = evidence["hardware"]
    capacity_mw = (
        hardware["installed_server_kW_proxy"]
        * (1 + hardware["ancillary_IT_power_fraction"])
        / 1000
    )
    records = []
    for row in benchmarks["rows"]:
        assert row["prefill_tp"] == row["decode_tp"] == config["tensor_parallel_size"]
        assert row["disagg"] is False and row["precision"] == config["precision"]
        assert row["spec_method"] == config["spec_method"]
        assert (
            row["num_prefill_gpu"]
            == row["num_decode_gpu"]
            == config["tensor_parallel_size"]
        )
        metrics = row["metrics"]
        rate = metrics["output_tput_per_gpu"]
        throughput = (
            rate
            * hardware["gpus_per_server"]
            * hardware["replication_efficiency"]
            / capacity_mw
        )
        ratio = metrics["input_tput_per_gpu"] / rate
        record = {
            "benchmark_id": row["id"],
            "concurrency_per_replica": row["conc"],
            "output_tok_s_per_GPU": rate,
            "output_tok_s_per_MW_IT": throughput,
            "input_output_ratio": ratio,
            "mean_streaming_tok_s_user": metrics["mean_intvty"],
            "p99_ttft_seconds": metrics["p99_ttft"],
        }
        for scenario in evidence["scenarios"]:
            a = assumptions_for(
                scenario, hardware, throughput, evidence["common_model_assumptions"]
            )
            price = calc_price_per_Mtok_for_target_irr(a, TARGET_IRR)
            c = calc_monthly_cashflows(a, price)
            assert abs(sum(c["net"] / (1 + TARGET_IRR) ** (c["months"] / 12))) < 1e-5
            record[scenario["name"]] = price
        for tariff in evidence["prices"]:
            example = PriceExample(
                tariff["provider"],
                evidence["model"],
                date.fromisoformat(evidence["retrieved_on"]).year,
                date.fromisoformat(evidence["retrieved_on"]).strftime("%B"),
                tariff["output_per_million"],
                tariff["input_per_million"],
            )
            record[tariff["provider"]] = example.effective_price_per_Mtok_output(ratio)
        records.append(record)
    assert all(r["Lower cost"] <= r["Central"] <= r["Higher cost"] for r in records)
    with (DATA / f"{config['csv_prefix']}.csv").open("w") as f:
        writer = csv.DictWriter(f, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)
    settings = {
        s["name"]: asdict(
            assumptions_for(s, hardware, 1e6, evidence["common_model_assumptions"])
        )
        for s in evidence["scenarios"]
    }
    (DATA / f"{config['csv_prefix']}_assumptions.json").write_text(
        json.dumps(
            {
                "target_irr": TARGET_IRR,
                "installed_IT_MW_per_server_with_ancillary": capacity_mw,
                "scenario_assumptions_at_one_million_tok_s_MW": settings,
            },
            indent=2,
        )
        + "\n"
    )
    return evidence, records


def plot(evidence, records):
    config = evidence["comparison"]
    plt.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "font.size": 11,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "svg.fonttype": "none",
        }
    )
    fig, (ax, lat) = plt.subplots(
        2,
        1,
        figsize=(11, 8.7),
        sharex=True,
        gridspec_kw={"height_ratios": [3, 1.2], "hspace": 0.12},
    )
    fig.subplots_adjust(left=0.10, right=0.96, top=0.85, bottom=0.23)
    fig.suptitle(
        f"{config['title']}: cost recovery vs. API tariffs",
        x=0.10,
        ha="left",
        y=0.97,
        fontsize=19,
        fontweight="bold",
    )
    fig.text(
        0.10,
        0.915,
        config["subtitle"],
        fontsize=11,
        color="#475569",
    )
    fig.text(
        0.10,
        0.885,
        f"Benchmark: {config['benchmark_date']}   |   Public prices retrieved: {evidence['retrieved_on']}",
        fontsize=10,
        color="#64748b",
    )
    x = np.array([r["output_tok_s_per_MW_IT"] / 1e6 for r in records])
    grid = np.linspace(min(x), max(x), 250)
    curves = {}
    for scenario in evidence["scenarios"]:
        curves[scenario["name"]] = [
            calc_price_per_Mtok_for_target_irr(
                assumptions_for(
                    scenario,
                    evidence["hardware"],
                    t * 1e6,
                    evidence["common_model_assumptions"],
                ),
                TARGET_IRR,
            )
            for t in grid
        ]
    ax.fill_between(
        grid,
        curves["Lower cost"],
        curves["Higher cost"],
        color="#3b82f6",
        alpha=0.15,
        label="Assumption range (not a confidence interval)",
    )
    ax.plot(
        grid,
        curves["Central"],
        color="#1d4ed8",
        lw=2.4,
        label="Central capital-recovery estimate",
    )
    ax.scatter(x, [r["Central"] for r in records], s=40, color="#1d4ed8", zorder=5)
    plotted_tariffs = [t for t in evidence["prices"] if t.get("plot")]
    for tariff in plotted_tariffs:
        y = [r[tariff["provider"]] for r in records]
        ax.plot(x, y, color=tariff["color"], lw=2, ls="--", label=tariff["plot_label"])
    price_max = max(r[t["provider"]] for t in plotted_tariffs for r in records)
    ax.set_ylim(0, max(price_max * 1.35, max(curves["Higher cost"]) * 1.08))
    ax.set_ylabel(
        "USD per million output tokens\nincluding associated input revenue", labelpad=10
    )
    ax.grid(axis="y", alpha=0.18)
    ax.legend(loc="upper right", fontsize=9, frameon=True, framealpha=0.95)
    ax.text(
        0.015,
        0.96,
        "Market references, not measured provider margins",
        transform=ax.transAxes,
        va="top",
        fontsize=9,
        color="#64748b",
    )
    lat.plot(
        x, [r["p99_ttft_seconds"] for r in records], color="#475569", marker="o", lw=1.8
    )
    for xv, r in zip(x, records):
        lat.annotate(
            f"{r['concurrency_per_replica']}",
            (xv, r["p99_ttft_seconds"]),
            xytext=(0, 7),
            textcoords="offset points",
            ha="center",
            fontsize=9,
        )
    lat.set_ylabel(config["latency_label"])
    lat.set_ylim(0, max(r["p99_ttft_seconds"] for r in records) * 1.3)
    lat.set_xlabel(
        "Million output tokens / second / MW of installed IT capacity", labelpad=12
    )
    lat.xaxis.set_major_formatter(FuncFormatter(lambda value, pos: f"{value:.1f}"))
    lat.grid(axis="y", alpha=0.18)
    lat.text(
        0.025,
        0.91,
        config["concurrency_label"],
        transform=lat.transAxes,
        fontsize=9,
        color="#64748b",
    )
    fig.text(
        0.10,
        0.105,
        "Range: 50–90% utilization, 3–5-year IT life, and stated hardware/site allowances. All scenarios: 15% equity hurdle.",
        fontsize=9,
        color="#475569",
    )
    fig.text(
        0.10,
        0.080,
        config["power_note"],
        fontsize=9,
        color="#475569",
    )
    fig.text(
        0.10,
        0.055,
        "Sources: InferenceX raw benchmarks · Exxact server quotes · NVIDIA system specs · Turner & Townsend · provider tariffs",
        fontsize=9,
        color="#475569",
    )
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for suffix in ["png", "svg"]:
        fig.savefig(
            OUTPUT / f"{config['artifact_prefix']}_cost_comparison.{suffix}",
            dpi=180,
            facecolor="white",
        )
    plt.close(fig)
    print(f"Saved comparison in {OUTPUT}")
    for r in records:
        print(
            {
                key: r[key]
                for key in [
                    "concurrency_per_replica",
                    "Lower cost",
                    "Central",
                    "Higher cost",
                    "p99_ttft_seconds",
                ]
                + [t["provider"] for t in plotted_tariffs]
            }
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=["gpt-oss", "qwen35"], default="gpt-oss")
    args = parser.parse_args()
    filename = (
        "open_weights_evidence.json"
        if args.case == "gpt-oss"
        else "qwen35_evidence.json"
    )
    plot(*build_comparison(filename))
