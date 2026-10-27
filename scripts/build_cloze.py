#!/usr/bin/env python3
"""
把 data/cloze-src/b*.json 各批题库合并、校验、去重，输出 data/cloze.json。

想加题：在 data/cloze-src/ 下新建一个 b*.json，按同样字段写，然后重跑本脚本即可。

校验项（任一不过就报错并列出）：
  - 必需字段齐全，level ∈ a1..c1，topic ∈ 21 个规范语法点
  - content 恰好一个空位（___ 或更多下划线）
  - options 恰好 4 个且互不相同
  - answer 必须在 options 里
  - id 全局唯一
  - 同一题干不得重复
用法： python3 scripts/build_cloze.py [--strict]
"""
import glob, json, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, "data", "cloze-src")
DST = os.path.join(ROOT, "data", "cloze.json")

TOPICS = ["tenses", "mixed", "sentence", "vocabulary", "pronouns", "conditionals",
          "prepositions", "gerunds", "modals", "questions", "passive", "reported",
          "adjectives", "nouns", "adverbs", "articles", "comparatives", "discourse",
          "conjunctions", "relatives", "register"]
LEVELS = ["a1", "a2", "b1", "b2", "c1"]
BLANK = re.compile(r"_{2,}")


def main():
    strict = "--strict" in sys.argv
    files = sorted(glob.glob(os.path.join(GEN, "b*.json")))
    if not files:
        print(f"✗ {GEN}/b*.json 一个都没有"); sys.exit(1)

    qs, bad, seen_id, seen_stem = [], [], set(), set()
    for f in files:
        try:
            arr = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            print(f"✗ {os.path.basename(f)} JSON 解析失败：{e}"); sys.exit(1)
        n0 = len(arr)
        for q in arr:
            qid = q.get("id") or "?"
            errs = []
            for k in ("id", "topic", "level", "content", "options", "answer", "explanation", "zh"):
                if not q.get(k):
                    errs.append(f"缺 {k}")
            if q.get("topic") not in TOPICS:
                errs.append(f"topic 非法({q.get('topic')})")
            if q.get("level") not in LEVELS:
                errs.append(f"level 非法({q.get('level')})")
            if q.get("content") and len(BLANK.findall(q["content"])) != 1:
                errs.append("空位数量不是 1")
            opts = q.get("options") or []
            if len(opts) != 4:
                errs.append(f"options 不是 4 个({len(opts)})")
            elif len(set(opts)) != 4:
                errs.append("options 有重复项")
            if q.get("answer") and opts and q["answer"] not in opts:
                errs.append("answer 不在 options 里")
            if qid in seen_id:
                errs.append("id 重复")
            stem = (q.get("content") or "").strip().lower()
            if stem and stem in seen_stem:
                errs.append("题干重复")
            if errs:
                bad.append((os.path.basename(f), qid, "; ".join(errs)))
                continue
            seen_id.add(qid)
            seen_stem.add(stem)
            qs.append(q)
        print(f"  {os.path.basename(f):22s} {n0:4d} 条 → 通过 {n0 - sum(1 for b in bad if b[0] == os.path.basename(f)):4d}")

    if bad:
        print(f"\n⚠️ {len(bad)} 条不合格：")
        for f, qid, e in bad[:30]:
            print(f"    {f} {qid}: {e}")
        if strict:
            print("\n--strict：不落盘"); sys.exit(1)

    # 按 topic → level → id 排序，便于阅读与增量 diff
    qs.sort(key=lambda q: (TOPICS.index(q["topic"]), LEVELS.index(q["level"]), q["id"]))

    by_topic = collections.Counter(q["topic"] for q in qs)
    by_level = collections.Counter(q["level"] for q in qs)

    data = {
        "name": "cozylingo-open-cloze",
        "version": "0.1.0",
        "license": "CC BY 4.0",
        "source": "AI 生成（CozyLingo 自研），非第三方题库",
        "topics": TOPICS,
        "levels": LEVELS,
        "count": len(qs),
        "byTopic": {t: by_topic[t] for t in TOPICS},
        "byLevel": {l: by_level[l] for l in LEVELS},
        "questions": qs,
    }
    json.dump(data, open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=0, separators=(",", ":"))

    print(f"\n✓ {os.path.relpath(DST, ROOT)}  {os.path.getsize(DST)/1024:.0f} KB  共 {len(qs)} 题")
    print(f"  按级别 {dict(sorted(by_level.items()))}")
    print(f"  按语法点（{len([t for t in TOPICS if by_topic[t]])}/{len(TOPICS)} 个有题）：")
    for t in TOPICS:
        bar = "█" * round(by_topic[t] / 6)
        print(f"    {t:14s} {by_topic[t]:4d}  {bar}")
    missing = [t for t in TOPICS if not by_topic[t]]
    if missing:
        print(f"  ⚠️ 还没有题的语法点：{missing}")


if __name__ == "__main__":
    main()
