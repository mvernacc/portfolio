"""Rebuild historical figures from saved evidence, without network access.

uv run --no-project --with matplotlib python <this file>
Data provenance and measurement qualifications live beside the inputs.
"""
import csv
import json
import os
from datetime import datetime
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR', '/tmp/portfolio-matplotlib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.ticker import FuncFormatter

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / 'assets/images/ai_datacenter_project_finance'
DATA = HERE / 'data'
OUT.mkdir(parents=True, exist_ok=True)
COLORS = ['#006e9c', '#b65c26']
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11,
                     'axes.spines.top': False, 'axes.spines.right': False,
                     'axes.labelcolor': '#263640', 'text.color': '#263640',
                     'axes.edgecolor': '#aab7bf', 'svg.fonttype': 'none'})
def date(s): return datetime.fromisoformat(s)
def save(fig, name):
    fig.savefig(OUT / f'{name}.svg', bbox_inches='tight')
    fig.savefig(OUT / f'{name}.png', dpi=180, bbox_inches='tight')
    plt.close(fig)
def calendar(ax):
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y'))
    ax.grid(axis='y', alpha=.2)
    ax.set_axisbelow(True)

with (DATA / 'epoch_gpqa_cost_history.csv').open() as f:
    rows = list(csv.DictReader(f))
fig, ax = plt.subplots(figsize=(8.6, 4.8))
for level, color in zip([.25, .75], COLORS):
    points = sorted([r for r in rows if float(r['chance_adjusted_score_threshold']) == level], key=lambda r:r['release_date'])
    xs = [date(r['release_date']) for r in points]
    ys = [float(r['cost_usd_per_question']) for r in points]
    assert all(y > 0 for y in ys)
    assert all(a >= b for a,b in zip(ys, ys[1:]))
    ax.step(xs, ys, where='post', color=color, linewidth=2, label=f'{level:.0%} chance-adjusted score')
    ax.scatter(xs, ys, color=color, s=25, zorder=3)
ax.set_yscale('log')
ax.set_ylim(.00005, .65)
ax.set_xlim(date('2023-08-01'), date('2026-10-01'))
ax.yaxis.set_major_formatter(FuncFormatter(lambda v,_: f'${v:g}'))
ax.set_ylabel('USD per GPQA Diamond question · log scale')
ax.set_xlabel('Model release date assigned by source')
ax.set_title('Reconstructed cost frontier at fixed benchmark scores', loc='left', fontsize=14, pad=15)
calendar(ax)
ax.legend(loc='upper left', frameon=False, fontsize=10)
fig.text(.02, .015, 'Source: Epoch AI, Figure 2 (Sep 2026). Retrospective costs and token-budget estimates;\nnot archived launch tariffs. Steps connect published records, without extrapolation.', fontsize=9, color='#52616a')
fig.subplots_adjust(bottom=.23, left=.13, top=.89)
save(fig, 'historical_capability_cost')

observations = json.loads((DATA / 'historical_observations.json').read_text())
fig, ax = plt.subplots(figsize=(8.6, 4.8))
for provider,color in zip(['Together','DeepSeek'], COLORS):
    points = [r for r in observations['tariffs'] if r['provider']==provider]
    for i,r in enumerate(points):
        x,y=date(r['date']),8*r['input']+r['output']
        ax.scatter(x,y,color=color,s=48,label=provider if i==0 else None,zorder=3)
        label=f"{r['label']}\n${y:.2f}"
        # The two September observations need opposite-side callouts.
        xytext=(-15,32) if r['label']=='V3.1' else ((25,12) if r['label']=='V3.2-Exp' else (0,12))
        ha='right' if r['label']=='V3.1' else ('left' if r['label']=='V3.2-Exp' else 'center')
        ax.annotate(label,(x,y),xytext=xytext,textcoords='offset points',ha=ha,fontsize=9,
                    arrowprops={'arrowstyle':'-', 'color':color} if provider=='DeepSeek' else None)
ax.set_ylim(0,34)
ax.set_xlim(date('2023-01-01'),date('2027-04-01'))
ax.set_ylabel('USD / million output tokens, including input revenue')
ax.set_xlabel('Announcement / effective date; final point is an Oct 2026 snapshot')
ax.set_title('Selected public API tariffs, normalized to the same token mix',loc='left',fontsize=13,pad=15)
calendar(ax)
ax.legend(loc='upper right',frameon=False)
fig.text(.02,.015,'8 uncached input tokens per output token. Different models and services, not equal capability.\nSources: Together AI and DeepSeek announcements/model page. No interpolation between quotes.',fontsize=9,color='#52616a')
fig.subplots_adjust(bottom=.23,left=.12,top=.89)
save(fig,'historical_provider_tariffs')

fig, ax = plt.subplots(figsize=(8.6,4.1))
rs=observations['throughput_comparisons']
values=[100*(r['ratio']-1) for r in rs]
ax.barh([2,1,0],values,color=[COLORS[0],COLORS[0],COLORS[1]],height=.48)
ax.set_yticks([2,1,0],[r['label'] for r in rs],fontsize=10)
for y,v in zip([2,1,0],values): ax.text(v+1,y,f'+{v:.0f}%',va='center',fontsize=12)
ax.set_xlim(0,61)
ax.set_xlabel('Throughput increase over each comparison’s own baseline (%)')
ax.set_title('Software gains on existing H100 hardware',loc='left',fontsize=14,pad=15)
ax.grid(axis='x',alpha=.2);ax.set_axisbelow(True)
fig.text(.02,.015,'Llama 2 70B. Sources: NVIDIA, Aug 2024 and Apr 2025. Intervals overlap; gains are not additive.\nServer and offline conditions differ; the annual maximum is not a fleet-average growth rate.',fontsize=9,color='#52616a')
fig.subplots_adjust(left=.30,bottom=.25,top=.86)
save(fig,'historical_h100_software')
