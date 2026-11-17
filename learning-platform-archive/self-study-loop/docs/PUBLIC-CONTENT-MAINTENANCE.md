# 公开首页、来源与更新日志维护

正式页面为 `/`、`/sources.html`、`/licenses.html`、`/changelog.html`、`/public-examples.html`。桌面及手机主导航和首页正文提供来源与日志入口，登录工作台独立在 `/platform.html`。

## 唯一日志数据

只维护 `public/changelog.json`；首页摘要和完整日志均由 `public/public-info.js`读取同一文件。`published`表示已正式上线，必须有经部署记录核实的ISO时间；`development`表示正在开发，`planned`表示计划中，后二者的`publishedAt`必须为null。正式记录按上线时间倒序，未排期计划放后面。浏览器统一显示北京时间。

本次`production-20261114.2`首次上线时间取Cloudflare真实部署记录，不取本地完成时间。维护顺序：先以development准备条目；完成自动化/权限/浏览器/备份恢复后发布；核验真实域名和部署ID；再将该条目标为published并记录实际首次上线时间。若发布失败，保持development并注明实际限制。只更新日志时也须发布静态资产并从正式域名回读。

题量与审核数由`/api/v1/public/coverage`按数据库聚合。不要写静态估算或把全站去重审核量误作每个机构的授权。日志中的数量是明确时间点的部署快照，最新数字始终以公开API为准。AI实时状态由`/api/v1/public/ai-status`提供，状态页不触发模型。

## 来源与许可

`sources.html`区分AI辅助开发、实际复用、架构参考和独立AI服务。`licenses.html`与`public/licenses/`保留已核对的许可原文、NOTICE和脱敏组件清单。新增代码、模型、图像、教材或依赖时，先记录实际版本、来源、使用方式和许可；不能将某个依赖许可指定给全项目。私人授权材料、服务配置和账号资料不进入public。

thewyj.uk所有者允许使用的背景已披露，商业使用、再分发及第三方素材范围仍待确认。DeepTutor当前仅固定原创样例实验；扩大到自由输入或PDF解析前，应重新核查数据授权、服务隔离、拒答/答案回归和对应依赖许可。

## 验证入口

- `node --test tests/homepage-public.test.mjs tests/public-information.test.mjs`
- `node tests/homepage-browser.mjs`、`node tests/public-information-browser.mjs`
- `node tests/public-live-data-integration.mjs`使用隔离真实API与合成账号。
- `node tests/live-public-anonymous.mjs`只读检查正式公开页面、聚合数字、匿名权限和缓存；不使用真实账号登录。
- `node tests/homepage-pdf.mjs`检查公开合成样例；业务题库导出另用受保护的题库浏览器测试。

`public/sw.js`只缓存白名单公开壳，不缓存API、日志数据、题目答案、私有图片或打印文档。添加页面不得扩大为通配缓存。真机和物理打印本次按要求跳过，浏览器视口与PDF渲染不能替代它们。
