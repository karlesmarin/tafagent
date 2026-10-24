import { inspectModel } from './model_compatibility.js';
import { t, getLang } from './i18n.js';
import { guideLink } from './guide_bridge.js';
let catalog;
const $ = id => document.getElementById(id);
function line(parent, value) { const p = document.createElement('p'); p.textContent = value; parent.append(p); }
export function refreshModelReview() {
  const select = $('model-review-select'), detail = $('model-review-detail');
  if (!catalog || !select || !detail) return;
  select.options[0].textContent = t('models.choose');
  detail.replaceChildren();
  const record = catalog.models.find(x => x.id === select.value);
  if (!record) return;
  line(detail, record.id);
  if (record.config) {
    const r = inspectModel(record.config);
    line(detail, t(r.eligible ? 'models.ready' : 'models.blocked'));
    for (const reason of r.reasons) line(detail, '• ' + t('models.reason.' + reason));
    line(detail, `${t('models.context')}: ${r.configuredContext ?? '—'}`);
    if (record.reference_context) line(detail, `${t('models.reference')}: ${record.reference_context}`);
    const source = document.createElement('a'); source.href = record.source;
    source.textContent = t('models.source') + ' · ' + record.revision.slice(0, 8);
    source.target = '_blank'; source.rel = 'noopener'; detail.append(source);
  } else line(detail, t('models.gated'));
  const p = document.createElement('p'), card = document.createElement('a');
  card.href = record.reference_source || record.model_card; card.textContent = t('models.card');
  card.target = '_blank'; card.rel = 'noopener'; p.append(card); detail.append(p);
  if (record.reference_context) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = t('models.load');
    button.id = 'model-review-load';
    button.addEventListener('click', () => document.dispatchEvent(new CustomEvent('taf:reviewed-model', { detail: record })));
    detail.append(button);
  }
  const next = document.createElement('p'), link = document.createElement('a');
  link.href = guideLink('architecture', 0, { lang: getLang(), model: record.id, mode: 'profile' });
  link.textContent = t('models.guide'); link.target = '_blank'; link.rel = 'noopener'; next.append(link); detail.append(next);
}
export async function initModelReview() {
  const select = $('model-review-select'); if (!select) return;
  try {
    const response = await fetch('data/model_catalog.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    catalog = await response.json();
    select.add(new Option(t('models.choose'), ''));
    for (const r of catalog.models) select.add(new Option(r.id, r.id));
    const example = new URLSearchParams(location.search).get('example');
    if (catalog.models.some(r => r.id === example)) {
      select.value = example; $('model-review').open = true;
    }
    select.addEventListener('change', refreshModelReview);
    refreshModelReview();
  } catch (e) { $('model-review-detail').textContent = '⚠ ' + e.message; }
}
