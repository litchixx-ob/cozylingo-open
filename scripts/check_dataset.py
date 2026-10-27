#!/usr/bin/env python3
"""数据集结构校验 —— CI 与提交前都用它。"""
import json, os, sys, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQ = {"id", "word", "senses", "ex", "remmethod", "topic", "frequency", "libs"}
errs, warns = [], []

d = json.load(open(os.path.join(ROOT, "data", "words.json"), encoding="utf-8"))
words = d.get("words") or []
print(f"词条 {len(words)}（声明 {d.get('count')}）")

if d.get("count") != len(words):
    errs.append(f"count 字段 {d.get('count')} != 实际 {len(words)}")

ids = set()
for w in words:
    miss = REQ - set(w)
    if miss:
        errs.append(f"{w.get('id')}: 缺字段 {miss}")
        continue
    if w["id"] in ids:
        errs.append(f"{w['id']}: id 重复")
    ids.add(w["id"])
    if not w["senses"]:
        errs.append(f"{w['id']}: 无释义")
    if not w["remmethod"]:
        errs.append(f"{w['id']}: 无记忆法")
    for s in w["senses"]:
        if re.search(r"\([A-Za-z]{1,3}\)人名", s.get("zh", "")):
            errs.append(f"{w['id']}: 释义含人名噪音")
    for e in w["ex"]:
        if e.get("en", "").startswith(("...", "…")):
            errs.append(f"{w['id']}: 例句疑似真题片段")
    if not w["ex"]:
        warns.append(f"{w['id']}: 无例句")
    if w.get("img") and not os.path.exists(os.path.join(ROOT, w["img"])):
        warns.append(f"{w['id']}: 插画缺失 {w['img']}")

# 禁用词
BANNED = ("真题", "试卷", "考试答案")
for w in words:
    for e in w["ex"]:
        for b in BANNED:
            if b in (e.get("zh") or ""):
                errs.append(f"{w['id']}: 例句含禁用词 {b}")

print(f"错误 {len(errs)} / 警告 {len(warns)}")
for e in errs[:30]:
    print("  ✗", e)
for x in warns[:10]:
    print("  ! ", x)
if len(warns) > 10:
    print(f"  … 另有 {len(warns)-10} 条警告")
sys.exit(1 if errs else 0)
