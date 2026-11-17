# 推广与财务演练 API（实现契约，真实业务关闭）

全部路径为 `/api/v1/referral/*`，沿用会话、CSRF、Origin 与 no-store。所有写请求都必须含 `simulation:true`；未知字段、`mode:live`、真实付款或提现参数均拒绝。学生账号不能加入或操作。教师角色不自动获得财务权限。在职学校教师能否参与真实推广未获确认，本期仅演练。

## 读取和加入

- `GET /dashboard` → `{simulation,notice,capabilities:{staffRoles,canManageGrants,canJoin},rules,member,cases,orders,proposals,appeals,adjustments}`。有 staff ACL 时展示本机构演练台账；否则只返回本人脱敏 case、进展、奖励；无姓名、微信、学校或学习记录。
- `POST /members` `{simulation:true,acknowledged:true}`：自己加入合成演练，初始等级1。不能指定他人。
- `POST /members/leave` `{simulation:true,reason}`：本人退出推广演练，取消其未成交活动归因；不修改学习账号或既有订单。历史、导出及申诉仍可访问，新案例与升级停止；本期不自动重新激活。
- `GET /grants`、`POST /grants`：仅平台管理员。写 `{simulation,userId,role:'operator'|'reviewer'|'manager',enabled:boolean,expectedVersion?:number}`。新增省略 expectedVersion，更新须匹配。
- `POST /cases` `{simulation,customerRef:'SIM-CUST-001',businessLine:'junior'|'arts',selfRelated:false,consentNoticeAcknowledged:true}`：本人建待核验案例；这是合成客户，不确认真人身份。一个合成客户只能有一个活动归因。自买自返拒绝。
- 案例含 `confirmedAt`、冻结的 `attributionDays`。首次双人确认批准后，从确认时刻重新计算归因期限；重复确认不能续期。订单模拟成交必须在确认时刻至归因到期之间，不能回填确认前成交。
- `POST /customers` `{simulation,customerRef,relatedUserId?:UUID|null}`：仅 operator/manager 登记已知合成参与账号关联，用于自买自返校验。禁止关联学生账号，不查询姓名或学习记录；未知合成ID不代表已验证真人唯一性。
- `GET /export?format=json|csv|print&scope=mine|staff`：同源权限导出，演练标记始终保留。
- `POST /appeals` `{simulation,orderId,reason}`：本人记录异议，进入争议而不触发支付或扣款。

## 统一双人复核

`POST /proposals`：`{simulation,requestId:UUID,kind,targetId?,expectedVersion?,payload:{...},reason}`。

`POST /proposals/:id/review`：`{simulation,expectedVersion,approve:boolean,reason}`。maker 与 reviewer 必须不同；不能复核本人推广收益。普通提案 maker 需 operator/manager，复核需 reviewer/manager；rules、level、violation 两端均需 manager。所有金额单位为整数分。

同一机构、提案种类和 `proofRef` 不能同时存在两个 pending/approved 提案。一份合成凭证本期只能对应一笔事项，不支持批量凭证拆单。拒绝后可以新 requestId 修正重提，保留原拒绝记录；已落库订单号始终唯一。同 requestId 的完全相同重试不重复记账，改变内容则拒绝。

| kind | targetId / expectedVersion | payload |
|---|---|---|
| consent | case ID / case.version | `{decision:'confirm'|'reject'|'correct',proofRef:'SIM-CONSENT-001'}`；staff 人工录入“模拟本人确认”，不构成真人身份或真实归因证据。纠正先撤销旧归因，不自动确认新推荐人 |
| order | 无 | `{caseId,orderRef:'SIM-ORDER-001',businessLine:'junior'|'arts',productId:'SIM-JUNIOR-COURSE'|'SIM-ARTS-COURSE',paidCents,excludedCents,paidAt?:ISO,proofRef:'SIM-PAYMENT-001'}`；仅显式合成合格产品，两条业务线须匹配；付款是演练凭证，不是截图识别 |
| qualify | order ID / order.version | `{observedAt:ISO,proofRef:'SIM-OBSERVE-001'}`；明确使用演练观察时间，不声称现实14天已经过 |
| payout | order ID / order.version | `{simulationAt:ISO,simulatedPaidCents,proofRef:'SIM-PAYOUT-001'}`；提案创建后处理中，批准后模拟已兑付；无支付调用。若模拟误兑付金额不等于应兑金额，保留原记录并产生待人工协议处理差额 |
| refund | order ID / order.version | `{eligibleRefundCents,excludedRefundCents,simulationAt:ISO,proofRef:'SIM-REFUND-001'}`；区分可计佣与已排除部分，避免双扣。补记旧退款不会倒退观察基准；已兑付退款不能回填到兑付之前。已兑付只记需要人工协议处理的非零差额，绝不自动扣款；取消后仍可登记剩余退款但不会复活奖励 |
| correction | order ID / order.version | `{correctedPaidCents,proofRef:'SIM-CORRECTION-001'}`；模拟已兑付记录更正建议，保留原凭证并记待人工协议处理事项，不自动改变原支付 |
| dispute | order ID / order.version | `{decision:'open'|'resolve'|'invalidate'|'cancel',proofRef:'SIM-REVIEW-001'}`；已兑付原记录保持，争议影响资格，不产生自动追索 |
| level | member.userId / member.version | `{level:2|3,simulatedIdentityReviewed:boolean,simulatedServiceReviewed:boolean,simulatedAgreementReviewed:boolean}`；等级2至少3个不同合格合成客户；等级3至少10个且三项模拟审核均为true，无未处理重大违规 |
| violation | member.userId / member.version | `{active:boolean,proofRef:'SIM-COMPLIANCE-001'}`；重大违规标志影响升级 |
| rules | 无 / 当前 rules.version | `{observationDays,attributionDays,monthlyBudgetCents,levels:[{level,bps,capCents,minQualifiedCustomers}...]}`；版本与生效时间记录原因，始终标记未确认示例。修改不追溯提高旧订单奖励 |

状态：提案 pending 为待核验；订单 observing 为待观察、ready 为可兑付、processing 为处理中、simulated_paid 为模拟已兑付，另有 invalid/disputed/cancelled。真实提现、支付、自动转账始终关闭。

初始示例：等级1 500bps/上限10000分，等级2 800bps/上限15000分/3客户，等级3 1000bps/上限20000分/10客户；观察14天、归因30天、月预算1000000分均为未确认演练示例。计佣基础＝付款－运费税费等排除额－可计佣部分退款。20000付款、5000可计佣退款、500bps＝750分。排除部分退款不会再次扣计佣基础。

人数阈值、比例和上限可由双人规则提案配置：一级人数为0，二级人数至少1，三级不低于二级；3人/10人仅为初始示例。金额使用整数分，比例使用整数bps。订单冻结成交时等级与规则，修改不追溯提高旧单。月预算按上海时区的演练兑付月份计算，包含待复核的处理中预留；退款和更正不自动释放已经记录的支付预算。

差额处理本期仅保存 `requires_manual_agreement` 的不可覆盖记录，不支持自动认定协议完成或自动追索。有未处理差额时不能通过普通“解决争议”按钮假装结清。真实协议、身份、税务、支付与真实业务激活仍未实现。

本期不创建匿名确认token。客户同意、拒绝、纠正均由不同staff maker/reviewer录入明确的合成证据；加好友或截图不能替代付款核验。
