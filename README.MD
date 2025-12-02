# 3X-UI 多功能脚本

这是一个 Tampermonkey 脚本，用于增强 3X-UI 面板的功能，提供一键生成节点、关闭订阅访问、添加出站规则、配置路由规则以及批量删除入站节点等便捷操作。
![main](/images/1.png)
[更多请点击这里](/images)

## 描述

该脚本为 3X-UI 面板添加了一个浮动按钮，点击后弹出界面，支持多种协议节点的快速创建（如 VLESS、VMESS 和 SS），并提供其他实用工具。脚本通过 API 与面板交互，实现自动化配置。当前版本：1.3。

## 功能

- **一键生成节点**：支持以下协议的节点创建（VLESS/VMESS/SS）：
  - VLESS TCP REALITY VISION
  - VLESS XHTTP REALITY
  - VLESS XHTTP Encryption (Post-Quantum) (非 TLS)
  - VLESS XHTTP Encryption (Post-Quantum) (TLS)
  - VLESS WS (非 TLS)
  - VLESS WS (TLS)
  - VMESS WS (非 TLS)
  - VMESS WS (TLS)
  - SHADOWSOCKS TCP (2022-BLAKE3-CHACHA20-POLY1305)
  - SHADOWSOCKS TCP (2022-BLAKE3-AES-256-GCM)
  - SHADOWSOCKS TCP (2022-BLAKE3-AES-128-GCM)
- **一键关闭订阅访问**：快速设置 `subEnable: false` 并重启面板。
- **一键添加出站规则**：添加 `UseIPv4v6` 和 `UseIPv6v4` 出站规则，支持 IPv4/IPv6 优先策略。
- **一键配置路由规则**：绑定入站节点到 IPv4 或 IPv6 优先出站，并保存配置。
- **一键批量删除节点**：快速选择并删除多个入站节点，并重启 Xray。
- **配置管理**：自定义起始端口、Reality 回落地址、伪装域名，以及随机端口模式。配置保存在浏览器本地存储。
- **拖拽浮动按钮**：界面友好，支持拖动浮动按钮位置。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展（支持 Chrome、Firefox 等浏览器）。
2. 创建新脚本，或直接导入本脚本代码。
3. 脚本匹配规则：`*://*/*/panel/*`，适用于 3X-UI 面板页面。
4. 保存后，访问 3X-UI 面板即可看到右上角的浮动按钮。

## 使用

1. **打开界面**：在 3X-UI 面板页面，点击右上角的浮动按钮（闪电图标），弹出主面板。
2. **生成节点**：
   - 选择需要创建的协议（支持多选）。
   - 点击“一键创建选中节点”按钮。
   - 脚本会自动检测可用端口、生成 UUID 等，并通过 API 添加节点。
3. **关闭订阅**：点击“关闭订阅”按钮，设置 `subEnable: false` 并重启面板。
4. **添加出站规则**：点击“添加出站”按钮，添加缺失的 IPv4/IPv6 出站规则，并重启 Xray。
5. **配置路由规则**：
   - 点击“路由规则”按钮，弹出子面板。
   - 选择 IPv4 或 IPv6 优先。
   - 勾选需要绑定的入站节点。
   - 点击“应用并保存”，更新路由规则并重启 Xray。
6. **批量删除节点**：
   - 点击“批量删除”按钮，弹出删除面板。
   - 选择需要删除的入站节点。
   - 点击“确认删除”，删除选中节点并重启 Xray。
7. **全局配置**：
   - 点击“配置”链接，进入配置视图。
   - 修改起始端口、Reality Target、SNI 等。
   - 点击“保存配置”，设置会持久化到浏览器本地存储。

**注意**：
- TLS 相关节点需面板启用 HTTPS，并配置证书。
- 随机端口模式会在 10000-60000 范围内随机选择端口。
- 操作失败时会弹出错误提示。

## 配置选项

- **起始查找端口 (startPort)**：默认 30000，从此端口开始查找可用端口。
- **Reality 回落地址 (Target)**：默认 `www.apple.com:443`。
- **Reality 伪装域名 (ServerName / SNI)**：默认 `www.apple.com`。
- **启用随机端口模式**：默认关闭，启用后端口随机在 10000-60000 间生成。

## 依赖

- 浏览器支持 `crypto.getRandomValues()`（现代浏览器均支持）。
- 3X-UI 面板的 API 接口（如 `/panel/api/inbounds/add`、` /panel/xray/update` 等）。

## 注意事项

- 该脚本仅在匹配的面板页面生效。
- 操作涉及面板重启，请确保权限充足。
- 如果遇到问题，检查浏览器控制台日志。
- 脚本不修改服务器文件，仅通过 API 操作。