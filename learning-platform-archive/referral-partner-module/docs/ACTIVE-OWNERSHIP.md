# 当前实施与发布边界（2026-11-14）

最新状态：初中复核与学习问答`.3`、独立艺考模块`.4`均已分阶段正式发布；当前版本与回滚以`release/production-deployment.json`、`content-round2.json`和`arts-production.json`为准。下述隔离目录说明保留来源边界；艺考已在23文件哈希及P1修复复验后增量合入，未整目录覆盖。两个学段的题库/成绩/统计仍独立。

本轮用户授权继续初中题库独立复核、隔离题修订、分批扩科和DeepTutor受保护学习问答。`junior-learning-release`保留所有未提交成果，生产更新只由“上线题库与 DeepTutor”对话统一执行。

本轮使用新增迁移0009学习问答、0010自动复核批次。自动复核不冒充teacher，版本化写入必须匹配原revision/content hash且没有后来教师处理；回滚也不得覆盖后来的教师修改。VPS旧math、代理、模型和固定样例实验室保留；新学习问答服务独立回环18084，受令牌与本机网络限制。

另一个经用户授权的“建设湖北艺考文化冲刺模块”对话在独立`hubei-arts-module`目录开发，边界为`public/arts/`、`data/arts-content.json`、`src/arts*.mjs`、迁移0020及相应测试/文档。已约定其不写当前release公共文件、不部署；完成后需提供增量文件哈希和测试再核查合入。当前初中部署不包含尚在开发的艺考模块，不可将两个学段的题目、成绩和统计混合。

`src/api.mjs`、平台入口、首页、日志、缓存和发布配置由根协调器合入。各独立目录或旧快照不得整目录覆盖当前release。最新正式版本以`release/production-deployment.json`、正式接口及本轮发布记录为准。
