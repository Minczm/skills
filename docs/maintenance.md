# 添加、更新与传输

## 交给 AI

附上技能文件夹、ZIP、`SKILL.md` 或本次整理的内容，再发送：

```text
维护 https://github.com/ZRainbow1275/skills 。
先读 AGENTS.md，将这次提供的 Skill 归入合适分类，整理文件并更新 README 目录。
预览图先留空。完成后提交到仓库，返回技能路径和提交链接。
```

更新已有技能时，附上对应技能的链接和需要调整的内容。

## 分类位置

| 分类 | 目录 |
| --- | --- |
| 法律与合规 | `skills/legal/` |
| 技术与开发 | `skills/development/` |
| 公司与产品运营 | `skills/operations/` |
| 公司调查 | `skills/investigation/` |
| 学术研究 | `skills/research/` |
| 写作与发布 | `skills/publishing/` |
| 设计与视觉 | `skills/design/` |

每项技能使用一个独立目录，入口为 `SKILL.md`。目录名取该文件的 `name`；需要的 `references/`、`scripts/`、`assets/` 随技能保存。

## 文件传输

在仓库根目录运行，需要 Python 3.9 或更新版本。原始文件先放到 `inbox/`。

### 导入

下面以待上传的公司调查技能包为例：

```bash
python3 scripts/transfer.py import inbox/company-background-investigation.zip --category investigation --slug company-background-investigation
```

来源也可以是一个技能文件夹，或单个 `SKILL.md`。ZIP 内可以直接放 `SKILL.md`，也可以用一个技能文件夹包裹完整内容。

导入完成后，AI 按[目录行模板](../templates/catalog-row.md)更新根 README，核对文件后提交。

### 更新

同名更新时，在导入命令末尾加 `--replace`：

- 文件夹或 ZIP：替换整项技能。
- 单个 `SKILL.md`：更新入口文件，保留已有附件。

### 导出

```bash
python3 scripts/transfer.py export skills/investigation/company-background-investigation
```

输出为 `dist/company-background-investigation.zip`。指定其他位置可加 `--output 路径.zip`。

导出包包含一个技能目录，以及其中的 `SKILL.md` 和附件，可直接交给其他 AI 导入。

## 首页与预览

- 根 README 的每一行对应一项技能；首项技能替换所在分类的“待收录”行。
- 技能名链接到 `skills/<category>/<slug>/SKILL.md`，问题说明用一句话，产出列只写主要结果。
- 预览栏留空；有成品图后使用 `assets/previews/<slug>.webp` 或 `.png`，点击图片进入技能。
- 技能模板位于 [SKILL.md.template](../templates/SKILL.md.template)。
