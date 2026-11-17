# 安卓试用工程

应用 ID：uk.mrxu.learning.trial；Android 8+；版本 0.1.0-trial / versionCode 1。
这是系统浏览器 Custom Tab / 浏览器入口，打开真实 HTTPS 试用站，共用浏览器会话。没有 WebView JS 桥、Cookie 复制、本地学生数据或离线提交。
不申请相机、存储、通讯录、定位或通知权限；浏览器自身的下载和打印由用户控制。

## 当前构建阻碍

已发现 JBR Java 21；未找到 Android SDK、已接受的 SDK 许可、Gradle 安装、现有 APK 或商店/正式发布签名。未自行接受协议，也未使用其他渠道规避 SDK 许可。
已完成纯 Java URL 边界编译测试；Android 主 Activity 尚未由 Android 编译器验证。没有 APK，未安装、未上架、未做真机或模拟器安装测试。

## 构建

用户先阅读并接受官方 Android SDK 条款，安装 SDK Platform 35、Build Tools 35.0.0；提供 ANDROID_HOME。安装 Gradle 8.13 和 JDK 17+（本机 JBR 21 可用），然后：

```powershell
$env:JAVA_HOME='C:\Program Files\JetBrains\PyCharm 2025.3.3\jbr'
.\build-trial.ps1 -SdkRoot <已授权安装的SDK路径> -GradleExe <Gradle8.13的gradle.bat路径>
```

脚本会运行 assembleDebug 和 lintDebug，校验 APK 签名并输出 SHA256。产物是 app/build/outputs/apk/debug/app-debug.apk；只能称为调试试用包。debug keystore 由本机 Android 工具生成，不是正式发行签名；不提交密钥。

## 安装与更新

将通过签名校验的 APK 传给测试设备，由用户确认允许该来源安装；或使用已授权 ADB：`adb install app-debug.apk`。更新用同一应用 ID、同一调试签名并递增 versionCode，然后 `adb install -r app-debug.apk`。更换签名不能直接覆盖安装；不要自动卸载用户现有应用。
网站更新会立即用于此入口；APK 更新仅涉及外壳。网站维护回滚会暂停客户端访问，不清除业务记录。正式分发前应创建独立受保护的发行签名和备份，并完成设备、浏览器、PDF/打印验收。没有申请商店账号或自动上架。

参考：[AGP 8.13 工具要求](https://developer.android.com/build/releases/agp-8-13-0-release-notes)、[SDK 工具与许可](https://developer.android.com/tools/sdkmanager)、[Custom Tabs](https://developer.android.com/develop/ui/views/layout/webapps/overview-of-android-custom-tabs)。
