# Software Projects

## Material properties library
<div class="proj_image_row">
    <div class="proj_image_row_image_container"><img src="../assets/images/material_properties/E_vs_T.png"></div>
    <div class="proj_image_row_image_container"><img src="../assets/images/material_properties/E_vs_T_code.png"></div>
</div>
I'm writing a material properties library in python - so far I have a prototype of the core logic. The ultimate goal is to provide for the interchange of information on material properties between CAD software, FEA software, and custom analysis scripts. I spend a lot of time manually transcribing material properties from MatWeb or MMPDS into SolidWorks and my own python scripts. This process is tedious and error prone - I'd like to make it better, and I imagine other engineers would appreciate this too. It would be valuable for a project to have a single (verified) database of material properties, which all of the project's computational tools (CAD, FEA, analysis scripts) reference.

[example for aeronautical engineering -->](https://github.com/mvernacc/material-properties-interchange/blob/master/tutorials/xplane_airframes.ipynb)

[example for nuclear engineering -->](https://github.com/mvernacc/material-properties-interchange/blob/feature/multi-var-w-state/tutorials/radiation_demo.ipynb)


## Rocket propulsion library

```python
>> from proptools import nozzle
>> p_c = 10e6; p_e = 100e3; gamma = 1.2; m_molar = 20e-3; T_c = 3000.
>> C_f = nozzle.thrust_coef(p_c, p_e, gamma)
>> c_star = nozzle.c_star(gamma, m_molar, T_c)
>> I_sp = C_f * c_star / nozzle.g
>> print "The engine's ideal sea level specific impulse is {:.1f} seconds.".format(I_sp)
The engine's ideal sea level specific impulse is 288.7 seconds.
```

`proptools` is a python package for preliminary design of rocket propulsion systems. It provides implementations of equations for nozzle flow, turbo-machinery and rocket structures. The project aims to cover most of the commonly used equations in* Rocket Propulsion Elements* *Modern Engineering for Design of Liquid-Propellant Rocket Engines* (Huzel & Huang). It's currently targeted at internal use in my lab, but I am working towards a `v1.0` that could be used by a broader audience.

[check it out on readthedocs -->](https://proptools.readthedocs.io/en/latest/)

## Solid propellant combustion simulation
<div class="proj_image_row">
    <div class="proj_image_row_image_container"><img src="../assets/images/2.28/heat_flux_vs_time.png"></div>
</div>
A simulation of the ignition transient of an ammonium perchlorate composite propellant, implemented in python using [`cantera`](https://cantera.org/) and `numpy`. *In collaboration with Sam Judd.*

[read more -->](../assets/docs/2.28/228_final_report.pdf)

## 2D shock-capturing computation fluid dynamics
<div class="proj_image_row">
    <div class="proj_image_row_image_container"><img src="../assets/images/18086/t_16637_629us_density_only.svg"></div>
</div>
For a numerical methods class, I programmed a 2D Euler equation (inviscid Navier-Stokes) solver using a finite-difference MacCormack method. I used artificial dissipation to reduce the non-physical oscillations which occur around shocks in finite difference schemes. My software was implemented in Julia.

[read more -->](../assets/docs/18086/report.pdf)

## Unscented Kalman Filter for 3D attitude estimation


