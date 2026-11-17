# 网站线程接入边界（后端与加载器已验收，页面待接入）

后端已新增draftRoutes并接入src/api.mjs；仅老师本人/本机构可以读取，不使用studentId或师生绑定替代草稿所有权。迁移0005只新增隔离表，不修改正式题库和学习记录。外部模型调用默认关闭。

本目录不是已合入的前端页面。先读取docs/STAGE8-AI-DRAFTS.md最终状态、docs/openapi.json与本目录登记，再在网站发布副本接入：

1. 教师候选题入口只调用真实draft-sources/question-drafts/draft-provider；未配置生成禁用，并展示明确原因。
2. 人工accept必须逐题勾选答案、解析、引用、年级检查，写复核说明。accepted_isolated仍未发布，禁止混入学生题单。
3. 使用当前api()的CSRF和身份代次；资源/学生/账号/视图切换防迟到覆盖。409保留输入并比较最新版本；401/403/404关闭敏感编辑。不缓存令牌和业务数据。
4. export-registry.js四类加入主registry；保存资料、候选批次及清单都有可见PDF/打印按钮。loadDraftDocument接入统一print-data，复用print.js的加载/空/失败禁印和打印前再次鉴权。后端给出渲染所需blocks，不能打印浏览器未保存输入。
5. JSON/CSV使用GET /draft-exports?kind=...&id=...&format=json|csv，均经相同服务端授权。JSON保留所有保存版本，CSV是当前版本题目明细，不取代PDF。
6. 生成201只表示请求记录保存：必须检查status；unavailable/failed没有题目；generating重放为202，不重新收费调用。生成过程中服务崩溃可能保留generating，尚无自动任务恢复；不得盲目重试新requestId。

不得把本目录或浏览器隔离打印试验称为正式网站入口已完成。页面、按钮、桌面/手机及最终网站集成验收由网站线程执行；后端与打印加载器证据在test-results/stage8。

本轮验收：83项Node测试、本地D1 6项、打印加载器102项与12份PDF/16页。加入最后的“候选ID不能创建正式测评”断言后相关10项再次通过。生成成功只由本机contract_fixture替身演练，真实VPS只读HTTP已验证、模型/embedding profiles仍0。

安全合入时点：docs/STAGE8-AI-DRAFTS标记“后端已验收”且test-results/stage8/closeout.json已生成最终文件SHA256。先比对列表，不复制整个工作目录或任何.local/test-results凭据和测试库。共有说明的具体更新见SHARED-DOC-CHANGES.md。
