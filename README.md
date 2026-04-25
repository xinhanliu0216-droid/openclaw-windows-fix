 ***

# Troubleshooting & Hotfix Guide: Dashboard Fails to Start on Windows

## Issue Summary
When running the `openclaw dashboard` command to launch the visual console on a Windows (win32) operating system, the terminal outputs the following success message:
> `Opened in your browser. Keep that tab to control OpenClaw.`

**Actual Behavior**: The system's default browser is **not launched**. Because the background Gateway runs normally and throws no error logs, this manifests as a **Silent Failure**. New users must manually copy the local address `http://127.0.0.1:18789` to access the system.

---

## Root Cause Analysis
After a complete trace, the issue originates from a third-party dependency module used by OpenClaw (responsible for the browser launch logic).
In the branch handling the `win32` platform within this module, there are two critical flaws:
1. **State Sync Anomaly (False Positive):** The original code uses an asynchronous Promise that returns `true` immediately after process creation. This misleads the higher-level OpenClaw logic into assuming the browser opened successfully, resulting in a false success log.
2. **Character Parsing Trap (Missing Escape):** Special reserved characters (like `&`) in the target URL are not properly escaped for the Windows environment. The Windows command-line interpreter (`cmd.exe`) misinterprets these as command separators, causing the underlying `start` command to be illegally truncated and crash silently.

---

## Local Hotfix Guide
Before the official release of the next version containing this fix, Windows users can completely resolve this issue by modifying the locally compiled code.

We recommend using **VSCode (Visual Studio Code)** for a global search and replace. The entire process takes about 2 minutes.

### Step 1: Open the Global Dependency Directory
1. Open VSCode.
2. In the top menu bar, select **File -> Open Folder**.
3. Paste the following Windows global npm path directly into the address bar and press Enter (if you installed Node.js on a different drive, replace the drive letter accordingly):
   `%APPDATA%\npm\node_modules\openclaw`

### Step 2: Global Search and Locate the Faulty Function
Since the bundled filenames contain random hashes, please use global search to locate the code:
1. Press `Ctrl + Shift + F` in VSCode to open the global search panel.
2. Enter the following keyword in the search box:
   `async function openUrl`
3. In the search results, find the file defining this function (usually ending in `.js`) and click to open it.

### Step 3: Apply the Safe Escape Patch
Scroll down the file to find the code block handling the `win32` platform (i.e., `if (process.platform === "win32")`).

**Replace the original flawed code:**
```javascript
if (process.platform === "win32") {
    const { exec } = await import("node:child_process");
    exec(`start "" "${url}"`, (error) => { /* ... */ });
    return true; 
}
```

**Completely replace it with the following stable version featuring safe character escaping:**
```javascript
if (process.platform === "win32") {
    const { exec } = await import("node:child_process");
    const escapedUrl = url.replace(/&/g, '^&');
    exec(`start "" "${escapedUrl}"`, (error) => {
        if (error) console.error("Failed to launch browser: ", error);
    });
    return true; 
}
```

### Step 4: Save and Verify
1. Press `Ctrl + S` to save the modified file.
2. Close your current command-line terminal and **reopen** a new PowerShell or CMD window.
3. Enter `openclaw dashboard` again.
4. **Success Verification**: The system's default browser should now instantly pop up and accurately navigate to the OpenClaw console interface!

---

## Something Went Wrong? How to Recover (Rollback)
If you accidentally delete the wrong character while modifying the code, causing the `openclaw` command to throw errors or crash completely, don't panic. You just need to reinstall globally once to overwrite and restore it to the official default state.

Open your terminal and run the following command:
```bash
npm install -g openclaw
```
*This will re-download and overwrite the modified files, restoring everything to normal.*

---

## Upstream Status
A detailed Issue report and a Pull Request with code suggestions have currently been submitted to the official repository. 
