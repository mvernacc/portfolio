# Same-hardware inference throughput evidence

Research date: 2026-10-18. Primary sources, primarily 2024–2025. This is research for scenario design, not prose for the post. No claim that published speedup maxima estimate a probability distribution.

## Strongest longitudinal anchor

**NVIDIA, 2025-04-02, MLPerf Inference v5.0.** H100 Llama 2 70B throughput increased **up to 1.5× over the previous year**, attributed to software: GEMM/attention kernels, fusion, chunked prefill, pipeline parallelism. This is the cleanest dated annual same-hardware observation found. It does not establish indefinite 50% annual improvement. The text gives an “up to” factor, not a fleet average. The article also includes a footer describing unverified MLPerf v4.1 offline results; without mapping every claim to a submission, treat the headline as a vendor report, not an independently certified longitudinal estimate. It also reports cumulative Hopper GPT-J improvements of 2.9× offline/3.8× server since benchmark introduction, which is a different model and horizon.

Source: https://developer.nvidia.com/blog/nvidia-blackwell-delivers-massive-performance-leaps-in-mlperf-inference-v5-0/

**NVIDIA, 2024-08-28, MLPerf v4.1 versus v4.0 (2024-03-27).** Table 3 holds H100 at 700W, eight GPUs, Llama 2 70B: **1.05× server and 1.12× offline** over approximately five months. H200 at 700W improved 1.14×/1.12×, but its earlier result was a preview. Entries listed: 4.0-0062, 4.0-0070, 4.1-0043, 4.1-0048, 4.1-0050. These are separate observations from (and overlapping with) the next year's 1.5× claim, not independent factors to multiply.

Source: https://developer.nvidia.com/blog/nvidia-blackwell-platform-sets-new-llm-inference-records-in-mlperf-inference-v4-1/

**Latency qualification:** The original MLPerf Llama 2 70B server benchmark has TTFT ≤2s and TPOT ≤200ms (~5 output tok/s/request). The newer interactive version uses 450ms/40ms (25 tok/s). Neither is equivalent to our 8,192-input/1,024-output workload with chosen 25/50/100 output tok/s/request. Use these for magnitude/context of software progress, not to rescale our initial B200 throughput mechanically.

Primary benchmark definition: https://mlcommons.org/2024/03/mlperf-llama2-70b/

Interactive version: https://mlcommons.org/2025/04/llm-inference-v5/

## Discrete software breakthroughs: useful but easy to over-extrapolate

**vLLM 2024-09-05:** v0.6.0 versus v0.5.3 claims **2.7× throughput for Llama 3 8B on 1 H100**, **1.8× for 70B on 4 H100**, with TPOT improvements measured at 32 QPS. ShareGPT uses 500 prompts averaging 202 input/179 output tokens. Aggregate throughput benchmark sends all requests at once (QPS infinity); it is not a matched streaming-speed SLO. Multi-step scheduling enabled with 10 steps. Article discloses chunkier returned tokens and worse low-load TTFT. Mechanism mainly removes CPU/API/scheduler idle gaps; breakthrough after bottleneck removal rather than an annual trend. Precision is not clearly documented in prose; do not claim controlled precision from this page alone.

Source: https://vllm.ai/blog/2024-09-05-perf-update

**vLLM 2025-01-27:** V1 architecture **up to 1.7×** throughput over V0 **without multi-step scheduling**, with text tests on Llama 3.1 8B and Llama 3.3 70B, ShareGPT. CPU overhead dominates improvement; kernels nearly identical. The baseline excludes an optimization used in the September headline. Thus do **not multiply 2.7× by 1.7×** as an observed chronological gain. Hardware/precision details need figure/reproduction inspection before using as matched numeric dataset.

Source: https://vllm.ai/blog/2025-01-27-v1-alpha-release

**SGLang 2024-09-04:** v0.3 claims **3–7× throughput** for DeepSeek MLA compared with baseline. H100, ShareGPT, TP1 for lite models/TP8 for big models; both BF16/FP8 are benchmarked. Work includes weight absorption, grouped decoding kernels, FP8 batched matmul and FP8 KV cache. This is specialized exploitation of a new architecture and precision, not generic annual inference progress; peak throughput is not constrained to our per-request target. Its separate torch.compile result is up to1.5× lower latency at small batches, not1.5× aggregate fleet output.

Source: https://www.lmsys.org/blog/2024-09-04-sglang-v0-3/

**NVIDIA 2024-07-02:** Mixtral8x7B on two H100 SXM, TensorRT-LLM0.10, TP2, input573/output50. FP8 streaming achieves38.4requests/s at mean TPOT0.016s (~62.5tok/s/request). Same-hardware precision comparison demonstrates a mechanism to increase capacity at a latency target, but quantization is a one-time technique and may change quality. Short outputs especially prevent direct use for our workload. Offline ~21,000tok/s at batch1024 is not the interactive result.

Source: https://developer.nvidia.com/blog/achieving-high-mixtral-8x7b-performance-with-nvidia-h100-tensor-core-gpus-and-tensorrt-llm/

## What to exclude from this project's throughput-growth calibration

- Blackwell versus Hopper factors: new compute hardware and sometimes new precision support, memory/interconnect/topology/power. A fixed installed cohort does not receive those gains.
- Per-GPU gains when system scale changes; fixed MW requires power and server overhead normalization.
- Attention-kernel microbenchmark gains: only part of inference runtime.
- Prefill cache gains applied indiscriminately to uncached workloads.
- Speculative decoding latency gains treated as peak aggregate throughput gains: spare compute and acceptance rates matter.
- Model migration gains quoted per token without matched capability or task success and output length. Fewer parameters/active parameters are not sufficient evidence of equivalent service.
- Annualizing a one-release jump and compounding it for five years.

## Recommendations (judgment, not measured estimates)

For an initially optimized fixed hardware cohort, **0–50% annual throughput improvement** is a defensible range to *explore*, supported in magnitude by the H100 longitudinal observations, but not a statistically calibrated interval. A working central value around **20–25%** is plausible as a deliberately moderate assumption; neither the evidence nor the sampling supports calling it the median forecast. Sustained +50% for five years is already7.6×. +100% annually (32× over five years) belongs in an explicit upside/model-migration stress scenario, requiring evidence beyond same-model software progress. Negative throughput trajectories can represent a shift toward harder models/longer contexts, not physical decay of computational performance.

A better shape, if willing to add minimal trajectory structure: a first-year software gain followed by smaller gains (e.g. +30%, +20%, +10%, then flat). This is an illustrative diminishing-opportunity assumption, not fit to a time series. Keep constant rates if simplicity wins, but show resulting lifetime multipliers so readers see what they imply.

No same-hardware evidence here supports throughput rising10× **each year**. A 90% annual price erosion with+25% annual throughput leaves annual revenue/MW at0.125×, before utilization. With+50%, it leaves0.15×. A tenfold annual task-cost decline can be true at the market frontier while an installed cohort rapidly loses economic value.

For coupled scenarios avoid automatically forcing faster price decline to imply proportionately faster cohort throughput. Market advances may be inaccessible to existing GPUs. Distinguish (a) commodity capability, partial capture of algorithmic gains; (b) increasing capability mix, less token-price erosion but flat/negative token throughput; (c) rapid market obsolescence, falling prices with limited cohort gains. Prices require the other research stream; this evidence only anchors the capacity side.

Presentation suggestion: show a small same-hardware evidence panel (H100 Llama2 +5% server over five months and up to+50% over one year) separate from market task-cost history. State the exact latency mismatch in caption. Then a scenario panel normalized to100 at start showing price, throughput and their product. This distinguishes observed market progress from assumed capture by an existing project. Do not stitch maximum software release speedups into a smooth historical index.
