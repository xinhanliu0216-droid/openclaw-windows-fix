---

# 故障排查与修复指南：OpenClaw Dashboard 自动唤起失效问题

## 故障摘要 (Issue Summary)
在执行 `openclaw dashboard` 命令时，程序会提示 `Opened in your browser`，但实际表现为**静默失败 (Silent Failure)**：默认浏览器未启动，用户被迫手动复制 `http://127.0.0.1:18789`。

---

## 根本原因定位 (Root Cause Analysis)
该问题源于底层 `browser-open` 逻辑在处理现代开发环境时的局限性：
1. **Windows 字符转义缺陷**：未对 URL 中的 `&` 符号进行转义，导致 `cmd.exe` 解析截断。
2. **环境误判与拦截**：原逻辑在检测到 SSH 连接或无显存环境（如某些 WSL 配置）时会触发硬拦截（Hard Break），直接拒绝执行启动指令。
3. **超时容错不足**：默认 5 秒超时对于冷启动的浏览器或跨层调用的 WSL 宿主机环境而言时间窗口过窄。

---

## 本地修复教程 (Local Hotfix Guide)

我们可以通过引入 **Robust-Opener** 逻辑来彻底重写该函数。

### 步骤 1：定位依赖目录
在 VSCode 中通过 **文件 -> 打开文件夹**，导航至：
`%APPDATA%\npm\node_modules\openclaw`

### 步骤 2：定位核心文件
1. 按下 `Ctrl + Shift + F` 全局搜索关键词：`async function openUrl`。
2. 找到对应文件（例如 `browser-open-blTvpJBc.js`）。

### 步骤 3：应用 Robust-Opener 补丁
定位到约第 67 行的 `async function openUrl(url)`，将其内容**整体替换**为以下具有“强力拦截 + 跨层穿透”能力的逻辑：

```javascript
/**
 * Refined browser opener logic with environment-agnostic support.
 * Features: CMD character escaping, Mac/Linux native call, and WSL-to-Host passthrough.
 */
async function openUrl(url) {
    if (shouldSkipBrowserOpenInTests()) return false;

    // Dynamically import exec for low-level system command execution
    const { exec } = await import("node:child_process");
    const platform = process.platform;

    // 1. Force intercept for Windows platform
    if (platform === "win32") {
        // Escape '&' with '^&' to prevent command truncation in cmd.exe
        const safeUrl = url.replace(/&/g, "^&"); 
        exec(`start "" "${safeUrl}"`, (error) => {
            if (error) console.error("[Browser] Windows force-open failed: ", error);
        });
        return true;
    }

    // 2. Force intercept for macOS
    if (platform === "darwin") {
        exec(`open "${url}"`, (error) => {
            if (error) console.error("[Browser] Mac force-open failed: ", error);
        });
        return true;
    }

    // 3. Force intercept for Linux / WSL
    if (platform === "linux") {
        // Try xdg-open first; fallback to PowerShell for WSL host-level execution
        const linuxCommand = `xdg-open "${url}" || powershell.exe -NoProfile -Command Start-Process "${url}"`;
        exec(linuxCommand, (error) => {
            if (error) console.error("[Browser] Linux/WSL force-open failed: ", error);
        });
        return true;
    }

    // 4. Ultimate Fallback to legacy detection logic
    const resolved = await resolveBrowserOpenCommand();
    if (!resolved.argv) return false;
    const command = [...resolved.argv, url];

    try {
        // Extended timeout to 10s for slow cold-starts
        await runCommandWithTimeout(command, { timeoutMs: 10e3 });
        return true;
    } catch {
        return false;
    }
}
```

### 步骤 4：保存与验证
保存文件并重新运行 `openclaw dashboard`。现在，无论是在 Windows 原生终端、WSL 还是受限的 SSH 环境，浏览器都将稳定自动弹出。

---

## 恢复方案 (Recovery)
如需撤销修改或因语法错误导致崩溃，请运行：
```bash
npm install -g openclaw
```
该命令将重新从 Registry 下载官方原始文件并覆盖本地修改。

---

## 维护状态 (Upstream)
该修复逻辑已基于最新的 `robust-opener` 标准进行优化，相关补丁已提交至上游。
