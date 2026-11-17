# 未覆盖、缺失值与真实零分专项验收

日期：2026-11-14。范围：独立平台的实际API、桌面/手机界面和真实生成PDF。旧math的疑似行为仅作为检查线索；本轮没有据此认定新平台有同样缺陷，也未修改旧项目。

## 结论与改动

**没有复现缺失类别被补成0分/0%、产生虚构薄弱预警或除零的问题。**现有设计只返回有实际样本的知识点/阶段；不完整的筛查题集在创建前被拒绝。真实零分保留数值0和正分母，未确认分值保留null，缺失分值不生成正式报告。

唯一产品代码调整是src/learning.mjs的growth.notice补充一句：“未列出的知识点或阶段表示暂无有效作答或未覆盖，不代表0分。”现有工作台与PDF预览都读取该服务端说明，因此语义一致。没有改计算、告警算法、状态机、数据库、题库范围或API结构；API1.3.0/44路径、25类导出及既有JSON/CSV保留。修改前源码在.local/missing-evidence-before/learning.mjs。

## 测试场景为何有效

使用原有4个明确标注的示例知识点，没有编造完整类别题库。通过真实API建立以下隔离状态：

| 场景 | 真实数据与预期 |
|---|---|
| 数学筛查缺一题（仅内存库故障注入） | CONTENT_INCOMPLETE/409；不创建attempt，不生成成绩或成长行 |
| 数学方程筛查错误、分数筛查正确 | 方程diagnostic=0/1，分数diagnostic=1/1；弱点仅来自实际方程错题 |
| 只对方程匹配、批准并完成练习，练习错误 | 方程practice=0/1；分数practice无样本，不返回该行、不补零 |
| 英语筛查已打开但未提交 | result=null；两个英语知识点没有有效作答，不进入成长统计或图表 |
| 阅卷草稿中第一题0/4、第二题满分和实际分缺失 | 第一题保持0，第二题保持null；确认返回SCORE_INCOMPLETE，report=null，不冒充0%总分 |
| 另一份仅含方程题的已确认卷面0/4 | score={max:4,earned:0,percent:0}；byScope只有实际方程条目，分数类别未返回 |

因此，“某知识点无样本”分别由未提交的英语知识点、未覆盖的分数练习阶段验证；并未声称平台允许缺题数学筛查继续产生部分诊断。没有复测，comparisons始终为空，成长页保留“尚无进步对比依据”。

## 已实际运行

- 新增3项防回归测试；完整Node业务/安全/契约套件**54/54通过**。静态检查**69个JS/MJS文件**及25类导出登记通过。
- `scripts/missing-evidence-browser-test.mjs`：**108项浏览器/API断言、12张真实截图**。桌面1440×1000与手机390×844，学生/老师/家长真实登录，实际进入成长、练习回看、未提交英语、人工阅卷草稿和正式报告。
- 界面保留真实0/1、0/4和0%，草稿输入分别显示0与空白；未覆盖的行不出现。未提交英语不显示成绩，家长只读已有授权成长摘要。
- 本轮实际生成**12份PDF/16页**：每种视口各有学生成长、真实零分练习、未提交英语作答单、含缺分的阅卷草稿、正式零分阅卷报告、家长成长共6份。
- 无数据预览和其他学生越权预览均禁止打印、没有生成零值图表；这些失败/空态只做实际浏览器检查，没有伪造空PDF作为成功导出。
- PDF经pdfplumber文字/页边界检查、Poppler逐页渲染和画面查看；中文可提取、A4正确、没有NaN/Infinity、虚构预警或0/0。

工作台当前使用表格展示知识点，图表位于打印预览/PDF中；没有把不存在的工作台图表算成已验证。实际SVG只含3条有样本的知识点/阶段，宽度为0、0、520，标签分别0/1、0/1、1/1。PDF文件内进一步检查到3条背景矢量条、仅1条非零绿色前景；没有给缺失的英语或分数练习补灰条或0%标签。缺失是“不绘制该类别”，真实0分是“有类别、有正分母、前景长度为0”。

数学练习中的0/1由MathML排成上下分数。验证实际PDF的字符坐标，确认0在分子位置、1在分母位置；没有因为纯文本提取缺少斜杠而把它误判成01或数据错误。人工卷面报告的带空格比例保留普通文本0 / 4，并明确0%。

旧70份PDF逐文件SHA256与上一轮清单一致，未覆盖、未重新生成。这些是历史验收文件；本次共享说明的新文本以新增12份为证据。本轮未重跑无影响的其余导出类型、OCR效果、RAG实验或workerd。不是宣称全站25类在本轮重新导出。

## 文件、证据与复现

| 文件 | 作用 |
|---|---|
| src/learning.mjs | 既有稀疏聚合与缺题拒绝；只补共享说明文字 |
| src/papers.mjs | 只读复核既有null/正满分校验和实际零分汇总，没有修改 |
| tests/evidence-scenarios.mjs | 通过实际API构建有限的合成场景 |
| tests/missing-evidence.test.mjs | 缺题拒绝、未提交/未覆盖不补零、null与真实0区别、正分母校验 |
| scripts/missing-evidence-browser-test.mjs | 真实UI、SVG、权限/空态和Chrome PDF生成 |
| scripts/verify-missing-evidence-pdfs.py | PDF文字、分数坐标、矢量条数量/颜色、分页和渲染 |
| scripts/label-evidence-samples.py | 给交付查看副本添加合成/自动化标签，不改原始PDF |

证据在test-results/missing-evidence：summary.json、desktop/mobile-api-evidence.json、node-tests.txt、pdf-validation.json、12份PDF、截图及rendered全页PNG。output/pdf中提供带“合成样本、自动化教师操作”页脚的两个查看副本，原始证据保持不变。

```powershell
node --test tests/missing-evidence.test.mjs
node scripts/missing-evidence-browser-test.mjs
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/verify-missing-evidence-pdfs.py
```

浏览器依赖配置沿用README的PLAYWRIGHT_MODULE/CHROME_EXECUTABLE；PDF核验依赖pdfplumber、Pillow与Poppler。脚本使用随机回环端口和内存数据库，不需要运行普通演示服务。

## 失败记录与限制

测试脚本的四次前期失败分别是：引用不存在的.records-list容器、在列表同名标题还存在时过早读取详情、把MathML分数当纯文本斜杠、又把保留空格的普通比例强制当MathML。均根据真实DOM/文件修正定位、等待或排版断言，未改变业务分数或为通过测试生成替代数据。失败阶段的summary副本仍在同目录；最终summary.completed=true。

只有源码检查的部分：对既有SQL分组、零分保护和匹配来源的阅读结论；不能将其单独视为浏览器/PDF通过。上述108项和12份PDF则实际运行并保存了文件，不是按钮、Mock页面或代码推断。

此验证限原有微型样例及受支持的API。没有做全课程题库、旧真人数据、损坏生产库、物理手机、物理打印机或复杂公式兼容测试；手机视口不是iOS/Android/鸿蒙真机。若未来页面要显示完整目录，缺失项必须用未覆盖/null等独立状态，不能将数组中不存在的行默认成0分。

所有教师核对和分数都是隔离合成自动化操作，不是真人审题或真实学生成绩。没有付费模型、外部学生资料传输、生产D1/R2操作、部署、推送、提交、旧math或原型写入；未提交成果、三步闭环、双场景和现有权限边界保留。
