## Target IRR

A reasonable sensitivity range is:

  10%   contracted, lower-risk data center infrastructure
  15%   base case for greenfield AI/data-center equity
  20%+  merchant token-price risk, fast obsolescence, speculative demand

  Why 15% is a good base case:

  - Your model is calculating levered equity IRR, not project IRR or WACC. Equity should target more than stabilized asset
    yield because it bears construction risk, demand/pricing risk, technology obsolescence, and residual-value risk.
  - Preqin’s infrastructure strategy framework says core assets target high-single to low-double-digit returns, core-plus/va
    lue-add target low-to-mid-double-digit returns, and opportunistic infrastructure seeks 15-20% or more. A greenfield AI d
    ata center with token-price exposure is closer to value-add/opportunistic than core infrastructure. Source: Preqin Acade
    my infrastructure risk/return
    (https://view.ceros.com/preqin/preqin-academy-definition-of-private-capital-4-1-1-2-1-1-1-2-1-1-1).
  - RCLCO’s 2026 data-center pipeline analysis uses 8-10% development yields-on-cost and 5.5-6.5% cap rates for the sector.
    Those are property-level yield assumptions, not levered equity IRRs; levered greenfield equity should sit above them. So
    urce: RCLCO, Data Center Pipeline: Boom or Bubble?
    (https://www.rclco.com/publication/data-center-pipeline-boom-or-bubble/)
  - Preqin reports median infrastructure fund IRRs above 8.5% across 2013-2022 vintages, which is a useful lower bound for d
    iversified infrastructure portfolios, not a greenfield AI project hurdle. Source: Preqin Infrastructure in 2026
    (https://www.preqin.com/insights/research/reports/infrastructure-in-2026)

  So for the blog post, I’d frame it as:

  > We use a 15% annual levered equity IRR target as a base case. Lower-risk contracted data-center infrastructure might
  > accept roughly 10-12%, while merchant AI inference capacity with demand, pricing, and hardware-obsolescence risk should
  > require something closer to 15-20%+.

  Then run sensitivities at 10%, 15%, and 20%.

## Debt interest rate

Suggested defaults:

  debt_interest_rate: float = 0.085  # [1 / year]

  Sensitivity range:

  0.065-0.075  low-risk contracted/hyperscaler-backed project
  0.08-0.095   reasonable base case for construction/term debt
  0.10-0.12+   private credit, merchant exposure, weaker sponsor, high leverage

  Why:

  - 2026 commercial construction loans are commonly floating-rate, priced over SOFR. One current CRE source gives bank const
    ruction loans around SOFR + 275-400 bps, or about 7.0-8.75% all-in, and debt-fund construction loans around 8.75-10.0%.
    Source: CLS CRE, Commercial Construction Loan Requirements 2026
    (https://clscre.com/blog/commercial-construction-loan-requirements-2026.html).
  - Another construction-loan market summary gives data-center construction loans around 7.4% average, with SOFR plus roughly
    260 bps. Source: Buildermuse, Construction Loan Interest Rates April 2026
    (https://buildermuse.com/economy/construction-loan-interest-rates-average-84-).
  - Private construction/hard-money financing is more like 10-15%, so 10% is not crazy; it just represents a more expensive
    capital stack. Source: Clear House Lending, Construction Loan Interest Rate Guide 2026
    (https://www.clearhouselending.com/blog/construction-loan-interest-rate-guide).

  For the blog model, I’d use 8.5% as baseline and include 7%, 10%, and 12% sensitivities. 

## Debt fraction

A reasonable sensitivity range:

  0.50  conservative / merchant AI exposure / weaker sponsor
  0.60-0.70  base-case data-center construction loan-to-cost
  0.75-0.80  preleased or hyperscaler-backed project with strong sponsor support

  Why:

  - Data-center project finance can support high leverage when backed by creditworthy anchor tenants. Foley & Lardner says d
    ata-center project finance often reaches 60-80% loan-to-cost, especially for purpose-built facilities with hyperscaler l
    eases. Source: Foley & Lardner, Financing the Data Center Boom

  (https://www.foley.com/insights/publications/2026/04/financing-the-data-center-boom-trends-structures-and-considerations-for-market-participants/).
  - General commercial construction lenders typically require 25-40% equity, implying 60-75% debt, with lower equity needs f
    or strong sponsors/preleased projects. Source: CLS CRE, Commercial Construction Loan Requirements 2026
    (https://clscre.com/blog/commercial-construction-loan-requirements-2026.html).
  - Another CRE construction finance summary gives senior debt at 60-75% LTC, with build-to-suit and credit-tenant deals oft
    en 70-75%. Source: TCG Commercial Construction Finance 2026
    (https://terrapincg.com/commercial-construction-finance-owner-advisory-2026).

  For a blog-post model about token pricing, I’d use 0.65 as the clean baseline. It is more realistic than 0.50, but not so
  highly levered that the model looks like it assumes a fully contracted hyperscaler deal. Keep 0.50, 0.65, and 0.80 as
  sensitivities.


## Token price

Use a workload-weighted blend, not a simple average.

  For your model, I’d use price per 1M output tokens equivalent, because your throughput is closer to “tokens generated per
  MW” than “all API tokens processed per MW.”

  Formula:

  effective_price_per_Mtok_output = (
      output_price_per_Mtok
      + input_price_per_Mtok * input_tokens_per_output_token
  )

  If you want to include cached input:

  effective_input_price = (
      uncached_input_fraction * input_price_per_Mtok
      + cached_input_fraction * cached_input_price_per_Mtok
  )

  effective_price_per_Mtok_output = (
      output_price_per_Mtok
      + effective_input_price * input_tokens_per_output_token
  )

  Reasonable ratios to show:

  input_tokens_per_output_token = 1    output-heavy chat / generation
  input_tokens_per_output_token = 3    good baseline for assistant/API usage
  input_tokens_per_output_token = 10   agentic coding / long-context workflows

  Example using current standard prices:

  OpenAI GPT-5.5: input $5, output $30 per MTok. Source: OpenAI API pricing (https://openai.com/api/pricing/).
  At 3 input tokens per output token:

  30 + 3 * 5 = $45 / MTok-output-equivalent

  Anthropic Claude Sonnet 4 pricing in Anthropic docs is input $3, output $15 per MTok. Source: Anthropic pricing docs
  (https://platform.claude.com/docs/en/docs/about-claude/pricing).
  At 3:1:

  15 + 3 * 3 = $24 / MTok-output-equivalent

  Google Gemini 2.5 Pro standard pricing is input $1.25, output $10 per MTok for prompts <= 200k tokens. Gemini 3 Flash Prev
  iew is input $0.50, output $3.00. Source: Google Gemini API pricing (https://ai.google.dev/gemini-api/docs/pricing).
  At 3:1:

  Gemini 2.5 Pro: 10 + 3 * 1.25 = $13.75 / MTok-output-equivalent
  Gemini 3 Flash: 3 + 3 * 0.50 = $4.50 / MTok-output-equivalent

  For the blog post, I’d define:

  input_tokens_per_output_token = 3.0  # [dimensionless]

  and compare API prices as:

  api_effective_price_per_Mtok = (
      api_output_price_per_Mtok
      + input_tokens_per_output_token * api_input_price_per_Mtok
  )

  Important caveat: this is a billing comparison, not a perfect compute-cost comparison. Prefill/input tokens and decode/
  output tokens have different compute behavior, and providers include thinking tokens differently. But for a simple pricing
  model, this is the clearest single-number blend.
  