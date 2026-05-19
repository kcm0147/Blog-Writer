$nodePath = "C:\Users\Mook\.gemini\antigravity\scratch\node-v22"
$env:PATH = "$nodePath;$env:PATH"

Set-Location "C:\Users\Mook\.gemini\antigravity\scratch\Blog-Writer-clone"

Write-Output "=== Running npm install inside clone ==="
npm install

Write-Output "=== Applying 7za.exe wrapper swap ==="
$targetDir = "C:\Users\Mook\.gemini\antigravity\scratch\Blog-Writer-clone\node_modules\7zip-bin\win\x64"
$real7z = Join-Path $targetDir "7za_real.exe"
$original7z = Join-Path $targetDir "7za.exe"
$wrapper7z = "C:\Users\Mook\.gemini\antigravity\scratch\Blog-Writer-clone\7zip-wrapper\7za.exe"

if (-not (Test-Path $real7z)) {
    Rename-Item -Path $original7z -NewName "7za_real.exe" -Force
    Write-Output "Renamed original 7za.exe to 7za_real.exe"
}
Copy-Item -Path $wrapper7z -Destination $original7z -Force
Write-Output "Copied wrapper to 7za.exe"

Write-Output "=== Starting Build ==="
$zipWrapperPath = "C:\Users\Mook\.gemini\antigravity\scratch\Blog-Writer-clone\7zip-wrapper"
$env:PATH = "$zipWrapperPath;$env:PATH"
npm run build:win
