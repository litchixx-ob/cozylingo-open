#!/usr/bin/env python3
"""
把 data/words.json 转成灵果山引擎要的紧凑格式 data/orchard.json。

格式：
  {
    "universe": "cozylingo-open",
    "topics": ["饮食", "家居", ...],            # 固定顺序，下标即方位
    "words": [["abandon", 12, 3], ...],         # [词, 话题下标, 海拔档 1..5]
    "stats": { "total": N, "byBand": {...}, "byTopic": {...} }
  }

海拔档按词频序号**分位数**分档（越小越常用，位置越低）：
  第 0–20% → 1 山脚（核心词）   20–40% → 2 丘陵（常用）
  40–60%  → 3 山腰（进阶）      60–80% → 4 高山（少见）
  80–100% → 5 雪线（生僻）

为什么用分位数而不是固定阈值：固定阈值（≤1000/3000/8000/20000）是按单个
雅思词库（9,064 词）定的，套到 7 个词书合并的 12,594 词上会让雪线堆 4,311 词、
山脚只剩 564 词 —— 山会变成上宽下窄的倒锥。分位数保证五档均衡，山形才读得出来。

用法： python3 scripts/build_orchard.py
"""
import json, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "words.json")
DST = os.path.join(ROOT, "data", "orchard.json")

QUANTILES = [0.20, 0.40, 0.60, 0.80]

# 约 1/3 的词条没有词频数据（它们是 7 个词书独有、不在主词频表里的词）。
# 对这批词按「所属词书难度」估海拔 —— 词书本身是难度递进的，这是有依据的代理指标，
# 比全塞进雪线（会让山变成上宽下窄的倒锥）或全塞山脚（语义错）都好。
LIB_ORDER = ["junior", "senior", "cet4", "cet6", "kaoyan", "toefl", "sat"]
LIB_BAND = {"junior": 2, "senior": 3, "cet4": 3, "cet6": 4, "kaoyan": 4, "toefl": 5, "sat": 5}


def est_band(w):
    """无词频时的海拔估计：取该词所属最难词书对应的档"""
    idx = [LIB_ORDER.index(l) for l in (w.get("libs") or []) if l in LIB_ORDER]
    if not idx:
        return 4
    return LIB_BAND[LIB_ORDER[max(idx)]]


def band_cutoffs(freqs):
    """按分位数算出 4 个切点，返回升序列表"""
    s = sorted(freqs)
    n = len(s)
    return [s[min(n - 1, max(0, int(n * q)))] for q in QUANTILES]


def band_of(freq, cuts):
    for i, c in enumerate(cuts):
        if freq <= c:
            return i + 1
    return 5


def main():
    d = json.load(open(SRC, encoding="utf-8"))
    ws = d.get("words") or []
    if not ws:
        print("✗ words.json 里没有词条"); sys.exit(1)

    # 话题顺序：固定为「按词数降序」，保证多次运行结果一致
    cnt = collections.Counter(w.get("topic") or "其他" for w in ws)
    topics = [t for t, _ in cnt.most_common()]
    tindex = {t: i for i, t in enumerate(topics)}

    # 分位切点只用「有词频」的词来算，否则 4,060 个 freq=0 的词会把切点拉到最大
    freqed = [int(w["frequency"]) for w in ws if int(w.get("frequency") or 0) > 0]
    cuts = band_cutoffs(freqed)
    out, by_band, by_topic = [], collections.Counter(), collections.Counter()
    n_est = 0
    for w in ws:
        t = w.get("topic") or "其他"
        f = int(w.get("frequency") or 0)
        if f > 0:
            b = band_of(f, cuts)
        else:
            b = est_band(w); n_est += 1
        out.append([w["word"], tindex[t], b])
        by_band[b] += 1
        by_topic[t] += 1

    data = {
        "universe": "cozylingo-open",
        "generated_from": "data/words.json",
        "topics": topics,
        "words": out,
        "stats": {
            "total": len(out),
            "topics": len(topics),
            "bandSource": {"fromFrequency": len(freqed), "estimatedFromBook": n_est},
            "byBand": {str(k): by_band[k] for k in sorted(by_band)},
            "byTopic": {t: by_topic[t] for t in topics},
        },
    }
    json.dump(data, open(DST, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    print(f"✓ {os.path.relpath(DST, ROOT)}  {os.path.getsize(DST)/1024:.0f} KB")
    print(f"  词数 {len(out)} · 话题 {len(topics)}")
    print(f"  海拔分布 {data['stats']['byBand']}")
    print(f"  分位切点 {cuts}")
    print(f"  海拔来源：词频 {len(freqed)} 词 · 按词书估计 {n_est} 词")
    print(f"  最大山脊 {topics[0]} {cnt[topics[0]]} 词 · 最小 {topics[-1]} {cnt[topics[-1]]} 词")
    mx, mn = cnt[topics[0]], cnt[topics[-1]]
    print(f"  脊词数比 {mx/max(1,mn):.1f}×  {'✅ 均匀' if mx/max(1,mn) < 6 else '⚠️ 偏失衡'}")


if __name__ == "__main__":
    main()
