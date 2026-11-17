# 学习规划：正式域名部署记录

> 后续版本 `production-20261114.2` 已于北京时间2026-11-14 20:03:38发布。当前后端、题库/审核实数、DeepTutor受限范围、公开来源与日志、备份及回滚请以 [本次发布记录](CONTENT-RELEASE-REPORT.md) 和 `content-release.json` 为准。本文下面保留首发历史。

日期：2026-11-14。入口：https://mrxu.uk 。运营名称：学习规划。隐私／删除请求邮箱：wangwenshu4119@gmail.com。

## 实际部署

- 独立Worker：learning-platform-production；根域精确路由mrxu.uk/*进入新平台。旧自定义域名绑定、证书和muddy-wildflower-44b9保持原样；移除本平台路由即可恢复旧站。
- 独立正式后端：/opt/learning-platform/current → releases/20261114-1；Node24，低权限learningapp用户，127.0.0.1:8792；正式库/图片在/var/lib/learning-platform/data，不使用旧math或试用数据。
- 持久Cloudflare命名隧道learning-production，独立learningtunnel账号、systemd自启。内部域名为用户实际添加的earning-origin.mrxu.uk；其拼写缺少原建议开头的l，部署配置已经对齐。它是受专用凭据保护的后端，未授权直连404。正式网站不依赖trycloudflare临时地址。
- 所有新服务与旧网站、试用、DeepTutor和代理目录/端口分开；没有新增付费或新外部账号。
- 第一次直接覆盖自定义域绑定被Cloudflare409拒绝，最终采用官方支持的Worker路由优先级。组合切换也曾被自动审批拦截；用户明确确认替换根入口、保留旧站后执行成功，没有绕过审批。

## 正式管理员

正式库仅初始化管理员mrxu，别名mrxu；没有QA账号、试用账号、学生成绩或自动化审核。4知识点12题仍待真实教师核验。
本机运行release/查看正式管理员账号.cmd读取随机初始密码。私密信息以Windows当前用户DPAPI保护，未写入网页、Git或聊天。
首次登录必须改密，服务器会拒绝其他业务接口。初始化后“账号与服务”支持修改登录名和密码，均需当前密码；成功后撤销所有会话。邮箱找回未配置，管理员失去凭据须走经核验的人工运维恢复，不存在公开无验证重置入口。

## 上传与导出

已按哈希合入upload-auth-20261114.1，正式服务使用私密磁盘适配器。POST/GET/PATCH在最终提交或发送前复核权限；DELETE以原子墓碑为授权提交点，失败保留不可访问状态并重试清理。
每5分钟执行私有维护：25条墓碑、200个文件的轮转扫描、到期图片及至少24小时后的孤儿清理。活动引用不删。失败只记录脱敏计数；不存在公开清理路由。
29类PDF/打印及原有JSON/CSV保留。教师候选题即使复核接受仍隔离，未发布到学生题库。网站未接通自动OCR、AI出题或AI判分。

## 备份、恢复与监测

- 每日北京时间04:00由systemd执行完整加密备份；备份期间短暂停止本平台后台写入，完成或失败后恢复服务。使用SQLite正式backup API和同一停写窗口中的私密图片。
- AES-256-GCM加密、RSA-OAEP封装随机数据密钥；服务器仅持公钥。默认30天保守轮换。每个包都附带摘要及创建时完整校验receipt。
- 正式Linux实际备份已下载到Windows并解密验证，再用恢复副本启动隔离服务验证health200；生产数据库未被恢复演练覆盖。
- 每5分钟检查受保护后端、持久源站HTTPS和备份时效，失败记录到systemd/journal。没有配置邮件/短信外部告警。
- 备份加密包已异地下载到本机；后续自动异地传送尚未配置，需定期执行 `python release/production-ops.py fetch-backups`。电脑上的副本不应被当作持续在线云备份。
- 恢复私钥保存在本机DPAPI；额外生成了output/learning-planning-backup-recovery-key-encrypted.pem。请将加密密钥与通过release/查看备份恢复口令.cmd获取的口令分开离线保存。不要将口令、私钥或初始密码发进聊天。

备份CLI最初通过current符号链接启动时未触发main，虽exit0却无产物；该问题已修复。协调器现在必须检查实际包、receipt和SHA256，不能只看退出码。修复后11项测试及真实Linux加密/恢复通过，先前误报已被后续真实结果替代。

## 回滚

在本发布目录运行：

```powershell
# 暂停学习网站，保留数据
node release/production-maintenance.mjs --on
# 恢复已验收学习网站版本
node release/production-maintenance.mjs --off
# 根域恢复旧math站，保留学习库及新Worker
node release/root-domain-switch.mjs --restore-old
# 重新让根域进入学习规划
node release/root-domain-switch.mjs --switch
```

旧站恢复已经实际演练，并与切换前/app.js SHA256相同，随后已切回新站。根路由、Worker版本、后端/数据库恢复是不同操作，不能把网关切换说成数据库恢复。
后端今后更新应新增release目录、先应用兼容迁移并保留快照再切current；正式账号要求首次改密，不能回到忽略该标志的旧后端。严重故障优先维护模式。数据恢复必须停止写入并同时恢复SQLite/图片集合，不覆盖运行中的WAL。
CloudflareOAuth可能过期，运行运维命令前可执行已安装Wrangler的whoami刷新现有登录；不得通过修改权限或替换未知凭据绕过失败。

## 验证与限制

- 151项核心/网关/存储/账号/备份回归通过；备份CLI修复后的专项11项再次通过。
- 真实Linux低权限磁盘上传/撤权/清理25项通过；管理员网页36项、教师资料候选66项、家长观察44项及页面修复18项在合成隔离环境通过。
- 正式预发布和mrxu.uk各18项真实入口检查通过：正式管理员登录、首次改密门禁、旧会话失效、私密路径404、桌面/手机视口，无改动实际管理员密码或业务数据。
- 真机、物理打印仍未测，移动仅浏览器视口。大规模容量、完整课程、全量分页导出、课堂排课/签到、自动监护关系验证和自助邮件找回未完成。现有列表有100/200/500等上限，不能宣称无限规模或全量导出。
- 首发为管理员邀请制；监护/师生关系由运营方核验，删除申请走隐私邮箱人工处理。图片清理不等于抹除所有文字/评分/审计；备份中的删除与教学记录保留需按运营规则处理。

机器证据：production-deployment.json、production-server-preparation.json、production-backup-verification.json、production-restore-rehearsal.json、root-rollback-rehearsal.json、production-operations-status.json及test-results/production-live/。
