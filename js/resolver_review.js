import { RESOLVER_TRANSLATIONS } from './resolver_i18n.js';
import { CASES } from './resolver.js';
import { buildResolverSummary } from './resolver_summary.js';

// Review available evidence, never assign a risk score or infer runtime failures.
// The report contains derived explanations only, never raw local inputs.
export function buildResolverReview(state,language='en') {
 const {route,bundle,result}=state;
 if(!Object.hasOwn(CASES,route)||!bundle||!result)throw new Error('review requires a completed case');
 const lang=Object.hasOwn(RESOLVER_TRANSLATIONS,language)?language:'en';
 const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
 const demo=bundle.origin==='demo',local=CASES[route].source==='local';
 const limited=result.status==='limited';
 const summary=buildResolverSummary(state,lang);
 return {
  version:1,route,demonstration:demo,
  evidence_kind:route==='pvr'?'imported_measurement':route==='drift'?'heuristic_comparison':route==='memory'&&!limited?'configuration_estimate':'static_inspection',
  provenance:tr(demo?'review_demo':local?'review_local':'review_metadata'),
  basis:tr(limited?'review_limited':'review_'+route+'_basis'),
  limitation:tr('review_'+route+'_limit'),
  observations:(result.notices||[]).map(n=>tr(n.key)),
  missing_protocol_fields:route==='pvr'?result.facts.find(f=>f.key==='missing_fields')?.value??null:null,
  next_check:summary.next,guide:summary.guide,
  protocol:result.protocolReview??null,
  memory_peak:route==='memory'?result.memoryPeak??null:null,
  checks:summary.checks,
  independently_verified:false,
 };
}
