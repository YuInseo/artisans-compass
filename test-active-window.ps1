$ErrorActionPreference = "Stop"

Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  }
"@

for ($i = 0; $i -lt 3; $i++) {
  $hwnd = [Win32]::GetForegroundWindow()
  if ($hwnd -ne [IntPtr]::Zero) {
    $pidObj = 0
    [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pidObj) | Out-Null
    $process = Get-Process -Id $pidObj -ErrorAction SilentlyContinue
    if ($null -ne $process) {
      $sb = New-Object System.Text.StringBuilder 256
      [Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
      $json = @{
        title = $sb.ToString()
        owner = @{ name = $process.ProcessName }
        id = $process.Id
      } | ConvertTo-Json -Compress
      Write-Output $json
    }
  }
  Start-Sleep -Seconds 1
}
