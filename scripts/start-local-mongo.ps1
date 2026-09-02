param(
  [int]$Port = 27017,
  [string]$BindIp = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$mongodPath = Join-Path $projectRoot ".runtime-logs\mongodb-7-extract\MongoDB\Server\7.0\bin\mongod.exe"
$dataPath = Join-Path $projectRoot ".local-mongo\data"
$logPath = Join-Path $projectRoot ".local-mongo\log\mongod.log"

if (-not (Test-Path $mongodPath)) {
  throw "Portable MongoDB 7.0 was not found at $mongodPath"
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  if ($process -and $process.ProcessName -eq "mongod") {
    Write-Host "MongoDB is already listening on $BindIp`:$Port."
    return
  }

  throw "Port $Port is already in use by process $($listener.OwningProcess)."
}

New-Item -ItemType Directory -Force -Path $dataPath,(Split-Path -Parent $logPath),".runtime-logs" | Out-Null

$outLog = Join-Path $projectRoot ".runtime-logs\portable-mongod.out.log"
$errLog = Join-Path $projectRoot ".runtime-logs\portable-mongod.err.log"

$process = Start-Process `
  -FilePath $mongodPath `
  -ArgumentList @("--dbpath", $dataPath, "--logpath", $logPath, "--logappend", "--bind_ip", $BindIp, "--port", $Port) `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -WindowStyle Hidden `
  -PassThru

Start-Sleep -Seconds 3

if ($process.HasExited) {
  throw "MongoDB exited during startup. See $logPath"
}

Write-Host "MongoDB started on $BindIp`:$Port."
