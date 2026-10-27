/**
 * CozyLingo Open —— 零依赖单页应用
 *   浏览：搜词、按词书/话题筛选、看词条详情
 *   今日小课：FSRS 排课 + 卡片练习（进度存 localStorage）
 *   灵果山：12,594 个词按话题/词频铺成的一座 WebGL 山，学过的词会亮
 *   语法精练：完形填空（AI 生成题库，21 个语法点 × A1–C1）
 */

import * as S from './store.js';
import * as P from './practice.js';
import * as C from './cloze.js';
import { icons, hydrateIcons } from './icons.js';

const PAGE = 60;
let all = [], view = [], shown = 0;
let tab = 'browse';
let libs = {}, tops = {};

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ───────────────────────── 启动 ───────────────────────── */
boot();

async function boot() {
  const d = await (await fetch('data/words.json')).json();
  all = d.words || [];
  $('#meta').textContent = `${all.length.toLocaleString()} 词条 · ${d.license}`;
  hydrateIcons();

  libs = {}; tops = {};
  for (const w of all) {
    (w.libs || []).forEach(l => libs[l] = (libs[l] || 0) + 1);
    tops[w.topic] = (tops[w.topic] || 0) + 1;
  }
  $('#hero-stats').innerHTML = [
    [all.length.toLocaleString(), '词条'],
    [Object.keys(libs).length, '词书'],
    [Object.keys(tops).length, '话题'],
    ['1,015', '语法精练题'],
    ['100%', '记忆法覆盖'],
  ].map(([v, l]) => `<div class="hstat"><b>${v}</b><span>${l}</span></div>`).join('');

  const lb = $('#lib');
  Object.entries(libs).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => lb.add(new Option(`${k}（${n}）`, k)));
  const tp = $('#topic');
  Object.entries(tops).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => tp.add(new Option(`${k}（${n}）`, k)));

  buildTabs();
  applyBrowse();
  refreshBadges();
  location.hash = location.hash || '#browse';
  route();
}

function buildTabs() {
  $('#tabs').innerHTML = [
    ['browse', '词库'],
    ['today', '今日小课'],
    ['cloze', '语法精练'],
    ['orchard', '灵果山'],
  ].map(([k, label]) => `<button class="tab" data-tab="${k}">${label}<span class="badge" data-badge="${k}"></span></button>`).join('');
  $('#tabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { location.hash = '#' + b.dataset.tab; });
}

export function refreshBadges() {
  const st = S.stats();
  const set = (k, v) => { const e = document.querySelector(`[data-badge="${k}"]`); if (e) e.textContent = v || ''; };
  set('today', st.due || '');
  set('orchard', st.learned || '');
}

function route() {
  tab = (location.hash || '#browse').slice(1);
  if (!['browse', 'today', 'cloze', 'orchard'].includes(tab)) tab = 'browse';
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('#view-browse').hidden = tab !== 'browse';
  $('#view-today').hidden = tab !== 'today';
  $('#view-cloze').hidden = tab !== 'cloze';
  $('#view-orchard').hidden = tab !== 'orchard';
  $('#filters').hidden = tab !== 'browse';
  $('#hero').hidden = tab !== 'browse';

  if (tab === 'today') mountToday();
  if (tab === 'cloze') C.mountCloze($('#cloze-head'), $('#cloze-body'));
  if (tab === 'orchard') mountOrchard();
}
addEventListener('hashchange', route);

/* ───────────────────────── 词库浏览 ───────────────────────── */
function applyBrowse() {
  const q = $('#q').value.trim().toLowerCase();
  const lib = $('#lib').value, topic = $('#topic').value;
  view = all.filter(w => {
    if (lib && !(w.libs || []).includes(lib)) return false;
    if (topic && w.topic !== topic) return false;
    if (!q) return true;
    return w.word.toLowerCase().includes(q) ||
      (w.senses || []).some(s => (s.zh || '').includes(q) || (s.en || '').toLowerCase().includes(q));
  });
  const useBtn = $('#use-filter');
  if (useBtn) {
    const on = !!(lib || topic || q);
    useBtn.hidden = !on;
    if (on) useBtn.textContent = `用当前筛选练（${view.length.toLocaleString()} 词）`;
  }

  $('#grid').innerHTML = '';
  shown = 0;
  moreBrowse();
  updateMore();
}

/** 刷新「加载更多」按钮与计数（列表不再无限滚动 —— 12,594 条滚不完，给明确的按钮更好控）*/
function updateMore() {
  const left = view.length - shown;
  const btn = $('#more');
  const wrap = $('#more-wrap');
  if (wrap) wrap.hidden = left <= 0;
  if (btn) btn.textContent = `加载更多（还有 ${left.toLocaleString()} 条）`;
  $('#count').textContent = left > 0
    ? `${view.length.toLocaleString()} 条 · 已显示 ${shown.toLocaleString()}`
    : `${view.length.toLocaleString()} 条 · 已全部显示`;
}

function moreBrowse() {
  const frag = document.createDocumentFragment();
  for (const w of view.slice(shown, shown + PAGE)) {
    const s = (w.senses || [])[0] || {};
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML =
      `<div class="w">${esc(w.word)}</div>
       <div class="ph">${esc(w.ipa_us || w.ipa_uk || '')}${s.pos ? ' · ' + esc(s.pos) : ''}</div>
       <img loading="lazy" src="${esc(w.img)}" alt="" onerror="this.style.display='none'">
       <div class="zh">${esc(s.zh || '')}</div>
       <div class="chips"><span class="chip">${esc(w.topic || '')}</span>${(w.libs || []).map(l => `<span class="chip">${esc(l)}</span>`).join('')}</div>`;
    el.onclick = () => openDetail(w);
    frag.appendChild(el);
  }
  $('#grid').appendChild(frag);
  shown += PAGE;
}

function openDetail(w) {
  const st = S.stageOf(S.rec(w.word));
  const stageLabel = { 0: '未学', 2: '学习中', 3: '复习中', 4: '已掌握' }[st];
  $('#dbody').innerHTML =
    `<button class="close" onclick="document.getElementById('dlg').close()" aria-label="关闭">✕</button>
     <h2>${esc(w.word)}</h2>
     <div class="ph">${esc(w.ipa_uk ? '英 ' + w.ipa_uk : '')}${w.ipa_uk && w.ipa_us ? '　·　' : ''}${esc(w.ipa_us ? '美 ' + w.ipa_us : '')}</div>
     <div class="dmeta">
       <button class="btn tiny" data-speak="${esc(w.id)}" data-accent="uk">${icons.speaker()}英</button>
       <button class="btn tiny" data-speak="${esc(w.id)}" data-accent="us">${icons.speaker()}美</button>
       <span class="chip chip-s${st}">${stageLabel}</span>
     </div>
     ${w.img ? `<img src="${esc(w.img)}" alt="" onerror="this.style.display='none'">` : ''}
     <div class="fsec"><h4>释义</h4>${(w.senses || []).map(s =>
       `<div class="sense"><b>${esc(s.pos || '')}</b> ${esc(s.zh || '')}${s.en ? `<div class="muted small">${esc(s.en)}</div>` : ''}</div>`).join('')}</div>
     ${(w.ex || []).length ? `<div class="fsec"><h4>例句</h4>${w.ex.map(e =>
       `<div class="ex">${esc(e.en)}<div class="muted small">${esc(e.zh || '')}</div></div>`).join('')}</div>` : ''}
     ${w.remmethod ? `<div class="fsec"><h4>记忆法</h4><div class="rem">${esc(w.remmethod)}</div></div>` : ''}
     <div class="fsec"><h4>标注</h4><span class="chip">${esc(w.topic || '')}</span>
       <span class="chip">词频 #${w.frequency || '-'}</span>
       ${(w.libs || []).map(l => `<span class="chip">${esc(l)}</span>`).join('')}
       ${w.tags ? `<span class="chip">${esc(w.tags)}</span>` : ''}</div>
     <div class="fsec">
       <h4>用这批词练</h4>
       <p class="muted small" style="margin:0 0 10px">选定范围后，今天的小课就从这批词里抽 —— 不用一个词一个词加。</p>
       <div class="row" style="justify-content:flex-start;margin-top:0">
         ${(w.libs || []).slice(0, 1).map(l =>
           `<button class="btn primary" data-scope-lib="${esc(l)}">练整本《${esc(l)}》</button>`).join('')}
         ${w.topic ? `<button class="btn" data-scope-topic="${esc(w.topic)}">练整个「${esc(w.topic)}」</button>` : ''}
         <button class="btn" data-scope-all="1">改成练全部词库</button>
       </div>
     </div>`;
  $('#dbody').querySelectorAll('[data-speak]').forEach(b => b.onclick = () => {
    const c = all.find(x => x.id === b.dataset.speak); if (c) P.speak(c, b.dataset.accent);
  });
  const gotoScope = (patch) => {
    S.saveSettings(patch);
    $('#dlg').close();
    location.hash = '#today';
    setTimeout(() => { mountToday(true); }, 60);
  };
  $('#dbody').querySelector('[data-scope-lib]')?.addEventListener('click', (e) =>
    gotoScope({ scopeLib: e.currentTarget.dataset.scopeLib, scopeTopic: '' }));
  $('#dbody').querySelector('[data-scope-topic]')?.addEventListener('click', (e) =>
    gotoScope({ scopeTopic: e.currentTarget.dataset.scopeTopic, scopeLib: '' }));
  $('#dbody').querySelector('[data-scope-all]')?.addEventListener('click', () =>
    gotoScope({ scopeLib: '', scopeTopic: '' }));
  $('#dlg').showModal();
}

/* ───────────────────────── 今日小课 ───────────────────────── */
let todayForced = false;
function mountToday(force = false) {
  todayForced = todayForced || force;
  const st = S.settings();
  const info = P.buildQueue(all);
  $('#today-head').innerHTML = `
    <div class="sec-head">
      <p class="eyebrow">FSRS 间隔复习</p>
      <h2>今日小课</h2>
      <p>按记忆曲线排出今天该练的词：先排到期的复习，再按词频补新词，已掌握的词毕业出队。
         下方的<b>练习范围</b>选一本词书或一个话题，就等于把它整批纳入今天的练习。</p>
    </div>
    <div class="scopebar">
      <span class="eyebrow">当前范围</span>
      <b>${esc(S.scopeLabel())}</b>
      <span class="muted">共 ${info.scopeTotal.toLocaleString()} 词</span>
    </div>
    <div class="statrow">
      <div class="stat"><b>${info.due}</b><span>待复习</span></div>
      <div class="stat"><b>${info.fresh}</b><span>新词</span></div>
      <div class="stat"><b>${info.total}</b><span>今日共</span></div>
      <div class="stat"><b>${S.stats().mastered}</b><span>已掌握</span></div>
    </div>
    <div class="settings scope">
      <span class="scopelead">练习范围</span>
      <label><select id="s-lib">
        <option value="">全部词书</option>
        ${Object.entries(libs).sort((a, b) => b[1] - a[1]).map(([k, n]) =>
          `<option value="${esc(k)}"${st.scopeLib === k ? ' selected' : ''}>${esc(k)}（${n.toLocaleString()}）</option>`).join('')}
      </select></label>
      <label><select id="s-topic">
        <option value="">全部话题</option>
        ${Object.entries(tops).sort((a, b) => b[1] - a[1]).map(([k, n]) =>
          `<option value="${esc(k)}"${st.scopeTopic === k ? ' selected' : ''}>${esc(k)}（${n.toLocaleString()}）</option>`).join('')}
      </select></label>
      <span class="scopeinfo">范围内共 <b>${info.scopeTotal.toLocaleString()}</b> 词</span>
    </div>
    <div class="settings">
      <label>每天新词 <input type="number" id="s-new" min="1" max="100" value="${st.dailyNew}"></label>
      <label>每天复习 <input type="number" id="s-rev" min="1" max="200" value="${st.dailyReview}"></label>
      <label class="ck"><input type="checkbox" id="s-wrong" ${st.wrongFirst ? 'checked' : ''}> 错题优先</label>
      <label class="ck"><input type="checkbox" id="s-img" ${st.showImage ? 'checked' : ''}> 显示插画</label>
      <button class="btn tiny" id="s-export">导出进度</button>
      <button class="btn tiny" id="s-import">导入进度</button>
    </div>`;
  $('#s-lib').onchange = e => { S.saveSettings({ scopeLib: e.target.value }); mountToday(true); };
  $('#s-topic').onchange = e => { S.saveSettings({ scopeTopic: e.target.value }); mountToday(true); };
  $('#s-new').onchange = e => { S.saveSettings({ dailyNew: +e.target.value }); mountToday(true); };
  $('#s-rev').onchange = e => { S.saveSettings({ dailyReview: +e.target.value }); mountToday(true); };
  $('#s-wrong').onchange = e => { S.saveSettings({ wrongFirst: e.target.checked }); mountToday(true); };
  $('#s-img').onchange = e => { S.saveSettings({ showImage: e.target.checked }); mountToday(true); };
  $('#s-export').onclick = () => {
    const blob = new Blob([S.exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cozylingo-open-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  $('#s-import').onclick = () => {
    const f = document.createElement('input');
    f.type = 'file'; f.accept = '.json';
    f.onchange = () => {
      const fr = new FileReader();
      fr.onload = () => { try { S.importAll(fr.result); mountToday(true); refreshBadges(); alert('进度已导入'); } catch (e) { alert('导入失败：' + e.message); } };
      fr.readAsText(f.files[0]);
    };
    f.click();
  };
  P.mount($('#today-body'), { onFinish: () => { mountToday(true); refreshBadges(); } });
}

/* ───────────────────────── 灵果山 ───────────────────────── */
let orchard = null;
async function mountOrchard() {
  if (orchard) return;
  const mod = await import('./orchard.js');
  orchard = await mod.initOrchard($('#orchard-host'), {
    wordsUrl: 'data/orchard.json',
    progress: () => {
      const p = S.progress(), out = {};
      for (const w in p) { const st = S.stageOf(p[w]); if (st >= 2) out[w] = st; }
      return out;
    },
  });
}

/* ───────────────────────── 语法精练 ───────────────────────── */
/* 逻辑全在 src/cloze.js，这里只把两个容器交给它 */

/* ───────────────────────── 事件绑定 ───────────────────────── */
$('#q').addEventListener('input', debounce(applyBrowse, 200));
$('#lib').addEventListener('change', applyBrowse);
$('#topic').addEventListener('change', applyBrowse);
$('#more')?.addEventListener('click', () => { moreBrowse(); updateMore(); });
$('#use-filter')?.addEventListener('click', () => {
  S.saveSettings({ scopeLib: $('#lib').value || '', scopeTopic: $('#topic').value || '' });
  location.hash = '#today';
  setTimeout(() => mountToday(true), 60);
});
addEventListener('keydown', e => { if (tab === 'today' && P.handleKey(e)) e.preventDefault(); });

function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
