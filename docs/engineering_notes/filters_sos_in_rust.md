# SOS Butterworth filters in Rust

*2025-11-30*

I recently [contributed](https://github.com/jlogan03/flaw/pull/18) a second-order sections (SOS) filter implementation to [flaw](https://github.com/jlogan03/flaw), a digital filtering library for Rust.
It targets both embedded platforms (`f32`, no-`std`, no-`panic`) and general-purpose platforms (`f64`, [FMA](https://en.wikipedia.org/wiki/Multiply%E2%80%93accumulate_operation#Fused_multiply%E2%80%93add) hardware acceleration).

My new `flaw::sos` module provides:

- Implementation of cascaded second-order sections: [`sos::SisoSosFilter`](https://github.com/jlogan03/flaw/blob/8629571642d2e20f0b8e069e65636c3f0b7bd4ed/flaw/src/sos/mod.rs#L23)
    - Generic over float type (`f32`, `f64`) and number of sections (filter order is up to 2x sections)
    - Designed for efficiency and low numerical error:
        - Update uses 9 float operations per section
        - Storage is 7 floats per section (2 delays + 5 coefficients)
        - Each stage uses [Transposed Direct Form II](https://en.wikipedia.org/wiki/Digital_biquad_filter#Transposed_direct_form_2)
    - FMA and non-FMA implementations, configured by the crate's existing `fma` feature
- Functions to generate SOS Butterworth low-pass filters for a given cutoff frequency: `sos::{` [`butter2`](https://github.com/jlogan03/flaw/blob/8629571642d2e20f0b8e069e65636c3f0b7bd4ed/flaw/src/sos/tables/butter2.rs#L55), [`butter4`](https://github.com/jlogan03/flaw/blob/8629571642d2e20f0b8e069e65636c3f0b7bd4ed/flaw/src/sos/tables/butter4.rs#L62), [`butter6`](https://github.com/jlogan03/flaw/blob/8629571642d2e20f0b8e069e65636c3f0b7bd4ed/flaw/src/sos/tables/butter6.rs#L69) `}`
    - Provides orders 2, 4, and 6 for `f32` and `f64`
    - SOS coefficients are interpolated vs cutoff frequency from a lookup table
    - Cutoff frequency region of validity is enforced and tested for each combination of filter order and float type
- Python script to auto-generate the SOS Butterworth lookup tables from SciPy: [`scripts/generate_butter_sos_tables.py`](https://github.com/jlogan03/flaw/blob/8629571642d2e20f0b8e069e65636c3f0b7bd4ed/scripts/generate_butter_sos_tables.py)

Example usage:

```rust
// Create a low-pass filter with (cutoff frequency) / (sample frequency) = 0.01
// Butterworth order 4 filter implemented with second-order sections
let mut filter = flaw::sos::butter4::<f32>(0.01)?;

loop {
  let u = 1.0; // get the next raw measurement
  let y = filter.update(u); // update the filter and get its next output
}
```

Below are my reflections on the project. Thanks to `flaw`'s maintainer, [James Logan](https://jlogan.dev/), for helping me with this!

## Digital filters with `f32` are numerically challenging

One target of `flaw` is embedded platforms where 64-bit float operations are slow or unavailable.
Thus, `flaw::sos` needs to support filters using `f32`.

The resolution of `f32` is [only ~7 decimal digits](https://doc.rust-lang.org/std/primitive.f32.html#associatedconstant.EPSILON).
A `f32`-based filter will have rounding errors if it adds together numbers more than a few orders of magnitude apart.
Unfortunately, [infinite impulse response (IIR)](https://en.wikipedia.org/wiki/Infinite_impulse_response) digital filters can have a large range of coefficient magnitudes, particularly at low cutoff ratio (cutoff frequency / sample frequency) for low-pass filters.

<figure>
    <img src="../../assets/images/engineering_notes/filters_sos_in_rust/b0_vs_cutoff.png" width=100%>
    <figcaption>The large range of filter coefficient magnitudes presents a challenge for 32-bit floats.</figcaption>
</figure>

An SOS form was chosen to improve numerical issues.
The same digital filter can be realized in different forms, and these have different robustness to numerical issues. Common forms include:

- The four direct forms: Direct I, Direct II, Transposed Direct I, and Transposed Direct II ([math reference](https://www.dsprelated.com/freebooks/filters/Implementation_Structures_Recursive_Digital.html))
    - Transposed Direct II is most numerically robust
    - All are susceptible to numerical instabilities, particularly for higher-order filters
- State space ([math reference](https://www.dsprelated.com/freebooks/filters/State_Space_Realization.html))
    - A modified state space form was used in the existing [`flaw::SisoIirFilter`](https://github.com/jlogan03/flaw/blob/8629571642d2e20f0b8e069e65636c3f0b7bd4ed/flaw/src/iir.rs#L13)
- Cascaded second-order sections (SOS) ([math reference](https://en.wikipedia.org/wiki/Digital_biquad_filter))

The SOS form is more numerically robust for filters of order > 2.
SOS divides a higher-order filter into a cascade of second-order sections.
Within each section, it tends to add values of similar magnitude, reducing rounding errors.
In `flaw::sos::SisoSosFilter`, each section is realized in the numericall-robust Transposed Direct II form.

Even with SOS, low-pass Butterworth filters have numerical problems for cutoff ratios that are too low.
`flaw::sos`'s `butter` methods protect users from creating bad filters by returning `Err` if `cutoff_ratio` is below a minimum value.
The minimum values are tabulated for each combination of filter order and float precision.
Tests ensure that each filter has a DC gain of 1.0 ± 1e-4 at the minimum cutoff ratio (numerical issues manifest as the DC gain departs from 1).

## Interpolating SOS coefficients for fast filter creation

In one case, users need to quickly create a new filter with a different cutoff frequency on an embedded platform.
The filter design algorithms are complicated and would not run in the allotted time.
Instead, `flaw` stores lookup tables of the filter coefficients, and interpolates them versus cutoff frequency when creating a new filter.
The `flaw` maintainer (James) developed this approach, and I extended it to SOS filters.

<figure>
    <img src="../../assets/images/engineering_notes/filters_sos_in_rust/butter4_vs_cutoff.png" width=100%>
    <figcaption>The coefficients of a Butterworth low-pass filter vary smoothly with cutoff ratio, and thus are suitable for interpolation.</figcaption>
</figure>

To generate the lookup tables, a Python script calls `scipy.signal.butter` to calculate the SOS coefficients, and then writes them to a `.rs` file as a static array. This happens once, before the crate is published.
At compile time, the lookup tables are compiled into the Rust binary.
If link-time optimization is enabled, the user's binary will only contain the lookup table(s) their code actually uses.

## Steady state (DC) gain formula

For a second-order section with $z$-transform of

$$
H(z) = \frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}
$$

the section's DC gain is

$$
g_{dc} = \frac{b_0 + b_1 + b_2}{1 + a_1 + a_2}
$$

For a cascaded SOS filter, the overall gain is the product of the section gains.

### Uses: Gain correction after coefficient interpolation

*In [`SisoSosFilter::new_interpolated`](https://github.com/jlogan03/flaw/blob/8629571642d2e20f0b8e069e65636c3f0b7bd4ed/flaw/src/sos/mod.rs#L169), this formula is used to correct the DC gain to 1.
A DC gain of 1 is vital:
e.g., in a measurement application, if the input is constantly and exactly 1.000 volt, the filter output should converge to 1.000 V, not 0.999 V or 1.001 V.

Each set of SOS coefficients in the lookup tables was designed for DC gain of 1, but interpolated coefficients may give a slightly-off-one DC gain.
After interpolation, `new_interpolated` calculates the DC gain of the overall filter, calculates a correction factor

```rust
let correction = dc_gain.powf(-1.0 / SECTIONS);
```

and scales the numerator of each section by `correction`.
This ensures the overall DC gain is 1 to within `1e-6`.

Note that, although the overall DC gain should be 1, the DC gain of each section is often not 1.

### Uses: Set the filter to steady state

In [`SisoSosFiler::set_steady_state`](https://github.com/jlogan03/flaw/blob/8629571642d2e20f0b8e069e65636c3f0b7bd4ed/flaw/src/sos/mod.rs#L111), the DC gain formula is used to set the internal state of the filter to its steady-state value for a given input.
This is useful in initializing the filter.

First, `set_steady_state` uses each section's steady state gain to calculate what the section output would be in steady state: `output = input * ss_gain`.
With both the input and output known, the section's state can be set using the usual update equations:

```rust
// Set the internal states based on the steady state input and output of this section
self.z[s][1] = b2 * input - a2 * output;
self.z[s][0] = b1 * input - a1 * output + self.z[s][1];
```

### Derivation of DC gain

The filter's DC gain is its $z$-transform evaluated at $z = 1$.
The DC gain is the final value of filter's the step response.
Let $H(z)$ be the $z$-transform of a second-order section.
The $z$-transform of the section's step response is:

$$
Y(z) = \frac{1}{1 - z^{-1}} H(z)
$$

The final value theorem for $z$-transforms states:

$$
\lim_{n \rightarrow \infty} y[n] = \lim_{z->1} (z - 1) Y(z)
$$

Applying this to the step response gives:

$$
\lim_{n \rightarrow \infty} y[n] = \lim_{z \rightarrow 1} \frac{z - 1}{1 - z^{-1}} H(z)
$$

The limit of the first term is 1, so we have:

$$
\lim_{n \rightarrow \infty} y[n] = H(1)
$$
assuming that $H(z)$ is stable so the limit exists.
See [the list of z-transform properties](https://en.wikipedia.org/wiki/Z-transform#Properties) for more information.

## Benchmarking and performance tricks

I also wanted to make filter updates fast on a general-purpose CPU with `f64`.
Before attempting performance optimization, I set up benchmarking to measure if my changes actually helped.
This was easy with [criterion](https://github.com/bheisler/criterion.rs).
Criterion tracks benchmark statistics and reports if a code change had a statistically significant impact on runtime.

The performance tricks I tried and their effects:

- Using fused-multiply-add (FMA) instructions: ~40% speedup
    - Requires setting the `target-cpu=x86-64-v3` rustc flag to actually get the hardware acceleration.
- Unrolling the loop over sections: ~5% speedup
- Memory-aligning the arrays for coefficient and state storage: no measurable effect
    - Despite no effect on my i7 CPU, I kept this in, as it may help on embedded platforms with less sophisticated memory controllers

To support a range of platforms, the FMA implementation is gated by a feature flag. If the `fma` feature is not set, the non-FMA implementation is used (code snippet below, and on [GitHub](https://github.com/jlogan03/flaw/blob/8629571642d2e20f0b8e069e65636c3f0b7bd4ed/flaw/src/sos/mod.rs#L71-L88)).
The FMA-or-not choice happens at compile time, so there is no performance hit due to added branches.

```rust
#[cfg(not(feature = "fma"))]
{
    // Direct Form II Transposed implementation
    output = b0 * input + self.z[s][0];
    // Update the filter delays, they will be used the next time this function is called
    self.z[s][0] = b1 * input - a1 * output + self.z[s][1];
    self.z[s][1] = b2 * input - a2 * output;
}

// The FMA implementation is ~40% faster, with target-cpu=x86-64-v3 on a i7-8550U CPU.
#[cfg(feature = "fma")]
{
    // Direct Form II Transposed implementation
    output = b0.mul_add(input, self.z[s][0]);  // b0 * input + self.z[s][0]
    // Update the filter delays, they will be used the next time this function is called
    self.z[s][0] = b1.mul_add(input, a1.mul_add(-output, self.z[s][1])); // b1 * input - a1 * output + self.z[s][1]
    self.z[s][1] = b2.mul_add(input, -a2 * output); // b2 * input - a2 * output
}
```

## Using AI in a new domain: coach, not substitute

Effective and ineffective strategies I've seen for using AI assistants in a new-to-me domain:

- **Don't**: ask AI to write everything for me
    - Removes my learning, and I don't yet know enough to tell if the results are bad
- **Do**: Design and write the code myself, ask AI for explanations to get unstuck faster
    - I spend more time learning and less time looking for information

On this project, I used Codex a lot, but almost exclusively in "chat" mode, not "agent" mode.
It was my first time extensively using generics in Rust and I often ran into compiler errors I didn't yet understand.
I found it helpful to give Codex prompts like:

> At line {X} in src/{Y}.rs, I'm trying to do {A}. I'm getting rustc error {Z}. Explain why this is happening and some options to resolve it.

This usually got me un-stuck in a few minutes.
I felt I could trust its answers because it was easy to check their correctness with `rustc`.

When learning C++ early in my career, each error like this was a long and frustrating quest -- but no more!
The combination of Rust's helpful error messages, Rust's strong compile-time checks, and AI explanations is really helpful for learning.

When I was writing the math logic, Copilot eagerly suggested formula completions. *Some* of these were correct.
AI is not a substitute for learning the domain, nor is it a substitute for good tests.
