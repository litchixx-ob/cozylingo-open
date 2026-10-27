# 参与贡献 / Contributing

谢谢你愿意让 CozyLingo Open 变得更好。

## 最有价值的贡献：纠错

词库来自外部开源词表 + 自动生成，**未经逐条人工审校**，释义、音标、例句、记忆法都可能有错。
请在 Issue 中写明：

1. 词条 `id`（就是单词本身，如 `abandon`）
2. 问题是什么（现状）
3. 建议改成什么
4. 依据（权威词典链接、教材页码等）

## 提交数据修正

1. 修改 `data/words.json` 中对应词条；如该词有 CSV 版本，`data/words.csv` 同步改。
2. 重新生成校验和：
   ```bash
   python3 scripts/build_manifest.py
   ```
3. 本地跑校验（必须通过）：
   ```bash
   python3 scripts/check_dataset.py
   ```
4. PR 里说明修改理由，必要时附权威词典链接。

## 提交代码

- 保持「**无账号、本地优先、无追踪**」的方向 —— 不要引入登录、埋点或云端同步。
- 界面改动请同时检查 375px 手机宽度与桌面宽度。
- 提交前跑一遍 `python3 scripts/check_dataset.py`。

## 新增内容

新增词表、插画或标注时，**必须写明来源与授权**，只接受可以按 CC BY 4.0 再分发的内容。
不接受从商业 App / 商业词典抓取的数据。

## 安全

不要在 Issue、PR、截图或日志中粘贴任何 API key 或数据库连接串。
