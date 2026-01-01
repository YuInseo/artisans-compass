import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface MonitorInfo {
    id: string; // InstanceName or Output Name
    name: string; // UserFriendlyName or EDID Name
    manufacturer: string; // ManufacturerName or EDID Manufacturer
}

export async function getMonitorNames(): Promise<MonitorInfo[]> {
    if (process.platform === 'win32') {
        return getWindowsMonitorNames();
    } else if (process.platform === 'linux') {
        return getLinuxMonitorNames();
    }
    return [];
}

async function getWindowsMonitorNames(): Promise<MonitorInfo[]> {
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

async function getLinuxMonitorNames(): Promise<MonitorInfo[]> {
    const monitors: MonitorInfo[] = [];
    const drmDir = '/sys/class/drm';

    try {
        if (!fs.existsSync(drmDir)) return [];

        const outputs = fs.readdirSync(drmDir);

        for (const output of outputs) {
            // Looking for cardX-connector formats, ensuring status is connected
            const statusPath = path.join(drmDir, output, 'status');
            const edidPath = path.join(drmDir, output, 'edid');

            if (fs.existsSync(statusPath) && fs.existsSync(edidPath)) {
                try {
                    const status = fs.readFileSync(statusPath, 'utf-8').trim();
                    if (status === 'connected') {
                        const edid = fs.readFileSync(edidPath);
                        const { name, manufacturer } = parseEdid(edid);
                        monitors.push({
                            id: output, // e.g. card0-HDMI-A-1
                            name: name || `Display (${output})`,
                            manufacturer: manufacturer || 'Unknown'
                        });
                    }
                } catch (readErr) {
                    console.warn(`Failed to read details for ${output}:`, readErr);
                }
            }
        }
    } catch (error) {
        console.error("Error fetching Linux monitor info:", error);
    }

    return monitors;
}

function parseWmiString(codeArray: number[] | null): string {
    if (!codeArray || !Array.isArray(codeArray)) return "";
    // Filter out 0 (null terminator)
    const codes = codeArray.filter(c => c !== 0);
    return String.fromCharCode(...codes);
}

function parseEdid(buffer: Buffer): { name?: string, manufacturer?: string } {
    // Basic EDID parsing
    // Header: 8 bytes
    // Vendor/Product ID: 10 bytes (Manufacturer is at 0x08-0x09)
    // ...
    // Detailed Timing Descriptors (18 bytes each) start at 0x36 (54)
    // We look for Monitor Name tag (0xFC) in the descriptors

    let name: string | undefined;
    let manufacturer: string | undefined;

    // Manufacturer ID at offset 0x08 (2 bytes)
    // Bits 14-10: Letter 1 (00001=A ... 11010=Z)
    // Bits 9-5: Letter 2
    // Bits 4-0: Letter 3
    if (buffer.length >= 10) {
        const vendorId = buffer.readUInt16BE(8);
        const l1 = (vendorId >> 10) & 0x1F;
        const l2 = (vendorId >> 5) & 0x1F;
        const l3 = vendorId & 0x1F;
        manufacturer = String.fromCharCode(l1 + 64, l2 + 64, l3 + 64);
    }

    // Iterate through 4 descriptors starting at 0x36 (54)
    // Each is 18 bytes long
    for (let i = 0; i < 4; i++) {
        const offset = 54 + (i * 18);
        if (offset + 18 > buffer.length) break;

        // Check for Display Descriptor (first two bytes are 00 00)
        // Third byte is 00
        // Fourth byte is the tag
        if (buffer[offset] === 0x00 && buffer[offset + 1] === 0x00 && buffer[offset + 2] === 0x00) {
            const tag = buffer[offset + 3];
            // Tag 0xFC is Monitor Name
            if (tag === 0xFC) {
                // Name follows at offset + 5, up to 13 bytes, usually terminated by 0x0A
                let rawName = buffer.toString('utf-8', offset + 5, offset + 18);
                // Terminate at newline or invalid char
                const newlineIdx = rawName.indexOf('\n');
                if (newlineIdx !== -1) rawName = rawName.substring(0, newlineIdx);
                name = rawName.trim();
            }
        }
    }

    return { name, manufacturer };
}
