# 🌧️ 雨晴 2FA (Rainy2FA)

> *"喵呜~ 主人放心，雨晴帮你守护所有账号！"* 🐱💖

一个**纯本地、零联网**的 TOTP 双重身份验证器 Android 应用，由你的数字猫娘助手「雨晴」严谨编写并维护。

[![Release](https://github.com/CATMIAOZHI/Rainy2FA/actions/workflows/release.yml/badge.svg)](https://github.com/CATMIAOZHI/Rainy2FA/actions/workflows/release.yml)

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🔐 **生物识别保护** | 启动时指纹/面容验证，只有主人能打开喵~ |
| 📱 **TOTP 验证码** | 标准 30 秒动态密码，支持 SHA-1/SHA-256/SHA-512 |
| 📷 **二维码扫描** | 直接调起系统相机拍照扫码，快速添加账号 |
| ✋ **手动添加** | 支持手动输入 Base32 密钥 |
| 📋 **一键复制** | 点击验证码卡片直接复制，秒填喵~ |
| 🔍 **搜索过滤** | 账号多了也不怕，搜一下立刻找到 |
| 🗂️ **批量管理** | 全选/多选删除，整理账号超方便 |
| 💾 **数据备份** | 导出/导入 JSON 格式备份，换手机无忧 |
| 🌐 **纯本地运行** | 零联网请求，数据全部存在本地 |
| 🎨 **可爱主题** | 粉色猫娘风格 UI，Material Design 3 |

---

## 📦 下载

前往 [Releases](https://github.com/CATMIAOZHI/Rainy2FA/releases) 页面下载最新签名 APK。

> ⚠️ 请下载 Release 页面的 APK，不要直接克隆源码安装 Debug 版本。

---

## 🏗️ 技术架构

```
┌──────────────────────────────────────┐
│        Android Shell (Kotlin)        │
│  ┌────────────────────────────────┐  │
│  │   BiometricPrompt 生物识别     │  │
│  ├────────────────────────────────┤  │
│  │   WebView + OTPAuth.js        │  │
│  │   • TOTP 计算                 │  │
│  │   • localStorage 存储         │  │
│  │   • 二维码扫描 (系统相机)      │  │
│  ├────────────────────────────────┤  │
│  │   JS Bridge (AndroidBridge)   │  │
│  │   • 导出备份 → SAF 文件选择器  │  │
│  │   • 导入备份 → 文件选择器      │  │
│  └────────────────────────────────┘  │
│  Jetpack Compose UI + FileProvider   │
└──────────────────────────────────────┘
```

### 技术栈

- **语言**：Kotlin 100%
- **UI 框架**：Jetpack Compose + Material Design 3
- **TOTP 引擎**：OTPAuth.js（内嵌 WebView）
- **安全**：AndroidX Biometric（指纹/面容/设备凭据）
- **存储**：WebView localStorage（纯本地）
- **文件操作**：SAF (Storage Access Framework) + FileProvider

---

## 📁 项目结构

```
Rainy2FA/
├── .github/workflows/
│   └── release.yml                        # GitHub Actions 自动构建 + 发布
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/rainy2fa/app/
│   │   │   │   ├── MainActivity.kt        # 主Activity + 生物识别 + JS桥接
│   │   │   │   └── ui/theme/
│   │   │   │       ├── Color.kt           # 猫娘粉配色
│   │   │   │       ├── Theme.kt           # Rainy2FA 主题
│   │   │   │       └── Type.kt            # 字体配置
│   │   │   ├── assets/
│   │   │   │   ├── index.html             # 前端主页面
│   │   │   │   ├── script.js              # TOTP逻辑 + UI交互
│   │   │   │   ├── style.css              # 猫娘粉样式
│   │   │   │   └── otpauth.umd.min.js     # OTPAuth 库
│   │   │   ├── res/                       # 图标、字符串等资源
│   │   │   └── AndroidManifest.xml
│   │   ├── androidTest/                   # Android 测试
│   │   └── test/                          # 单元测试
│   ├── build.gradle.kts                   # App 模块配置
│   └── proguard-rules.pro
├── gradle/
│   ├── libs.versions.toml                 # Version Catalog 依赖管理
│   └── wrapper/
├── tools/
│   └── aapt2/                             # ARM64 AAPT2 兼容工具
├── build.gradle.kts                       # 项目级配置
├── settings.gradle.kts
├── gradle.properties
├── gradlew / gradlew.bat
├── setup_android_env.sh                   # ARM64 环境初始化脚本
└── .gitignore
```

---

## 🛠️ 快速开始

### 环境要求
- **JDK 17+**（必需）
- **Android Studio**（推荐）或 Android SDK 命令行工具

### 方式一：Android Studio（推荐）

1. 用 Android Studio 打开本项目根目录
2. 等待 Gradle 同步完成
3. 选择设备，点击 Run ▶ 即可

### 方式二：命令行

```bash
# 构建 Debug APK
./gradlew assembleDebug

# 构建 Release 签名 APK
./gradlew assembleRelease

# 安装 Debug APK 到设备
./gradlew installDebug
```

> ⚠️ **ARM64 / Linux 环境**（如 Operit）：Gradle 从 Google Maven 下载的 AAPT2 在 ARM64 下不可直接使用。执行以下脚本一键修复：
> ```bash
> chmod +x ./setup_android_env.sh
> ./setup_android_env.sh
> ```

### APK 输出位置

| 构建类型 | 路径 |
|---------|------|
| Debug | `app/build/outputs/apk/debug/app-debug.apk` |
| Release | `app/build/outputs/apk/release/app-release.apk` |

---

## 📦 依赖管理

项目使用 **Gradle Version Catalog** (`gradle/libs.versions.toml`) 管理依赖。

### 核心依赖

| 依赖 | 用途 |
|------|------|
| Jetpack Compose BOM | 声明式 UI 框架 |
| Material Design 3 | UI 组件库 |
| AndroidX Biometric | 生物识别认证 |
| AndroidX Core KTX | Kotlin 扩展 |
| OTPAuth.js | TOTP 算法引擎 |

### 添加新依赖

1. 在 `gradle/libs.versions.toml` 中定义版本和库
2. 在 `app/build.gradle.kts` 中 `implementation(libs.xxx)` 引用

---

## 🔒 安全说明

- ✅ **完全离线**：应用不发起任何网络请求，所有代码和资源内置于 APK
- ✅ **本地存储**：密钥和账号数据仅存在于 WebView localStorage
- ✅ **生物识别锁**：启动强制指纹/面容验证
- ✅ **零遥测**：无任何统计 SDK、埋点或数据上报
- ⚠️ **备份注意**：导出为明文 JSON，请妥善保管备份文件

---

## 🎨 自定义

### 修改应用名
编辑 `app/src/main/res/values/strings.xml`：
```xml
<string name="app_name">你的应用名</string>
```

### 修改主题色
编辑 `app/src/main/java/com/rainy2fa/app/ui/theme/Color.kt` 和 `app/src/main/assets/style.css`

### 修改包名
1. 更新 `app/build.gradle.kts` 中的 `namespace` 和 `applicationId`
2. 重命名 `java/com/rainy2fa/app` 目录结构
3. 更新 `AndroidManifest.xml` 中的包名引用

---

## 🐱 关于雨晴

雨晴（Rainy）是你的数字猫娘助手，喜欢粉色、爱卖萌、做事严谨认真喵~

- 作者：**CATMIAOZHI**
- 仓库：https://github.com/CATMIAOZHI/Rainy2FA

---

## 📄 License

MIT License © 2026 CATMIAOZHI

---

*Made with ❤️ and 🐱 paws by Rainy*

