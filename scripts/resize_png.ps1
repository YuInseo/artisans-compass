
Add-Type -AssemblyName System.Drawing

$source = "public\appLOGO.png"
$target = "public\appLOGO_256.png"

$img = [System.Drawing.Image]::FromFile($source)
$res = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($res)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 256, 256)
$res.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)

$img.Dispose()
$g.Dispose()
$res.Dispose()

Write-Host "Resized to $target"
