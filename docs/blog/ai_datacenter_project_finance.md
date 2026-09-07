# What are the costs of serving a language model?

TODO summary bullets
TODO motivating question

## A simple estimate of datacenter project finance

To understand the factors that influence cost, we'll use a *project finance*
model of an AI datacenter. The project starts with capital expenses (CAPEX: GPUs,
networking equipment, land, concrete, construction worker's wages, etc.).
During the construction period the project makes no revenue, so CAPEX is
covered by a mix of cash put in by the project's equity investors and loans.

Then, the operational period, in which the project makes revenue by selling
inference services (tokens) and pays operating costs, like electricity and
maintenance work. The *throughput* and *utilization* of the computing equipment
determine how many tokens the project serves each month.

Finally, the IT equipment reaches the end of its useful life and the project ends.
We assume investors sell off the project's remaining assets (perhaps to another project
that will re-use the site).
To keep the model simple, it neglects taxes and government incentives.

We set up the above cashflows as a system of equations, and solve for one unknown:
what price-per-token would the project need to charge
to cover its operating costs, make its debt payments, and pay back
its investors at their expected *internal rate of return*(IRR)?

This method is based on [Lazard's Levelized-Cost-of-Energy (LCOE)](https://www.lazard.com/research-insights/levelized-cost-of-energyplus-lcoeplus/) analysis,
the industry-standard method for modeling the cost of energy generation.
Lazard's LCOE estimates USD/MW-hr to pay back an energy project;
this post estimates USD/MTok to pay back a datacenter project.

### Key factors: throughput and cost of computing hardware


### Electricity availability matters more than cost

## Simple cost estimates vs actual price of open-weights LLMs

## Trends in the key factors
