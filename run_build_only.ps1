$nodePath = "C:\Users\Mook\.gemini\antigravity\scratch\node-v22"
$zipWrapperPath = "C:\Users\Mook\.gemini\antigravity\scratch\Blog-Writer-clone\7zip-wrapper"
$env:PATH = "$zipWrapperPath;$nodePath;$env:PATH"

Set-Location "C:\Users\Mook\.gemini\antigravity\scratch\Blog-Writer-clone"
Write-Output "=== Running npm run build:win inside Clone ==="
npm run build:win
