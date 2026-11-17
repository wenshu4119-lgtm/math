# 结构化人工阅卷：实现前模型与回归审查

核查日期：2026-11-13。只读依据：旧 `cloudflare-deploy/app.js` 的 `paperNewRow`（800）、`paperChanged`（813）、`paperPoints`（817）、`paperReady`（821）、`paperImport`（963）、`paperToReport`（1094）、`calcReport`（1180附近）；新平台 `migrations/0001_initial.sql`、`src/uploads.mjs`、`src/learning.mjs`、`src/security.mjs` 和 `docs/MATH-MIGRATION.md`。旧源码固定HEAD为 `e56614db680fa83ac68210bec69f8d164e7c8fd0`。本文件是给本轮实现的审查建议，**不是宣称这些新API已实现或测试通过**；最终实现与测试结果以主任务文档为准。

## 1. 旧实现应继承与修正的精确语义

1. `paperPoints(row)`：有已知满分及 `actual` 时优先采用人工实得分；否则将0–3档位按 `score/3 * maxScore` 换算。满分缺失则用3作为等权分母。新平台保留直接部分分，不能将后三类换算悄悄当成真实卷面分。
2. `paperReady`：校验题号、科目、范围、难度与得分；旧代码强制必须匹配具体知识点，这会推动章名落为首个知识点。新平台应允许章节/未映射状态，报告如实提示，不能用错误精确映射换取“可提交”。
3. `paperChanged` 每次编辑取消人工复核；新平台必须由服务端revision和审核状态实现，不能只取消浏览器checkbox。
4. `paperImport` 对原表采用全量先校验再替换；输入1–120小题、重复题号、题号格式和满分非法即拒绝；不能部分成功造成老师旧记录被破坏。它主动丢弃AI答案、分数和对错，可继续保留这个原则。
5. `paperToReport` 在所有满分已知时累加原始分，否则全卷变为3分等权指标。新平台建议拆分卷面实得分与观察量表，而不是让一条未知满分改变整卷统计口径。
6. 新原型的 `judgeRatio` 将2档映为0.72，与旧2/3不同，不能继承为成绩。其 `_isMock:false` 在模拟OCR后也可能出现，因此不是可信来源证明。

## 2. 最小可运行数据模型

独立于 `attempts/answers` 建立卷面阅卷记录。在线选择题保持原有source及不可变快照，不把人工阅卷伪造成一次选择题作答。

建议整卷字段：

| 字段 | 规则 |
|---|---|
| `id, org_id, student_id` | 服务器生成ID；机构和学生来自已授权关系 |
| `title, subject` | 有界文本；第一阶段math/english，不照搬旧物理化学为已支持 |
| `upload_id`（可选） | 仅本人/关联学生有效图片；图片删除/过期不能删除已确认的人工评分证据；建议外键SET NULL并保留来源说明 |
| `status` | draft → confirmed；本轮确认后只读，修改另开新记录，避免静默重写成长 |
| `revision` | 所有编辑和确认递增，客户端须提交expected revision |
| `created_by, confirmed_by, created_at, confirmed_at` | 全部来自服务端会话和时钟 |
| `algorithm_version` | 如paper-report-v1；报告计算口径可以追溯 |
| `source` | 结构/录入来源独立保留，不能由前端声明 `student_self` 或 `verified=true` |

每条记录建议包含：

- 稳定条目ID、序号、题号，如 `21(1)`、可选parentNo。题号经过NFKC和去首尾空白后做唯一判断，避免 `21（1）` 与 `21(1)` 重复。
- 题干/证据摘录、题型、难度、原始范围scopeText（均有界字符串，前端纯文本渲染）。难度尚不确定时允许unknown并在报告显示，不参与难度细分。
- mappingLevel=`knowledge|chapter|unresolved`、可空knowledgeId；只有明确人工选择有效同科目知识点才计入该知识点统计。章名和未映射条目保留原文本，不强行定位。
- `evidenceType` 至少区分 `paper_score`（已知满分+实际得分）与 `ability_observation`（0–3人工观察）；生成式/识别结果作为 `ai_inference` 或 `ai_structure` 单独来源，不能进成绩。
- `contentOrigin` 与 `gradingOrigin` 分开：从AI提取的题干经教师核对后，题干来源仍然是AI结构，最终给分来源才是teacher_manual；不要用一个布尔reviewed抹掉来源链。
- 真实 `maxScore`、`earnedScore`；观察 `observationLevel`。两类字段互斥，null不能自动变0，不允许通过 `Number(null)` 产生假零分。

金额式整数存储适合小数分：若支持0.01精度，则服务端验证最多两位小数并存百分之一分，报告只在显示时除以100。至少验证 `0 < max <= 150`，`0 <= earned <= max`，有限数值；不用浮点直接拼接累计而产生`0.1+0.2`误差。若本轮限定0.5精度，应在UI/API/测试同时说明，不能悄悄四舍五入输入。

**父子题防双计分**：大题21与小题21(1)/21(2)同时存在时，必须把21视为不计分分组，或拒绝父题也填写分数。不能将大题总分再加一遍子题分数。最小方案是保存每个计分叶子条目，parentNo仅作展示分组，无父行分数。

## 3. 业务状态与接口建议

建议 `GET/POST /papers`、`GET/PATCH /papers/{id}`、`POST /papers/{id}/confirm`、`GET /papers/{id}/report`。这些是本文件提出的接口形状，不代表已经存在。

- 创建和编辑需要关联老师，或仅允许学生创建未评分草稿；若本轮不做学生草稿，UI明确“请由关联老师录入”。任何学生/家长/管理员不能确认给分。
- JSON整体替换条目前，先完整归一化与校验；失败时保留原记录。不要自动导入localStorage。
- 确认需要老师明确确认、当前revision、至少1个完整条目。draft不会出现在正式成长/成绩摘要；PDF可以导出draft，但必须水印“未确认草稿”，不冒充正式评分。
- 确认之后不可编辑。重复确认应返回已有相同结果或409，不能追加重复成长条目/重复审核事件。
- 任何修改范围、题号、证据、分值或观察档位都必须更新revision；旧页面确认409后重新加载，不能覆盖新数据。
- OCR未接通维持503，不接入DeepTutor已发现反例的通用评分；输入JSON中出现AI `score/correct/answer` 应剥离且提示、或严格拒绝，不能进入实得分。

### D1事务竞争注意

不能使用“先UPDATE revision，再无条件DELETE/INSERT条目，最后才检查UPDATE changes”的伪乐观锁；失败请求仍可能在batch中覆写别人的条目。

可选安全办法：

1. 主UPDATE同时写入本次随机writeToken；后续DELETE/INSERT与审计都以 `paper_id + revision + writeToken + status` 为门控；UPDATE失败则整批后续操作均无效，最后返回409。
2. 或所有编辑/确认首先追加 `UNIQUE(paper_id, revision)` 的版本事件，利用唯一冲突回滚整批；所有状态变化（包括confirm）都递增revision。

若批次中任何条目写入失败，必须回滚整卷状态和全部条目。不要在D1 batch之外逐行更新确认记录。报告最终基于同一次已确认快照生成。

## 4. 权限、成长与导出

沿用当前 `allowStudent` 的资源范围，但为写入额外加teacher角色。家长只读已确认摘要，不能读取原图、逐题证据文本或未确认草稿；管理员仅管理关系，不默认读取学生纸卷。教师撤销绑定后的GET、PATCH、confirm、PDF和JSON导出都应受限。

成长接口返回三个独立区，而非合并正确率：

1. 在线实际题目作答：现有attempt evidence，student_self或teacher_recorded。
2. 卷面人工评分：`earned/max`、计分叶子数量、confirmedBy/time、算法版本，单独列表和报告。
3. 人工能力观察：0–3原始档位分布/条目、观察范围与时间，不能称卷面分或掌握率。

AI推断最多列在待核对区，不进入上述真实学习/成绩指标。即使教师确认AI题干，也必须明确由教师录入实际分数才能产生paper_score。

按类型聚合：科目、明确知识点、范围层级、题型、已确认难度。未映射条目可以贡献真实卷面分，但不贡献特定知识点掌握结论；未知难度独立列“未分类”。完整卷面总分必须展示其包含的评分条目数量，混有观察条目时显示“仅X条已知卷面分，另Y条人工观察未计入总分”。

新增可保存实体应同时登记导出：阅卷清单、草稿/确认明细、正式卷面报告、人工观察记录；PDF与打印使用统一preview，JSON/CSV若原型已有则保留。导出需从受保护API重新取数据，不能导出浏览器缓存的角色/模拟历史。CSV文本以=、+、-、@开头时应防公式注入，原始规范JSON可保留准确值。

## 5. 必须实际运行的回归样本

| 类别 | 测试 |
|---|---|
| 黄金部分分 | 4分得3 + 6分得3 = 6/10、60%；不变为0–3或72% |
| 小数精度 | 0.1+0.2按整数存储得到0.3；超出允许精度拒绝而非隐式舍入 |
| 题号 | `21(1)`、`21(2)`合法；全角/半角等价题号重复拒绝；父子总分不双计 |
| 输入完整性 | 空卷、超过120条、null条目、空题号、重复题号、无效科目、NaN/Infinity/字符串分数/负分/earned>max拒绝 |
| 两种证据 | 观察level=2没有maxScore不计为2/3卷面得分；mixed报告将分数与观察分开 |
| 范围 | 章名“全等三角形”保持chapter；无映射保存unresolved；跨科目knowledgeId拒绝 |
| 来源 | 输入AI分数/答案不会入库；确认AI结构之后仍保留contentOrigin；gradingOrigin只能服务端赋teacher_manual |
| 权限 | student/parent/admin不能给分或确认；另一个老师/跨机构读写404；撤销绑定立即失效 |
| 上传归属 | 外人的uploadId拒绝；过期或删除原图不篡改已确认分数；报告不泄露对象键 |
| 状态 | 草稿不进成长，确认一次进入；确认后修改拒绝；重复确认不重复增分 |
| 并发 | 两个revision相同PATCH至多一个成功，另一个409；PATCH与confirm竞态无半更新；两个confirm只生成一次证据 |
| 原子性 | 最后一条条目校验或DB约束失败时，前面条目与revision均保持原状 |
| 导出 | draft水印、confirmed分值正确、观察档位单列、权限复查、空/错提示、题目/图片A4不截断 |
| 前端 | 线上学生不能出现教师评分按钮；线下教师录入明确标记teacher_manual；刷新后真实状态可恢复；API失败不回落mock |

本次研究没有修改旧源码、新平台src/public/migrations或既有tests，没有访问线上/生产服务，也未运行付费模型。
