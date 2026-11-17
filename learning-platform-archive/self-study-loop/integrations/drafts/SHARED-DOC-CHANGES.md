# 共有文档/页面交接补丁清单

这里记录网站线程需要合并的内容，不直接覆盖其发布副本或public目录。

## API.md 顶部新增说明

> 第八阶段后端机器契约为1.6.0、54路径，新增8个路径，见STAGE8-AI-DRAFTS和draft-api-contract.json。原学习/作业/权限协议保持。新增候选资料和题目由老师本人私有管理；accepted_isolated仍未发布到正式题库。真实模型与RAG未接通，生成默认unavailable。网站入口是否已接入应以发布副本实际验收为准。

## EXPORT-INVENTORY.md 新登记

| kind | 内容与读取 | 权限/状态 |
|---|---|---|
| draft-sources | /draft-exports?kind=draft-sources | 仅本人老师资料清单，无数据禁印 |
| draft-source | /draft-exports?kind=draft-source&id=... | 原文、来源声明、版本与digest |
| question-drafts | /draft-exports?kind=question-drafts | 本人候选批次与生成状态；失败不冒充题目 |
| question-draft | /draft-exports?kind=question-draft&id=... | 所有保存题目版本、候选答案/解析、引用及账号复核记录，始终未发布 |

合入这四项后共29类；主项目public目前仍25类，不能只改文档数字。保存页和列表均须有可见PDF/打印，并保留JSON/CSV入口。format=json返回records；format=csv下载当前明细；默认document是统一print.js可渲染的blocks。

## VERIFICATION.md 新增后端条目

引用STAGE8-AI-DRAFTS中的83项Node、6项本地D1、102项隔离打印加载器和12份/16页PDF。明确区分：后端/加载器已验收、真实模型生成未跑、网站页面未由本线程集成。不得把已有模型替身测试数写成准确率，也不能把移植前的PDF文件当作最终部署页面已通过。

## 页面实际接入需要保留

- 登录会话/身份代次；相同学生的其他老师也不能读本人私有草稿。
- 来源许可是提交者声明，非平台认证；自动结构/引用检查非真人审核。
- 逐题复核checks及10字以上说明、明确confirmed；修改回到待审，历史不覆盖。
- 201生成请求必须检查status；失败/不可用明确提示，生成中不发新请求自动重试。
- 生成按钮按draft-provider.available与真实配置显示；不要调用VPS上不存在的junior-candidates-v1桥接。
- 新加载器完成读取后再次核验会话，旧账号已授权但迟到的响应也不能进入新账号预览。

原型共有54→108题为并行成果，全部保留。只读导入实验明确选择Batch1/2共54题；额外54题未被声明已验证或已入库。
