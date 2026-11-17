# 原型并行更新记录

第六阶段（2026-11-14）有新的保存基线与并行修改，不能仅使用下方第二阶段9/12结论。当前阶段基线包含13个文件；收尾检测HANDOFF-TO-CODEX.md、index.html、js/app.js、mock/mockData.js、services/dataService.js共5文件变化，旧math tracked diff和HEAD未变。原型代码、数据和交接更新全部保留，不覆盖、不重置。当前app.js 161793字节，交接文件17203字节，最后只读核对交接修改时间12:01:27。证据为test-results/stage6/preservation-baseline.json与preservation-result.json；接口差异见ANTIGRAVITY-HANDOFF-ALIGNMENT。

2026-11-13收尾只读核对发现：初始清单12文件中9个SHA256一致，3个在开发期间变化。本任务未写入旧math/platform-ui；没有用起始副本覆盖这些新成果。无法仅凭文件信息判断具体修改者，因此不把变更归因于某个工具。

| 文件 | 起始SHA256 | 收尾SHA256 | 文件修改时间（Asia/Shanghai） |
|---|---|---|---|
| js/app.js | ec90113d14adbff6b6e60b965789bdb007a12ea310e0c854e022dcc98cead115 | 76010b1acae4411834bd575bb6c1b749a483da0c86c5e7b3c90057dfe27b6331 | 20:16:03 |
| styles/components.css | 5249ae44afe518211edfbbfc0ad2c0d1d1bd620276d93415582c9e8e69947581 | e35b233d3e8986d5d2925be18d65397dbe9013fa3818df213c2b1ebe4486cf7e | 20:14:06 |
| styles/layout.css | dd7414ebbe5cd21b260e78fad662ab831c5e514d590b03d9e30bb03f7c90d528 | 23f64dd944ba2d7366a850f173c5f3da037c843a1f9e5bf3ca9c2bc275069c70 | 20:14:04 |

只读差异核查：layout新增A4打印、保留权限提示、图片和Canvas快照规则；components调整review-grid和question-block；当前app.js增加打印前图表快照/标题权限提示/更多打印入口等，仍引用MockData、DataService，没有真实fetch登录/资源权限。初始“7处window.print场景”是起始版本结论，不能当成此后原型的固定能力清单。

独立平台继续保留已经验证的起始3份CSS，未静默同步这些并行修改。新平台对应能力由独立的授权print.html/print.css与paper-workspace实现，覆盖18类真实保存内容；不会把原型新增Mock/前端角色逻辑搬入live入口。需要后续合并视觉改动时，可对照此记录逐项选择。

`node scripts/preserve-check.mjs`输出完整差异到test-results/prototype-preservation.json；存在并行变化时故意非零退出，不把它伪装成12/12未变化。旧math已跟踪文件diff仍为空；独立平台整合的CSS仍与起始锁定版本一致。

2026-11-14第四阶段再次只读核对：app.js、components.css与上表收尾哈希相同；layout.css又有并行更新，当前13284字节，修改时间2026-11-13 22:31:47，SHA256为`46dcd8d30ad0d62e19b7b0713a201d1d9f887dae896986a5ba4480f89ae0ee74`。保留该新版本，没有覆盖或静默同步到live。检查仍为9/12与起始一致、退出2；独立平台已扩展到25类导出，上述18类是第二阶段时点。
