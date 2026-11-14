# Add, update, and transfer skills

[简体中文](maintenance.md) · [Back to the homepage](../README.en.md#maintain)

## Ask an AI to maintain the repository

Attach a skill folder, ZIP, `SKILL.md`, or the material to organize, then send:

```text
Maintain https://github.com/ZRainbow1275/skills .
Read AGENTS.md, place the supplied skill in the appropriate category, organize its files, and update the catalogs in both README.md and README.en.md.
Update the previews in both versions when actual output images are available. Commit the changes and return the skill path and commit link.
```

To update an existing skill, include its link and describe the changes.

## Category locations

| Category | Directory |
| --- | --- |
| Legal & Compliance | `skills/legal/` |
| Technology & Development | `skills/development/` |
| Business & Product Operations | `skills/operations/` |
| Company Investigations | `skills/investigation/` |
| Academic Research | `skills/research/` |
| Writing & Publishing | `skills/publishing/` |
| Design & Visuals | `skills/design/` |

Each skill has its own directory with a `SKILL.md` entry point. Use that file's `name` as the directory name, and keep any required `references/`, `scripts/`, and `assets/` with the skill.

## File transfer

Run the commands from the repository root with Python 3.9 or later. Put source files in `inbox/` first.

### Import

For example, to import a company investigation skill package:

```bash
python3 scripts/transfer.py import inbox/company-background-investigation.zip --category investigation --slug company-background-investigation
```

The source can also be a skill folder or a single `SKILL.md`. A ZIP may contain `SKILL.md` at its root or a single enclosing skill folder with all its files.

After importing, the AI updates both homepage versions using the [catalog and preview templates](../templates/catalog-row.md), checks the files, and commits the changes.

### Update

Add `--replace` to the import command to update an existing skill:

- Folder or ZIP: replace the entire skill.
- Single `SKILL.md`: update the entry file and retain existing attachments.

### Export

```bash
python3 scripts/transfer.py export skills/investigation/company-background-investigation
```

The output is `dist/company-background-investigation.zip`. Use `--output path.zip` to choose another location.

The ZIP contains one skill folder with its `SKILL.md` and attachments, ready to pass to another AI for import.

## Catalog and previews

- The root `README.md` and `README.en.md` form the single bilingual skill catalog. Keep categories, skill order, and links aligned.
- The catalog is under `#skills`. Until a skill is added, keep a single empty-state sentence. Once populated, use one row per skill with four columns: Category, Skill, What it does, and Output.
- Link each skill name to `skills/<category>/<slug>/SKILL.md`. Describe what it does in one sentence and list its main output.
- Previews sit separately under `#previews`, showing up to three actual outputs. Keep the placeholder text until images are available. Store them as `assets/previews/<slug>.webp` or `.png`, use the same images in both versions, translate the alt text, and link each image to its skill.
- A 16:9 landscape image works well; keep the original output's proportions when appropriate.
- The skill template is [SKILL.md.template](../templates/SKILL.md.template).
