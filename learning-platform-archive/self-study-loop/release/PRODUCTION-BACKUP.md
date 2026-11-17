# 正式站点备份与恢复工具

本工具只处理本地文件、SQLite备份和加密，不停止/启动服务、不创建定时任务、不联网或上传。当前仅完成本机合成资料验证，尚未声称已部署、已定时运行、已有异地副本或完整服务器恢复。

## 数据布局和一致性条件

- 程序：`/opt/learning-platform/current/release/production-backup.mjs`，只读发布目录。
- CLI按入口参数和模块URL的真实路径判定，支持`current`目录符号链接和脚本文件符号链接；作为模块import不会执行CLI。协调器必须要求非空且结构正确的JSON结果，并核查实际包、receipt、大小与SHA256，不能仅看退出码0。
- 正式数据：`/var/lib/learning-platform/data/learning.sqlite`，私密图片在同级 `papers/`。
- 加密备份：`/var/backups/learning-platform`，应归备份管理员所有、目录0700，文件0600。
- RSA公钥：建议`/etc/learning-platform/backup-public.pem`，服务器仅保存公钥。建议RSA3072位或以上，工具拒绝低于2048位。
- 私钥：只留运营者Windows当前用户DPAPI保护的恢复资料中；不能上传VPS、放public/、Git或备份包，也不能出现在命令参数、日志中。

外层备份协调器必须停止`learning-platform.service`及其他数据写入者，等待在途请求结束，再执行`encrypt --writers-stopped`。CLI在Linux另检查该服务为inactive或failed，unknown/active都拒绝，但不能替代对其他维护写入者的协调。结束后必须由外层在finally中恢复先前运行的服务，并检查health；备份工具本身不改服务状态。

SQLite使用Node24的`node:sqlite.backup()`产生一致快照，随后结合停止写入期间的图片文件打包，**没有把复制主sqlite文件当作WAL完整备份**。记录每个文件大小、SHA256和发布版本；打包时再读一遍校验，发现变化立即失败。文件读两次用于变化检测，仍不能替代服务停写。代码、运行配置、服务单元、密钥和DNS配置应另做受保护的版本化恢复清单，不含在此数据包中。

## 创建加密备份

在外层已停写后执行：

```text
node /opt/learning-platform/current/release/production-backup.mjs encrypt --data-dir /var/lib/learning-platform/data --backup-dir /var/backups/learning-platform --public-key /etc/learning-platform/backup-public.pem --version <已发布代码版本> --writers-stopped --retain-days 30
```

备份名称固定为`learning-platform-<UTC时间>-<随机UUID>.lpbak`。图片和manifest都在加密载荷内；公开外壳只含算法、时间、公钥指纹、随机IV和加密数据密钥。

每包随机32字节密钥，用AES-256-GCM加密并认证完整载荷；该随机密钥用RSA-OAEP-SHA256公钥封装，外壳作为GCM附加认证数据。文件以流方式处理，不需要将全部图片加载进内存。默认安全上限为8GiB总数据、25000文件、8MiB清单；超限失败，不静默截断。
加密防篡改不等于备份发送方签名：持有公钥的人可制作自己的新包。恢复材料必须来自已认证的服务器/受限备份渠道，并核对可信记录中的SHA256，不能接受来源不明但能解密的包。

创建完成前，工具用仍在内存中的随机数据密钥解密到私密临时目录，校验全部文件SHA256和SQLite integrity_check；成功后才发布最终包和`.receipt.json`。临时明文和数据密钥随后清理。进程被强制杀死或主机掉电可能留下0700临时目录；运营清理程序需在确认没有备份进程运行后核查这些目录，不能无条件删除不明路径。

只输出包路径、计数、版本、摘要和轮换结果，不打印密钥、数据库记录或图片内容。`receipt`记录创建时全量校验结果，不是私钥签名。服务器目录权限必须限制修改；重新验证解密恢复需要运营者私钥。

## 完整验证与恢复

先把`.lpbak`和receipt下载到受限权限目录。Windows端可直接调用`verifyBackup({input,privateKey})`或`decryptBackup({input,outputDir,privateKey})`，其中私钥由DPAPI解密后仅留进程内存；不必生成私钥明文文件。

CLI也支持私钥文件路径，仅在已保护的本机临时目录中使用，结束后清理该临时私钥：

```text
node release/production-backup.mjs verify --input <下载的.lpbak> --private-key <本机受保护临时私钥.pem>
node release/production-backup.mjs decrypt --input <下载的.lpbak> --output-dir <尚不存在的恢复目录> --private-key <本机受保护临时私钥.pem>
```

`verify`会完整解密、检查清单、每个摘要及SQLite完整性，然后删除自己创建的私密临时目录。`decrypt`保留新的恢复目录，含`learning.sqlite`、`papers/`和`backup-manifest.json`。目标目录必须不存在；工具拒绝覆盖运行数据、现有目录或文件。错误密钥、篡改、截断、额外载荷、路径逃逸、符号链接、硬链接、大小异常均会失败并移除仅本次创建的部分输出。

应用恢复时，由外层先维护入口、停止新后台，另存当前库和图片，再把**经过验证的恢复目录**作为完整数据集合部署；保持低权限服务账号与600/700权限。不得只覆盖活动SQLite而保留旧WAL/SHM，不能把数据文件恢复成功等同域名/密钥/服务配置恢复。先验证正式角色与隔离、图片、导出和后端版本兼容，再恢复流量。

## 保留与轮换

默认30天，`encrypt`成功后自动调用轮换；也可单独运行：

```text
node release/production-backup.mjs rotate --backup-dir /var/backups/learning-platform --public-key /etc/learning-platform/backup-public.pem --retain-days 30
```

只有严格符合本工具文件名前缀、普通且单硬链接文件、具有有效receipt、同一公钥指纹、实际大小和SHA256一致、外壳时间匹配，且创建时间和文件修改时间均过期的包才删除。未知文件、符号链接、无receipt包、被修改包和其他密钥的备份均保留并计入skipped。不从压缩包路径或任意外部清单推导删除目标。

轮换仅是受保护目录内的保留策略，不是再次全量解密验证，也不是安全擦除承诺。密钥轮换后旧指纹包默认保留，需运营者按旧密钥的恢复验收和保留要求另行处理。监管/用户删除请求对备份的处理规则仍需运营方确定。

## 验证与未完成工作

`node --test release/production-backup.test.mjs`：11项通过，覆盖完整SQLite+中文图片恢复、已提交WAL记录、篡改/截断拒绝、错误私钥、目录覆盖/路径逃逸、有效加密恶意清单越界拒绝、符号链接拒绝、保守轮换，以及目录/脚本符号链接CLI和import不触发CLI。CLI测试要求真实JSON输出和恢复产物；Windows另运行符号链接入口的encrypt并检查备份包与receipt摘要一致。Linux仍保留真实systemd停写门槛，没有用测试替身放开正式encrypt。

修复记录：初版入口比较使用`resolve(argv[1])`对比已被Node解析过符号链接的`import.meta.url`，经`current`链接启动可能静默退出0。现对两端调用`realpath`比较；该问题说明退出码不能替代产物验证，部署协调器还需做上述独立检查。

尚需由部署线程完成：服务停写与finally恢复包装、定时器、失败通知、异地/离线副本传送、私钥DPAPI交付和备份、正式Linux服务环境测试、完整异机恢复、RPO/RTO确认。Windows本机测试成功不等于这些运营条件已经完成。
