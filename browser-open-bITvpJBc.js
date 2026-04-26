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
async function openUrl(url: string): Promise<boolean> {
    if (shouldSkipBrowserOpenInTests()) return false;
    const { exec } = await import("node:child_process");
    const platform = process.platform;
    const forceExec = (cmd: string): Promise<boolean> => {
        return new Promise((resolve) => {
            exec(cmd, (error) => {
                if (error) {
                    console.error(`[Browser] 唤起失败 (${platform}):`, error.message);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    };
    // Windows
    if (platform === "win32") {
        const safeUrl = url.replace(/"/g, '""'); 
        return await forceExec(`start "" "${safeUrl}"`);
    }
    // macOS
    if (platform === "darwin") {
        return await forceExec(`open "${url.replace(/"/g, '\\"')}"`);
    }
    // Linux / WSL
    if (platform === "linux") {
        const { t: isWSL } = await import("./wsl-DyUPSL8q.js");
        const wsl = await isWSL();
        if (wsl) {
            // WSL 
            const winCmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${url}'"`;
            const success = await forceExec(winCmd);
            if (success) return true;
        }
        return await forceExec(`xdg-open "${url.replace(/"/g, '\\"')}"`);
    }
    const resolved = await resolveBrowserOpenCommand();
    if (!resolved.argv) return false;
    const command = [...resolved.argv, url];
    try {
        await runCommandWithTimeout(command, { timeoutMs: 15000 }); // 给 15 秒，更宽容一些
        return true;
    } catch {
        return false;
    }
}
//#endregion
export { openUrl as n, resolveBrowserOpenCommand as r, detectBrowserOpenSupport as t };
