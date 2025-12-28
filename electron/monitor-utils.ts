import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MonitorInfo {
    id: string; // InstanceName
    name: string; // UserFriendlyName
    manufacturer: string; // ManufacturerName
}

export async function getMonitorNames(): Promise<MonitorInfo[]> {
    try {
        // PowerShell command to get WMI Monitor ID
        // select UserFriendlyName, ManufacturerName, InstanceName
        const psCommand = `
            Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID |
            Select-Object UserFriendlyName, ManufacturerName, InstanceName |
            ConvertTo-Json -Compress
        `;

        const { stdout } = await execAsync(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 5 // 5MB buffer just in case
        });

        if (!stdout.trim()) return [];

        let items: any[] = [];
        try {
            const parsed = JSON.parse(stdout);
            items = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            console.error("Failed to parse WMI JSON:", e);
            return [];
        }

        const monitors: MonitorInfo[] = items.map(item => {
            const name = parseWmiString(item.UserFriendlyName);
            const manufacturer = parseWmiString(item.ManufacturerName);
            return {
                id: item.InstanceName,
                name: name || "Unknown Display",
                manufacturer
            };
        });

        return monitors;

    } catch (error) {
        console.error("Error fetching monitor names via WMI:", error);
        return [];
    }
}

function parseWmiString(codeArray: number[] | null): string {
    if (!codeArray || !Array.isArray(codeArray)) return "";
    // Filter out 0 (null terminator)
    const codes = codeArray.filter(c => c !== 0);
    return String.fromCharCode(...codes);
}
