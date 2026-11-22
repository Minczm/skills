# 求职背调验收与增量更新

## 一、结构与安全校验

执行随附脚本完成完整校验与构建：

```bash
python3 -X utf8 "<skill-dir>/scripts/validate_dossier.py" "<work-dir>/dossier.json" --json
python3 -X utf8 "<skill-dir>/scripts/build_report.py" "<work-dir>/dossier.json" --out "<work-dir>/job-research-report.html"
```

更新既有背调（例如从“投递前”推进到“拿到 Offer 决策”）时执行增量对比：

```bash
python3 -X utf8 "<skill-dir>/scripts/validate_dossier.py" "<work-dir>/dossier.json" --previous "<work-dir>/previous.json" --json
```

硬性验收门禁：
- `errors` 必须为 0；`unreachable_ids` 必须为空（所有主体经已证实关系连通根节点）。
- 所有 `stored` 证据文件的 `sha256` 与 `bytes` 与磁盘真实字节完全一致；受限平台如实标记 `metadata_only` 或 `unavailable`。
- `decision_scorecard`、`flags.green` / `flags.red`、`role_assessment.dimensions` 和 `interview_checklist` 均绑定有效 `sources`，且 `interview_checklist` 覆盖业务面、HR 面与签约前核对。

## 二、求职内容专项复核

1. **签约主体核对**：报告是否明确指出常见劳动合同签约主体、它与核心运营/上市主体的关系，以及是否存在外包/空壳隐患？
2. **业务与资金口径**：是否区分公司整体盈亏与目标业务线周期？金额是否带币种、单位、期间与审计属性？
3. **口碑反失真**：社区评价与薪资爆料是否标注了年份、部门/城市和匿名属性？是否与财报人数/费用及在招岗位交叉印证？
4. **面试清单可用性**：每条反问是否都能对应到本次背调的真实触发事实，并给出可操作的正面/风险听辨信号，而非空洞套话？
5. **诚实标注缺口**：未披露的财报季度、登录墙受限平台、未公开判赔或参保原件是否在对应位置清楚说明一次？

## 三、浏览器与移动端交互验收

实际打开生成的离线 HTML，重点核查：
1. 首页首屏：求职背景胶囊、核心判断、五维红绿灯评估卡、加分项与避坑红旗双栏均清晰可读。
2. 岗位五维区：五个维度及 JD vs 实况对照正常渲染，来源与“核查依据”弹层可打开。
3. 关系神经网络：默认核心视图聚焦签约主体、核心业务与关键人物；切换全部/周边视图、点击节点与连线、查看路径均正常。
4. 面试反问清单：角色筛选（全部 / 业务面试官 / HR 与谈薪 / 签约前核对）正常过滤，勾选进度正常更新并支持重置。
5. 移动端（390px 宽度）：无横向溢出，目录抽屉、搜索弹窗和评估卡排版紧凑可读。
6. 打印 / 导出 PDF：隐藏无关按钮，展开核心档案与带勾选框（`☐`）的面试速查页。
