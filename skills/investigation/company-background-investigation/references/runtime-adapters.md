# 跨 agent 运行

目录：安装与调用；能力映射；路径与运行；交付模式；资料隔离；协作。

## 安装与调用

解压后保留完整 `company-background-investigation/` 文件夹，其中 `SKILL.md` 是入口，`references/` 是调查规范，`scripts/` 和 `assets/` 是资料检查与 HTML 构建资源。仅复制入口文件会丢失参考资料和模板。

先查看效果可直接用浏览器打开 `assets/example-report.html`，其全部资料为虚构样例。正式调查按独立公司资料生成新文件。

### 原生支持 Agent Skills 的环境

支持 ZIP 导入的产品，在技能管理界面上传本包并启用。Claude 的官方上传格式采用单个顶层技能目录；本包按此组织。

本地安装选择下列一种作用域，将整个技能文件夹复制到对应目录：

| 宿主 | 当前用户可用 | 当前项目可用 | 直接调用 |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/skills/company-background-investigation/` | `<项目>/.claude/skills/company-background-investigation/` | `/company-background-investigation 调查目标公司` |
| Codex CLI / IDE | `~/.agents/skills/company-background-investigation/` | `<项目>/.agents/skills/company-background-investigation/` | `$company-background-investigation 调查目标公司` |

`~` 表示当前用户的主目录；个人与项目目录二选一即可。安装后在宿主的技能列表中确认名称，再发起调查。其他 Agent Skills 客户端按其文档选择安装目录。

### 使用通用文件读取能力

把解压目录放进 agent 可读取的工作区，发送：

```text
请先读取 company-background-investigation/SKILL.md，按其工作流程调查：
公司或品牌：［填写名称］
官网或法域：［填写已知线索］
调查目的：［入职 / 合作 / 投资研究 / 其他］
重点：［股东、核心人物、资本链、实际案例等］

以该公司为中心逐层延伸人物、关联企业、产品和运营关系。
按需要读取技能目录中的参考文件、模板和脚本，完成公开检索、
证据归档、神经网络图和自包含 HTML；同时保存结构化调查数据。
```

继续旧报告时，附上实际报告与可用的原数据，再补充：

```text
以附件作为基线，保留已认可的目录、核心问题、完整档案与交互。
把新增证据和更正回填到所有受影响的位置，并保留资料来源与历史。
```

只有对话输入、没有文件读取能力时，将 `SKILL.md` 及任务所需参考内容粘贴为上下文。具体完成范围按第三节的能力模式执行。

### 安装说明的官方依据

安装路径及格式核对日期：2026-11-04。

- [Agent Skills 规范](https://agentskills.io/specification)：目录、frontmatter 与相对资源路径。
- [Claude Code Skills](https://code.claude.com/docs/en/skills)：个人与项目目录、直接调用、跨端字段。
- [Codex Skills](https://learn.chatgpt.com/docs/build-skills)：本地技能目录与调用。
- [Claude 技能打包说明](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)：ZIP 顶层目录结构。

## 一、按能力映射工具

本技能使用标准 `SKILL.md` 入口和相对资源目录。宿主读取入口后，按任务需要再读 references；脚本和模板在需要构建时使用。

| 工作 | 所需能力 | 执行方式 |
| --- | --- | --- |
| 查询当前事实 | 互联网检索、网页读取 | 用可用搜索引擎发现来源，再打开原始页面或附件；记录原始 URL 与访问日期 |
| 读取用户资料与历史成稿 | 本地文件或用户授权的文档服务 | 先取得实际内容，再建立版本基线 |
| 读取登记附件和截图 | PDF/表格读取、浏览器或受支持截图 | 记录页码、行号、产品 ID、界面与日期 |
| 维护结构化证据 | UTF-8 JSON 文件读写 | 按 data-model.md 创建独立 dossier.json |
| 构建离线报告 | Python 3.10+、本地文件读写 | 执行随附标准库脚本，无需安装第三方 Python 或 JavaScript 包 |
| 查看交互 | 现代浏览器或宿主 HTML 预览 | 打开产物，检查搜索、图谱、档案、图片、移动布局与打印 |
| 保存交付 | 本地输出或宿主附件服务 | 保存 HTML 与 JSON，给出可访问路径或附件 |

宿主的 API、插件名、引用语法和模型型号由实际环境决定。不要将另一环境的工具调用复制为当前工具调用。正文来源使用原始网页链接；聊天采用宿主支持的引用或标准 Markdown 链接。

## 二、定位文件和执行命令

从已加载 `SKILL.md` 所在目录解析 `scripts/`、`references/`、`assets/`。不要把当前工作目录当作技能目录，也不要在技能包里保存被调查公司的实际证据。

先建立独立的输出目录，在该目录保存 `dossier.json`、取回的图片、原始附件和研究日志。原始/派生证据通过 evidence_manifest 连接，实际文件保存后计算哈希。图片与证据相对路径以数据 JSON 所在目录为基准；其他机器继续工作时同时带上相应图片与附件。

通用命令模板（替换尖括号占位符为真实路径，保留引号）：

```bash
python3 -X utf8 "<skill-dir>/scripts/validate_dossier.py" "<work-dir>/dossier.json" --json
python3 -X utf8 "<skill-dir>/scripts/build_report.py" "<work-dir>/dossier.json" --out "<work-dir>/company-report.html"
```

更新报告：

```bash
python3 -X utf8 "<skill-dir>/scripts/validate_dossier.py" "<work-dir>/dossier.json" --previous "<work-dir>/previous.json" --json
```

试运行随附虚构数据：

```bash
python3 -X utf8 "<skill-dir>/scripts/build_report.py" "<skill-dir>/assets/example-data.json" --out "<work-dir>/example-report.html"
```

Windows 可把命令前缀 `python3 -X utf8` 改为已安装 Python 的 `py -3 -X utf8` 或 `python -X utf8`；其余参数保持不变。输入、输出和图片路径包含空格时始终使用引号。报告构建离线执行；网上调查阶段使用宿主提供的联网工具。

阅读 HTML 使用支持 ES2021 和 `<dialog>` 的现代浏览器，并启用 JavaScript。模板使用系统字体，界面语言为中文时使用具备中文字形的字体。Node.js 仅用于可选的 JavaScript 语法检查。

## 三、根据实际能力完成任务

**有完整工具**：完成调查、证据建模、HTML 构建和交互检查，交付可下载文件及关键发现。

**能读资料但当前无法联网**：处理用户提供的原始资料，保留各来源的日期，将需要刷新或缺少公开材料的具体问题记在研究日志。在交付说明中一次写明资料覆盖截止日；后续恢复检索时沿原数据增量更新。

**有文件与联网、没有 Python**：先完成证据和 JSON。若宿主有其他代码运行能力，按相同数据契约与随附模板构建并检查 HTML。脚本尚未运行的部分在交付状态中写清实际进度。

**只有对话能力**：按相同方法分析已提供的材料，输出可保存的结构化内容；对无法执行的检索、文件生成或交互检查记录具体状态。不要把未运行操作描述成已完成。

**没有浏览器**：仍可构建文件并执行结构和脚本检查。交付状态记录尚未完成的浏览器检查项目；后续补做时复用现有成稿。

权限、登录、发布和联系第三方遵守当前用户授权及宿主约束。工具能力缺失时完成当前可执行部分，保持证据和交付状态真实。

## 四、每个调查独立建档

- 示例中的实体、网址、图片、金额与角色只承担教学用途；正式资料从当前任务的原始来源建立。
- 案例中的历史更正不构成其他用户或公司的历史；只有实际取得旧报告时才执行增量保留。
- 当前任务的原始材料、私人附件、账号标识和下载凭据留在该任务工作目录，避免混入可分享的技能包。
- 共享新报告时按用户要求处理非公开材料；公共事实仍保留来源与日期。

## 五、协作与模型选择

宿主允许多 agent 协作时，以独立调查线分工，共享主体 ID 与事实格式。子任务返回证据和具体发现，由主 agent 合并、消歧并维护全局结论。模型、推理等级、预算、并发数使用当前用户配置；单 agent 顺序完成同一流程。
