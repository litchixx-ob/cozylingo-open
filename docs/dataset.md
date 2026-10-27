# 词库格式 / Dataset format

## `data/words.json`

```json
{
  "name": "CozyLingo Open", "version": "0.1.0",
  "license": "CC BY 4.0",
  "attribution": "kylebing/english-vocabulary (BSD-3-Clause)",
  "count": 12594,
  "words": [ /* Word[] */ ]
}
```

### Word

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | URL 安全标识，同时是媒体文件名 |
| `word` | string | 词头 |
| `ipa_uk` / `ipa_us` | string | 英式 / 美式音标 |
| `senses` | `{pos, zh, en}[]` | 1–3 个义项：词性、中文释义、简明英文释义 |
| `ex` | `{en, zh}[]` | 0–2 条例句，英文 + 中译 |
| `remmethod` | string | 记忆法（词根词缀拆解式） |
| `topic` | string | 25 个话题之一；未标注的归「其他」 |
| `frequency` | number | 词频序号，越小越常用 |
| `tags` | string | 空格分隔的考试标签（zk gk cet4 cet6 ky toefl ielts gre） |
| `level_rank` | number | 学段分级序号 |
| `libs` | string[] | 所属词书：junior / senior / cet4 / cet6 / kaoyan / toefl / sat |
| `img` / `thumb` | string | 插画路径（512px / 256px） |

## `data/words.csv`

同内容的表格版，多值字段用 ` | ` 连接，UTF-8。

## `data/libraries.json`

每个词书包含的 `id` 列表。

## `data/orchard.json`

星图引擎用的紧凑格式（由 `scripts/build_orchard.py` 从 `words.json` 生成）：

```json
{
  "universe": "cozylingo-open",
  "topics": ["饮食", "家居", "..."],
  "words": [["abandon", 12, 3]],
  "stats": { "total": 12594, "topics": 25, "bandSource": {...}, "byBand": {...}, "byTopic": {...} }
}
```

- `words` 每行是 `[词, 话题下标, 海拔档 1–5]`，`话题下标` 指向 `topics` 数组
- 海拔档按**词频序号的分位数**分档（第 0–20% 为山脚，80–100% 为雪线），保证五档均衡、山形读得出来
- 约 1/3 的词条没有词频数据（7 个词书独有、不在主词频表里），其海拔按**所属词书难度**估计，
  数量记在 `stats.bandSource.estimatedFromBook`

## 媒体

`public/img/<id>.webp`（512px）、`public/thumb/<id>.webp`（256px）。
并非每个词都有插画，以 `img` 字段是否存在为准。

发音不在 git 里，见 README「发音音频」：

```
data/audio/us/<id>.mp3     美音
data/audio/uk/<id>.mp3     英音
```

## 授权

CC BY 4.0，署名 `CozyLingo Open contributors`；
词头/音标/释义/例句部分同时保留 `Copyright (c) 2022-2026 KyleBing`（BSD-3-Clause）。
见 [CONTENT_LICENSE.md](../CONTENT_LICENSE.md)。
