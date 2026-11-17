
## Completed learning plan center release (2026-11-15)

The plan-center expansion is published as production-20261115.3, Worker 4e83aa9f-12a7-4f2d-89cc-9850b89e095b, backend 20261115-plan-center-2. This scoped publication window is complete, with no pending automatic writes/deployments. Read release/PLAN-CENTER-PRODUCTION-REPORT.md and plan-center-import-manifest.json before a later change. Recheck live version and coordinate a new single publisher before any future update. Original 58 tables/rows were preserved; two new tables started empty. Normal user traffic and scheduled backups continue. Question/handout expansion and Android remain paused; payments, real referral campaigns, WeCom integration and automatic messaging remain closed. Older completion sections below are historical.


## Completed learning time plan release (2026-11-15)

The scoped time-plan upgrade is published as production-20261115.2, Worker 311ea4d4-3334-4221-8e65-b8fa1174b1f2, backend 20261115-plan-1. This release window is complete; no pending automatic production changes. Read release/TIME-PLAN-PRODUCTION-REPORT.md and release/time-plan-import-manifest.json before further changes. Recheck actual deployment and arrange a new single-publisher window before any next update. The self-study-loop content expansion remains paused and was not merged. Android stays paused; payment, real referral campaigns, WeCom integration and automatic messages stay closed. Original 54 tables and all existing uncommitted work preserved; normal traffic and backups continue.

# 最新发布状态（2026-11-15）

家长分享与在线合作首版已发布为`production-20261115.1`，当前后端`20261115-referral-1`，最终Worker`c3439ffc-a4bd-4601-bad6-0ebf3a0a9f54`。本轮自动代码/生产修改已结束，正常用户业务及定时备份继续。只有中性公开体验、内审素材、隔离演练与私有联系资料草稿，真实活动、资金、带佣渠道、自动消息和企业微信API仍关闭。下一次更新先查`release/referral-production.json`、`release/REFERRAL-PRODUCTION-REPORT.md`及在途聊天，协调唯一发布者；不以旧快照覆盖，也不删除新增记录来回滚。

以下保留上一轮历史边界：

# 当前实施与发布边界（2026-11-14）

2026-11-15更新：上一轮工作已完成。本对话`01a1d9d6-b061-7262-b050-db8d03178f11`停止源码/部署/生产修改，将“家长分享与在线合伙人首版模拟模块”的下一次发布执行权交给已获用户授权的`01a1da0f-f500-7b23-9209-f578f3e46705`。这是发布所有权交接，不停止正常业务或备份。真实资金、活动、带佣渠道、自动消息及企业微信接入均未获启用确认。最新边界见`REFERRAL-PUBLISH-HANDOFF-20261115.md`和`../release/ownership-handoff-20261115.json`；下述为历史。

最新状态：初中复核与学习问答`.3`、独立艺考模块`.4`均已分阶段正式发布；当前版本与回滚以`release/production-deployment.json`、`content-round2.json`和`arts-production.json`为准。下述隔离目录说明保留来源边界；艺考已在23文件哈希及P1修复复验后增量合入，未整目录覆盖。两个学段的题库/成绩/统计仍独立。

本轮用户授权继续初中题库独立复核、隔离题修订、分批扩科和DeepTutor受保护学习问答。`junior-learning-release`保留所有未提交成果，生产更新只由“上线题库与 DeepTutor”对话统一执行。

本轮使用新增迁移0009学习问答、0010自动复核批次。自动复核不冒充teacher，版本化写入必须匹配原revision/content hash且没有后来教师处理；回滚也不得覆盖后来的教师修改。VPS旧math、代理、模型和固定样例实验室保留；新学习问答服务独立回环18084，受令牌与本机网络限制。

另一个经用户授权的“建设湖北艺考文化冲刺模块”对话在独立`hubei-arts-module`目录开发，边界为`public/arts/`、`data/arts-content.json`、`src/arts*.mjs`、迁移0020及相应测试/文档。已约定其不写当前release公共文件、不部署；完成后需提供增量文件哈希和测试再核查合入。当前初中部署不包含尚在开发的艺考模块，不可将两个学段的题目、成绩和统计混合。

`src/api.mjs`、平台入口、首页、日志、缓存和发布配置由根协调器合入。各独立目录或旧快照不得整目录覆盖当前release。最新正式版本以`release/production-deployment.json`、正式接口及本轮发布记录为准。
