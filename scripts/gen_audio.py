#!/usr/bin/env python3
"""
为词条批量生成英美发音 mp3（Edge TTS）。

产物： data/audio/us/<id>.mp3、data/audio/uk/<id>.mp3
（默认不进 git —— 体积约 280MB，走 GitHub Releases 分发；见 README）

用法：
  python3 scripts/gen_audio.py                # 全量，跳过已存在的
  python3 scripts/gen_audio.py --limit 20     # 只跑前 20 个词（冒烟）
  python3 scripts/gen_audio.py --concurrency 6
  python3 scripts/gen_audio.py --proxy http://127.0.0.1:7899   # 需要走代理时

依赖： pip install edge-tts   （⚠️ 必须 ≥ 7.3.1：7.2.x 会被
      speech.platform.bing.com 返回 403 WSServerHandshakeError，实测 7.3.1 正常）
"""
import argparse, asyncio, json, os, sys, time

try:
    import edge_tts
except ImportError:
    print("✗ 缺依赖：pip install -U 'edge-tts>=7.3.1'"); sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "words.json")
OUT = os.path.join(ROOT, "data", "audio")

VOICES = {"us": "en-US-AriaNeural", "uk": "en-GB-SoniaNeural"}
RATE = "-10%"          # 稍慢，方便跟读
RETRY = 3


async def synth(text, voice, proxy=None):
    kw = {"rate": RATE}
    if proxy:
        kw["proxy"] = proxy
    c = edge_tts.Communicate(text, voice, **kw)
    buf = b""
    async for ch in c.stream():
        if ch["type"] == "audio":
            buf += ch["data"]
    return buf


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=5)
    ap.add_argument("--proxy", default=None)
    ap.add_argument("--only", choices=["us", "uk"], default=None)
    a = ap.parse_args()

    words = json.load(open(SRC, encoding="utf-8"))["words"]
    if a.limit:
        words = words[:a.limit]
    tags = [a.only] if a.only else list(VOICES)

    tasks = []
    for w in words:
        for tag in tags:
            dst = os.path.join(OUT, tag, f"{w['id']}.mp3")
            if os.path.exists(dst) and os.path.getsize(dst) > 800:
                continue
            tasks.append((w["id"], w["word"], tag, dst))
    print(f"待生成 {len(tasks)} 段（词 {len(words)} × {len(tags)} 档）· 并发 {a.concurrency}", flush=True)
    if not tasks:
        print("没有需要生成的"); return

    sem = asyncio.Semaphore(a.concurrency)
    stat = {"ok": 0, "fail": 0, "bytes": 0}
    t0 = time.time()

    async def job(idx, wid, word, tag, dst):
        async with sem:
            for attempt in range(1, RETRY + 1):
                try:
                    data = await synth(word, VOICES[tag], a.proxy)
                    if not data:
                        raise RuntimeError("空音频")
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    tmp = dst + ".tmp"
                    with open(tmp, "wb") as f:
                        f.write(data)
                    os.replace(tmp, dst)
                    stat["ok"] += 1
                    stat["bytes"] += len(data)
                    break
                except Exception as e:
                    if attempt == RETRY:
                        stat["fail"] += 1
                        if stat["fail"] <= 20:
                            print(f"  ✗ {tag} {word}: {type(e).__name__} {str(e)[:70]}", flush=True)
                    else:
                        await asyncio.sleep(1.5 * attempt)
            if (stat["ok"] + stat["fail"]) % 200 == 0:
                el = time.time() - t0
                done = stat["ok"] + stat["fail"]
                print(f"  {done}/{len(tasks)}  成功 {stat['ok']} 失败 {stat['fail']}  "
                      f"{stat['bytes']/1048576:.0f}MB  {el:.0f}s  "
                      f"预计剩余 {el/max(1,done)*(len(tasks)-done)/60:.0f} 分钟", flush=True)

    await asyncio.gather(*[job(i, *t) for i, t in enumerate(tasks)])

    el = time.time() - t0
    print(f"\n完成：成功 {stat['ok']} / 失败 {stat['fail']} / 共 {len(tasks)}")
    print(f"体积 {stat['bytes']/1048576:.1f} MB  用时 {el/60:.1f} 分钟")


if __name__ == "__main__":
    asyncio.run(main())
