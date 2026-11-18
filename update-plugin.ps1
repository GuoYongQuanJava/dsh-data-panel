# 在 DSH profile 里执行 pnpm install（自动定位 pnpm，不用记路径）
#
# 用法（任意目录执行）：
#   powershell -ExecutionPolicy Bypass -File .\update-plugin.ps1
#
# 为什么需要它：pnpm 不在 PATH 里，藏在 DSH 自带的运行时目录下，
# 完整路径又长又跟安装位置有关（F:\DeepSeek Harness\... 换台机器就不同）。
# 本脚本自动找出 pnpm，然后到 profile 目录执行 install。
#
# 前置条件：DeepSeek Harness 必须完全退出。
#   pnpm 要替换 node_modules 下的插件目录，驱动进程占用 cua-driver.exe 时会 EPERM。

param(
  [string]$ProfileName = 'desktop',
  [string]$DshInstallRoot = ''      # 可选：手动指定 DSH 安装根，默认自动探测
)

$ErrorActionPreference = 'Stop'

Write-Host "=== DSH 插件安装器 ===" -ForegroundColor Cyan

# ── 1. 检查 DSH 是否在运行（在跑就装不了） ──
$running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
if ($running) {
  Write-Host ""
  Write-Host "检测到 DeepSeek Harness 正在运行（$($running.Count) 个进程）。" -ForegroundColor Yellow
  Write-Host "pnpm 需要替换 node_modules 下的插件目录，驱动占用文件时会失败。" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "请先完全退出 DeepSeek Harness（右键系统托盘图标 → 退出），再重新运行本脚本。" -ForegroundColor Yellow
  exit 1
}
Write-Host "DSH 未运行  OK" -ForegroundColor Green

# ── 2. 定位 pnpm（多路探测，命中即停） ──
function Find-Pnpm {
  param([string]$Root)

  $candidates = @()

  # ① 显式指定
  if ($Root -ne '') {
    $candidates += Join-Path $Root 'resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
  }

  # ② 从注册表 / 快捷方式推断不了，就从常见安装位置找
  $roots = @(
    'F:\DeepSeek Harness',
    'C:\Program Files\DeepSeek Harness',
    "$env:LOCALAPPDATA\Programs\DeepSeek Harness",
    "$env:ProgramFiles\DeepSeek Harness"
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($r in $roots) {
    $candidates += Join-Path $r 'resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
  }

  # ③ DSH_HOME 下的运行时（另一套布局）
  if ($env:DSH_HOME) {
    $candidates += Join-Path $env:DSH_HOME 'dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
  }
  $candidates += Join-Path $HOME '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'

  # ④ PATH 里有 pnpm 就直接用
  $onPath = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($onPath) { $candidates = @($onPath.Source) + $candidates }

  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return $null
}

$pnpm = Find-Pnpm -Root $DshInstallRoot
if (-not $pnpm) {
  throw @"
找不到 pnpm。已尝试的位置：
  - F:\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs
  - %LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\...
  - $env:DSH_HOME\dsh-runtimes\...
  - ~\.dsh\dsh-runtimes\...
  - PATH 中的 pnpm

如果 DSH 装在别的位置，用参数指定安装根：
  -DshInstallRoot "D:\Your\DeepSeek Harness"
"@
}
Write-Host "pnpm: $pnpm" -ForegroundColor Green

# ── 3. 定位 profile ──
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
$profileDir = Join-Path $dshHome "profiles\$ProfileName"
if (-not (Test-Path (Join-Path $profileDir 'package.json'))) {
  throw "找不到 profile：$profileDir（请确认 DSH 已初始化，或指定 -ProfileName）"
}
Write-Host "profile: $profileDir"

# ── 4. 执行 install ──
Write-Host ""
Write-Host "执行 pnpm install ..." -ForegroundColor Cyan
Push-Location $profileDir
try {
  & node $pnpm install 2>&1 | ForEach-Object { Write-Host "  $_" }
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}

if ($code -ne 0) {
  Write-Host ""
  Write-Host "pnpm install 失败（退出码 $code）。" -ForegroundColor Red
  Write-Host "常见原因：" -ForegroundColor Yellow
  Write-Host "  EPERM  → DSH 没完全退出，驱动进程还占着文件"
  Write-Host "  网络错误 → 检查网络，或先跑 git lfs pull 确保依赖目录完整"
  exit $code
}

Write-Host ""
Write-Host "=== 安装完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "现在重新打开 DeepSeek Harness。检查：" -ForegroundColor Yellow
Write-Host "  1. 插件页出现 dsh-cua-mcp，开关为开"
Write-Host "  2. 任务管理器有 cua-driver.exe"
Write-Host "  3. 对话里能调用 mcp__cua__* 工具"