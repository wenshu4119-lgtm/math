# Antigravity 原型与真实平台整合核对

2026-11-14第六阶段已重新核对当前原型和live代码，完成通关包标签/翻卡与真实审核、作答衔接；只借鉴交互，不导入MockData/DataService或本地掌握度。新旧设计逐项状态、当前13文件保存基线、真实测试和剩余页面见STAGE6-ANTIGRAVITY-PACK。以下保留为第二阶段初始审计。

第六阶段期间又出现5文件并行更新，最新原型已有真实同源session只读探针，其余业务仍为演示；最新HANDOFF已读取。不要套用下文“无fetch”的初始时点结论。正式接入需按ANTIGRAVITY-HANDOFF-ALIGNMENT映射实际字段/路径，不能把期望接口当已实现；对方文件未被回写。

核查日期：2026-11-13。原型位置：`C:/Users/Administrator/Desktop/cloudflare-deploy/platform-ui`。本次仅只读检查原型及第一阶段MVP，不修改原型、旧math、密钥或生产数据。原型仍为旧仓库的未跟踪目录；旧仓库HEAD为`e56614db680fa83ac68210bec69f8d164e7c8fd0`。

本文记录第二阶段开始时的输入与实施建议，不把建议列为已经完成。第二阶段实施见STAGE2-HANDOFF；后续真实OCR与独立作业的当前状态见STAGE3-OCR-RAG、STAGE4-HOMEWORK及VERIFICATION。原型后续并行更新另见CONCURRENT-PROTOTYPE-UPDATE。

## 1. 实际原型已经具备的价值

原型不是只有静态图：`js/app.js` 已有双场景门户、可交互三步流程、学生学习包的讲解/翻卡/练习、试卷逐行核对、教师调整/反馈、家长档案和移动端导航。三个CSS文件提供完整的蓝/青/橙主题、组件与响应式壳。应保留这些视觉和交互成果，在独立平台接真实数据，不重新建另一套与原型无关的页面。

但它的账号、数据与计算均不是后端可信来源：`setRole()` 只切换前端角色；`reviewQueueState` 来自Mock；`loadState/saveState` 将业务数据写到 `edu_platform_ui_preview_v1`；`simulateMockPaperOcr` 返回模板；试题正确答案在浏览器数据中。点击保存或 `_isMock:false` 不足以证明真人学生作答、真实OCR或经教师审核。

## 2. 可以直接沿用的视觉组件与适配方法

| 原型文件 / 组件 | 价值 | 接入方式与注意点 |
|---|---|---|
| `styles/tokens.css` | 蓝色数学、青色英语、橙色线下，统一字号/间距/边框/色义 | 可以复制到新平台受控目录，保留来源记录；不用暗色变量表示权限或数据状态 |
| `styles/layout.css` 的 `.topbar`、`.brand-mark`、`.app-shell`、`.sidebar`、`.main-stage`、`.stage-container` | 桌面侧栏与顶部身份区 | 用真实会话用户及真实可访问学生替代角色切换器；侧栏只列当前角色允许入口 |
| `.mobile-menu-btn`、`.drawer-backdrop`、`.bottom-nav`、`.bottom-tab` | 960px以下抽屉与底部导航；避免桌面侧栏硬缩窄 | 保留aria-expanded/aria-controls、Escape关闭、遮罩关闭；手机底栏只显示最关键4–5个入口，不挤入全部后台操作 |
| `components.css` 的 `.portal-hero`、`.hero-stack`、`.floating-mini-card` | 首屏说明目标和核心操作 | 沿用构图，把原型“Mock演示”状态改为真实服务状态；不展示不存在的班级人数或提分比例 |
| `.loop-stepper`、`.loop-step`、`.loop-step.active/.done`、`.loop-num` | 三步闭环主线清晰 | 按同一diagnostic→pack→practice/retest链计算；未筛查不是15%进度；学习中不能靠翻页或自报“已掌握”冒充完成 |
| `.scenario-grid`、`.scenario-card.online/.offline`、`.scenario-steps-mini` | 线上与线下场景分区 | 登录前说明差异，登录后只开放该账号实际权限。选择“教师场景”不能把学生账号变为老师 |
| `.page-head`、`.page-actions`、`.badge-*`、`.kpi-tile` | 页面标题、状态、导出入口、统计 | 保留，但所有计数从API读取；没有记录时显示暂无而不是Mock基线 |
| `.tabs`、`.tab-btn`、`.flashcard*`、`.quiz-option` | 讲解/记背/练习学习体验 | 内容来自pack材料与服务器题目；翻面只是阅读操作，除非有明确持久化API，不显示已保存掌握度 |
| `.photo-preview-box`、`.review-row`、`.review-grid`、`.review-row.needs-attention/.verified` | 原图与逐题人工复核、部分分输入 | 对接受保护图片和新paper资源；逐行未复核状态由服务端验证，不能只改CSS就确认 |
| `.state-panel`、`.state-panel.error`、`.skeleton-line` | 加载/空/错误/重试 | 由真实请求状态驱动；移除可让普通用户“切换到正常数据”的演示状态下拉 |

MVP原有 `styles.css` 与原型都使用 `.topbar/.sidebar/.card/.timeline/.toast` 等名称，不能无计划同时全量引入。先选原型壳作为唯一布局来源，再给保留的MVP控件加兼容样式；或者将复制的原型CSS限定在明确的根容器。不要为了原型的内联style字符串放宽现有CSP为unsafe-inline，使用DOM文本节点、class和已有安全渲染函数。

品牌名称在原型中是“智学方舟 · 初中学习平台”，MVP首版是“知行”。合并时页面、manifest、打印页应保持一个一致名称，并在交接中记录沿用来源，避免同一产品出现两套身份。

## 3. 三步闭环与角色/场景的真实语义

### 线上学生

1. 能力筛查：打开实际待答题，服务器提交后显示题数、答对数和具体薄弱点。
2. 针对性学习：展示该次筛查匹配的包；待教师审核时明确等待；审核后提供讲解、记背、练习标签。完成练习才允许复测。
3. 复测与成长：显示本轮对应记录及范围差异，不把任意两次科目/范围不同的结果相减称作能力提升。

### 线下教师

1. 只能从 `/students` 返回的已绑定学生选择对象；能力观察、实际测验、纸卷评分分开显示。
2. 可审核内容、调整包、打印作业/讲义、录入学生实际作答。代录必须标老师录入。
3. 结构化纸卷录分必须支持题号/小题、满分、得分/部分分、知识点映射与确认者。确认后形成独立证据记录，不塞入选择题attempt，也不能伪装学生在线成绩。

### 家长与管理员

- 家长查看已绑定孩子的成长摘要和允许的教师反馈；不直接访问原图、逐题隐私、其他学生、教师审核队列。
- 管理员管理本机构账号、关系和脱敏审计；不要把原型“角色切换”或Mock管理员统计当作管理权限。
- 登录前的场景按钮可以提示登录目的；权限始终来自服务器角色。不能以点击入口或localStorage中的role提升权限。

## 4. 真实API替换点

| 原型状态/函数 | 第一阶段真实来源 | 缺口或限制 |
|---|---|---|
| `state.role`、`setRole` | auth/session、真实登录/退出 | 移除前端冒充角色入口 |
| Mock学生/班级/家长历史 | students、scoped growth | 班级聚合未实现就显示未接通，不回落Mock |
| `screeningAnswers`、`computeQuizReport` | attempts创建+submit+GET | 分数和答案由服务器决定；不要提交客户端算分 |
| `screeningReport` | attempt结果、knowledge统计 | 保留当前测评ID，不能用任意旧筛查替代当前包来源 |
| `reviewQueueState` | content/review-queue、content/{id}/review；包列表+PATCH | 队列内容与审核动作必须来自真实后端 |
| `packState`、`calcPackCompletion` | packs、practice/retest结果 | 第一阶段无讲解阅读/翻卡进度持久化；不把临时翻卡状态做成真实成长百分比 |
| `teacherDispatches/teacherFeedbacks` | 现阶段仅pack.teacherNote | 独立课程安排/课堂反馈未接通则明确提示；不得继续本地“保存成功” |
| `simulateMockPaperOcr` | uploads、recognize、review | OCR当前503；只显示人工录入，不返回模板成功 |
| `computePaperReport` | 本轮新增结构化paper资源和服务端聚合 | 原型档位2用0.72且来源可能丢失；不得继续作为正式报告算法 |
| `localArchiveRecords` | growth及后续独立paper/observation来源 | 不自动导入localStorage历史；未来导入必须预览、核验来源和幂等 |
| `triggerPrint` | export-registry + print.html授权预览 | 保留统一权限复查、空/错/加载禁用及A4能力 |

## 5. 已有导出格式的实际核查

原型全目录（除压缩Chart vendor）检索 `download/createObjectURL/Blob/text/csv/application/json/CSV/JSON`：**没有发现JSON/CSV文件下载入口**。`JSON.parse/stringify` 用于深拷贝与localStorage；不是数据导出。旧math中的createObjectURL用于图片预览，toDataURL用于OCR图像压缩，也不是CSV/JSON报表下载。

原型已有7处打印/PDF动作，均调用 `triggerPrint()`→`window.print()`：

| 原型位置 | 已有能力 | 新平台对应 |
|---|---|---|
| app.js:901/918 | 筛查报告 | attempt / 后续paper报告 |
| app.js:999/1023 | 通关包讲义 | pack / assignment |
| app.js:1199/1233 | 复测与成长档案 | attempt / growth |
| app.js:1396/1423 | 教师方案与反馈 | content/pack及真实新增反馈资源 |
| app.js:1443/1475 | 班级薄弱点总览 | 当前仅授权学生名单；班级聚合未实现不能冒充 |
| app.js:1525/1527 | 家长线上线下记录单 | parent-scoped growth及获准新来源摘要 |
| app.js:1536/1560 | 家长周报 | scoped growth；不输出Mock学生画像 |

原型的打印样式隐藏`.notice-banner`，会一并去掉数据来源或Mock警示；这不适合直接作为真实平台导出样式。原型直接打印当前DOM，也缺少导出前重新鉴权和必要图片加载检查。保留新平台的独立授权预览，并把新的纸卷、观察记录、课堂反馈等保存内容逐项登记。若本轮添加JSON/CSV，必须与PDF同一权限范围并处理CSV公式注入；不得因为添加PDF删除任何已有格式。

## 6. 保留原型的SHA-256证据

以下12文件总计404,527字节；源目录不修改。摘要为原始字节SHA-256（不做换行归一化）。后续若其他开发工具更新原型，应再次记录差异，而不是覆盖新成果。

| 相对路径 | SHA-256 |
|---|---|
| favicon.svg | `2c510402ca1ab9486b0f44ce6e274a7e78b29f9a6efc035db8de92e113ee845b` |
| index.html | `0806cd514b2a96628a73b5fbc5a0f13c52fa97ae2285b5c670fffcb68595a672` |
| start_preview.bat | `13e69a8fb2b4d2b42129888f49660e8f91efbded8a8191bbea1524ac53e2d5c2` |
| js/app.js | `ec90113d14adbff6b6e60b965789bdb007a12ea310e0c854e022dcc98cead115` |
| mock/mockData.js | `af7c619305458291d531e3c495828d488b618f00befe8fde650e7a983d8fdd77` |
| services/dataService.js | `d92f5b216a0d7c42a37e60572ce706d61b80d69413c17dfb1f30c727efeb2ec5` |
| styles/components.css | `5249ae44afe518211edfbbfc0ad2c0d1d1bd620276d93415582c9e8e69947581` |
| styles/layout.css | `dd7414ebbe5cd21b260e78fad662ab831c5e514d590b03d9e30bb03f7c90d528` |
| styles/tokens.css | `88bbff4b4a467d352b581ccc700ce0a946690f490ff97deed2b7efdd389b3fe0` |
| utils/mathRenderer.js | `e8141e0c1876ebba9bd213a23d612b6eae130a468dcf4ebb3096d5dd79d323f7` |
| utils/samplePaperGen.js | `841a203adac6a7e8dacddd6d4aacfdde2841701687a6c0ed0a6cb537a21545b4` |
| vendor/chart.min.js | `d2af8974e95271638772e9e9524db5b9a6f58d6ec2d5d781400447b4a31c681e` |

## 7. 本轮建议验收重点

1. 视觉上能辨认原型的蓝/青/橙体系、门户+工作区、三步主线、双场景卡片和手机底部导航；不是仅更换项目名。
2. localStorage注入角色、Mock分数或历史不会改变真实UI记录或接口权限；无存量记录时显示空状态。
3. 学生线上流程、教师代录/审核流程、家长只读流程分别端到端验证；用户切换及请求晚到不会串学生数据。
4. 讲解、记背、练习内容可正常切换，实际练习提交与复测由后端状态控制。
5. 结构化纸卷支持如`1`、`2(1)`、`2(2)`的独立行；部分分、缺满分、未映射知识点、未核对行、重复确认和并发更新均有实际测试。
6. 所有新增保存内容同时提供PDF/打印；如果新增JSON/CSV须使用同一授权范围。桌面和手机视口都测试空态、错误、撤权、长题/表格/图片与A4分页。

本次只读研究不等于上述功能已实现；父任务完成实施后应以最终测试记录更新状态。
