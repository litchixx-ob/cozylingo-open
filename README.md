<div align="center">

# CozyLingo Open · 蔻兹灵果开源词库

**12,594 个英语词条 · 记忆法 · 插画 · 音标 · 例句 · 话题与词频标注**

[词库下载](data/) / [English](README.en.md)

[![Code: MIT](https://img.shields.io/badge/Code-MIT-17283B?style=flat-square)](LICENSE)
[![Dataset: CC BY 4.0](https://img.shields.io/badge/Dataset-CC_BY_4.0-AD5038?style=flat-square)](CONTENT_LICENSE.md)

</div>

---

CozyLingo Open 是从 [CozyLingo（蔻兹灵果）](https://www.cozylingo.com) 抽出的
**开源词库数据集**。在线网站独立迭代，功能与本仓库可能不同；代码与内容分别遵循
MIT / CC BY 4.0 授权。

> **版本说明**：本仓库提供词库数据与配套的读取脚本。在线网站独立迭代，功能与仓库可能不同。

## 数据规模

| 项 | 数量 |
|---|---|
| 词条 | **12,594**（来自初中 / 高中 / 四级 / 六级 / 考研 / 托福 / SAT 七个词书） |
| 义项 | 每条 1–3 个，含词性、中文释义、简明英文释义 |
| 例句 | 每条 0–2 条，英文 + 中文对照 |
| 记忆法 | **12,594 条（100%）**，词根词缀拆解式 |
| 插画 | 512px 主图 + 256px 缩略图 |
| 话题 / 词频 / 考试标签 | 每条附带 |

## 字段说明

见 [docs/dataset.md](docs/dataset.md)。

## 本地使用

```bash
git clone --depth 1 <repo>
cd <repo>
python3 -c "
import json
ws = json.load(open('data/words.json', encoding='utf-8'))['words']
print(len(ws), ws[0])
"
```

## 授权

| 范围 | 许可 |
| :--- | :--- |
| 应用代码 | [MIT](LICENSE) |
| 词库内容 | [CC BY 4.0](CONTENT_LICENSE.md)（含 BSD-3-Clause 来源的署名） |

---

如果这个数据集对你有用，欢迎 Star。
