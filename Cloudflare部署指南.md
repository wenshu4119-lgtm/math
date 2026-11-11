# 初中全科能力筛查系统 · 部署与维护指南

> 适用对象：没有开发基础的个人教师 / 工作室。纯静态站点，无服务器、无数据库、免费。
> 最后更新：2026-11-11

---

## 一、当前状态（已上线，不必重做）

| 项目 | 值 |
|---|---|
| 正式网址 | **https://mrxu.uk** |
| 域名注册商 / DNS | Cloudflare（域名 `mrxu.uk`） |
| 部署平台 | Cloudflare Workers / Pages，项目名 `muddy-wildflower-44b9` |
| Cloudflare 账户 ID | `e790168a5525cfa3180de7a2aea228ab` |
| 代码仓库 | `https://github.com/wenshu4119-lgtm/math`（main 分支） |
| 部署方式 | 静态文件上传；后续改为推送 GitHub 即自动上线 |
| 工作室信息 | 许老师工作室 / 18986280310 / 微信同号 |

站点运行文件：`index.html`、`app.js`、`style.css`、`chart.min.js`，外加 `favicon.svg` / `favicon.ico` 两个图标文件。图表库已本地化，不依赖任何外部 CDN。

---

## 二、⚠️ 唯一数据源：`index.html` 里的 `SYS_CONFIG`

**这是本指南最容易被搞错的一点。**

系统运行时只读取 `index.html` 中 `window.SYS_CONFIG =` 开头的那一行（用 `Ctrl + F` 搜 `SYS_CONFIG` 即可定位），**不读取任何 JSON 文件**。
早期版本里有一个 `config.json`，它从未被代码加载，已于 2026-11-11 删除。今后不要再创建或编辑 `config.json`——改了不会生效。

所有内容（工作室信息、科目、年级、模块、知识点、预设场景、报告文案）都在这一个 JSON 块里。

### 改工作室信息（换电话、换微信号、换地址）

1. 用**记事本**打开 `index.html`
2. 按 `Ctrl + F`，搜索 `许老师工作室`（或直接搜 `"studio"`）
3. 你会看到这样一段（整段都在同一行）：

   ```json
   "studio":{"name":"许老师工作室","phone":"18986280310","wechat":"微信同号","address":"江岸区百步亭花园路现代城一区"}
   ```

4. **只替换引号里面的文字**，不要删引号、不要动冒号和逗号、不要换行
5. 保存，按第三节本地预览确认报告页底部显示正确

> 报告页、首页页脚、分享文案全部从这里取值，改一处即可全站生效。

### 加新模块 / 新知识点

在同一个 `SYS_CONFIG` 里找到 `"modules"`，按三级结构追加：模块 → 章节 → 知识点。

```json
"8shang": {
  "name": "八上·数学",
  "grade": "8",
  "children": {
    "sanjiaoxing": {
      "name": "三角形",
      "kps": {
        "biansan": "三角形三边关系",
        "neijiao": "三角形内角和"
      }
    }
  }
}
```

### 加一个新预设场景

在 `SYS_CONFIG` 末尾的 `"presets"` 数组里加一条：

```json
{"key":"8xiaqimo","label":"初二期末（数学）","subject":"math",
 "modules":["8shang","8xia"],"tip":"八年级全年数学内容"}
```

全科预设用 `"subject":"all"`，并把 `modules` 写成对象：

```json
"modules": {"math":["7shang","7xia"],"physics":["8shang"],"chem":["9shang"]}
```

> 这一行很长，记事本容易看花眼。建议先 `Ctrl + F` 定位到关键词，再只改那一小段。改错标点会导致整页空白，改前先复制一份 `index.html` 备份。

---

## 三、本地预览（改完必做）

**不要双击 `index.html`。** 浏览器会禁止 `file://` 协议下的部分脚本行为。

- **Windows**：双击 `start_local.bat`，自动打开 `http://localhost:8000`
- **Mac / 命令行**：在本目录执行 `python3 -m http.server 8000`

走一遍流程确认：选场景 → 确认范围 → 填几个分数 → 生成报告 → 看报告底部的工作室信息。

---

## 四、更新上线

### 方式 A：推送即上线（推荐，配置一次即可）

代码已纳入 Git，并已启用**本机推送钩子**：执行 `git push` 时会自动运行 `npx wrangler deploy`，把最新文件发布到正式域名。

```
本地改文件 → git add . → git commit -m "改了什么" → git push
                                    ↓
                        pre-push 钩子自动部署
                                    ↓
                        https://mrxu.uk 自动更新
```

已于 2026-11-11 端到端验证：推送后线上首页 SHA-256 与本地一致。网址**不会变**，家长手上的旧二维码继续有效。

钩子文件是仓库里的 `.githooks/pre-push`，通过 `git config core.hooksPath .githooks` 启用。它依赖本机 Wrangler 登录态；换电脑后需重新执行 `npx wrangler login`，并再运行一次上述 `git config`。若推送时看到 `[auto-deploy] 部署失败`，说明登录态过期，重新登录后再推送一次即可。

> 若以后改为下方「方式 C」的云端 Workers Builds，建议先停用本机钩子（`git config --unset core.hooksPath`），避免同一次推送部署两遍。

### 方式 C：Cloudflare 云端 Workers Builds（可选）

希望不依赖本机、由 Cloudflare 直接在云端构建时，可在已登录的 Cloudflare 控制台连接仓库。

配置步骤（只需做一次，全部在控制台点选，约 1 分钟）：

1. 打开 **Workers 和 Pages** → 项目 `muddy-wildflower-44b9`
   直达链接：`https://dash.cloudflare.com/e790168a5525cfa3180de7a2aea228ab/workers/services/view/muddy-wildflower-44b9/production/settings#builds`
2. 进入 **Settings → Builds** → 点 **Connect**（连接）
3. 选择 GitHub 账户 `wenshu4119-lgtm` 与仓库 `math`，生产分支 `main`
4. 构建命令留空（纯静态，无需构建）；部署命令使用 `npx wrangler deploy`
5. 保存后，往 `main` 推一次代码验证自动部署

> ⚠️ 仓库中 `wrangler.jsonc` 的 `name` 必须保持 `muddy-wildflower-44b9`，与控制台项目名一致，否则构建会失败且域名绑定会失效。
> Cloudflare 的 GitHub App 已安装（installation 180801883），无需重新安装。

### 方式 B：手动直接上传（备用）

若自动部署暂未接通，沿用原来的方式：

1. Cloudflare 控制台 → **Workers 和 Pages** → 项目 `muddy-wildflower-44b9` → **Deployments**
2. 点 **Upload assets**，选中**整个 `cloudflare-deploy` 文件夹**（不是 ZIP、不是单个文件）
3. 等 10～30 秒出现 `Success`，刷新 https://mrxu.uk

> 浏览器拖拽不支持 ZIP 压缩包，传压缩包会失败。

---

## 五、上线验收清单

| # | 操作 | 期望结果 |
|---|---|---|
| 1 | 打开 https://mrxu.uk | 首页标题 + 8 个预设卡片 |
| 2 | 点「武汉中考（数理化全科）」 | 范围确认页显示数学 6 模块 + 物理 + 化学 |
| 3 | 点「确认，开始填分」 | 填分页出现分组题目，题量不超过 60 |
| 4 | 给几题打分 | 顶部进度条与分数同步更新 |
| 5 | 点「生成报告」 | 雷达图、条形图、薄弱清单正常 |
| 6 | 看报告底部 | 显示你的工作室名、电话、微信、地址 |
| 7 | 手机 / 微信内打开同一链接 | 320px 窄屏自适应，流程可完整走完 |

**7 项全通过，才可以用于推广。**

---

## 六、常见问题

**Q1：页面打开是空白？**
→ 多半是 `SYS_CONFIG` 的 JSON 被改坏了（中文引号、多余逗号、漏引号）。按 F12 看 Console 报错；用备份的 `index.html` 恢复后重改。

**Q2：改了电话但网站没变化？**
→ 先确认你改的是 `index.html` 里的 `SYS_CONFIG`，不是 `config.json`；再确认改动已经**部署上线**（推了 GitHub 或重传了文件夹）。Cloudflare 有缓存，可等 1～2 分钟或强制刷新。

**Q3：拖拽上传一直失败？**
→ 确认拖的是整个文件夹，且 `index.html` 在根目录（没有套一层子文件夹）。

**Q4：二维码扫出来 404？**
→ 同上，检查上传目录结构。

**Q5：手机上第一次打开有点慢？**
→ 图表库约 200KB，首次 2～3 秒，之后浏览器会缓存，属正常。

**Q6：自动部署没触发？**
→ 确认推送的是 `main` 分支；到 Cloudflare 项目 **Deployments** 看最新一条构建的状态与日志。

---

## 七、二维码与推广

拿到 https://mrxu.uk 后，用 **https://cli.im/**（草料二维码）生成 PNG，贴到易错点手册、试卷诊断表、海报、签到台立牌。

| 时间 | 动作 | 渠道 |
|---|---|---|
| 上线当天 | 发朋友圈「免费测孩子数学真实薄弱模块，2 分钟出报告」+ 二维码 | 朋友圈、家长群 |
| 第 3 天 | 私聊 10 位老家长 | 一对一 |
| 第 7 天 | 打印物料，家长会现场 iPad 展示报告 | 线下 |
| 持续 | 每次大考后更新预设，再发一波 | 全渠道 |

---

## 八、目录说明

| 文件 | 作用 | 是否可自行修改 |
|---|---|---|
| `index.html` | 页面结构 + **全部内容配置 `SYS_CONFIG`** | ✅ 改引号内文字 |
| `app.js` | 页面逻辑、出题、算分、画报告 | ⚠️ 需开发能力 |
| `style.css` | 样式 | ⚠️ 需开发能力 |
| `chart.min.js` | 图表库（离线版） | ❌ 不要动 |
| `wrangler.jsonc` | Cloudflare 自动部署配置 | ❌ 不要动 |
| `start_local.bat` | 一键本地预览 | ❌ 不要动 |
| `Cloudflare部署指南.md` | 本文件 | ✅ |
| `.gitignore` | 排除不应入库的文件 | ❌ |

---

**一句话：改内容只动 `index.html` 里的 `SYS_CONFIG`；本地预览确认；推 GitHub 即上线；网址永远是 https://mrxu.uk。**
