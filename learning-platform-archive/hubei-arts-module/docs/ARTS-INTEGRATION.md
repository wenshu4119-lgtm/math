# 艺考模块增量合入说明

本目录是隔离快照，不可整目录部署。生产所有者先完成正在进行的题库/DeepTutor更新，然后基于最新release应用本清单。公共入口与私有路由应同批发布，避免页面指向不存在的API。

## 新增文件

- `public/arts/*`：全部可公开静态代码（只含独立本地演示题）。
- `data/arts-content.json`、`data/arts-policy-evidence.json`：仅服务端。
- `src/arts.mjs`、`src/arts-domain.mjs`：独立路由与校验。
- `migrations/0020_arts.sql`：只追加arts表。
- `tests/arts*.test.mjs`、`scripts/arts-ui-test.mjs`：验证。
- `docs/ARTS-*`、`release/arts-manifest.json`：交付记录。

## 三处API增量（人工比对最新版本）

在`src/api.mjs`导入：
```js
import {artsRoutes,publicArtsCatalog} from './arts.mjs';
```
在既有public分支旁加入：
```js
else if(path==='/public/arts/catalog' && request.method==='GET') result={data:publicArtsCatalog()};
```
在认证后的路由链加入（保留最新其他分支）：
```js
|| await artsRoutes(request,env,path,user,url)
```

## 并列入口与缓存

在最新`public/index.html`桌面和手机导航添加“艺考文化课”，链接`/arts/index.html`；在首屏下方增加两个并列学段卡：“初中学习”链接`/platform.html`，“湖北艺考文化课冲刺”链接`/arts/index.html`。说明独立题库和记录，共享已有账号。

在最新`public/app.js`非管理员导航追加`/arts/workspace.html`，文案“艺考文化课 · 独立工作台”；保留初中现有学习、题库、DeepTutor入口。登录后可通过该入口回到艺考，不增加第二套认证。

`sw.js`沿用当前公共壳白名单，增新版本标识以刷新首页/导航；不加入arts API、学生数据、题目快照或打印内容。艺考页面本身不注册额外Service Worker。

## 发布及回滚

1. 校验`release/arts-manifest.json`的文件hash；共同文件仅用上述挂载点人工增量合并，不复制本目录api/index/app/sw。
2. 保存生产Worker版本和后端目录；运行现有生产备份与隔离恢复验证，不新增费用或更改代理/DeepTutor配置。
3. 在恢复副本通过现有迁移登记程序连续调用两次，第二次应跳过已登记的`0020_arts.sql`，核对旧表行数；不要重复执行裸SQL。正式迁移使用同一登记机制追加一次。
4. 后端产物必须包含`data/arts-content.json`，因为Node直接导入该文件。只public目录上传静态资产。
5. 跑业务测试与艺考浏览器验收；检查匿名catalog无题干答案，私有API401；审核初始0；原有健康/初中/DeepTutor回归正常。
6. 发布后保留静态路径、Worker ID、后端release名、迁移和备份标识；不自动执行任何生产教师审核。
7. 回滚代码/Worker到已记录版本即可撤去新入口与路由。保留arts表，避免删除已经产生的艺考学习证据；需要恢复数据库时依据维护窗口和现有备份程序执行，不以旧全库覆盖后续真实写入。

未完成生产发布前不能称模块已经上线。教师测试审核只发生在隔离内存数据库，不能把测试通过写成生产“老师已审核”。
