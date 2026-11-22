# 求职背调统一资料模型（向下兼容 schema_version: 1）

目录：顶层结构；求职专属扩展字段；基础主体/关系/来源/主张契约；证据留存；图表与表格。

## 一、顶层对象

沿用 `schema_version: 1` 单一 UTF-8 JSON 契约，完全兼容原版基础字段，同时新增五个面向求职决策的一等公民扩展字段：`job_context`、`decision_scorecard`、`flags`、`role_assessment`、`interview_checklist`。

```json
{
  "schema_version": 1,
  "meta": {
    "title": "目标公司｜求职深度背调报告",
    "subtitle": "业务稳健度、签约主体、岗位五维、薪酬口碑与面试反问清单",
    "root_id": "co-root",
    "as_of": "2026-11-22",
    "snapshot_at": "2026-11-22",
    "summary": "给求职者的 5 分钟核心结论",
    "core_ids": ["co-root"],
    "language": "zh-CN"
  },
  "job_context": {},
  "decision_scorecard": [],
  "flags": { "green": [], "red": [] },
  "role_assessment": {},
  "interview_checklist": [],
  "metrics": [],
  "entities": [],
  "relationships": [],
  "sources": [],
  "assets": [],
  "claims": [],
  "evidence_manifest": [],
  "findings": [],
  "sections": [],
  "questions": [],
  "archives": [],
  "timeline": []
}
```

### 保留导航锚点

`meta.navigation` 的 `target` 可指向以下保留模板锚点或任意 `sections[].id`：
- `overview`（首页总览：求职背景、核心判断、红绿灯评估卡、加分与避坑双栏）
- `network`（求职视角关系神经网络）
- `role-assessment`（岗位五维深度拆解）
- `checklist`（面试反问 & Offer 核实交互清单）
- `questions`（求职 8 个核心问答）
- `archives`（完整资料档案）
- `timeline`（公司与组织发展时间线）
- `sources`（全部资料来源与证据存档）

推荐默认 8 个求职阅读入口：`overview` → 业务与资金安全章节 → `network` → `role-assessment` → 产品与业务前景章节 → 薪酬口碑与风险章节 → `checklist` → `archives`（或 `questions`）。

## 二、求职专属扩展字段

### 1. `job_context`（求职上下文）

对象，可选。记录本次求职场景，渲染在首页顶部胶囊区：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `target_role` | string | 目标岗位或职能（未指定时可写“通用产研 / 运营求职视角”） |
| `business_unit` | string | 目标部门或业务线（可选） |
| `location` | string | 目标工作城市（可选） |
| `stage` | string | 求职阶段，如 `投递前评估`、`面试前准备`、`Offer 决策` |
| `employer_entity` | string | 已知或常见劳动合同签约主体（可选） |
| `compensation_note` | string | 已知薪资带宽或 Offer 报价口径（可选） |
| `jd_summary` | string | JD 核心职责与要求摘要（可选） |
| `entity_ids` | string[] | 关联主体 ID（如签约主体、目标产品） |
| `sources` | string[] | 出处来源 ID |

### 2. `decision_scorecard[]`（求职多维红绿灯评估卡）

数组，建议 4–6 项（推荐 5 项：公司生存与资金安全、目标业务线前景、团队与组织稳定性、薪酬口碑与工作强度、劳动与合规风险）：

| 字段 | 必填 | 约定 |
| --- | --- | --- |
| `id` | 是 | 稳定 ID，如 `SC01` |
| `dimension` | 是 | 评估维度名称 |
| `rating` | 是 | 枚举：`positive`（稳健/加分）、`caution`（需关注）、`warning`（高风险）、`unknown`（信息不足） |
| `verdict` | 是 | 短结论词（6–16 字，如“连续盈利、现金充裕”“游戏周期波动、广告强劲”） |
| `summary` | 是 | 一两句话事实依据，必须对应真实数据或口径 |
| `sources` | 是 | 至少 1 条来源 ID |
| `claim_ids` | 否 | 关联主张 ID 数组，前端渲染“核查依据”按钮 |
| `entity_ids` | 否 | 关联主体 ID 数组 |

### 3. `flags`（加分项 & 避坑红旗）

对象 `{ "green": [...], "red": [...] }`：
- 每条记录包含：`id`（必填，全局或栏内唯一，如 `GF01` / `RF01`）、`title`（必填）、`text`（必填）、`sources`（必填，至少 1 条）、可选 `date`、`category`（如 `薪酬福利` / `签约主体` / `劳动合规` / `业务增长` / `工作强度`）、`entity_ids[]`、`claim_ids[]`。

### 4. `role_assessment`（岗位五维深度拆解）

对象，可选但求职报告强烈建议填写：

```json
{
  "target_role": "后端/平台研发工程师（或通用产研视角）",
  "team": "主站/商业化技术体系",
  "location": "上海（杨浦区国正中心）",
  "summary": "一句话概括进去后真实做什么、依赖什么、成长与压力在哪。",
  "dimensions": [
    {
      "id": "actual_technology",
      "title": "实际技术与方法",
      "answer": "结合线上产品、开源仓库与招聘要求说明真实技术栈与方法。",
      "jd_signal": "招聘/JD 常见要求（可选）",
      "reality_signal": "开源仓库/技术博客/线上运行核验（可选）",
      "sources": ["S001"],
      "claim_ids": ["C001"]
    }
  ]
}
```

五个推荐维度 ID：`actual_technology`、`operating_systems`、`prior_experience`、`domain_knowledge`、`working_conditions`。

### 5. `interview_checklist[]`（面试反问 & Offer 核实交互清单）

数组，直接生成可勾选、可筛选、可打印的面试速查表：

| 字段 | 必填 | 约定 |
| --- | --- | --- |
| `id` | 是 | 稳定 ID，如 `IC01` |
| `target` | 是 | 枚举：`interviewer`（业务面试官）、`hr`（HR 与谈薪）、`contract`（签约前核对）、`general`（通用核实） |
| `priority` | 否 | 枚举：`P0`（必问）、`P1`（建议问）、`P2`（补充） |
| `question` | 是 | 可直接照着问的具体问题话术 |
| `trigger_fact` | 是 | 触发这条问题的背调事实或信息缺口（杜绝无由头的泛泛套话） |
| `good_signal` | 否 | 听到什么样的回答属于正面信号 |
| `risk_signal` | 否 | 听到什么样的回避或话术属于风险信号 |
| `sources` | 是 | 至少 1 条来源 ID |
| `entity_ids` | 否 | 关联主体 ID |
| `claim_ids` | 否 | 关联主张 ID |

## 三、基础字段契约与新增来源类型

### `sources[].kind`（已扩展 5 类求职源）

合法取值（共 15 种）：
- 原有 10 种：`official`, `registry`, `first_party`, `store`, `court`, `media`, `forum`, `user`, `archive`, `analysis`
- 新增 5 种求职专项源：
  - `job_posting`（招聘官网 / BOSS / 猎聘 / LinkedIn 在招 JD）
  - `salary_data`（Offershow / 牛客开奖 / Levels.fyi / 薪资爆料）
  - `employee_review`（脉脉 / 牛客面经 / 知乎 / 看准 / 小红书 / Glassdoor / Blind 员工体验）
  - `labor_legal`（劳动争议裁判 / 社保参保年报 / 人社局欠薪与违法公示）
  - `tech_footprint`（GitHub 开源仓库 / 技术博客 / 架构分享 / 状态页）

### `entities[]`、`relationships[]`、`claims[]`、`evidence_manifest[]`、`assets[]`、`metrics[]`、`sections[]`、`questions[]`、`archives[]`、`timeline[]`

完全保持与原版一致的字段要求与校验规则：
- 所有主体须有稳定 `id, name, type, summary, sources`，并通过带来源的确认关系连通 `meta.root_id`。
- 所有 `stored` 证据须从磁盘真实字节计算 64 位 SHA-256 与正整数 `bytes`；反爬/登录墙未取到原件的记录须用 `status: "metadata_only"` 或 `unavailable` 并在 `access_note` 如实说明，禁止填写 `path/sha256/bytes`。
- 表格每行含 `sources` 或 `claim_ids` 时，`headers` 末尾包含“来源”列以保持列数一致。
