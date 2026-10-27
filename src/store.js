/**
 * 学习进度存储 —— 纯 localStorage，无账号、无后端、无追踪。
 *
 * 记录结构与 CozyLingo 线上 personalized_progress 表同构，便于将来互通：
 *   { word: { status, due, stability, difficulty, reps, lapses, last_review, fsrs_card } }
 *
 * 阶段口径（与线上一致，勿改）：
 *   0 未学（无记录） · 2 学习中(learning|relearning) · 3 复习中(review) · 4 已掌握(mastered)
 *   「已学」= 阶段 >= 2     「已掌握」= 阶段 4
 */

const PROG_KEY = 'cozylingo-open.progress.v1';
const SET_KEY = 'cozylingo-open.settings.v1';

const DEFAULT_SETTINGS = {
  dailyNew: 8,          // 每天新词上限
  dailyReview: 40,      // 每天复习上限
  wrongFirst: true,     // 错题优先
  showImage: true,      // 卡片上显示插画
  hideMeaning: true,    // 先隐藏释义，点「显示答案」再出
  scopeLib: '',         // 练习范围 · 词书（'' = 不限）
  scopeTopic: '',       // 练习范围 · 话题（'' = 不限）
};

let _prog = null;
let _set = null;

export function settings() {
  if (!_set) {
    try { _set = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SET_KEY) || '{}') }; }
    catch { _set = { ...DEFAULT_SETTINGS }; }
  }
  return _set;
}

export function saveSettings(patch) {
  _set = { ...settings(), ...patch };
  localStorage.setItem(SET_KEY, JSON.stringify(_set));
  return _set;
}

/** 一个词是否落在当前练习范围内 */
export function inScope(w, st = settings()) {
  if (st.scopeLib && !(w.libs || []).includes(st.scopeLib)) return false;
  if (st.scopeTopic && w.topic !== st.scopeTopic) return false;
  return true;
}

/** 按当前范围筛出词池 */
export function scopeWords(words) {
  const st = settings();
  if (!st.scopeLib && !st.scopeTopic) return words;
  return words.filter(w => inScope(w, st));
}

/** 范围的中文描述，用于界面上显示「正在练什么」 */
export function scopeLabel() {
  const st = settings();
  const a = st.scopeLib ? `《${st.scopeLib}》` : '';
  const b = st.scopeTopic ? `「${st.scopeTopic}」` : '';
  return a && b ? `${a} 的 ${b}` : (a || b || '全部词库');
}

export function progress() {
  if (!_prog) {
    try { _prog = JSON.parse(localStorage.getItem(PROG_KEY) || '{}') || {}; }
    catch { _prog = {}; }
  }
  return _prog;
}

function flush() {
  localStorage.setItem(PROG_KEY, JSON.stringify(_prog));
}

export function rec(word) {
  return progress()[word] || null;
}

export function putRec(word, r) {
  progress()[word] = r;
  flush();
}

export function stageOf(r) {
  if (!r) return 0;
  const s = r.status || r.state;
  if (s === 'mastered') return 4;
  if (s === 'review') return 3;
  if (s === 'learning' || s === 'relearning') return 2;
  return 0;
}

export function isMastered(word) { return stageOf(rec(word)) === 4; }

/** 统计：已学 / 已掌握 / 今天到期 */
export function stats(now = new Date()) {
  const p = progress();
  let learned = 0, mastered = 0, due = 0;
  for (const w in p) {
    const st = stageOf(p[w]);
    if (st >= 2) learned++;
    if (st === 4) mastered++;
    if (st >= 2 && st < 4 && p[w].due && new Date(p[w].due) <= now) due++;
  }
  return { learned, mastered, due, total: Object.keys(p).length };
}

/** 到期需要复习的词（已掌握的不再排） */
export function dueList(now = new Date()) {
  const p = progress();
  const out = [];
  for (const w in p) {
    const st = stageOf(p[w]);
    if (st >= 2 && st < 4 && p[w].due && new Date(p[w].due) <= now) {
      out.push({ word: w, rec: p[w], due: new Date(p[w].due) });
    }
  }
  out.sort((a, b) => {
    const aw = a.rec.wrong_count || 0, bw = b.rec.wrong_count || 0;
    if (settings().wrongFirst && (aw > 0) !== (bw > 0)) return bw - aw;   // 错题优先
    return a.due - b.due;
  });
  return out.map(x => x.word);
}

/** 尚未学过的新词（按词频序号，最常用的先来）。words 应由调用方按练习范围先筛过 */
export function newList(words, limit = Infinity) {
  const p = progress();
  return words
    .filter(w => !p[w.word])
    .sort((a, b) => (a.frequency || 1e9) - (b.frequency || 1e9))
    .slice(0, limit)
    .map(w => w.word);
}

export function markMastered(word) {
  const r = rec(word) || {};
  putRec(word, { ...r, status: 'mastered', state: 'mastered', mastered_at: new Date().toISOString() });
}

export function resetWord(word) {
  delete progress()[word];
  flush();
}

export function resetAll() {
  _prog = {};
  flush();
}

/** 导出 / 导入（换设备时用，README 里会写） */
export function exportAll() {
  return JSON.stringify({ version: 1, exported_at: new Date().toISOString(),
                          progress: progress(), settings: settings() }, null, 1);
}

export function importAll(text) {
  const d = JSON.parse(text);
  if (!d || typeof d.progress !== 'object') throw new Error('不是有效的进度备份');
  _prog = d.progress;
  flush();
  if (d.settings) saveSettings(d.settings);
  return stats();
}
