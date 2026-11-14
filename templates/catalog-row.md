# 目录与预览模板 / Catalog and preview templates

在 `README.md` 和 `README.en.md` 的 `#skills` 区域同步添加技能，同类条目相邻。首次收录时，用表头和首行替换待收录说明。

Add the skill under `#skills` in both `README.md` and `README.en.md`, keeping related entries together. For the first skill, replace the empty-state sentence with the table header and first row.

## 中文目录行

```markdown
| 分类 | Skill | 解决的问题 | 产出 |
| --- | --- | --- | --- |
| [分类名称](skills/<category>/) | [技能名称](skills/<category>/<slug>/SKILL.md) | 动词开头的一句话说明 | 主要文件或结果 |
```

## English catalog row

```markdown
| Category | Skill | What it does | Output |
| --- | --- | --- | --- |
| [Category name](skills/<category>/) | [Skill name](skills/<category>/<slug>/SKILL.md) | One sentence starting with a verb | Main file or result |
```

## 独立预览 / Separate previews

有真实成品图后，在两版首页的 `#previews` 区域同步添加，最多展示三项。共用图片路径，分别填写中文和英文 alt；图片也可使用 `.png`。

When an actual output image is available, add it under `#previews` in both homepage versions, showing up to three outputs. Use the same image path with translated alt text; `.png` is also supported.

中文：

```markdown
### [技能名称](skills/<category>/<slug>/SKILL.md)

一句话说明这张图展示的成果。

[![技能名称：成品预览](assets/previews/<slug>.webp)](skills/<category>/<slug>/SKILL.md)
```

English:

```markdown
### [Skill name](skills/<category>/<slug>/SKILL.md)

One sentence describing the result shown in the image.

[![Skill name: output preview](assets/previews/<slug>.webp)](skills/<category>/<slug>/SKILL.md)
```
