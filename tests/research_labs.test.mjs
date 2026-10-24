import assert from 'node:assert/strict';
import { softmaxRoundoff, residualMix } from '../js/research_lab_math.js';
import { LAB_TEXT } from '../js/research_lab_i18n.js';
const cliff=softmaxRoundoff(18);
assert.equal(cliff.ordinary,0);
assert.ok(cliff.stable<0 && cliff.other>0 && cliff.sumOrdinary>0);
assert.equal(cliff.sumStable,0);
for(let margin=0;margin<=40;margin+=.5){
  const r=softmaxRoundoff(margin);
  assert.ok(Math.abs((r.stable-r.reference)/r.reference)<2e-7);
}
for(const a of [0,.05,.3,.5,.95,1]) for(const steps of [0,1,5,30]){
  const r=residualMix(a,steps);
  assert.ok(r.norm<=r.initialNorm+1e-12);
  for(const c of r.centroid)assert.ok(Math.abs(c-1/3)<1e-12);
  for(let j=0;j<3;j++){
    assert.ok(Math.abs(r.matrix[j].reduce((s,x)=>s+x,0)-1)<1e-12);
    assert.ok(Math.abs(r.matrix.reduce((s,row)=>s+row[j],0)-1)<1e-12);
  }
}
assert.ok(residualMix(.3,30,1.1).norm>Math.sqrt(3));
assert.equal(residualMix(1,30).norm,Math.sqrt(3));
for(const lang of ['es','fr','zh'])assert.deepEqual(Object.keys(LAB_TEXT[lang]).sort(),Object.keys(LAB_TEXT.en).sort());
for(const bad of [NaN,Infinity,-1,41])assert.throws(()=>softmaxRoundoff(bad));
assert.throws(()=>residualMix(.5,1.5));assert.throws(()=>residualMix(.5,4,2));
console.log('Research labs PASS: rounding cliff, stable gradient, conservation, contraction, gain and translations.');
