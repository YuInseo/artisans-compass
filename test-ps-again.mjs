import { spawn } from 'child_process';
import readline from 'readline';

const psScript = `
$ErrorActionPreference = "SilentlyContinue"
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

public class ActiveWindowTrackerTest9 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static string GetActiveWindowJson() {
        try {
            IntPtr hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero) return "{}";
            
            uint pid = 0;
            GetWindowThreadProcessId(hwnd, out pid);
            
            Process proc = Process.GetProcessById((int)pid);
            if (proc == null) return "{}";
            
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hwnd, sb, 256);
            
            string title = sb.ToString().Replace("\\"", "\\\\\\"").Replace("\\n", "").Replace("\\r", "");
            string pName = proc.ProcessName.Replace("\\"", "\\\\\\"");
            
            return "{\\"title\\":\\"" + title + "\\",\\"owner\\":{\\"name\\":\\"" + pName + "\\"},\\"id\\":" + pid + "}";
        } catch {
            return "{}";
        }
    }

    public static void WriteBase64() {
        string json = GetActiveWindowJson();
        byte[] bytes = System.Text.Encoding.UTF8.GetBytes(json);
        string b64 = System.Convert.ToBase64String(bytes);
        Console.WriteLine("---BEGIN---");
        Console.WriteLine(b64);
        Console.WriteLine("---END---");
    }
}
"@ | Out-Null

for ($i=0; $i -lt 3; $i++) {
    [ActiveWindowTrackerTest9]::WriteBase64()
    Start-Sleep -Milliseconds 1000
}
`;

const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
const proc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded]);

const rl = readline.createInterface({ input: proc.stdout });
let buffer = "";
let recording = false;

rl.on('line', line => {
    line = line.trim();
    if (line === "---BEGIN---") {
        recording = true;
        buffer = "";
    } else if (line === "---END---") {
        recording = false;
        try {
            const decoded = Buffer.from(buffer, 'base64').toString('utf8');
            console.log('[PARSED]', JSON.parse(decoded));
        } catch (e) {
            console.error('PARSE ERROR', e);
        }
    } else if (recording) {
        buffer += line;
    }
});
