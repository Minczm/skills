---
name: job-seeker-company-research
description: "求职公司深度背调：从求职者决策视角核验目标公司的签约主体、业务健康度、资金安全、真实岗位五维（技术/系统/交付/行业/工时）、薪酬福利、员工口碑、劳动争议与避坑红旗，输出带一手来源、交互关系网与可勾选面试反问/Offer 核实清单的离线 HTML 报告。Job-seeker company due diligence with verified evidence, red/green flags, role assessment, and interview checklist."
---

# 求职公司深度背调

站在求职者立场把一家公司查透，把“值不值得投、稳不稳、进去干什么、有什么坑、面试怎么反问”组织成可追溯、可离线带进面试间的完整决策档案。

## 运行约定

- 使用宿主提供的检索、网页读取、文件、代码执行和浏览器能力；模型选择、协作方式与权限遵从当前用户和宿主设置。
- 以本文件所在目录为 `<skill-dir>`，所有随附文件使用相对路径。首次运行先读 [runtime-adapters.md](references/runtime-adapters.md)，确认可用能力与交付路径。
- 按用户语言、目标岗位、城市和求职阶段（投递前 / 面试前 / Offer 决策）组织成稿。中文 HTML 为默认语言；更换语言时同步翻译模板界面与正文。
- 仅将当前任务提供或可实际检索/恢复的资料作为基线。随附示例数据均为虚构教学材料，严禁带入正式报告。

## 求职交付标准

- **5 分钟看懂去不去**：首页首屏给出公司综合判断、五维红绿灯评估卡（生存与资金、业务线前景、团队稳定、薪酬口碑、劳动合规）、以及**加分项 vs 避坑红旗**双栏对比。
- **穿透包装看实况**：严格区分“JD 要求 / HR 话术”与“线上真实运行系统 / 审计或登记事实 / 匿名员工体验”。不把 3 年前的旧差评当现状，也不把情绪化传闻当定论。
- **直接交付面试工具**：基于本次查出的信息缺口与风险点，输出可勾选、可打印的**面试反问 & Offer 核实清单**（区分问业务面试官、问 HR 谈薪、签合同前核对），每题写明触发事实与听回答时的正/负信号。
- **一等证据可溯源**：重要判断建立 `claims`，附原始来源、定位、发布/生效/统计/访问日期及本地留存哈希（`evidence_manifest`）。未知项与反爬/登录墙限制如实说明一次。
- **单文件离线可读**：默认交付自包含离线 HTML（含求职仪表盘、岗位五维卡、求职视角关系网、交互面试清单、案例图集、完整来源、全站搜索和打印样式），同时保留 `dossier.json` 供后续面试轮次或拿到 Offer 后增量更新。

## 先确定求职场景

- **未提供具体 JD（通用求职模式）**：以目标公司为主线，覆盖核心签约主体、主力业务线及最主流职能（如产研/产品/运营），先给公司级底盘与避坑判断。
- **提供了 JD / 部门 / Offer 条件（定向决策模式）**：将用户提供的 JD、HR 谈薪口径、签约主体、薪资/期权与竞业条款记为 `user` 来源，逐项与公开数据交叉核验，在 `job_context`、`role_assessment` 和 `interview_checklist` 中定点回应。
- **继续既有背调（如从“面试前”推进到“拿到 Offer”）**：以旧版 `dossier.json` 为基线，保留稳定 ID，补查新拿到的签约主体、谈薪细节和面试新线索，回填受影响的全部板块与面试核实清单。

## 工作流程

### 1. 建立根节点与求职上下文

识别目标品牌、上市/控股母公司、中国大陆或目标市场的核心运营主体，以及**实际招聘/签约/发薪主体**（重点排查是否存在外包、劳务派遣、异地社保代缴或空壳子公司）。记录 `job_context`（目标岗位、业务线、城市、求职阶段、已知签约主体与薪酬口径）。

先阅读 [job-research-playbook.md](references/job-research-playbook.md) 的数据源矩阵与三层取证策略；需要同名消歧、匿名评价反失真或劳动争议分级时阅读 [evidence-and-identity.md](references/evidence-and-identity.md)。

### 2. 沿求职视角开展八条调查线（融合 5 类求职专项数据源）

1. **签约主体、办公地与基础资质**：官网/招聘页落款、ICP/行业牌照、企业登记（信用代码、存续、注册资本、变更）、关联外包/壳主体核查。
2. **业务健康度与资金安全**：财报/融资/现金储备、收入构成、盈亏与现金流；判断目标业务线处于**增长扩张 / 现金牛维稳 / 收缩边缘**哪一阶段。
3. **实控人、管理层与业务带队人**：谁真正拍板、核心高管与业务一号位履历、稳定性及近期变动。
4. **岗位五维与真实工作内容**：读取 [role-and-engineering.md](references/role-and-engineering.md)，结合 `job_posting` 与 `tech_footprint`（官网 JD、GitHub、技术博客、应用更新日志、产品实况），拆解真实技术/方法、运行系统、团队既往交付、行业约束与工作条件。
5. **核心产品、业务前景与市场反馈**：产品更新频率、商店评分与差评、版本维护节奏、竞争格局与天花板。
6. **团队规模、扩张/裁员轨迹与薪酬福利**：历年员工人数、职能占比、社保参保趋势（年报）、`salary_data`（Offershow / 牛客开奖 / Levels.fyi / 招聘带宽）、年终与期权/RSU 归属规则、公积金比例。
7. **员工真实口碑与工作强度**：`employee_review`（脉脉 / 牛客 / 知乎 / 看准 / 小红书 / Glassdoor / Blind），强制按**部门、城市、年份与匿名属性**拆解加班、值班、绩效淘汰、试用期转正与裁员赔偿实况。
8. **劳动合规、司法争议与面试反问推导**：`labor_legal`（劳动争议、违法解除、欠薪、竞业限制、期权纠纷、被执行人/限高、人社违法公示）+ 重大负面舆情；将所有未解缺口与潜在隐患直接转化为可执行的 `interview_checklist`。

### 3. 三层取证与单一资料源

按 [job-research-playbook.md](references/job-research-playbook.md) 执行**公开直采 → 定向检索聚合（`site:` 语法）→ 求职者自带材料交叉核验**三层取证：
- 公开直采原件（财报、公告、RDAP、招聘官网、GitHub、商店接口、截图）保存本地并计算真实 SHA-256。
- 存在登录墙/反爬的平台（如脉脉、BOSS、企查查、裁判文书网）通过定向检索获取摘要时，在 `evidence_manifest` 如实标注 `excerpt` 或 `metadata_only`，绝不伪造原件哈希。
- 按 [data-model.md](references/data-model.md) 维护统一 `dossier.json`，填充 `job_context`、`decision_scorecard`、`flags`（`green`/`red`）、`role_assessment`、`interview_checklist`、`entities`、`relationships`、`claims`、`sources`、`assets` 等字段。

### 4. 构建离线求职报告与验收

```bash
python3 -X utf8 "<skill-dir>/scripts/validate_dossier.py" "<work-dir>/dossier.json" --json
python3 -X utf8 "<skill-dir>/scripts/build_report.py" "<work-dir>/dossier.json" --out "<work-dir>/job-research-report.html"
```

更新既有背调时追加 `--previous "<work-dir>/previous.json"`。验收标准见 [quality-and-updates.md](references/quality-and-updates.md)：
- 结构校验必须 **0 错误**，所有实体通过已证实关系连通根节点，所有 `stored` 证据 SHA-256 一致。
- 用可用浏览器打开成稿，重点核验：首屏求职决策卡与红/绿旗、岗位五维区、关系网核心视图（签约主体 ↔ 业务线 ↔ 老板）、面试清单筛选与勾选、手机宽度（390px）不溢出、打印/PDF 速查页完整。

### 5. 完成交付

交付离线 HTML、`dossier.json` 与证据目录。聊天回复先给出可点击打开的报告入口，再用 1 分钟读完的篇幅总结：**一句话去留建议倾向（附事实前提）、3 条核心加分项、3 条必须盯紧的避坑红旗、以及最建议在下一轮面试立刻反问的 3 个问题**；明确说明本次未覆盖的实际缺口。未经用户授权不联系目标公司或公开分享用户私密 Offer 材料。

## 按需参考

- [job-research-playbook.md](references/job-research-playbook.md)：求职 8 条调查线、5 类求职数据源、三层取证与社区口碑反失真。
- [role-and-engineering.md](references/role-and-engineering.md)：岗位五维调查（工程与非工程通用）、JD 穿透核验与工作链。
- [evidence-and-identity.md](references/evidence-and-identity.md)：来源分级、签约主体核验、劳动争议与匿名评价规范。
- [data-model.md](references/data-model.md)：求职扩展 JSON 数据契约与字段说明。
- [report-design.md](references/report-design.md)：求职 8 入口、8 问题、仪表盘、面试清单与关系网设计。
- [quality-and-updates.md](references/quality-and-updates.md)：校验清单、浏览器验收与增量更新。
- [runtime-adapters.md](references/runtime-adapters.md)：跨 agent 运行、命令模板与能力受限处理。
