# 企业微信联系配置草稿接口

本模块服务于面向全国初高中学生的线上工具测评、任务定制项目。实际业务是否属于培训，须根据交付内容、教学互动、对象、收费等实质判断；线上形式或“工具”名称不自动豁免监管。武汉线下收费规则仅是研究背景，不能直接套用本项目线上价格。

仅提供现有管理员在本机构内保存和核对联系资料的入口。本次没有企业微信API连接、客户同步、自动归因、公开咨询或支付；配置保存后仍是 `draft_pending_review`。没有资料时显示 `not_configured`，不能用合成企业账号、示例链接或测试PNG冒充真实配置。

## 挂载契约

`src/referral-contact.mjs` 导出：

```js
import {referralContactRoutes,publicReferralContactStatus} from './referral-contact.mjs';
// 公开分支，在 authenticate 之前；函数不读取任何机构配置或环境开关。
// GET /api/v1/public/referral/contact-status
result={data:publicReferralContactStatus()};

// 私有分支，在现有 authenticate / checkOrigin / CSRF / rateLimit 之后。
result=await referralContactRoutes(request,env,path,user,url);
```

保持现有API响应封装 `{data: ...}` / `{error: ...}`、通用安全头、错误映射。此模块没有修改共同API文件。`user` 必须来自现有服务器会话验证，不得来自客户端字段。其 `id/org_id/token_hash` 会在最后一条SQL再次联合核对角色、机构、状态、改密要求和有效会话。写入语句也包含同一个执行时守卫；版本和审计在同一数据库批事务内条件写入。

| 方法 | 路径（均在 `/api/v1` 下） | 权限 / 行为 |
|---|---|---|
| GET | `/public/referral/contact-status` | 固定关闭，匿名可读，永不返回配置 |
| GET | `/referral/contact-config` | 仅本机构admin；读取当前草稿及最近100条版本摘要 |
| POST | `/referral/contact-config` | 仅本机构admin；创建唯一草稿；已有草稿409 |
| PATCH | `/referral/contact-config` | 仅本机构admin；必须expectedVersion及修改原因 |
| GET | `/referral/contact-config/qr.png?v=1` | 仅本机构admin；图片不存在404，版本不符409 |
| GET | `/referral/contact-config/print` | 仅本机构admin；当前配置打印元数据，不含base64 |

没有 `/publish`、`/live` 或删除接口。未知开启字段不能通过请求或环境变量启用真实能力。所有私有成功响应含 `Cache-Control: no-store`、`X-Actor-Id` 和现有安全头。公开分支同样应继承现有 `no-store`。

## 请求字段

创建请求为 `application/json`：

```json
{
  "enterpriseDisplayName": "管理员填写的真实企业显示名称",
  "officialContactUrl": null,
  "qrPngBase64": null,
  "description": "管理员说明，禁止填密钥或客户个人资料",
  "manualChecks": ["核对本机构官方生成记录"],
  "reason": "保存或修订原因，至少3个字符"
}
```

上面的null仅说明字段格式，不是可提交的完成配置。实际保存必须提供官方链接或本机构真实PNG至少一项。没有资料时保留未配置状态，页面可先展示填写入口。

PATCH支持上述字段的局部更新，另须整数 `expectedVersion`；`reason` 每次必填。`officialContactUrl:null`、`qrPngBase64:null` 分别清除该项，但不能同时清空全部联系方式。未传PNG保留原图。禁止传 `orgId/org_id`、`actorId`、`state`、`live`、`publish`、任何secret或支付字段；未列字段直接400。

| 字段 | 限制 |
|---|---|
| enterpriseDisplayName | 1–100字符，真实显示名称；不接收CorpID、CorpSecret |
| officialContactUrl | null或不超过2048字符的完整官方HTTPS链接 |
| qrPngBase64 | null或PNG文件原字节的标准base64，禁止data URL前缀 |
| description | 0–2000字符 |
| manualChecks | 最多20条，每条1–300字符；待办不是已审核证据 |
| reason | 3–1000字符；历史记录保存 |

普通文字字段还拒绝常见密钥标签及PEM私钥标记。系统无法判断任意无标签文本是否是秘密；入口应明确禁止粘贴密钥。图片不会进行OCR或扫码，也不能保证用户上传内容不含不适当信息，管理员须在草稿核对。

## 官方链接范围与图片校验

目前仅接受精确host `work.weixin.qq.com`（不接受用户密码、端口、片段或子域通配）：

- `/ca/{单段字母数字下划线或连字符ID}`，只接受可选 `customer_channel`，解码后不超过64 UTF-8字节。依据：[获客链接管理](https://developer.work.weixin.qq.com/document/path/97297)，本次核得更新时间2025-11-17。
- `/kf/{单段ID}`，只接受可选 `enc_scene` 和 `scene_param`，后者解码后不超过128 UTF-8字节。依据：[获取客服账号链接](https://developer.work.weixin.qq.com/document/path/94665)，本次核得更新时间2026-10-14。

不放行整个qq.com、`/kfid/`、任意路径、重复参数、任意跳转参数。保存原链接，不重写签名，不联网检查或跟随跳转。允许格式不代表验证了机构归属、链接有效或平台许可。

PNG限制为256KiB（262144字节）；宽高各64–2048像素。校验签名、IHDR长度及参数、数据块长度和CRC、图像数据及IEND完整性、不得追加尾部内容。校验范围是文件结构；不对压缩图像像素做完整解码，不解读二维码、不认证、不检查扫码落地页。文件存在独立SQL草稿及版本表，完全不使用PAPERS，避免现有孤儿文件清理误删。

## 返回值

公开状态始终为：

```json
{
  "state": "preparing",
  "label": "咨询方式准备中",
  "apiConnected": false,
  "automaticAttribution": false,
  "publicConsultationEnabled": false,
  "liveIntegrationEnabled": false
}
```

私有草稿包含 `id/version/state/enterpriseDisplayName/officialContactUrl/description/manualChecks/reason/hasQr/createdAt/updatedAt/history`，以及上述四个固定false能力字段。`futureNeeds` 是人工核验清单；`allowedContactLinks` 是官方域名和来源说明。元数据不含PNG base64；有图时 `qr={width,height,bytes,previewUrl}`，预览地址固定为本机构权限端点并带当前版本。

未配置时：`id:null,version:0,state:'not_configured',hasQr:false,qr:null`，不虚构账号或联系方式。打印端点增加 `print={label,scope,generatedAt}`；它不是公开PDF链接，也不证明启用。前端打印前必须重新请求此接口，核对响应身份，未授权时清除旧DOM并默认禁止直接打印。二维码建议通过当前会话fetch、核对X-Actor-Id后生成短期blob预览，退出/切账号/离开页面时撤销。

错误使用现有ApiError：未登录401、角色不允许403、无图或无草稿404、版本/末时权限变化409、格式/未知字段400、请求超400KiB返回413、非JSON415。最终撤权错误码为 `ACCESS_OR_VERSION_CHANGED`；前端应清空所有旧私有数据。

## 数据、版本与验收

迁移 `0031_referral_contact.sql` 只新增 `referral_contact_drafts` 和 `referral_contact_draft_versions`。每机构一份当前草稿；每次修订保留精确payload（含私有PNG）、版本、原因和操作者。审计动作是 `referral_contact_draft_created` / `referral_contact_draft_updated`，失败守卫不产生成功审计。没有真实默认记录、密钥字段或公开配置查询。

运行 `node --test tests/referral-contact.test.mjs`：13项测试通过，包含15种最终读取SQL执行前撤权变体、最终写入撤权、并发版本冲突、跨机构隔离、非admin/匿名拒绝、链接和PNG边界、密钥/发布字段拒绝、私有图片及打印元数据。测试只使用内存数据库和合成图片，未实测真实企业微信、真实二维码或用户资料。

完整政策研究保存在 `C:/Users/Administrator/Desktop/cloudflare-deploy/research/referral-policy-20261115.json` 与同名Markdown；已按“全国线上工具测评和任务定制”澄清更新，不作整体合规或微信零钱到账承诺。
