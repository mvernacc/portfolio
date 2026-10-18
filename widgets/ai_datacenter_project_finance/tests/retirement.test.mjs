import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ASSUMPTIONS, calcMonthlyCashflows, calcProjectFinanceTerms, calcPricePerMTokForTargetIrr } from '../src/model.ts';
import { optimizeRetirement } from '../src/retirement.ts';
import { evaluateProject } from '../src/scenario.ts';
import { TRAJECTORIES } from '../src/trajectories.ts';
const near = (a,b,tol=1e-7) => assert.ok(Math.abs(a-b) <= tol*Math.max(1,Math.abs(a),Math.abs(b)), `${a} != ${b}`);
const npv = (c,h) => c.net.reduce((sum,v,m)=>sum+v/(1+h)**(m/12),0);

// Independent oracle sums each complete cashflow stream, unlike the O(N) prefix solver.
function enumerate(a,h) {
  return Array.from({length:Math.round(a.operatingYears*12)},(_,i)=>{
    const t=i+1, c=calcMonthlyCashflows(a,1,t);
    const revenue=c.revenue.reduce((s,v,m)=>s+v/(1+h)**(m/12),0);
    return {t,price:Math.max(0,(revenue-npv(c,h))/revenue)};
  });
}
test('optimal price matches explicit monthly enumeration and other retirement choices cannot improve NPV',()=>{
  for(const trajectory of TRAJECTORIES) for(const debt of [0,.65]) for(const rate of [0,.085]) {
    const a={...DEFAULT_ASSUMPTIONS,priceAnnualErosion:trajectory.priceAnnualErosion,throughputAnnualChange:trajectory.throughputAnnualChange,debtFraction:debt,debtInterestRate:rate};
    const best=optimizeRetirement(a,.15), choices=enumerate(a,.15);
    near(best.price,Math.min(...choices.map(c=>c.price)),1e-11);
    near(npv(calcMonthlyCashflows(a,best.price,best.retirementMonths),.15),0,1e-5);
    for(const {t} of choices) assert.ok(npv(calcMonthlyCashflows(a,best.price,t),.15)<1e-5);
    assert.ok(best.price<=calcPricePerMTokForTargetIrr(a,.15)+1e-10);
  }
});
test('early retirement preserves scheduled payment and repays remaining principal exactly once',()=>{
  for(const rate of [0,.085]) {
    const a={...DEFAULT_ASSUMPTIONS,debtInterestRate:rate};
    const terms=calcProjectFinanceTerms(a), c=calcMonthlyCashflows(a,1,10), full=calcMonthlyCashflows(a,1);
    near(c.debtService.at(-1),full.debtService.at(-1));
    const r=rate/12,n=60-10;
    const expected=r===0?terms.termLoanMonthlyPayment*n:terms.termLoanMonthlyPayment*(-Math.expm1(-n*Math.log1p(r)))/r;
    near(-c.debtPayoff.at(-1),expected,1e-11);
    assert.equal(c.debtPayoff.filter(v=>v!==0).length,1);
    assert.equal(full.debtPayoff.reduce((s,v)=>s+v,0),0);
    near(c.terminalValue.at(-1),full.terminalValue.at(-1));
    assert.equal(c.months.at(-1),24+10);
    c.net.forEach((v,i)=>near(v,c.revenue[i]+c.equityConstructionCapex[i]+c.nonEnergyOpex[i]+c.energyOpex[i]+c.capacityOpex[i]+c.debtService[i]+c.debtPayoff[i]+c.terminalValue[i]));
  }
});
test('flat revenues and no salvage favor full life; extreme erosion can favor earliest retirement',()=>{
  const flat={...DEFAULT_ASSUMPTIONS,facilityResidualFraction:0};
  assert.equal(optimizeRetirement(flat,.15).retirementMonths,60);
  const adverse={...DEFAULT_ASSUMPTIONS,priceAnnualErosion:.999999999,nonEnergyAnnualOpex:1e9};
  assert.equal(optimizeRetirement(adverse,.15).retirementMonths,1);
});
test('retirement cashflows and price retain exact reciprocal throughput scaling',()=>{
  const a={...DEFAULT_ASSUMPTIONS,priceAnnualErosion:.9,throughputAnnualChange:.5};
  const x=evaluateProject(a,.15), y=evaluateProject({...a,throughput:a.throughput*2},.15);
  assert.equal(x.retirementMonths,y.retirementMonths);
  near(x.price,2*y.price,1e-12);
  near(x.npv,0,1e-5);
  x.cashflows.net.forEach((v,i)=>near(v,y.cashflows.net[i],1e-11));
});
test('retirement validation and zero-price asset recovery case',()=>{
  for(const t of [0,1.5,61,NaN]) assert.throws(()=>calcMonthlyCashflows(DEFAULT_ASSUMPTIONS,1,t),/Retirement/);
  for(const h of [-1,NaN]) assert.throws(()=>optimizeRetirement(DEFAULT_ASSUMPTIONS,h));
  const a={...DEFAULT_ASSUMPTIONS,debtFraction:0,facilityCapexFraction:1,facilityResidualFraction:1,energyCostPerMWh:0,nonEnergyAnnualOpex:0};
  const best=optimizeRetirement(a,-.1);
  assert.equal(best.price,0);
  assert.ok(npv(calcMonthlyCashflows(a,0,best.retirementMonths),-.1)>=0);
});
