import { r as runCommandWithTimeout } from "./exec-CIhMaoDG.js";
import { t as isWSL } from "./wsl-DyUPSL8q.js";
import { t as detectBinary } from "./detect-binary-CGbk8fui.js";
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
	// 强行拦截 Windows 环境的唤起逻辑
	if (process.platform === "win32") {
		const { exec } = await import("node:child_process");
		// 直接调用系统原生 start 命令打开 URL
		exec(`start "" "${url}"`, (error) => {
			if (error) console.error("强制唤起报错: ", error);
		});
		return true; // 告诉主程序：我已经成功干完活了
	}
	if (shouldSkipBrowserOpenInTests()) return false;
	const resolved = await resolveBrowserOpenCommand();
	if (!resolved.argv) return false;
	const command = [...resolved.argv];
	command.push(url);
	try {
		await runCommandWithTimeout(command, { timeoutMs: 5e3 });
		return true;
	} catch {
		return false;
	}
}
//#endregion
export { openUrl as n, resolveBrowserOpenCommand as r, detectBrowserOpenSupport as t };
