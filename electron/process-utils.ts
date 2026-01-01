import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AppInfo {
    id: string;
    name: string;
    process: string;
    appIcon: string | null;
}

export async function getRunningApps(): Promise<AppInfo[]> {
    if (process.platform === 'win32') {
        return getWindowsRunningApps();
    } else if (process.platform === 'linux') {
        return getLinuxRunningApps();
    }
    return [];
}

async function getWindowsRunningApps(): Promise<AppInfo[]> {
    try {
        // Set UTF-8 encoding to properly handle Korean and other Unicode characters
        const psCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Process | Where-Object {$_.MainWindowTitle -ne \"\"} | Select-Object ProcessName, MainWindowTitle | ConvertTo-Json -Compress`;
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });

        let activeApps: any[] = [];
        try {
            if (stdout.trim()) {
                activeApps = JSON.parse(stdout);
                if (!Array.isArray(activeApps)) {
                    activeApps = [activeApps];
                }
            }
        } catch (e) {
            console.error("Failed to parse running apps JSON", e);
        }

        return activeApps.map((a: any) => ({
            id: a.ProcessName,
            name: a.MainWindowTitle || a.ProcessName,
            process: a.ProcessName,
            appIcon: null
        }));
    } catch (e) {
        console.error("Failed to get running apps on Windows", e);
        return [];
    }
}

async function getLinuxRunningApps(): Promise<AppInfo[]> {
    try {
        // Use wmctrl to list windows: Window ID, Workspace, PID, Client Machine, Title
        const { stdout } = await execAsync('wmctrl -lp');
        const lines = stdout.split('\n').filter(line => line.trim() !== '');

        const apps: AppInfo[] = [];

        for (const line of lines) {
            // Format: 0x04000003  0 2889   machine Name of Window
            const parts = line.split(/\s+/);
            if (parts.length < 5) continue;

            const pid = parts[2];
            // Reconstruct title (everything after the machine name)
            // parts[3] is machine name usually
            const titleStartIndex = line.indexOf(parts[3]) + parts[3].length;
            const title = line.substring(titleStartIndex).trim();

            if (title === 'N/A' || title === '') continue;

            // Get process name using ps
            try {
                const { stdout: psOut } = await execAsync(`ps -p ${pid} -o comm=`);
                const processName = psOut.trim();

                apps.push({
                    id: processName, // Using process name as ID for consistency
                    name: title,
                    process: processName,
                    appIcon: null
                });
            } catch (psErr) {
                // If process lookup fails, maybe use title as process name or skip
                apps.push({
                    id: title,
                    name: title,
                    process: title,
                    appIcon: null
                });
            }
        }
        return apps;

    } catch (e) {
        console.error("Failed to get running apps on Linux (ensure wmctrl is installed):", e);
        return [];
    }
}
