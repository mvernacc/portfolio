# Goal: AI Datacenter Project finance blog post

The core of this blog post is a toy model of project finance for an AI datacenter.
It models: at what price per token can the project deliver an adequate
return to investors? How sensitive is this to various assumptions?
It should be a simple model, the datacenter analogy of Lazard's LCOE model for energy systems.

## Motivation

My motivation for writing is diverging opinions about the future of token prices among my software
engineering and research colleagues. The two schools of thought:
- *Pessimists*: This is like the early days of rideshare apps. The major players are burning
    investor money to sell tokens below cost and grab market share. As the industry matures,
    prices must rise, and consumers who became reliant will get squeezed.
- *Optimists*: The major labs' API pricing is well above cost. They are taking investment
    to scale the next generation of infrastructure, not to cover operating losses. Hardware
    and algorithmic improvements are dramatically reducing input-factor costs even as the models
    become larger. We should expect prices to come down as the technology matures. 

Obviously, a lot of the future *price* trajectory depends on market-competition dynamics that
are outside the scope of this post. I'm interested in the "are today's API prices
above or below *cost*?" aspect of this debate. Can a simple model show under what assumptions
this goes one way or the other, and possibly provide a conclusive answer based on open information
about those assumptions?

A secondary motivation relates to my day job is in energy technology (I manage scientific software for
a fusion energy developer). Datacenters seem like an ideal beachhead market and I want to better
understand the economics of our customer.

## Target audience

Software engineers, researchers and other professionals who use AI, but aren't necessarily industry
insiders. Educate them (and myself) about the cost factors in providing the tokens they use.

## Division of labor

 - Me (human): Set research direction, writing (a goal of mine is to understand and practice communicating the topic, I don't get that if an agent writes post for me).
 - You (agent): Model and interactive widget software, data gathering,
    critique research directions and conclusions, proofread.

## Related literature

Presumably similar to SemiAnalysis's "AI Cloud TCO" model, but open and simpler.
Our post will be aimed at showing the key trends/interactions/scales to
educate people adjacent to the industry, whereas SemiAnalysis's model aims at
providing sufficient detail to guide insiders in making decisions.
https://semianalysis.com/ai-cloud-tco-model

## Blog post sections

## Interactive plot widget

Let the reader explore the effect of assumptions of the model with sliders, and see
plots update live.

## Validate our model on open-weights LLMs

Throughput (tokens per second per power) stats for open-weights LLMs from SemiAnalysis:
https://inferencex.semianalysis.com/calculator
https://inferencex.semianalysis.com/historical

Price examples for inference on the open-weights LLMs, e.g. from Open Router:
https://openrouter.ai/z-ai/glm-5#providers
https://openrouter.ai/qwen/qwen3.5-397b-a17b#providers
https://openrouter.ai/deepseek/deepseek-v4-pro

Find LLMs that have both throughput and price data. Plot these on a price vs
throughput graph, compared to curve(s) for our model.

## Trends

Explore how the assumptions / model parameters have evolved over the past two-ish years.
- Throughput vs time
- Compute hardware cost per MW vs time
- Frontier model price per token vs time
