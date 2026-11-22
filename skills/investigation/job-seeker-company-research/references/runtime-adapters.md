# 跨 agent 运行与能力映射

## 一、目录隔离与命令模板

从已加载 `SKILL.md` 所在目录解析 `references/`、`scripts/` 与 `assets/`。不要将某家被调查公司的证据或报告写入技能目录，应为每次求职背调建立独立工作目录（保存 `dossier.json`、`evidence/`、`images/` 与最终离线 HTML）。

```bash
python3 -X utf8 "<skill-dir>/scripts/validate_dossier.py" "<work-dir>/dossier.json" --json
python3 -X utf8 "<skill-dir>/scripts/build_report.py" "<work-dir>/dossier.json" --out "<work-dir>/job-research-report.html"
```

Windows 环境使用 `python -X utf8` 或 `py -3 -X utf8`，路径含空格时保留双引号。构建与结构校验全部基于 Python 3.10+ 标准库，离线执行，无需第三方依赖。

试运行随附虚构求职样例：

```bash
python3 -X utf8 "<skill-dir>/scripts/build_report.py" "<skill-dir>/assets/example-data.json" --out "<work-dir>/example-job-report.html"
```

## 二、能力受限时的降级原则

- **完整工具（联网 + 文件 + Python + 浏览器）**：执行三层取证、校验构建、浏览器实测并交付完整离线 HTML 与 JSON。
- **部分网站存在登录墙/反爬**：切至搜索引擎定向检索摘要并在 `evidence_manifest` 标为 `metadata_only` / `excerpt`，同时引导用户补充自带 JD、Offer 或截图以进一步交叉核验。
- **无法联网**：基于用户提供的 JD、Offer、年报 PDF 或截图建档，明确标注资料覆盖截止日与未联网状态。
- **无浏览器环境**：完成结构与静态检查，在交付说明中明确列出未执行的动态交互验收项。
