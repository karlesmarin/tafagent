import { normalizeMeasured, matchMeasured, predictionVsReality, predictionContext, compareProtocols, missingProtocolFields, confidenceFromMeasured, contributionRecord, gammaPade } from "../js/prediction_reality.js";
let p=0,f=0; const ck=(n,c)=>{if(c){p++;console.log("  ✓ "+n);}else{f++;console.log("  ✗ "+n);}};

// dataset-style record
const ds = {model:"EleutherAI/pythia-1.4b", corpus:"mongo", gamma:0.705, R2:0.841};
// Diagnose-CLI-style record
const cli = {model:"meta-llama/Llama-3-8B", theta_nom:500000, N:8192, gamma:0.97, gamma_pred:0.94, fit_power_law:{R2:0.93}, D90:740};

const nd=normalizeMeasured(ds), nc=normalizeMeasured(cli);
ck("normalize dataset rec", nd.model==="EleutherAI/pythia-1.4b" && nd.gamma_obs===0.705 && nd.R2===0.841 && nd.source==="dataset:mongo");
ck("normalize CLI rec (R2 from fit, theta/T/D90)", nc.gamma_obs===0.97 && nc.R2===0.93 && nc.theta===500000 && nc.T===8192 && nc.D90===740 && nc.source==="user");
ck("normalize junk → null", normalizeMeasured(null)===null && normalizeMeasured({})===null);

const matches=matchMeasured("eleutherai/PYTHIA-1.4B",[ds,{model:"x",gamma:0.5}]);
ck("matchMeasured case-insensitive", matches.length===1 && matches[0].gamma_obs===0.705);

const rows=predictionVsReality({theta:500000,T:8192}, cli);
const g=rows.find(r=>r.metric==="gamma");
ck("PvR gamma row: pred=γ_Padé, Δ=obs-pred", Math.abs(g.predicted-gammaPade(500000,8192))<1e-9 && Math.abs(g.delta-(0.97-g.predicted))<1e-9);
ck("PvR within-tolerance flag present", typeof g.within==="boolean");
ck("PvR includes D90 row when measured", rows.some(r=>r.metric==="D90" && r.measured===740));

const cf=confidenceFromMeasured(cli);
ck("measurement is evidence of measured gamma only", cf.length===1 && cf[0].key==="gamma_measured");
ck("high R2 implies neither a benchmark nor calibration", !cf.some(x=>x.key.startsWith("calib_")||x.key==="benchmark_yes"));

const c=contributionRecord("meta-llama/Llama-3-8B", cli, {rope_theta:500000});
ck("contribution record schema", c.json.model==="meta-llama/Llama-3-8B" && c.json.gamma===0.97 && c.json.theta_nom===500000 && c.json.N===8192);
ck("contribution HF discussion url", /huggingface\.co\/datasets\/karlexmarin\/taf-attention-decay\/discussions\/new/.test(c.hfUrl));

const guide = { model:"test/model", revision:"commit-123", corpus:"fixture-v1", theta_nom:10000,
  gamma:0, r2_log:null, distance:[1,2,3], mean_attention:[0.25,0.25,0.25], residual_log:[0,0,0],
  protocol:{id:"guide-distance-mean-v1",length:4,queries:[3],sink_tokens:0,samples:2,
    pooling:"arithmetic_mean_per_distance",fit:"unweighted_OLS_log_mean_vs_log_distance",
    layer:0,head:0,backend:"numpy",dtype:"float64",quantization:"none",seed:42,tokenizer_revision:"not_used"} };
const ng=normalizeMeasured(guide);
ck("guide zero gamma and undefined flat-fit R2 preserved", ng.gamma_obs===0 && ng.R2===null && ng.T===4);
ck("normalization preserves provenance and is idempotent", JSON.stringify(normalizeMeasured(ng))===JSON.stringify(ng));
const exported=contributionRecord(null,ng,null).json;
ck("export retains curve, residuals and exact protocol", exported.protocol===guide.protocol && exported.mean_attention===guide.mean_attention && exported.revision===guide.revision);
ck("explicit source not relabelled as dataset", normalizeMeasured({...guide,source:"experiment"}).source==="experiment");
ck("no finite gamma means no valid measurement", normalizeMeasured({gamma:Infinity})===null && normalizeMeasured({gamma:NaN})===null);
ck("documented fixed context uses measured length, not N", predictionContext({...guide,N:9999}).T===4);
ck("geometry conflict blocks prediction", predictionVsReality({T:500},guide).length===0 && predictionContext({...guide,T_eval:8}).status==="conflict");
ck("old context remains explicitly illustrative", predictionContext(cli).status==="legacy");
const variable={...cli,attn_by_distance:{10:.1,50:.02},protocol:{id:"taf-cli-variable-length-v1",length_policy:"distance_plus_50"},D90_kind:"derived_power_law"};
ck("variable length cannot be compared to single-context Pade", predictionContext(variable).status==="variable" && predictionVsReality({},variable).length===0);
ck("legacy CLI curve also identifies variable length", predictionContext({...variable,protocol:null}).status==="variable");
ck("null records do not throw", predictionVsReality({},null).length===0);
ck("equal documented protocols incl zero indices", missingProtocolFields(guide).length===0 && compareProtocols(guide,guide).status==="same");
ck("gamma changes are not protocol differences", compareProtocols(guide,{...guide,gamma:1}).status==="same");
ck("sink changes are explicit", compareProtocols(guide,{...guide,protocol:{...guide.protocol,sink_tokens:1}}).fields.some(f=>f.key==="sink_tokens"&&f.status==="different"));
ck("unknown protocols never count as identical", compareProtocols(ds,ds).status==="unknown");
ck("partial protocols may have differences and unknowns", compareProtocols(ds,{...ds,corpus:"other"}).status==="different");
ck("additional protocol conditions are compared too", compareProtocols(guide,{...guide,protocol:{...guide.protocol,rope_scaling:2}}).fields.some(f=>f.key==="rope_scaling"&&f.status==="unknown"));
ck("object key order does not create differences", compareProtocols({...guide,protocol:{...guide.protocol,extra:{a:1,b:2}}},{...guide,protocol:{...guide.protocol,extra:{b:2,a:1}}}).status==="same");
ck("export does not invent a corpus for anonymous measurements", contributionRecord(null,{gamma:0},null).json.corpus===null);

console.log(`\n==== prediction_reality: ${p} passed, ${f} failed ====`);
process.exit(f?1:0);
