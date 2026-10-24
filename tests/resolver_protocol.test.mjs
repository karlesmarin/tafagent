import assert from 'node:assert/strict';
import {reviewProtocol,PROTOCOL_GROUPS,PROTOCOL_PATHS} from '../js/resolver_protocol.js';
import {protocolRows} from '../js/resolver_protocol_i18n.js';
import {solveLocalCase,LOCAL_DEMOS} from '../js/resolver_local.js';
import {buildResolverSummary} from '../js/resolver_summary.js';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const a={model:'PRIVATE/model',revision:'PRIVATE_REVISION',corpus:'PRIVATE_CORPUS',theta_nom:10000,gamma:0,distance:[1,2,3],
 protocol:{id:'PRIVATE_PROTOCOL',length:4,queries:[3],sink_tokens:0,samples:2,pooling:'arithmetic_mean_per_distance',fit:'OLS',layer:0,head:0,backend:'numpy',dtype:'float64',quantization:'none',seed:0,tokenizer_revision:'not_used'}};
const complete=reviewProtocol(a,a);
assert.equal(complete.priority,'repeat');assert.equal(complete.fields.length,19);
assert.ok(complete.fields.every(f=>f.documented&&f.comparison==='same'));
assert.deepEqual(Object.keys(PROTOCOL_PATHS).sort(),Object.values(PROTOCOL_GROUPS).flat().sort());
const changed={...a,protocol:{...a.protocol,seed:1}};
assert.equal(reviewProtocol(a,changed).priority,'align');
assert.equal(reviewProtocol(a,changed).fields.find(f=>f.key==='seed').comparison,'different');
const absent={...a,protocol:{...a.protocol,backend:'unknown'}};
assert.equal(reviewProtocol(absent).priority,'document');assert.equal(reviewProtocol(absent).fields.find(f=>f.key==='backend').documented,false);
assert.equal(reviewProtocol(a,absent).priority,'document');
const conflict={...a,T_eval:8};
assert.equal(reviewProtocol(conflict,changed).priority,'context');
assert.equal(reviewProtocol(a,conflict).priority,'reference_context');
assert.equal(reviewProtocol({...a,protocol:{...a.protocol,length_policy:'distance_plus_50'}}).priority,'context');
assert.equal(reviewProtocol({gamma:.5,theta:10000,N:4}).priority,'context');
assert.equal(reviewProtocol({gamma:.5}).priority,'context');
const custom={...a,protocol:{...a.protocol,'PRIVATE_KEY':null,'PRIVATE_OTHER':{path:'PRIVATE_PATH'}}};
const extra=reviewProtocol(custom,{...custom,protocol:{...custom.protocol,PRIVATE_OTHER:{path:'DIFFERENT_PRIVATE_PATH'}}});
assert.ok(extra.additional_fields.missing_in_first>0);assert.ok(extra.additional_fields.different>0);
assert.ok(!JSON.stringify(extra).includes('PRIVATE'));assert.ok(!JSON.stringify(complete).includes('PRIVATE'));
for(const [lang,i] of ['en','es','fr','zh'].map((l,i)=>[l,i])){
 for(const [k,v] of Object.entries(protocolRows))assert.equal(RESOLVER_TRANSLATIONS[lang]['resolver.'+k],v[i]);
 for(const m of [a,absent,conflict,JSON.parse(LOCAL_DEMOS.pvr.text)]){
  const inputs={text:JSON.stringify(m)},result=solveLocalCase('pvr',inputs);
  const summary=buildResolverSummary({route:'pvr',bundle:{origin:'local'},inputs,result},lang);
  assert.equal(summary.next,protocolRows['protocol_first_'+result.protocolReview.priority][i]);
  assert.equal(new URL(summary.guide.url).hash,'#tbl-gamma-protocolo');
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 }
}
console.log('Resolver protocol PASS: missing and differing fields, priority, zero/none, privacy, four languages and controlled-comparison boundaries.');
