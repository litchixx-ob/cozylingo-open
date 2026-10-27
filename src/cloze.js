/**
 * 语法精练 —— 完形填空（cloze）
 *
 * 题库在 data/cloze.json，**为 AI 生成**（覆盖 21 个语法点、A1–C1），
 * 与线上站点使用的题库无关（线上那批题干来自第三方站点，不随本仓库分发）。
 *
 * 交互照搬 CozyLingo 线上 components/GrammarCloze.tsx：
 *   题干挖空 → 四选一 → 检查 → 正误高亮（选错时只有正确答案标绿）→ 讲解 → 下一题
 *
 * 进度存本机 localStorage，含错题本（答错的题可单独重练）。
 */

import * as S from './store.js';

const KEY = 'cozylingo-open.cloze.v1';
const LEVELS = [
  ['a1', 'A1 入门'], ['a2', 'A2 基础'], ['b1', 'B1 进阶'],
  ['b2', 'B2 中高级'], ['c1', 'C1 高级'],
];
const TOPIC_ZH = {
  tenses: '时态', mixed: '综合', sentence: '句子结构', vocabulary: '词汇辨析',
  pronouns: '代词', conditionals: '条件句', prepositions: '介词', gerunds: '动名词',
  modals: '情态动词', questions: '疑问句', passive: '被动语态', reported: '间接引语',
  adjectives: '形容词', nouns: '名词', adverbs: '副词', articles: '冠词',
  comparatives: '比较级', discourse: '语篇衔接', conjunctions: '连词',
  relatives: '关系从句', register: '语域',
};

let BANK = null;
let topics = [];
let state = { level: '', topic: '', wrongOnly: false };
let queue = [], qi = 0, cur = null, picked = null, checked = false;
let session = { done: 0, correct: 0 };
let els = {};

/* ── 本机记录 ─────────────────────────────── */
function loadRec() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function saveRec(r) {
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch {}
}
function recOf(id) { return loadRec()[id] || { c: 0, w: 0 }; }
function mark(id, ok) {
  const r = loadRec();
  const e = r[id] || { c: 0, w: 0 };
  if (ok) e.c++; else e.w++;
  e.last = new Date().toISOString();
  r[id] = e;
  saveRec(r);
}
function wrongCount() {
  return Object.values(loadRec()).filter((e) => (e.w || 0) > 0 && (e.c || 0) === 0).length;
}
function resetAll() {
  localStorage.removeItem(KEY);
  session = { done: 0, correct: 0 };
  buildQueue();
  render();
}

/* ── 题库与队列 ───────────────────────────── */
async function loadBank() {
  if (BANK) return BANK;
  const r = await fetch('data/cloze.json', { cache: 'force-cache' });
  const d = await r.json();
  BANK = d.questions || [];
  const set = new Set(BANK.map((q) => q.topic));
  topics = [...set].sort((a, b) => (TOPIC_ZH[a] || a).localeCompare(TOPIC_ZH[b] || b, 'zh'));
  return BANK;
}

function buildQueue() {
  const rec = loadRec();
  let pool = BANK.filter((q) => {
    if (state.level && q.level !== state.level) return false;
    if (state.topic && q.topic !== state.topic) return false;
    if (state.wrongOnly) {
      const e = rec[q.id];
      if (!e || !(e.w > 0) || (e.c || 0) > 0) return false;
    }
    return true;
  });
  // 错题优先，其次没做过的，最后做对的
  const rank = (q) => {
    const e = rec[q.id];
    if (!e) return 1;
    if (e.w > 0 && (e.c || 0) === 0) return 0;
    return 2;
  };
  pool = pool.slice().sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  queue = pool;
  qi = 0;
  next(true);
}

function next(reset) {
  if (reset) session = { done: 0, correct: 0 };
  picked = null;
  checked = false;
  if (qi >= queue.length) { cur = null; render(); return; }
  cur = queue[qi];
  render();
}

/* ── 朗读（用浏览器自带合成，句子不预生成音频）── */
function speak() {
  if (!cur || !window.speechSynthesis) return;
  const fill = checked ? cur.answer : (picked || cur.answer);
  const text = cur.content.replace(/_{2,}/g, fill).replace(/\s{2,}/g, ' ').trim();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

/* ── 渲染 ─────────────────────────────────── */
function render() {
  if (!els.body) return;
  const wrong = wrongCount();
  els.head.innerHTML = `
    <div class="pbar">
      <span><b>${session.done}</b> 本次已练</span>
      <span>正确率 <b>${session.done ? Math.round((session.correct / session.done) * 100) : 0}%</b></span>
      <span>错题本 <b>${wrong}</b></span>
      <span>题库 <b>${BANK ? BANK.length.toLocaleString() : '…'}</b> 题</span>
    </div>
    <div class="pset">
      <label>级别
        <select data-f="level">
          <option value="">全部</option>
          ${LEVELS.map(([k, v]) => `<option value="${k}"${state.level === k ? ' selected' : ''}>${v}</option>`).join('')}
        </select>
      </label>
      <label>语法点
        <select data-f="topic">
          <option value="">全部</option>
          ${topics.map((t) => `<option value="${t}"${state.topic === t ? ' selected' : ''}>${TOPIC_ZH[t] || t}</option>`).join('')}
        </select>
      </label>
      <label class="chk"><input type="checkbox" data-f="wrong"${state.wrongOnly ? ' checked' : ''}> 只练错题</label>
      <button class="ghost" id="c-reset">清空记录</button>
    </div>`;

  if (!cur) {
    els.body.innerHTML = `
      <div class="pcard empty">
        <p class="big">${queue.length ? '这一组练完了 🎉' : '没有符合条件的题'}</p>
        <p class="muted">${queue.length
          ? `本次 ${session.done} 题，正确率 ${session.done ? Math.round((session.correct / session.done) * 100) : 0}%。换个语法点继续，或点「重新来一组」。`
          : '换个级别或语法点试试；「只练错题」在错题本为空时也会是空的。'}</p>
        <button class="primary" id="c-again">重新来一组</button>
      </div>`;
    bindHead();
    els.body.querySelector('#c-again')?.addEventListener('click', () => { buildQueue(); });
    return;
  }

  const zhMeta = /^(哪种|哪一|选择|选出)/.test((cur.zh || '').trim());
  const parts = cur.content.split(/_{2,}/);
  const stem = parts.map((p, i) => i < parts.length - 1
    ? `${p}<span class="blank">${checked && picked ? esc(picked) : ' '}</span>`
    : p).join('');

  const opts = cur.options.map((o) => {
    let cls = 'opt';
    if (checked) {
      if (o === picked) cls += ' mine';
      if (o === cur.answer && (o !== picked || picked === cur.answer)) cls += ' right';
      if (o !== picked && o !== cur.answer) cls += ' dim';
    } else if (o === picked) cls += ' mine';
    return `<button class="${cls}" data-opt="${esc(o)}"${checked ? ' disabled' : ''}>${esc(o)}</button>`;
  }).join('');

  els.body.innerHTML = `
    <div class="pcard">
      <div class="qmeta">
        <span class="tag">${TOPIC_ZH[cur.topic] || cur.topic}</span>
        <span class="tag lv">${(cur.level || '').toUpperCase()}</span>
        <span class="qidx">第 ${qi + 1} / ${queue.length} 题</span>
      </div>
      ${(!zhMeta && cur.zh) ? `<p class="qzh">${esc(cur.zh)}</p>` : ''}
      <p class="qstem">${stem}</p>
      <div class="qbar"><button class="ghost" id="c-speak">🔊 朗读</button></div>
      <div class="opts">${opts}</div>
      ${!checked
        ? `<button class="primary wide" id="c-check"${picked ? '' : ' disabled'}>检查</button>`
        : `<div class="result">
             <p class="verdict ${picked === cur.answer ? 'ok' : 'no'}">
               ${picked === cur.answer ? '✓ 正确！' : `不太对 · 正确答案：<b>${esc(cur.answer)}</b>`}
             </p>
             ${cur.explanation ? `<p class="expl">${esc(cur.explanation)}</p>` : ''}
             ${cur.zh && !zhMeta ? `<p class="expl muted">整句：${esc(cur.content.replace(/_{2,}/g, cur.answer))}<br>${esc(cur.zh)}</p>` : ''}
             <button class="primary wide" id="c-next">下一题 →</button>
           </div>`}
    </div>`;

  bindHead();
  els.body.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
    if (checked) return;
    picked = b.getAttribute('data-opt');
    render();
  }));
  els.body.querySelector('#c-speak')?.addEventListener('click', speak);
  els.body.querySelector('#c-check')?.addEventListener('click', () => {
    if (!picked) return;
    checked = true;
    const ok = picked === cur.answer;
    session.done++;
    if (ok) session.correct++;
    mark(cur.id, ok);
    render();
  });
  els.body.querySelector('#c-next')?.addEventListener('click', () => { qi++; next(false); });
}

function bindHead() {
  els.head.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('change', () => {
    const f = el.getAttribute('data-f');
    if (f === 'wrong') state.wrongOnly = el.checked;
    else state[f] = el.value;
    buildQueue();
  }));
  els.head.querySelector('#c-reset')?.addEventListener('click', () => {
    if (confirm('清空本机的语法练习记录（含错题本）？')) resetAll();
  });
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── 入口 ─────────────────────────────────── */
export async function mountCloze(headEl, bodyEl) {
  els = { head: headEl, body: bodyEl };
  if (BANK) { render(); return; }
  els.head.innerHTML = '<div class="pbar"><span>题库加载中…</span></div>';
  els.body.innerHTML = '';
  try {
    await loadBank();
    buildQueue();
  } catch (e) {
    els.head.innerHTML = '';
    els.body.innerHTML = `<div class="pcard empty"><p class="big">题库加载失败</p><p class="muted">${esc(e.message)}</p></div>`;
  }
}
