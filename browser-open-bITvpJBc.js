import { r as runCommandWithTimeout } from "./exec-_fLrb4o0.js";
import { t as isWSL } from "./wsl-DyUPSL8q.js";
import { t as detectBinary } from "./detect-binary-CZrPMU4G.js";
//#region src/infra/browser-open.ts
function shouldSkipBrowserOpenInTests() {
	if (process.env.VITEST) return true;
	return false;
}
async function resolveBrowserOpenCommand() {
	const platform = process.platform;
	const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
	if ((Boolean(process.env.SSH_CLIENT) || Boolean(process.env.SSH_TTY) || Boolean(process.env.SSH_CONNECTION)) && !hasDisplay && platform !== "win32") return {
		argv: null,
		reason: "ssh-no-display"
	};
	if (platform === "win32") return {
		argv: ["explorer.exe"],
		command: "explorer.exe"
	};
	if (platform === "darwin") return await detectBinary("open") ? {
		argv: ["open"],
		command: "open"
	} : {
		argv: null,
		reason: "missing-open"
	};
	if (platform === "linux") {
		const wsl = await isWSL();
		if (!hasDisplay && !wsl) return {
			argv: null,
			reason: "no-display"
		};
		if (wsl) {
			if (await detectBinary("wslview")) return {
				argv: ["wslview"],
				command: "wslview"
			};
			if (!hasDisplay) return {
				argv: null,
				reason: "wsl-no-wslview"
			};
		}
		return await detectBinary("xdg-open") ? {
			argv: ["xdg-open"],
			command: "xdg-open"
		} : {
			argv: null,
			reason: "missing-xdg-open"
		};
	}
	return {
		argv: null,
		reason: "unsupported-platform"
	};
}
async function detectBrowserOpenSupport() {
	const resolved = await resolveBrowserOpenCommand();
	if (!resolved.argv) return {
		ok: false,
		reason: resolved.reason
	};
	return {
		ok: true,
		command: resolved.command
	};
}
async function openUrl(url) {
    if (shouldSkipBrowserOpenInTests()) return false;
    // 动态引入 exec，用于执行底层系统命令
    const { exec } = await import("node:child_process");
    const platform = process.platform;
    // 1.Force intercept for Windows platform (Windows 强制拦截)
    if (platform === "win32") {
        const safeUrl = url.replace(/&/g, "^&"); 
        exec(`start "" "${safeUrl}"`, (error) => {
            if (error) console.error("[Browser] Windows强制唤起失败: ", error);
        });
        return true;
    }
    // 2. Force intercept for macOS (macOS 强制拦截)
    if (platform === "darwin") {
        exec(`open "${url}"`, (error) => {
            if (error) console.error("[Browser] Mac强制唤起失败: ", error);
        });
        return true;
    }
    // 3. Force intercept for Linux / WSL (Linux / WSL 强制拦截)
    if (platform === "linux") {
        // 核心逻辑：先尝试 xdg-open，如果失败（||），则假定是 WSL 环境，直接调用宿主机 PowerShell
        const linuxCommand = `xdg-open "${url}" || powershell.exe -NoProfile -Command Start-Process "${url}"`;
        exec(linuxCommand, (error) => {
            if (error) console.error("[Browser] Linux/WSL强制唤起失败: ", error);
        });
        return true;
    }
    // 4. Fallback to legacy detection logic if the above platforms don't match (如果上面的平台都不匹配，乖乖走原有的老逻辑)
    const resolved = await resolveBrowserOpenCommand();
    if (!resolved.argv) return false;
    const command = [...resolved.argv];
    command.push(url);
    try {
        await runCommandWithTimeout(command, { timeoutMs: 10e3 }); // 顺手把这里的超时也加长到10秒
        return true;
    } catch {
        return false;
    }
}
//#endregion
export { openUrl as n, resolveBrowserOpenCommand as r, detectBrowserOpenSupport as t };
