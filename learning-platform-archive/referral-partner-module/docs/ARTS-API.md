# 艺考模块 API 补充契约

路径前缀 `/api/v1`。统一成功返回 `{data: ...}`，失败沿用平台 `{error:{code,message,requestId}}`。下表艺考字段不追加到旧初中数据口径。除明确public接口外均需现有会话；写操作需同源及CSRF，角色、绑定、版本在事务边界再次核对。

| 方法与路径 | 权限及数据 |
|---|---|
| `GET /public/arts/catalog` | 匿名；六科安全目录、计分类型、初始内容数量、四档引用。真人审核是机构内版本状态，公开返回null并注明登录后查看 |
| `GET /arts/catalog?examYear=2027` | 学生/教师；只返回适用年度的点。教师含题目答案和讲义；学生只在已审版本获得讲义，不从目录获得测试答案 |
| `GET /arts/plans?studentId=...&examYear=...` | 学生本人/绑定教师/授权家长。家长裁剪内部备注与调整原因 |
| `POST /arts/plans` | 学生本人或绑定教师。每机构/学生/学段/年度唯一 |
| `GET /arts/plans/:id` | 同计划读取权限 |
| `PATCH /arts/plans/:id` | 绑定教师，必须expectedVersion、reason；不可改变学生或年度；追加历史版本 |
| `GET /arts/plans/:id/evidence` | 真实已提交记录、可比性和透明建议；学生/教师含未提交题组安全摘要，家长只有pendingCount，不含题目/逐题答案 |
| `GET /arts/plans/:id/print` | 与evidence相同权限；教师另含计划版本历史和内容疑点记录 |
| `GET /arts/content/:pointId/print` | 教师完整核对材料；学生仅相应已审讲义；家长不可读取 |
| `POST /arts/content/:pointId/review` | 教师；`{version,confirmed:true}`；必须实际核验的版本，隔离内容不能审核 |
| `PATCH /arts/content/:pointId` | 教师；`{expectedVersion,payload,reason}`；payload为完整合法point，新版本回到待真人审核 |
| `POST /arts/content/:pointId/report` | 教师；`{version,reason,severity:'minor'或'serious'}`；serious立即隔离相应版本 |
| `POST /arts/attempts` | 学生本人/绑定教师；`{planId,pointId,phase,diagnosticId?}`；未审核/隔离/跨年度拒绝；practice和retest必须引用同点已提交diagnostic，retest还需已提交practice |
| `GET /arts/attempts/:id` | 学生本人/绑定教师；open题面无答案。submitted返回实际选择、当时快照答案与解析；隔离版本明确历史证据状态 |
| `POST /arts/attempts/:id/submit` | 同权限；`{answers:[{questionId,selectedOption}]}`；每题实际选择，提交后不能覆盖，教师代录与学生自主分别保存 |
| `GET /arts/attempts/:id/print` | 与attempt相同权限 |

计划创建字段：
```json
{
  "studentId": "授权学生ID",
  "examYear": 2027,
  "combination": "history_geography_politics",
  "targetTotal": 400,
  "targets": {"chinese":85,"math":70,"english":75,"history":60,"geography":55,"politics":55},
  "baseline": {"chinese":null,"math":25,"english":null,"history":null,"geography":null,"politics":null},
  "startDate": "2027-01-11",
  "examDate": null,
  "dailyMinutes": 120,
  "restDaysPerWeek": 1,
  "offlineMinutesPerWeek": 120,
  "reason": "依据本次实际基线建立计划"
}
```
`baseline`全部为模拟原始分，null表示缺失证据；地理政治目标为等级分，禁止将两种口径相减或合成当前正式成绩。`examDate`可为空；非空也标记用户预计，不能冒充官方日程。教师可增加`teacherNote`和`priorities:[{pointId,priority:'secure|improve|defer',reason}]`。学生不能写教师指导或覆盖优先级。

打印前前端再次读取受保护接口；HTTP响应no-store。没有匿名私有PDF下载路径。未提交题组通过evidence.pendingAttempts找到原ID并GET恢复，不重复创建破坏唯一阶段约束。

本补充是首批实际实现契约；现有`docs/openapi.json`是旧平台契约，不作为本模块已生成OpenAPI的证明。
