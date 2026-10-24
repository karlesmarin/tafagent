// Uses the same narrated demo runner as the other TAF tools.
import { dt } from './demo_i18n.js';
import { openResolverForDemo, loadResolverExample, createResolverSummary, simulateResolverProgress } from './resolver_ui.js';

export async function runResolverDemo(D) {
  openResolverForDemo();
  const dialog=document.getElementById('resolver-dialog');
  let interrupted=false;
  const stop=()=>{interrupted=true;};
  const takeOver=e=>{if(e.isTrusted && dialog.contains(e.target))stop();};
  const check=()=>{if(interrupted || !dialog.open)throw new DOMException('Demo interrupted','AbortError');};
  const pause=async ms=>{await D.sleep(ms);check();};
  dialog.addEventListener('close',stop);
  document.addEventListener('pointerdown',takeOver,true);
  document.addEventListener('keydown',takeOver,true);
  document.addEventListener('input',takeOver,true);
  try {
    D.banner(dt('resolver.s1'),1,6);D.hl('#resolver-symptom');await pause(700);
    D.select('#resolver-symptom','memory');await pause(1000);
    D.banner(dt('resolver.s2'),2,6);D.hl('#resolver-symptom-detail');await pause(700);
    D.select('#resolver-symptom-detail','generate');D.hl('#resolver-triage-answer');
    await pause(1600);D.click('#resolver-triage-continue');
    D.banner(dt('resolver.s3'),3,6);D.hl('#resolver-demo');await pause(900);
    await loadResolverExample();check();D.hl('#resolver-memory-fields');await pause(1600);
    D.banner(dt('resolver.s4'),4,6);D.hl('#resolver-result dl');await pause(1800);
    D.hl('#resolver-reduce');await pause(900);D.click('#resolver-reduce');
    D.hl('#resolver-result dl');await pause(1800);
    D.banner(dt('resolver.s5'),5,6);D.click('#resolver-review > summary');D.hl('#resolver-review');await pause(2600);
    D.hl('#resolver-checks');await pause(1200);
    simulateResolverProgress();D.hl('#resolver-progress-next');await pause(1600);
    D.hl('#resolver-failed');await pause(900);
    D.click('#resolver-failed');D.hl('#resolver-followup');await pause(1800);
    D.banner(dt('resolver.s6'),6,6);D.hl('#resolver-case-summary .resolver-summary-guide');await pause(1600);
    D.clearHl();
    return {title:dt('resolver.x.title'),lines:[],content:createResolverSummary('resolver-demo-summary')};
  } finally {
    dialog.removeEventListener('close',stop);
    document.removeEventListener('pointerdown',takeOver,true);
    document.removeEventListener('keydown',takeOver,true);
    document.removeEventListener('input',takeOver,true);
  }
}
