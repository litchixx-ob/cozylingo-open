#!/usr/bin/env python3
"""重新生成 PUBLIC_MANIFEST.json（改过数据后必须跑一次）。"""
import hashlib, json, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


items = []
for dp, _dn, fn in os.walk(ROOT):
    parts = dp.split(os.sep)
    # 跳过：git 内部、本地缓存、以及不进 git 的发音音频（约 300MB，走 Releases 分发）
    if ".git" in parts or ".cache" in parts:
        continue
    if os.path.join("data", "audio") in dp:
        continue
    for f in fn:
        fp = os.path.join(dp, f)
        if os.path.basename(fp) in ("PUBLIC_MANIFEST.json",):
            continue
        items.append({"path": os.path.relpath(fp, ROOT).replace(os.sep, "/"),
                      "bytes": os.path.getsize(fp), "sha256": sha256(fp)})
items.sort(key=lambda x: x["path"])
out = {"name": "CozyLingo Open",
       "generated": datetime.date.today().isoformat(),
       "files": len(items), "bytes": sum(i["bytes"] for i in items), "items": items}
json.dump(out, open(os.path.join(ROOT, "PUBLIC_MANIFEST.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print(f"清单已更新：{out['files']} 个文件 / {out['bytes']/1048576:.1f} MB")
