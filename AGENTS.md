# AGENTS.md — Rainy2FA

> AI 协作规则手册。下次 AI 在这个项目写代码时必须看到的硬规则。

## 项目概要

纯本地 TOTP 双重身份验证器 Android 应用。Kotlin + Jetpack Compose 外壳，WebView 内嵌 OTPAuth.js 做 TOTP 计算。零联网、零遥测。

## 核心架构

```
MainActivity.kt (Compose UI + Biometric + JS Bridge)
  └── WebView
        ├── index.html    (主页面)
        ├── script.js     (TOTP 逻辑 + UI 交互 + 扫码)
        ├── style.css     (小猫粉样式)
        └── otpauth.umd.min.js (TOTP 引擎)
```

- **数据存储**：WebView `localStorage`，key 为 `2fa_accounts`
- **账号结构**：`{ issuer, label, secret, createdAt }`
- **文件导入导出**：SAF + FileProvider，经 `AndroidBridge` JS 接口

## 关键文件

| 文件 | 职责 |
|------|------|
| `app/src/main/java/com/rainy2fa/app/MainActivity.kt` | 主 Activity、BiometricPrompt、WebView 配置、JS Bridge |
| `app/src/main/assets/script.js` | 全部前端逻辑：渲染、TOTP 更新、扫码、批量管理、搜索 |
| `app/src/main/assets/style.css` | 全部样式。账号卡片显示依赖 `.issuer` / `.label` / `.account-card` / `.account-info` |
| `app/src/main/assets/index.html` | HTML 骨架 |
| `gradle/libs.versions.toml` | Version Catalog，统一依赖管理 |

## 构建命令

```bash
# 必须：ARM64/proot 环境先跑这个（一键完成环境初始化 + AAPT2 修复 + 构建验证）
bash setup_android_env.sh

# Debug
./gradlew clean assembleDebug --no-daemon

# Release（需要 release.jks）
./gradlew clean assembleRelease --no-daemon
```

**ARM64 特别注意**：`gradle.properties` 已有 `android.aapt2.process.daemon=false`。如遇 AAPT2 启动失败，跑 `setup_android_env.sh`。

## CSS 修改注意事项

`style.css` 是 WebView 内直接加载的资产文件。修改后必须 `clean` 构建（`./gradlew clean assembleDebug`），否则 Gradle 缓存可能不更新 APK 内的资源。可通过 `unzip -p <apk> assets/style.css` 验证打包内容。

## 签名

- 文件：`release.jks`（项目根目录）
- Alias：`rainy2fa`，密码：`rainy2fa`
- GitHub Actions 用 Secret `KEYSTORE_BASE64` 传入

## 版本

- versionName: 1.1.2，versionCode: 4
- Tag 格式：`v1.1.2`

## 禁止事项

- ❌ 不要发起网络请求（纯本地应用）
- ❌ 不要在 script.js 中引入外部 CDN 依赖
- ❌ 不要在 CLAUDE.md/AGENTS.md 里写历史叙事（"X 时刻 Y 上线"）——这是 git log 的事
- ❌ 不要把账号卡片的 `.issuer` / `.label` 加回 `nowrap + ellipsis`——用户需要完整显示