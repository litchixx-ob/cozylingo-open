#!/usr/bin/env python3
"""校验 PUBLIC_MANIFEST.json 里每个文件的 sha256 是否与磁盘一致。"""
import hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man = json.load(open(os.path.join(ROOT, "PUBLIC_MANIFEST.json"), encoding="utf-8"))
bad = miss = 0
for it in man["items"]:
    p = os.path.join(ROOT, it["path"])
    if not os.path.exists(p):
        print("  ✗ 缺失", it["path"]); miss += 1; continue
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    if h.hexdigest() != it["sha256"]:
        print("  ✗ 校验和不符", it["path"]); bad += 1
print(f"清单 {len(man['items'])} 个文件 · 缺失 {miss} · 不符 {bad}")
sys.exit(1 if (bad or miss) else 0)
