<div align="center">

<a href="https://litchixx-ob.github.io/cozylingo-open/"><img src="docs/assets/banner.webp" alt="CozyLingo Open — 12,594 English word entries with mnemonics, illustrations, IPA and examples" width="100%"></a>

# CozyLingo Open

**12,594 English word entries · mnemonics · illustrations · UK/US IPA · examples · topic & frequency tags**

[**Browse online ↗**](https://litchixx-ob.github.io/cozylingo-open/)　/　[demo video](docs/assets/demo.mp4)　/　[download dataset](data/)　/　[中文](README.md)

[![Code: MIT](https://img.shields.io/badge/Code-MIT-17283B?style=flat-square)](LICENSE)
[![Dataset: CC BY 4.0](https://img.shields.io/badge/Dataset-CC_BY_4.0-AD5038?style=flat-square)](CONTENT_LICENSE.md)
[![entries](https://img.shields.io/badge/entries-12%2C594-5B8C5A?style=flat-square)](data/words.json)

</div>

---

**Version note**: this repository ships the dataset and a small reader page. The online site
([cozylingo.com](https://www.cozylingo.com)) evolves independently and may differ.
Code and content are licensed separately (MIT / CC BY 4.0).

## What it is

An **English vocabulary dataset** you can use directly. Every entry carries a **root/affix
mnemonic**, an **illustration**, UK/US IPA, English + Chinese example sentences, a topic label
and a frequency rank.

Entries are merged and de-duplicated from 7 word books (junior / senior / CET-4 / CET-6 /
postgraduate / TOEFL / SAT) — **12,594 words, 100% with mnemonics**.

## Scale

| Item | Count |
| :--- | ---: |
| Entries | **12,594** |
| Word books | 7 (merged & de-duplicated) |
| Senses | 1–3 per entry (POS + Chinese gloss + short English definition) |
| Examples | 0–2 per entry, English + Chinese |
| **Mnemonics** | **12,594 (100%)** — root/affix breakdown style |
| Illustrations | 12,594 × 512px + 12,594 × 256px thumbnails (WebP) |
| Topics | 25 categories |
| Frequency / exam tags | per entry |

## Preview

<img src="docs/assets/list-desktop.png" alt="Word browser: card grid, search, book and topic filters" width="100%">

<table>
<tr>
<td width="50%"><img src="docs/assets/list-mobile.png" alt="Mobile list view"></td>
<td width="50%"><img src="docs/assets/detail-mobile.png" alt="Mobile entry detail: senses, examples, mnemonic"></td>
</tr>
</table>

<details>
<summary><b>Watch the 53-second demo</b></summary>

<a href="docs/assets/demo.mp4"><img src="docs/assets/demo-preview.webp" alt="Play the demo video" width="100%"></a>

[Full video with sound](docs/assets/demo.mp4)

</details>

<img src="docs/assets/demo.gif" alt="Search, filter, open an entry" width="100%">

## Quick start

The repo ships a **zero-dependency** word browser (`index.html`) — no build step, no backend:

```bash
git clone --depth 1 https://github.com/litchixx-ob/cozylingo-open.git
cd cozylingo-open
python3 -m http.server 8000
# open http://localhost:8000
```

Or just take the data:

```python
import json
ws = json.load(open("data/words.json", encoding="utf-8"))["words"]
print(len(ws))                       # 12594

top = sorted((w for w in ws if w["topic"] == "科学与技术"), key=lambda w: w["frequency"])[:5]
for w in top:
    print(w["word"], "|", w["senses"][0]["zh"], "|", w["remmethod"])
```

Field reference: [docs/dataset.md](docs/dataset.md).

## License

| Scope | License |
| :--- | :--- |
| Page code | [MIT](LICENSE) |
| Dataset | [CC BY 4.0](CONTENT_LICENSE.md); headwords / IPA / definitions / examples come from [kylebing/english-vocabulary](https://github.com/kylebing/english-vocabulary) (BSD-3-Clause, full text included) |

**Not included**: exam papers, textbook passages, or commercial dictionary audio recordings.

## Contributing

The most valuable contribution is **fixing content errors** (the dataset has not been
proofread entry by entry). See [CONTRIBUTING.md](CONTRIBUTING.md).

---

If this dataset is useful to you, a star is appreciated.
