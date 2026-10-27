/**
 * 今日小课 —— 用 FSRS 排今天该练哪些词，练完把结果写回本地进度。
 *
 * 排课逻辑（与线上一致）：
 *   1. 先排「到期复习」（按 due 升序；设置里开了错题优先则错题排最前）
 *   2. 再补「新词」，按词频序号从小到大（最常用的先学），受 dailyNew 上限约束
 *   3. 已掌握的词（阶段 4）不再排入
 *
 * 评分五档 → FSRS rating：
 *   不会 again(1) · 困难 hard(2) · 良好 good(3) · 简单 easy(4) · 已掌握 mastered(直接毕业出队)
 * FSRS 按 requestRetention = 0.9 反推下次间隔；答「不会」10 分钟后再来一次。
 */

import * as S from './store.js';

const FSRS = window.module.exports;      // src/fsrs.js（服务端逐字相同的 CommonJS 模块）

const RATINGS = [
  { key: 'again', label: '不会', cls: 'r-again', hint: 'R / 1' },
  { key: 'hard', label: '困难', cls: 'r-hard', hint: '2' },
  { key: 'good', label: '良好', cls: 'r-good', hint: 'Enter / 3' },
  { key: 'easy', label: '简单', cls: 'r-easy', hint: '4' },
];

let queue = [];
let idx = 0;
let revealed = false;
let host = null;
let onDone = null;
let wordsById = new Map();
let session = { done: 0, again: 0 };

export function buildQueue(words) {
  wordsById = new Map(words.map(w => [w.word, w]));
  const st = S.settings();
  const due = S.dueList().slice(0, st.dailyReview);
  const dueSet = new Set(due);
  const fresh = S.newList(words, st.dailyNew).filter(w => !dueSet.has(w));
  queue = [...due, ...fresh];
  idx = 0; revealed = false; session = { done: 0, again: 0 };
  return { due: due.length, fresh: fresh.length, total: queue.length };
}

export function current() {
  const w = queue[idx];
  return w ? wordsById.get(w) : null;
}

export function progressText() {
  return { done: session.done, left: Math.max(0, queue.length - idx), total: queue.length };
}

/** 评分 → 写回进度 → 前进 */
export function rate(ratingKey) {
  const card = current();
  if (!card) return null;
  const word = card.word;

  if (ratingKey === 'mastered') {
    S.markMastered(word);
    session.done++;
    idx++; revealed = false;
    return { word, status: 'mastered', interval: null };
  }

  const prev = S.rec(word) || {};
  const prevProgress = {
    correct: ratingKey !== 'again',
    state: prev.status || prev.state || 'new',
    stability: prev.stability || 0,
    difficulty: prev.difficulty || 0,
    reps: prev.reps || 0,
    lapses: prev.lapses || 0,
    last_review: prev.last_review || null,
    fsrs_card: prev.fsrs_card || null,
  };
  const r = FSRS.scheduleFsrsReview(prevProgress, ratingKey, new Date());
  S.putRec(word, {
    status: r.status,
    state: r.status,
    due: r.due.toISOString(),
    stability: r.stability,
    difficulty: r.difficulty,
    reps: (prev.reps || 0) + 1,
    lapses: r.lapses,
    last_review: new Date().toISOString(),
    correct_count: (prev.correct_count || 0) + (ratingKey !== 'again' ? 1 : 0),
    wrong_count: (prev.wrong_count || 0) + (ratingKey === 'again' ? 1 : 0),
    last_rating: ratingKey,
    fsrs_card: r.fsrsCard,
  });
  session.done++;
  if (ratingKey === 'again') session.again++;
  idx++; revealed = false;
  return { word, status: r.status, interval: r.scheduledDays, rating: ratingKey };
}

export function skip() {
  if (idx < queue.length) { idx++; revealed = false; }
}

/* ───────────────────────────── 渲染 ───────────────────────────── */

export function mount(el, { onFinish, onJump }) {
  host = el;
  onDone = onFinish;
  host._onJump = onJump;
  render();
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function render() {
  if (!host) return;
  const card = current();

  if (!card) {
    const s = S.stats();
    host.innerHTML = `
      <div class="empty">
        <div class="empty-ico">✓</div>
        <h3>今天的任务练完了</h3>
        <p>本次完成 <b>${session.done}</b> 个词${session.again ? `，其中答错 <b>${session.again}</b> 个已排进下次复习` : ''}。</p>
        <p class="muted">累计已学 <b>${s.learned}</b> 词 · 已掌握 <b>${s.mastered}</b> 词 · 今天到期 <b>${s.due}</b> 词</p>
        <div class="row">
          <button class="btn primary" id="p-again-more">再练 10 个新词</button>
          <button class="btn" id="p-reset">重置全部进度</button>
        </div>
      </div>`;
    host.querySelector('#p-again-more').onclick = () => {
      S.saveSettings({ dailyNew: S.settings().dailyNew + 10 });
      onDone && onDone({ restart: true });
    };
    host.querySelector('#p-reset').onclick = () => {
      if (confirm('确定要清空全部学习进度吗？此操作不可撤销。')) { S.resetAll(); onDone && onDone({ restart: true }); }
    };
    return;
  }

  const st = S.settings();
  const s0 = card.senses?.[0] || {};
  const stage = S.stageOf(S.rec(card.word));
  const pt = progressText();

  host.innerHTML = `
    <div class="pbar">
      <div class="pbar-fill" style="width:${pt.total ? Math.round(pt.done * 100 / pt.total) : 0}%"></div>
    </div>
    <div class="pmeta">
      <span>今日小课</span>
      <span class="muted">剩余 ${pt.left} / 共 ${pt.total}　·　已完成 ${pt.done}</span>
    </div>

    <div class="fcard ${revealed ? 'revealed' : ''}">
      <div class="fhead">
        <div class="fword">${esc(card.word)}</div>
        <div class="fipa">${esc(card.ipa_uk ? '英 ' + card.ipa_uk : '')}${card.ipa_uk && card.ipa_us ? ' · ' : ''}${esc(card.ipa_us ? '美 ' + card.ipa_us : '')}</div>
        <div class="frow">
          <button class="btn tiny" data-speak="${esc(card.id)}" data-accent="uk">🔊 英</button>
          <button class="btn tiny" data-speak="${esc(card.id)}" data-accent="us">🔊 美</button>
          ${stage >= 2 ? `<span class="chip chip-s${stage}">${stage === 4 ? '已掌握' : stage === 3 ? '复习中' : '学习中'}</span>` : ''}
        </div>
      </div>
      ${st.showImage && card.img ? `<img class="fimg" src="${esc(card.img)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}

      ${revealed ? `
        <div class="fsec"><h4>释义</h4>
          ${(card.senses || []).map(x => `<div class="sense"><b>${esc(x.pos || '')}</b> ${esc(x.zh || '')}${x.en ? `<div class="muted small">${esc(x.en)}</div>` : ''}</div>`).join('')}
        </div>
        ${(card.ex || []).length ? `<div class="fsec"><h4>例句</h4>${card.ex.map(e => `<div class="ex">${esc(e.en)}<div class="muted small">${esc(e.zh || '')}</div></div>`).join('')}</div>` : ''}
        ${card.remmethod ? `<div class="fsec"><h4>记忆法</h4><div class="rem">${esc(card.remmethod)}</div></div>` : ''}
        <div class="fsec"><h4>标注</h4>
          <span class="chip">${esc(card.topic || '')}</span>
          <span class="chip">词频 #${card.frequency || '-'}</span>
          ${(card.libs || []).map(l => `<span class="chip">${esc(l)}</span>`).join('')}
        </div>
      ` : `
        <button class="btn primary big" id="p-show">显示答案（空格）</button>
      `}
    </div>

    ${revealed ? `
      <div class="rate">
        ${RATINGS.map(r => `<button class="rbtn ${r.cls}" data-rate="${r.key}">
            <span class="rlabel">${r.label}</span><span class="rhint">${r.hint}</span></button>`).join('')}
        <button class="rbtn r-mastered" data-rate="mastered"><span class="rlabel">已掌握</span><span class="rhint">毕业出队</span></button>
      </div>
    ` : `<div class="rate-placeholder">先回忆这个词的意思，再点「显示答案」</div>`}
  `;

  host.querySelector('#p-show')?.addEventListener('click', () => { revealed = true; render(); });
  host.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
    const res = rate(b.dataset.rate);
    flash(res);
    render();
  }));
  host.querySelectorAll('[data-speak]').forEach(b => b.addEventListener('click', () => speak(card, b.dataset.accent)));
}

function flash(res) {
  if (!res) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = res.status === 'mastered'
    ? `${res.word} · 已掌握，毕业出队`
    : `${res.word} · ${res.interval < 1 ? Math.max(1, Math.round(res.interval * 1440)) + ' 分钟后再来' : '下次 ' + res.interval + ' 天后'}`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('in'), 10);
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 1600);
}

/** 发音：优先本地预生成音频，缺失则回退浏览器合成 */
export function speak(card, accent = 'us') {
  const src = `data/audio/${accent}/${card.id}.mp3`;
  const a = new Audio(src);
  a.onerror = () => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(card.word);
      u.lang = accent === 'uk' ? 'en-GB' : 'en-US';
      u.rate = 0.85;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  };
  a.play().catch(() => { a.onerror(); });
}

/** 键盘：空格显示答案 / 1-4 评分 / R 不会 / Enter 良好 */
export function handleKey(e) {
  if (!host || !document.body.contains(host)) return false;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return false;
  if (!current()) return false;
  if (e.key === ' ' || e.key === 'Spacebar') {
    if (!revealed) { e.preventDefault(); revealed = true; render(); return true; }
    return false;
  }
  if (!revealed) return false;
  const map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy', 'r': 'again', 'R': 'again' };
  if (e.key === 'Enter') { rate('good'); render(); return true; }
  const k = map[e.key];
  if (k) { rate(k); render(); return true; }
  return false;
}
