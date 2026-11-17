本轮已上线 **家长分享与在线合作首版**（production-20261115.1）：[公开体验](https://mrxu.uk/share/index.html)、[素材审核稿](https://mrxu.uk/share/toolbox.html)、[规则示例](https://mrxu.uk/share/partner.html)、[模拟工作台](https://mrxu.uk/share/workspace.html)、[管理员企业微信资料草稿入口](https://mrxu.uk/share/config.html)。真实客户/资金/带佣活动/企业微信接入尚未启用。保存联系方式不会自动公开或启用。[实际交付与回滚说明](release/REFERRAL-PRODUCTION-REPORT.md)。

# 学习规划 · 网站工程

> 当前整体站点为 `production-20261114.4`：初中更新保留，另增加独立湖北艺考文化课模块。两类题库/成绩/统计不混合。艺考真实数量、审核门禁、测试和回滚见 [艺考正式发布记录](release/ARTS-PRODUCTION-REPORT.md)。

> 最新初中更新为 `production-20261114.3`：317待审逐题复核、3隔离题修订、物理/地理候选、281道非正式练习及受保护自由输入问答。实数、模型真实失败、未完成项与批次回滚见 [本轮发布记录](release/CONTENT-ROUND2-REPORT.md)。

> 当前正式版本为 `production-20261114.2`（2026-11-14）：免登录首页、来源/许可/日志、两卷分层题库与受限DeepTutor教师实验室已上线。最新实数、测试、未完成项和回滚见 [本次正式发布记录](release/CONTENT-RELEASE-REPORT.md)；日志维护见 [公开内容维护](docs/PUBLIC-CONTENT-MAINTENANCE.md)。下方原试用及首发说明仅作历史，不应覆盖最新正式记录或真实账号状态。

> 正式入口已切换至 https://mrxu.uk 。管理员mrxu；首次登录必须改密，之后可在网页更改登录名与密码。最新部署、账号交付、备份恢复、回滚和限制见 [正式部署记录](release/PRODUCTION-DEPLOYMENT.md)。下文保留最初试用交付历史，不再代表当前根域名版本。

> 最新方向（2026-11-14）：目标已改为正式可运营的网站，安卓暂停。下文为既有预览交付记录，不代表正式上线完成。当前线上版本、回滚点、正式部署缺口与新版页面进度以 [正式运营盘点](release/PRODUCTION-READINESS.md) 为准。

实际访问：<https://junior-learning-trial-20261114.wenshu4119.workers.dev>

本目录是网站与安卓发布副本，分支 codex/trial-release。原 junior-learning-platform 与 Antigravity 源文件保持各自工作；原 Codex 继续负责 DeepTutor、AI、隔离题库。第八阶段尚未纳入本版。

## 登录和首次试用

在本机运行 `release/查看试用账号.cmd`，显示 trial-admin、trial-teacher、trial-student、trial-parent 等随机账号。凭据以 Windows 当前用户 DPAPI 加密保存在 `.local/trial-credentials.dpapi`，不放网页或交付包。先在「账号与服务」修改密码。

试用机构没有预置成绩。当前 4 个示例知识点、12 道题均待真人审核；老师实际核对后才可开放筛查。教师和家长仅绑定试用学生 A，B 用于手动隔离检查。自动化测试账号已停用，不能拿其审核结果当教研验收。

## 完成范围

- 学生：概览、筛查、讲解/记背/练习通关包、复测与成长、独立作业、已确认线下记录。
- 教师：授权学生上下文、方案调整与冲突处理、作业布置/提交/部分分批改、家长公开摘要、线下卷面分和独立 0–3 观察、内容审核。
- 家长：成长、作业/线下摘要；新增「家校摘要档案」，只读保存记录，排除作答正文、原图和私密反馈。
- 管理员：账号、启停、师生/亲子关系、审计与授权导出；不默认读取学生成绩。
- 共用：真实服务端会话、账号改密、服务状态、来源说明；保留 25 类 PDF/打印和原有 JSON/CSV。

未开放：班级薄弱点聚合、排课/签到、真实 OCR、DeepTutor/AI 出题。R2 权限拒绝，图片上传在本发布明确不可用，未绕过授权。草稿题库未合入，未伪造教师审核。

## 实际发布结构

Cloudflare 独立 Worker 提供 public 静态资源和受控 API 转发；独立 VPS `/opt/junior-learning-trial` 使用 Node 24.22.1 与 SQLite，监听 127.0.0.1:8791。所有业务源码使用第七阶段快照，密码仍采用原 scrypt 参数。
初始 D1/Worker 方案在真实登录中遇到 Worker 资源上限，已退出业务使用。独立 D1 保留但无当前绑定，不承载试用业务。未升级或购买套餐。
VPS 通过临时 HTTPS Quick Tunnel 连接；后端还强制校验专用随机凭据，直接访问为404。它没有稳定性承诺，重启会换地址。隧道变化后在本目录运行 `node release/refresh-tunnel.mjs`；运行前须保有原本已授权 SSH/Cloudflare 登录。没有新增 DNS、开放公网应用端口或改变现有网站/DeepTutor/代理服务。

## 验证结果

本地 65 项业务安全测试；5 项发布网关边界；教师工作台 122 项、资源边界 10 项、导出边界 10 项；原闭环 16 项、会话 4 项、作业 24 项；新页面 20 项。通用导出 78 项检查通过。线上单独 98 项通过，含真实保存、跨机构/跨学生拒绝、CSRF、角色伪造拒绝、撤权、四角色浏览器和实际 PDF。
本轮 62 份 PDF / 111 页：通用42份74页、教师16份32页、线上4份5页；已检查中文、基础分数/方程、A4、图片（仅本地合成存储）、分页和家长隐私，完成栅格化目检。线上图片功能仍关闭。测试用自动审核与合成评分不是真人审核证据。
真机、模拟器安装、物理打印、系统打印对话框、复杂 LaTeX 未验证；移动测试是 Chromium 390×844 视口。

完整证据在 `test-results/`；最终检查清单见 `release/FINAL-REPORT.md`。

## 回滚与恢复

立即进入维护：`node release/rollback.mjs --maintenance`。
恢复已验证版本：`node release/rollback.mjs --resume`。
两个命令仅切换独立试用 Worker，保留 VPS 数据，已实际演练503→200。
版本标识保存在 `release/deployment.json`。不要回滚到最初的 D1 业务版本，其密码校验存在资源上限问题。

数据备份：`python release/vps-ops.py backup`（需使用已安装 paramiko 的 Python）；在线 SQLite backup 后会按时间戳新建并下载至本机 `.local/backups/`（初始备份为 trial-20261114.sqlite，不会覆盖），受本机 ACL 保护。备份已做完整性检查并复制恢复验证。真实业务开始后应建立经过确认的保留、删除及备份策略。
需要恢复数据库时，先维护网站并停止 **junior-learning-trial.service**，另存当前数据库和 WAL，再使用经核验备份恢复，保持 jltrial 账号600文件权限，启动服务、核验权限和记录，再恢复网关。不得直接覆盖运行中的 SQLite，也不得用旧 D1 替代新业务库。

## 安卓

见 [安卓工程说明](android/README.md)。已准备浏览器 Custom Tab 试用壳、构建/签名校验/安装更新说明，JVM URL策略9项通过。
本机缺 SDK 35、Build Tools、已接受的 SDK 许可和 Gradle；未自行接受协议。**没有生成 APK、没有商店发布、没有真机安装验证。** 用户完成 SDK 安装与许可后可执行 `android/build-trial.ps1`。

参考：[Cloudflare Quick Tunnel 限制](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)、[版本回滚](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)。
