# 把 dsh-cua-mcp 登记到当前 DSH profile（纯方案 B）
#
# 用法（在仓库根目录执行）：
#   powershell -ExecutionPolicy Bypass -File .\install-cua-plugin.ps1
#
# 本脚本只做一件事：把插件登记进 profile 的 package.json。
# 文件安装交给 pnpm —— 与 dsh-data-panel / dsh-better-sidebar 完全一致的机制：
#
#   profile/package.json
#     dependencies:  "dsh-cua-mcp": "file:<仓库路径>/dsh-cua-mcp"
#     dsh.profile.bundles: 追加 "dsh-cua-mcp"
#
# 脚本执行完会提示你自己跑 pnpm install（需要先关闭 DSH）。
#
# 为什么还要这个脚本：手改 package.json 有两个坑 ——
#   1. 格式容易写错（少逗号、多逗号）
#   2. PowerShell 的 Set-Content/Out-File 会写 UTF-8 BOM，Node 的 JSON.parse 不认，
#      会直接导致 DSH 启动崩溃。本脚本强制无 BOM 写入并用 Node 复核。

param(
  [string]$ProfileName = 'desktop'
)

$ErrorActionPreference = 'Stop'

Write-Host "=== dsh-cua-mcp 登记器 ===" -ForegroundColor Cyan

# ── 1. 定位仓库里的插件源码 ──
$repoRoot = $PSScriptRoot
$src = Join-Path $repoRoot 'dsh-cua-mcp'
if (-not (Test-Path $src)) {
  throw "找不到插件目录：$src（请在仓库根目录执行本脚本）"
}
if (-not (Test-Path (Join-Path $src 'package.json'))) {
  throw "插件目录缺少 package.json：$src"
}

# ── 2. 校验二进制（缺了插件起不来，提前拦） ──
$cuaDir = Join-Path $src 'vendor\cua'
$cuaExe = Join-Path $cuaDir 'cua-driver.exe'
if (-not (Test-Path $cuaExe)) {
  throw @"
缺少 CUA 驱动：$cuaExe

vendor/cua/ 由 Git LFS 管理，克隆后需要先拉取实体：
    git lfs install
    git lfs pull

拉取完成后重新运行本脚本。
"@
}
$files = Get-ChildItem $cuaDir -File
$totalMb = [math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB, 1)
if ($files.Count -lt 8 -or $totalMb -lt 50) {
  throw "vendor/cua/ 内容不完整（$($files.Count) 个文件，$totalMb MB）。预期 8 个文件、约 81 MB。请先执行 git lfs pull。"
}
Write-Host "二进制: $($files.Count) 个文件, $totalMb MB  OK" -ForegroundColor Green

# ── 3. 定位 profile ──
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
$profileDir = Join-Path $dshHome "profiles\$ProfileName"
$manifest = Join-Path $profileDir 'package.json'
if (-not (Test-Path $manifest)) {
  throw "找不到 profile 清单：$manifest（请确认 DSH 已初始化，或指定 -ProfileName）"
}
Write-Host "profile: $profileDir"

# ── 4. 登记到 package.json ──
$json = (Get-Content $manifest -Raw -Encoding utf8) | ConvertFrom-Json

# dependencies
if ($null -eq $json.dependencies) {
  $json | Add-Member -NotePropertyName 'dependencies' -NotePropertyValue ([pscustomobject]@{}) -Force
}
$spec = 'file:' + ($repoRoot -replace '\\', '/') + '/dsh-cua-mcp'
if ($json.dependencies.PSObject.Properties.Name -contains 'dsh-cua-mcp') {
  $json.dependencies.'dsh-cua-mcp' = $spec
} else {
  $json.dependencies | Add-Member -NotePropertyName 'dsh-cua-mcp' -NotePropertyValue $spec
}
Write-Host "dependencies.$spec"

# bundles
$bundles = @($json.dsh.profile.bundles)
if ($bundles -notcontains 'dsh-cua-mcp') {
  $json.dsh.profile.bundles = $bundles + 'dsh-cua-mcp'
  Write-Host "已加入 dsh.profile.bundles"
}

# 写回：必须无 BOM，否则 Node 解析失败、DSH 起不来
$out = $json | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($manifest, $out, (New-Object System.Text.UTF8Encoding $false))

# 复核
$checkJs = Join-Path $env:TEMP "dsh-check-manifest-$PID.js"
$checkCode = "try{JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'));console.log('ok')}catch(e){console.log('fail:'+e.message)}"
[System.IO.File]::WriteAllText($checkJs, $checkCode, (New-Object System.Text.UTF8Encoding $false))
$check = & node $checkJs $manifest
Remove-Item $checkJs -Force -ErrorAction SilentlyContinue
if ($check -ne 'ok') { throw "profile 清单写入后无法解析：$check" }
Write-Host "已登记（依赖 + bundle），JSON 校验通过" -ForegroundColor Green

# ── 5. 提示下一步 ──
$running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "=== 登记完成，接下来安装文件 ===" -ForegroundColor Cyan
Write-Host ""
if ($running) {
  Write-Host "检测到 DeepSeek Harness 正在运行。" -ForegroundColor Yellow
  Write-Host "pnpm 需要替换 node_modules 下的插件目录，驱动进程占用时会失败。" -ForegroundColor Yellow
  Write-Host "请先完全退出 DeepSeek Harness，再执行下面这条：" -ForegroundColor Yellow
} else {
  Write-Host "接下来在 profile 目录执行 pnpm install：" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  cd `"$profileDir`""
Write-Host "  node `"$dshHome\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs`" install"
Write-Host ""
Write-Host "装完重启 DeepSeek Harness。检查：" -ForegroundColor Yellow
Write-Host "  1. 插件页出现 dsh-cua-mcp，开关为开"
Write-Host "  2. 任务管理器有 cua-driver.exe"
Write-Host "  3. 对话里能调用 mcp__cua__* 工具"