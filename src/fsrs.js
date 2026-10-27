/**
 * FSRS 复习调度引擎 —— 与 CozyLingo 线上服务端 lib/personalized-core.js 逐字相同。
 *
 * 实现 FSRS v4.5 默认参数：遗忘曲线 R(t) = (1 + FACTOR·t/S)^DECAY，
 * 按目标记忆率 requestRetention = 0.9 反推下次复习间隔。
 * 每个词单独维护 stability（记忆稳定度）与 difficulty（难度）。
 *
 * 该文件是 CommonJS 模块（服务端与浏览器共用同一份），浏览器里由 index.html
 * 用一个 3 行 shim 加载，见 README「FSRS 引擎」一节。
 */
const FSRS_RATINGS = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

const FSRS_RATING_NAMES = Object.fromEntries(Object.entries(FSRS_RATINGS).map(([name, value]) => [value, name]));
const FSRS_DECAY = -0.5;
const FSRS_FACTOR = Math.pow(0.9, 1 / FSRS_DECAY) - 1;
const FSRS_PARAMS_VERSION = 'fsrs-v4.5-default';
const DEFAULT_FSRS_PARAMS = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544,
  1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034, 0.6567,
];
const DEFAULT_FSRS_OPTIONS = {
  requestRetention: 0.9,
  maximumInterval: 36500,
  againMinutes: 10,
  hardMinutes: 20,
};

function defaultModesForSource(sourceType) {
  if (sourceType === 'grammar') return ['copy'];
  if (sourceType === 'vocab_card' || sourceType === 'word_dict') return ['copy', 'dictation'];
  return ['copy', 'assembly', 'dictation'];
}

function preferredPracticeMode(modes, defaultMode = 'copy') {
  const safeModes = Array.isArray(modes) ? modes : [];
  if (safeModes.includes(defaultMode)) return defaultMode;
  if (safeModes.includes('copy')) return 'copy';
  if (safeModes.includes('assembly')) return 'assembly';
  if (safeModes.includes('dictation')) return 'dictation';
  return defaultMode;
}

function sourcePracticeHref(src, mode) {
  if (src.source_type === 'grammar') {
    // 走 personalized 做题流程（有评分/进度保存），而不是直接跳 /cloze
    return `/personalized/practice?source=${src.id}&mode=cloze`;
  }
  if (src.source_type === 'vocab_card') {
    return `/card?category=${encodeURIComponent(src.category || '')}`;
  }
  if (src.source_type === 'word_dict') {
    return `/vocab?category=${encodeURIComponent(src.category || '')}`;
  }
  return `/personalized/practice?source=${src.id}&mode=${mode}`;
}

function personalizedPracticeHref(sourceId, mode) {
  return `/personalized/practice?source=${sourceId}&mode=${mode}`;
}

function resolveTodayPerSource(requested, dailyPerSource) {
  const daily = Number(dailyPerSource) || 8;
  const requestedNum = Number(requested) || daily;
  return Math.min(Math.max(requestedNum, 1), 30);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(a, b) {
  const start = parseDate(a);
  const end = parseDate(b);
  if (!start || !end) return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / 86400000);
}

function normalizeFsrsRating(rating, correct) {
  if (typeof rating === 'number' && FSRS_RATING_NAMES[rating]) return FSRS_RATING_NAMES[rating];
  const raw = String(rating || '').trim().toLowerCase();
  if (raw && FSRS_RATINGS[raw]) return raw;
  if (['1', 'again', 'forgot', 'wrong', 'fail'].includes(raw)) return 'again';
  if (['2', 'hard'].includes(raw)) return 'hard';
  if (['3', 'good', 'ok'].includes(raw)) return 'good';
  if (['4', 'easy'].includes(raw)) return 'easy';
  return correct ? 'good' : 'again';
}

function constrainDifficulty(difficulty) {
  return clamp(difficulty, 1, 10);
}

function constrainStability(stability) {
  return Math.max(0.01, stability);
}

function initStability(ratingValue, params = DEFAULT_FSRS_PARAMS) {
  return constrainStability(params[ratingValue - 1]);
}

function initDifficulty(ratingValue, params = DEFAULT_FSRS_PARAMS) {
  return constrainDifficulty(params[4] - Math.exp((ratingValue - 1) * params[5]) + 1);
}

function nextDifficulty(difficulty, ratingValue, params = DEFAULT_FSRS_PARAMS) {
  const easyDifficulty = initDifficulty(FSRS_RATINGS.easy, params);
  const next = difficulty - params[6] * (ratingValue - FSRS_RATINGS.good);
  return constrainDifficulty(params[7] * easyDifficulty + (1 - params[7]) * next);
}

function forgettingCurve(elapsedDays, stability) {
  const safeStability = constrainStability(Number(stability) || 0.01);
  return Math.pow(1 + FSRS_FACTOR * Math.max(0, elapsedDays) / safeStability, FSRS_DECAY);
}

function nextInterval(stability, options = DEFAULT_FSRS_OPTIONS) {
  const requestRetention = clamp(Number(options.requestRetention) || DEFAULT_FSRS_OPTIONS.requestRetention, 0.7, 0.99);
  const maximumInterval = Number(options.maximumInterval) || DEFAULT_FSRS_OPTIONS.maximumInterval;
  const raw = stability / FSRS_FACTOR * (Math.pow(requestRetention, 1 / FSRS_DECAY) - 1);
  return clamp(Math.round(raw), 1, maximumInterval);
}

function nextRecallStability(difficulty, stability, retrievability, ratingValue, params = DEFAULT_FSRS_PARAMS) {
  const hardPenalty = ratingValue === FSRS_RATINGS.hard ? params[15] : 1;
  const easyBonus = ratingValue === FSRS_RATINGS.easy ? params[16] : 1;
  const growth = Math.exp(params[8])
    * (11 - difficulty)
    * Math.pow(stability, -params[9])
    * (Math.exp((1 - retrievability) * params[10]) - 1)
    * hardPenalty
    * easyBonus;
  return constrainStability(stability * (1 + growth));
}

function nextForgetStability(difficulty, stability, retrievability, params = DEFAULT_FSRS_PARAMS) {
  return constrainStability(
    params[11]
    * Math.pow(difficulty, -params[12])
    * (Math.pow(stability + 1, params[13]) - 1)
    * Math.exp((1 - retrievability) * params[14])
  );
}

function parseFsrsCard(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch {}
  return null;
}

function fsrsCardFromProgress(progress = {}) {
  const stored = parseFsrsCard(progress.fsrs_card) || {};
  const lastReview = stored.last_review || progress.last_practiced_at || null;
  const status = stored.state || progress.status || 'new';
  return {
    state: status === 'mastered' ? 'review' : status,
    due: stored.due || progress.next_due_at || null,
    stability: Number(stored.stability ?? progress.stability ?? 0),
    difficulty: Number(stored.difficulty ?? progress.difficulty ?? 0),
    elapsed_days: Number(stored.elapsed_days ?? 0),
    scheduled_days: Number(stored.scheduled_days ?? progress.interval_days ?? 0),
    reps: Number(stored.reps ?? ((Number(progress.correct_count) || 0) + (Number(progress.wrong_count) || 0))),
    lapses: Number(stored.lapses ?? progress.lapses ?? 0),
    last_review: lastReview,
    params_version: stored.params_version || FSRS_PARAMS_VERSION,
  };
}

function minutesToDays(minutes) {
  return minutes / 1440;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function buildResult(card, rating, reviewedAt, scheduledDays, state, stability, difficulty, retrievability, elapsedDays, options) {
  const due = addDays(reviewedAt, scheduledDays);
  const nextCard = {
    state,
    due: due.toISOString(),
    stability,
    difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: scheduledDays,
    reps: card.reps + 1,
    lapses: card.lapses + (rating === 'again' ? 1 : 0),
    last_review: reviewedAt.toISOString(),
    rating,
    rating_value: FSRS_RATINGS[rating],
    retrievability,
    request_retention: options.requestRetention,
    params_version: FSRS_PARAMS_VERSION,
  };
  return {
    rating,
    ratingValue: FSRS_RATINGS[rating],
    isCorrect: rating !== 'again',
    state,
    status: state,
    scheduledDays,
    delayMinutes: Math.max(1, Math.round(scheduledDays * 1440)),
    due,
    stability,
    difficulty,
    retrievability,
    elapsedDays,
    lapses: nextCard.lapses,
    fsrsCard: nextCard,
    before: {
      state: card.state,
      stability: card.stability || null,
      difficulty: card.difficulty || null,
    },
  };
}

function scheduleFsrsReview(progress = {}, inputRating, reviewedAtInput = new Date(), fsrsOptions = {}) {
  const options = { ...DEFAULT_FSRS_OPTIONS, ...fsrsOptions };
  const reviewedAt = parseDate(reviewedAtInput) || new Date();
  const rating = normalizeFsrsRating(inputRating, Boolean(progress.correct));
  const ratingValue = FSRS_RATINGS[rating];
  const card = fsrsCardFromProgress(progress);
  const elapsedDays = card.last_review ? daysBetween(card.last_review, reviewedAt) : 0;
  const hasMemoryState = card.stability > 0 && card.difficulty > 0 && card.reps > 0;

  if (!hasMemoryState || card.state === 'new') {
    const stability = initStability(ratingValue);
    const difficulty = initDifficulty(ratingValue);
    if (rating === 'again') {
      return buildResult(card, rating, reviewedAt, minutesToDays(options.againMinutes), 'learning', stability, difficulty, null, elapsedDays, options);
    }
    if (rating === 'hard') {
      return buildResult(card, rating, reviewedAt, minutesToDays(options.hardMinutes), 'learning', stability, difficulty, null, elapsedDays, options);
    }
    const scheduledDays = rating === 'easy' ? Math.max(2, nextInterval(stability, options)) : 1;
    return buildResult(card, rating, reviewedAt, scheduledDays, 'review', stability, difficulty, null, elapsedDays, options);
  }

  const retrievability = forgettingCurve(elapsedDays, card.stability);
  const difficulty = nextDifficulty(card.difficulty, ratingValue);
  if (rating === 'again') {
    const stability = nextForgetStability(card.difficulty, card.stability, retrievability);
    return buildResult(card, rating, reviewedAt, minutesToDays(options.againMinutes), 'relearning', stability, difficulty, retrievability, elapsedDays, options);
  }

  const stability = nextRecallStability(card.difficulty, card.stability, retrievability, ratingValue);
  const goodStability = nextRecallStability(card.difficulty, card.stability, retrievability, FSRS_RATINGS.good);
  let scheduledDays = nextInterval(stability, options);
  if (rating === 'hard') scheduledDays = Math.min(scheduledDays, Math.max(1, nextInterval(goodStability, options) - 1));
  if (rating === 'easy') scheduledDays = Math.max(scheduledDays, nextInterval(goodStability, options) + 1);
  return buildResult(card, rating, reviewedAt, scheduledDays, 'review', stability, difficulty, retrievability, elapsedDays, options);
}

module.exports = {
  FSRS_RATINGS,
  FSRS_PARAMS_VERSION,
  defaultModesForSource,
  preferredPracticeMode,
  sourcePracticeHref,
  personalizedPracticeHref,
  resolveTodayPerSource,
  normalizeFsrsRating,
  forgettingCurve,
  nextInterval,
  fsrsCardFromProgress,
  scheduleFsrsReview,
};
