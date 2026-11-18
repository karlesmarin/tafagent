import assert from 'node:assert/strict';
import {gammaPade,thetaInverse,thetaEffPade,gammaCheckAll} from '../js/gamma_check.js';
import {thetaEffNTK,planExtension} from '../js/yarn_planner.js';
import {loadRulerKB,calibrateNIAH,lookupRulerModel,predictNIAHReasoning} from '../js/niah_reasoning.js';
for(const theta of [10000,500000])for(const T of [512,2048,65536]){
 const g=gammaPade(theta,T),inverse=thetaInverse(g,T);
 assert.ok(Math.abs(inverse/theta-1)<1e-12);
 assert.notEqual(thetaEffPade(theta,T),inverse);
}
for(const g of [-1,1,1.05,NaN])assert.ok(Number.isNaN(thetaInverse(g,2048)));
assert.equal(gammaCheckAll({theta:10000,T:2048,gObs:0}).gammaObserved,0);
assert.equal(gammaCheckAll({theta:10000,T:2048}).gammaObserved,null);
assert.equal(gammaCheckAll({theta:10000,T:2048,gObs:1.05,isRandom:true}).regime,'outside_inverse');
assert.equal(thetaEffNTK(10000,4,16),10000*4**(16/14));
assert.ok(Number.isNaN(thetaEffNTK(10000,4,2)));
assert.equal(planExtension({originalCtx:2048,theta:10000,targetCtx:8192}).gammaEff,null);
globalThis.fetch=async()=>({ok:true,json:async()=>({source:{primary:'https://example.org/source'},models:{exact:{ruler_avg:{'4k':0,'8k':90},id_aliases:['org/exact']}}})});
await loadRulerKB();
assert.equal(calibrateNIAH('org/exact',4096).ruler_avg_pct,0);
assert.equal(calibrateNIAH('exact',6000),null);
assert.equal(lookupRulerModel('unrelated/exact'),null);
assert.equal(calibrateNIAH('exact',8192).reasoning_calibrated,null);
assert.equal(predictNIAHReasoning({max_position_embeddings:8192},4096).T_train,null);
console.log('Alignment regression: inverses, domains, zero/missing values, NTK and exact benchmark lookup PASS');
