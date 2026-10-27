# FSRS 复习调度说明

「今日小课」不是随机抽词，而是用 **FSRS**（Free Spaced Repetition Scheduler）算出你今天该复习哪些词。

本仓库的 `src/fsrs.js` 与 CozyLingo 线上服务端逐字相同（只多了一段来源注释），
所以这里描述的机制就是线上真实运行的机制。

## 一、为什么需要它

一个词背过一遍不代表记住了。记忆会随时间衰减，而且**每次在「快忘」的时候复习，衰减会变慢**。
间隔重复就是把「下次什么时候复习」算准：太早浪费次数，太晚等于重学。

FSRS 是目前公开文献里效果最好的一类调度算法（Anki 21.0 之后内置的也是它）。
它比传统的 SM-2（Anki 老版）多做了一件事：**给每个词单独维护两条记忆参数**，而不是只用一个「难度系数」。

## 二、核心公式

遗忘曲线：

```
R(t) = (1 + FACTOR · t / S) ^ DECAY
```

| 符号 | 含义 | 本仓库取值 |
| --- | --- | --- |
| `t` | 距上次复习的天数 | 由 `last_review` 算出 |
| `S` | **记忆稳定度**（stability），可理解为「记住多久后回忆率降到 90%」 | 每词独立，随每次评分更新 |
| `DECAY` | 衰减指数 | `-0.5` |
| `FACTOR` | `0.9^(1/DECAY) - 1` | 由 DECAY 推出 |
| `R` | 当前**可提取率**（retrievability）—— 此刻还能想起来的概率 | 计算得出 |

调度时反过来用：给定目标记忆率 `requestRetention = 0.9`，
解出「让 R 降到 0.9 需要多少天」→ 那就是下次复习的间隔。

> 一句话：**它按「90% 还能记住」来安排，而不是按固定天数表。**

## 三、四档评分 + 毕业

界面上五个按钮对应 FSRS 的四种评分，外加一个「毕业」：

| 按钮 | FSRS rating | 值 | 发生什么 |
| --- | --- | --- | --- |
| 不会 | `again` | 1 | 稳定度下降（走遗忘公式），进入 `relearning`，**10 分钟后再来一次** |
| 困难 | `hard` | 2 | 间隔取「良好间隔 − 1 天」，至少 1 天 |
| 良好 | `good` | 3 | 按稳定度算出的正常间隔 |
| 简单 | `easy` | 4 | 间隔取「良好间隔 + 1 天」起步，且首答就至少 2 天 |
| 已掌握 | — | — | 直接标 `mastered`，**毕业出队**，不再排入复习 |

新词的第一次评分：`again`/`hard` 进入学习阶段（10/20 分钟），
`good` 排到 1 天后，`easy` 直接 2 天以上。

## 四、状态口径（与线上一致，勿改）

```
0  未学      —— 本地没有这条记录
2  学习中    —— learning / relearning
3  复习中    —— review
4  已掌握    —— mastered
```

- 「**已学**」= 阶段 ≥ 2
- 「**已掌握**」= 阶段 4
- 灵果山上的表现：未学=暗星 · 学习中=亮星 · 复习中=更亮 · 已掌握=**金色**并放大

## 五、每天排哪些词

`src/practice.js` 的 `buildQueue()`：

1. **先排到期的复习**（`due <= 现在`，且未掌握）
   - 按到期时间升序
   - 设置里开了「错题优先」时，答错过的词排到最前
   - 上限 = `每天复习`（默认 40）
2. **再补新词**：按**词频序号**从小到大（最常用的先学），上限 = `每天新词`（默认 8）
3. 已掌握的词**不再排入**

两个上限和「错题优先 / 显示插画」都在「今日小课」页的设置区里改，存在本机。

## 六、参数表（`src/fsrs.js` 顶部）

| 参数 | 值 | 说明 |
| --- | --- | --- |
| `FSRS_PARAMS_VERSION` | `fsrs-v4.5-default` | 用的是 FSRS v4.5 的默认 19 个参数 |
| `requestRetention` | `0.9` | 目标记忆率 |
| `maximumInterval` | `36500` | 最大间隔（天） |
| `againMinutes` | `10` | 答「不会」后多久再来 |
| `hardMinutes` | `20` | 答「困难」后多久再来 |
| `DECAY` | `-0.5` | 遗忘曲线衰减指数 |

想调「更严格 / 更宽松」，改 `requestRetention` 即可：调高（如 0.95）→ 复习更频繁；
调低（如 0.85）→ 间隔更长、每天更省事。

## 七、进度存在哪

纯 `localStorage`，key 为 `cozylingo-open.progress.v1`，**没有账号、没有后端、没有埋点**。
每条记录：

```json
{
  "be": {
    "status": "review",
    "due": "2026-10-28T10:20:24.332Z",
    "stability": 3.1262,
    "difficulty": 5.3145,
    "reps": 1,
    "lapses": 0,
    "last_review": "2026-10-27T10:20:24.333Z",
    "correct_count": 1,
    "wrong_count": 0,
    "last_rating": "good",
    "fsrs_card": { "...": "FSRS 完整卡片状态" }
  }
}
```

字段与线上 `personalized_progress` 表**同构**，将来要互通不需要转换。
换设备时用「导出进度 / 导入进度」按钮搬 JSON。

## 八、想核对实现

```bash
# 看调度函数本体
sed -n '/function scheduleFsrsReview/,/^}/p' src/fsrs.js

# 在浏览器控制台里手算一次
# （先打开今日小课并评一次分，让 fsrs.js 载入）
window.module.exports.scheduleFsrsReview(
  { correct: true, state: 'new' }, 'good', new Date()
)
```

返回值里 `scheduledDays` 就是这次算出的间隔，`retrievability` 是当前可提取率，
`stability` / `difficulty` 是更新后的记忆参数。
