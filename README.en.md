<div align="center">

# CozyLingo Open

**12,594 English word entries · mnemonics · illustrations · IPA · examples · topic & frequency tags**

[Download the dataset](data/) / [中文](README.md)

[![Code: MIT](https://img.shields.io/badge/Code-MIT-17283B?style=flat-square)](LICENSE)
[![Dataset: CC BY 4.0](https://img.shields.io/badge/Dataset-CC_BY_4.0-AD5038?style=flat-square)](CONTENT_LICENSE.md)

</div>

---

CozyLingo Open is the **open dataset** extracted from
[CozyLingo](https://www.cozylingo.com), a free English practice site.
The online site evolves independently; features here may differ.
Code and content are licensed separately (MIT / CC BY 4.0).

## What's inside

| Item | Count |
| --- | --- |
| Entries | **12,594** (from 7 word books: junior / senior / CET-4 / CET-6 / postgraduate / TOEFL / SAT) |
| Senses | 1–3 per entry: part of speech, Chinese gloss, short English definition |
| Examples | 0–2 per entry, English + Chinese |
| Mnemonics | **12,594 (100%)** — root/affix breakdown style |
| Illustrations | 512px + 256px WebP |
| Topic / frequency / exam tags | per entry |

## Preview without cloning

Open `index.html` in a browser (or the GitHub Pages build) to browse the dataset.

## Use it

```bash
git clone --depth 1 <repo>
cd <repo>
python3 -c "
import json
ws = json.load(open('data/words.json', encoding='utf-8'))['words']
print(len(ws), ws[0])
"
```

Field reference: [docs/dataset.md](docs/dataset.md).

## License

| Scope | License |
| :--- | :--- |
| Code | [MIT](LICENSE) |
| Dataset | [CC BY 4.0](CONTENT_LICENSE.md), including BSD-3-Clause attribution for the source word list |

---

If this dataset is useful to you, a star is appreciated.
