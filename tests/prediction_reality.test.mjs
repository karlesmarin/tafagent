import { normalizeMeasured, matchMeasured, predictionVsReality, confidenceFromMeasured, contributionRecord, gammaPade } from "../js/prediction_reality.js";
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
ck("confidence flips to benchmark_yes + gamma_measured", cf.some(x=>x.key==="benchmark_yes"&&x.status==="ok") && cf.some(x=>x.key==="gamma_measured"));
ck("confidence calib from R2≥0.8", cf.some(x=>x.key==="calib_reliable"));

const c=contributionRecord("meta-llama/Llama-3-8B", cli, {rope_theta:500000});
ck("contribution record schema", c.json.model==="meta-llama/Llama-3-8B" && c.json.gamma===0.97 && c.json.theta_nom===500000 && c.json.N===8192);
ck("contribution HF discussion url", /huggingface\.co\/datasets\/karlexmarin\/taf-attention-decay\/discussions\/new/.test(c.hfUrl));

console.log(`\n==== prediction_reality: ${p} passed, ${f} failed ====`);
process.exit(f?1:0);
