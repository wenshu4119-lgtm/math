# 学习时间计划 API 与边界

使用现有 `/api/v1` 登录、CSRF、账号状态与学生绑定。管理员无学情权限；学生本人、绑定家长、绑定教师可读写时间计划。练习/复测仍只允许学生和教师，调用既有接口和审核门禁。所有响应 no-store，无外部 AI/OCR 调用。

- `GET /time-plans/context?studentId=&stage=&grade=&examYear=`：每路径最近最多 200 条已提交检测/复测摘要、默认每科最新有效报告、实际机构内容数量、已保存计划。初中旧报告适配仅初一年级数学/英语 4 点/12 题/4 份短讲解；8/9 年级题库自主核对不产生持久检测，缺口如实显示。艺考按考试年度读取旧 arts_attempts 及当前版本审核，首批 6 点/6 讲义/18 题。
- `POST /time-plans/preview`：`studentId, config, planId?, expectedVersion?, taskEdits?, restoreVersion?`。配置含日期/IANA 时区/考试及各科上限/目标/报告选择/自填历史成绩/时间口径/七天预算/休息日/窗口/固定及阶段安排/原因。生成绑定操作者和版本、20 分钟有效的预览；不会自动生效。
- `POST /time-plans/commit`：`previewId, confirmed:true`。证据与内容发生变化拒绝；最终 SQL 同时验证授权、原计划版本、未使用预览、数据戳。新版本、历史及审计原子提交。预览不是账号正式计划。
- `GET /time-plans/:id`、`GET /:id/history`：实际快照和追加执行记录。恢复使用 preview/commit 创建新版本，保留实际记录和手工锁定项。
- `POST /:id/events`：`expectedVersion, requestId, taskId, status, minutes, date, note`。状态 started/completed/skipped/reopened；同请求不重复记账。版本冲突拒绝，完成记录不改动实际作答/掌握结果。
- `GET /:id/content?taskId=`：原知识短讲解或已审核艺考讲义；没有未作答题答案。重新校验当前版本和绑定。
- `POST /:id/action {taskId}`：复用原练习/复测创建或恢复入口。旧初中学习包待教师批准时明确拒绝。基于已经完成的复测安排新练习时先提示在原流程开启下一轮检测，不能重复使用旧提交伪造新进步。
- `GET /:id/export?range=all|week|day&date=YYYY-MM-DD`：授权总/周/日计划；由现有 `/print.html?kind=time-plan&id=...&range=...&date=...` 生成 PDF/打印预览。周 date 必须使用周一起始日期。原生打印快照、下载文件无法远程撤回。

四个新增表：time_plans / time_plan_versions / time_plan_previews / time_plan_events。`0050_time_plans.sql` 只增加表/索引；不改旧 questions、attempts、arts、referral 数据或教师审核。生产迁移脚本检查旧表/行/结构哈希、重复迁移、完整性及新表空状态；不种入合成数据。

排程共享算法 `public/planning/model.js` 与 `src/time-plan-model.mjs` 字节一致，更新后运行 `node scripts/sync-time-plan-model.mjs`。日期无 UTC 跨日偏移；只在本地日期上运算，开始含/目标不含。午夜跨度须拆为两日；零容量及全部休息允许保存并显示未排入。首尾部分周的总量按日数/7 折算；固定安排计入周总量，净自学口径不再次扣除占用。

计划保留可比较范围、版本、样本和实际答题数量，不输出预计总分或达标概率。难度/耗时未校准时明确不完全可比。锁定时段冲突保留待处理，不挤占休息；已完成记录保存历史。单次时长为估算，剩余不足的任务完整进入未排入清单。

2027 湖北考试科目及原始分/等级分口径：省教育考试院 2026-10-16 发布的 [2027 年报名须知](https://www.hbea.edu.cn/html/2026-10/16178.html)，核对日期 2026-11-15；2026 对应 [2026 年报名须知](https://www.hbea.edu.cn/html/2025-10/15456.html)。2027 正式文化课具体日程本次未核实，所有目标日期作为用户预计。其他年度以参考规则标识，不能说已核实。中考/校内考试仅用户自定义、需核对当地范围和上限。
