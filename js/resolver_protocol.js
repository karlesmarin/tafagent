import {missingProtocolFields,compareProtocols,predictionContext,protocolFields} from './prediction_reality.js';

// Fixed field names only: private custom keys and all input values stay out of exports.
export const PROTOCOL_GROUPS={
 identity:['model','revision','corpus','theta','tokenizer_revision'],
 sampling:['id','length','queries','sink_tokens','distance','samples','layer','head','seed'],
 execution:['backend','dtype','quantization'],
 fitting:['pooling','fit'],
};
export const PROTOCOL_PATHS={model:'model',revision:'revision',corpus:'corpus',theta:'theta_nom / theta',tokenizer_revision:'protocol.tokenizer_revision',id:'protocol.id',length:'protocol.length / protocol.lengths',queries:'protocol.queries',sink_tokens:'protocol.sink_tokens',distance:'distance / protocol.distances / (protocol.d_min + protocol.d_max)',samples:'protocol.samples / protocol.samples_by_distance',layer:'protocol.layer',head:'protocol.head',seed:'protocol.seed',backend:'protocol.backend',dtype:'protocol.dtype',quantization:'protocol.quantization',pooling:'protocol.pooling',fit:'protocol.fit'};
const allowed=new Set(Object.values(PROTOCOL_GROUPS).flat());
export function reviewProtocol(measured,reference=null){
 const missing=missingProtocolFields(measured),comparison=reference?compareProtocols(measured,reference):null;
 const context=predictionContext(measured,{}).status;
 const referenceContext=reference?predictionContext(reference,{}).status:null;
 const fields=Object.values(PROTOCOL_GROUPS).flat().map(key=>({key,documented:!missing.includes(key),comparison:comparison?.fields.find(f=>f.key===key)?.status??null}));
 const extras=Object.keys(protocolFields(measured)).filter(k=>!allowed.has(k));
 const otherMissing=missing.filter(k=>!allowed.has(k)).length;
 const otherDifferences=comparison?.fields.filter(f=>!allowed.has(f.key)&&f.status==='different').length??0;
 const otherUnknown=comparison?.fields.filter(f=>!allowed.has(f.key)&&f.status==='unknown').length??0;
 const priority=context!=='documented'?'context':reference&&referenceContext!=='documented'?'reference_context':comparison?.status==='different'?'align':missing.length||comparison?.status==='unknown'?'document':'repeat';
 return {version:1,context,reference_context:referenceContext,comparison:comparison?.status??null,priority,fields,
  additional_fields:{in_first:extras.length,missing_in_first:otherMissing,different:otherDifferences,unknown:otherUnknown}};
}
