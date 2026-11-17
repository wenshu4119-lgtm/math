# 第一阶段实施方案（2026-11-13）

> 这是首次实施前方案。后续用户补充的所有者全部使用授权、深入源码验证、Antigravity新目录和全站PDF/打印要求，已纳入 `ARCHITECTURE.md`、三份源码审计、`API.md` 与 `EXPORT-INVENTORY.md`；以这些更新文档和 `VERIFICATION.md` 的实际结果为准。

## 现场检查与保存边界

原工作区为 `C:/Users/Administrator/Desktop/cloudflare-deploy`，Git `main`，HEAD `e56614d`，初始工作区干净；无本地 AGENTS.md。目录中未发现 Antigravity 创建的新平台。检查相邻开发目录 web（仅 workbuddy 记忆目录）和 cloudflare-deploy-live（旧静态资源副本），未发现新平台；这不代表已搜索整台电脑。

math 的 `.githooks/pre-push` 执行 `npx wrangler@4 deploy`，其静态资源目录为仓库根目录。因此新建独立同级目录和独立 Git 仓库，不修改、嵌套于、复制或推送旧仓库。不读取旧 `.dev.vars`。

## 架构与阶段范围

原生 HTML/CSS/ES Modules → 同源 `/api/v1` Pages Functions → 共享业务层 → D1 + 私有 R2。
本地零依赖 Node 24 服务复用同一业务层和 SQL 迁移；SQLite adapter 模拟 D1 的调用形态，文件 adapter 模拟 R2，保存真实本地数据。Cloudflare 本地运行使用 Wrangler，绝不使用 `--remote`。

仅数学与英语各两个知识点、每点筛查/练习/复测各一题（12 道原创微型样题）。不是完整课程或标准化能力测量。匹配为确定性规则，不调用生成式 AI。教师可审核样题/材料、调整学习包知识点和指导语、批准学习包；学生完成练习后复测。没有薄弱项时给出巩固包。

PWA 只缓存公共应用外壳，不缓存会话、题目、学生数据、API 或图片；离线不能提交学习记录。未来 iOS/Android/鸿蒙复用 `/api/v1` 的业务契约，原生身份认证需单独设计，第一阶段不实现 App。

## 数据与权限

- organizations/users：随机 ID、组织、登录别名、显示别名、角色、密码哈希、停用状态；不收姓名、生日、学校、手机号、身份证、定位。
- relationships：管理员建立老师→学生、家长→学生的显式授权，可撤销；跨组织禁止。
- sessions/rate_limits：会话只存令牌哈希，8 小时固定过期；限流键哈希，不存原始 IP。
- knowledge/questions：带版本、出处、示例标记、独立推导、自动核验与人工审核信息。审核不修改历史题目。
- attempts/attempt_items/answers：按服务端题目快照，实际选择、正确与否、提交者、线上自主/线下录入、时间持久化；提交只允许一次。
- packs：筛查来源、薄弱点、匹配版本、教师调整、批准人、乐观锁；练习和复测关联学习包。
- uploads：私有对象键、归属、有效期、OCR 状态、人工修订文本；核对文本不是已验证题目或成长分数。
- audit_events：事件、操作者随机 ID、对象 ID、时间；不含密码、令牌、原图、题干、答案、用户输入。

管理员仅账号/关系/审计管理，不默认读取学生学习内容；老师只访问关联学生；家长只读关联孩子成长摘要，不取原图和逐题作答；学生只操作本人。所有资源端点服务端鉴权，不依赖前端隐藏按钮。

## 接口与计划文件

所有 API 使用 `{data: ...}` / `{error:{code,message,requestId}}`，状态码 400/401/403/404/409/413/415/429/503。写入请求要求固定 Origin 与 `X-CSRF-Token`，登录也检查 Origin。
`auth/*`、`admin/users`、`admin/relationships`、`students`、`content/*`、`attempts/*`、`packs/*`、`students/:id/growth`、`uploads/*`。详细字段及响应落在 `docs/openapi.json`、`docs/API.md`。

文件：public/（页面、样式、ES 模块、PWA）、functions/api/[[path]].js（适配入口）、src/（安全、数据访问、业务路由、样例）、migrations/（SQL）、scripts/（本地初始化/服务/清理/验证/DeepTutor 探测）、tests/（业务闭环、安全、契约、内容）、docs/（架构/API/交接/验证/许可证/技术验证）。

## 验收标准

1. 不改旧仓库，无部署/推送/生产操作；新目录独立启动。
2. 四角色会话、关系撤销、组织隔离、越权、CSRF、限流、安全错误和脱敏审计通过实际测试。
3. 两科从待人工审核样题开始，模拟教师审核后可筛查→匹配→审核/调整→练习→复测→基于实际记录的成长摘要；重复和并发提交不污染记录。
4. 提交前不泄露答案；未经人工审核内容不能出题；历史记录不随内容变动；展示样本数及不确定性。
5. 图片限 JPEG/PNG、2 MiB、签名和维度校验、私有访问、24 小时到期；OCR 未接通为 unavailable，人工核对可保存，不自动生成分数。
6. 成功测试与限制写入 docs/VERIFICATION.md。测试中人工角色为模拟；不宣称种子内容已被真人审核或 DeepTutor 实际准确率。
