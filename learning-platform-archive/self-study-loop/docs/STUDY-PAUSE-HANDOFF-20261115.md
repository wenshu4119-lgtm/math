# 自学闭环工作暂停与恢复记录

记录日期：2026-11-15。当前工作目录：`C:/Users/Administrator/Desktop/self-study-loop`。

## 暂停边界

收到协调消息，转述用户要求优先处理已排队的“学习时间计划”新任务。当前停止题库/讲义扩充、原闭环任务的继续开发及发布，仅保存本记录。完整的新需求在本轮可读消息历史中尚未出现，不能声称已开始实现新计划；结束本轮后接续原始排队消息，不创建重复任务、不要求用户重发。

没有删除、回滚、覆盖既有成果；没有将本目录同步到生产源码，没有运行本轮生产迁移或发布。生产最后核验基线仍为 `production-20261115.1`，Worker `c3439ffc-a4bd-4601-bad6-0ebf3a0a9f54`，backend `20261115-referral-1`。继续工作前须重新核查实际版本、部署归属与其他在途任务。

安卓保持暂停。初中、艺考、分享/推广模拟模块、DeepTutor、旧 math、生产数据和已有未提交成果保持原状。真实支付、奖励活动、自动兑付、自动消息与企业微信接入未启用。

## 已保存的工作

- `docs/STUDY-GAP-AND-PLAN.md`：现状差距与分期计划。
- `data/study-content.json` v2：20 个结构化知识点/讲义版本（初中 14、艺考 6），180 道新题。每点 9 题，检测/练习/复测与难度分开。艺考沿用并扩展原有 6 个主题，不能累计宣称新增 6 个不同主题。另有 20 道讲义例题、44 道讲义内练习，不计入 180 道题。
- 内容自动校验及独立 AI 复核证据保存在 `data/study-content-audit.json`、`data/study-reviewed-texts.json`、`data/study-content-revisions.json`、`test-results/study-content-independent/`。真人审核为 0；不是完整学科覆盖或正式难度校准。
- `src/study*.mjs` 与 `migrations/0040_self_study.sql`：新增隔离表、同知识点同用途多题、真实检测/任务/复测 API、权限投影、草稿、报告快照、纸笔证据关联、版本和导出。旧 `questions` 唯一约束及旧成绩未改动。
- `public/study-workspace.js`、`study-ui.js`、`study.css`、`study-print-loader.js` 及现有 app/API/export registry 接口：本地接入草稿，尚不可发布。
- 会话/打印隐私修复：`public/session-guard.*`、现有私有页面与打印入口集成，证据在 `test-results/study-privacy/`。只在隔离目录，生产问题不能称已修复。

内容冻结 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| data/study-content.json | ab1d4149684bf708bef7c623851d4831746eb16b8dc2659e4182780bc2173ffa |
| data/study-content-audit.json | 019cc3d8206434f87184b094ef30c0fbc1f47b8f260917be89abd1aa29702b83 |
| data/study-reviewed-texts.json | 2bc4c2ab1c97d91726bfac90924a3c4632f857716ca20abee9078eb3f372c7e3 |

## 已运行验证与限制

- 内容：14 项测试；独立审查覆盖 180 题、20 份讲义、20 道例题、44 道内部练习，72 项数值/符号复算；12 种语义负例被拒绝。上述均非真人审题。
- 后端：最后已在运行的 `tests/study-flow.test.mjs` 自然结束，8/8 通过，包含初中两科及艺考六科闭环、未作答、草稿、报告冻结、纸笔、范围/下一轮及权限导出。尚未完成全部专项与旧套回归。
- 隐私：此前完成 35/35 浏览器场景、79/79 单元检查、32 份 PDF 控制证据；其后 root 改动主界面导航，仍需最终集成复验。真实 BFCache 未命中，仅补充 persisted 事件测试；没有真机、物理打印或原生打印对话框完整人工验收。浏览器既有打印快照和已下载文件不能远程撤回。
- UI：仅完成契约检查和一次内存浏览器探测。学生不经过教师审核即可创建并提交检测；返回任务页时遇到空值渲染错误。没有完成新的 UI 端到端测试套件。
- OCR：生产未开通，本轮未连接或模拟 OCR；已有私有图片上传/人工核对路径可复用。未运行真实 OCR 准确性测试。

## 恢复时优先核查的已知问题

1. `comparisonHtml` 与打印报告默认 diagnostic/retest 均存在；单侧为空时实际抛错，正文为空。应先处理尚未组成对照的状态。
2. 家长 DTO 是摘要，没有 task.items/materials 及部分问题字段；UI/打印须单独呈现授权摘要。
3. practiceTier 的 UI 英文枚举与实际内容的“基础识别/基础运用/迁移巩固”不一致，筛选结果错误。
4. suspectedErrorHints 是对象数组，应显示 hint，不能直接 join 为 `[object Object]`。
5. 后端最后已保存 manualText 未评分附注、workTextGraded:false、previouslySeenQuestionIds/seenBefore；尚待显式 API 断言及 UI 对接/复验。
6. 尚待教师 bundle 审核/纠错/隔离、最终 SQL 撤权/资源版本竞态、照片有效性专项、全旧测试回归、STUDY-API 文档同步。生产迁移工具尚未编写。
7. 主界面与各私有导出的报告版本、来源、内容失效提示及家长展示仍须整体验收。当前 UI 不可作为已完成闭环对外宣称。

## 运行状态

后端及 UI 子代理均确认停止，没有其启动的驻留测试服务、浏览器或内存数据库进程。后端最后测试进程 exit 0；UI 探测服务与浏览器已关闭。隐私子代理未启动新的工作。所有成果保留，后续按新需求复用相关数据与接口，不能把未完成部分标成已上线。
