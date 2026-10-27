/**
 * CozyLingo Open —— 零依赖单页应用
 *   浏览：搜词、按词书/话题筛选、看词条详情
 *   今日小课：FSRS 排课 + 卡片练习（进度存 localStorage）
 *   星图：12,594 个词按话题/词频铺成的 WebGL 星图，学过的词会亮
 *   语法精练：完形填空（AI 生成题库，21 个语法点 × A1–C1）
 */

import * as S from './store.js';
import * as P from './practice.js';
import * as C from './cloze.js';

const PAGE = 60;
let all = [], view = [], shown = 0;
let tab = 'browse';

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ───────────────────────── 启动 ───────────────────────── */
boot();

async function boot() {
  const d = await (await fetch('data/words.json')).json();
  all = d.words || [];
  $('#meta').textContent = `${all.length} 个词条 · ${d.license} · 版本 ${d.version || '-'}`;

  const libs = {}, tops = {};
  for (const w of all) {
    (w.libs || []).forEach(l => libs[l] = (libs[l] || 0) + 1);
    tops[w.topic] = (tops[w.topic] || 0) + 1;
  }
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
    ['star', '星图'],
  ].map(([k, label]) => `<button class="tab" data-tab="${k}">${label}<span class="badge" data-badge="${k}"></span></button>`).join('');
  $('#tabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { location.hash = '#' + b.dataset.tab; });
}

export function refreshBadges() {
  const st = S.stats();
  const set = (k, v) => { const e = document.querySelector(`[data-badge="${k}"]`); if (e) e.textContent = v || ''; };
  set('today', st.due || '');
  set('star', st.learned || '');
}

function route() {
  tab = (location.hash || '#browse').slice(1);
  if (!['browse', 'today', 'cloze', 'star'].includes(tab)) tab = 'browse';
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('#view-browse').hidden = tab !== 'browse';
  $('#view-today').hidden = tab !== 'today';
  $('#view-cloze').hidden = tab !== 'cloze';
  $('#view-star').hidden = tab !== 'star';
  $('#filters').hidden = tab !== 'browse';

  if (tab === 'today') mountToday();
  if (tab === 'cloze') C.mountCloze($('#cloze-head'), $('#cloze-body'));
  if (tab === 'star') mountStar();
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
  $('#grid').innerHTML = '';
  shown = 0;
  $('#count').textContent = `${view.length} 条`;
  moreBrowse();
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
    `<button class="close" onclick="document.getElementById('dlg').close()">✕</button>
     <h2>${esc(w.word)}</h2>
     <div class="ph">${esc(w.ipa_uk ? '英 ' + w.ipa_uk : '')}${w.ipa_uk && w.ipa_us ? ' · ' : ''}${esc(w.ipa_us ? '美 ' + w.ipa_us : '')}</div>
     <div class="frow" style="margin:-4px 0 12px">
       <button class="btn tiny" data-speak="${esc(w.id)}" data-accent="uk">🔊 英</button>
       <button class="btn tiny" data-speak="${esc(w.id)}" data-accent="us">🔊 美</button>
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
     <div class="fsec"><button class="btn primary" id="d-practice">用这个词开始练（加入今日小课）</button></div>`;
  $('#dbody').querySelectorAll('[data-speak]').forEach(b => b.onclick = () => {
    const c = all.find(x => x.id === b.dataset.speak); if (c) P.speak(c, b.dataset.accent);
  });
  $('#d-practice').onclick = () => {
    S.saveSettings({ dailyNew: Math.max(S.settings().dailyNew, 1) });
    $('#dlg').close();
    location.hash = '#today';
    setTimeout(() => { mountToday(true); }, 60);
  };
  $('#dlg').showModal();
}

/* ───────────────────────── 今日小课 ───────────────────────── */
let todayForced = false;
function mountToday(force = false) {
  todayForced = todayForced || force;
  const st = S.settings();
  const info = P.buildQueue(all);
  $('#today-head').innerHTML = `
    <div class="statrow">
      <div class="stat"><b>${info.due}</b><span>待复习</span></div>
      <div class="stat"><b>${info.fresh}</b><span>新词</span></div>
      <div class="stat"><b>${info.total}</b><span>今日共</span></div>
      <div class="stat"><b>${S.stats().mastered}</b><span>已掌握</span></div>
    </div>
    <div class="settings">
      <label>每天新词 <input type="number" id="s-new" min="1" max="100" value="${st.dailyNew}"></label>
      <label>每天复习 <input type="number" id="s-rev" min="1" max="200" value="${st.dailyReview}"></label>
      <label class="ck"><input type="checkbox" id="s-wrong" ${st.wrongFirst ? 'checked' : ''}> 错题优先</label>
      <label class="ck"><input type="checkbox" id="s-img" ${st.showImage ? 'checked' : ''}> 显示插画</label>
      <button class="btn tiny" id="s-export">导出进度</button>
      <button class="btn tiny" id="s-import">导入进度</button>
    </div>`;
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

/* ───────────────────────── 星图 ───────────────────────── */
let orchard = null;
async function mountStar() {
  if (orchard) return;
  const mod = await import('./orchard.js');
  orchard = await mod.initOrchard($('#star-host'), {
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
addEventListener('scroll', () => {
  if (tab === 'browse' && innerHeight + scrollY > document.body.offsetHeight - 600) moreBrowse();
});
addEventListener('keydown', e => { if (tab === 'today' && P.handleKey(e)) e.preventDefault(); });

function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
