# 2026-11-14 发布分工和初始盘点

用户授权独立网站试用及安卓构建；真机和物理打印暂缓，权限、隔离、回滚必须验证。

- 原 Codex：主工程的 DeepTutor、AI、隔离草稿后端和迁移。其确认第七阶段可快照，第八阶段未完成，不纳入本发布。
- 本工作：本目录 public、release、android、发布配置与集成测试。主工程和 Antigravity 原文件不写。
- 原项目全部未提交，无 remote。122 个来源文件已经复制并形成 release/upstream-snapshot.json；发布副本另有独立 Git 提交，可回滚。
- Antigravity 在旧 math 仓库内的 platform-ui 独立目录；其最新 HANDOFF 已读。采用视觉、工作分组和家长档案思路，不复制默认满分批改、Mock 或草稿题库。
- 旧 math：cloudflare-deploy，main，GitHub wenshu4119-lgtm/math，起始 HEAD e56614db680fa83ac68210bec69f8d164e7c8fd0。旧 tracked diff 为空，platform-ui 未跟踪。禁止触发其 pre-push 自动部署。
- 旧线上 Worker muddy-wildflower-44b9 / mrxu.uk；本发布不用该名称、域名、路由或资源。
- Cloudflare 现有 OAuth 有 Workers/D1 权限。原账号无 D1/Pages；R2 列举 HTTP403，未尝试启用或购买。新发布明确关闭图片上传。
- 安卓：未发现已有平台工程、APK、发布签名、SDK 或商店配置；JetBrains JBR 提供 Java。不会接受 SDK 协议或宣称上架。
- 新试用计划：junior-learning-trial-20261114 Worker + 新独立 D1；专用维护版本作为撤回目标。不改生产数据，不配置自定义域名。后台只开放已验证 API，AI/OCR 关闭。

所有凭据仅留本机私密目录或现有系统凭据库，不提交、不打包到 public、不打印到日志。
