
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("public\appLOGO.png")
Write-Host "Width: $($img.Width) Height: $($img.Height)"
$img.Dispose()
