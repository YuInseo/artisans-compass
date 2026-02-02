
Add-Type -AssemblyName System.Drawing

$sourcePng = Resolve-Path "public\appLOGO.png"
$targetIco = "public\appLOGO.ico"

Write-Host "Converting $sourcePng to $targetIco..."

try {
    $bitmap = [System.Drawing.Bitmap]::FromFile($sourcePng)
    # GetHicon creates a cursor/icon handle. Limitations: usually 32x32.
    # To do better, we'd need more complex resizing logic, but for now getting the build to pass is priority.
    # For a high-res icon, we ideally need a multi-page ICO.
    
    # Attempting to create a higher quality icon is hard with just System.Drawing.
    # Let's try the simple approach first.
    
    $iconHandle = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    
    
    $stream = New-Object System.IO.FileStream($targetIco, [System.IO.FileMode]::Create)
    $icon.Save($stream)
    $stream.Close()
    
    # Simple cleanup
    $icon.Dispose()
    $bitmap.Dispose()
    
    Write-Host "Success!"
} catch {
    Write-Error "Failed to convert: $_"
    exit 1
}
