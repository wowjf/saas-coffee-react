param(
  [int]$MongoTunnelPort = 27018,
  [string]$Database = "cafe_db",
  [int]$AppPort = 3000
)

$ErrorActionPreference = "Stop"

$listener = Get-NetTCPConnection -LocalPort $MongoTunnelPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) {
  throw "No SSH tunnel is listening on port $MongoTunnelPort. Run scripts/start-vds-mongo-tunnel.ps1 in another terminal first."
}

$appListener = Get-NetTCPConnection -LocalPort $AppPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($appListener) {
  $process = Get-Process -Id $appListener.OwningProcess -ErrorAction SilentlyContinue
  $processLabel = if ($process) { "$($process.ProcessName) ($($process.Id))" } else { "process $($appListener.OwningProcess)" }
  throw "Port $AppPort is already in use by $processLabel. Stop the existing dev server before running against VDS data."
}

$env:MONGODB_URI = "mongodb://127.0.0.1:$MongoTunnelPort/$Database"
$env:ALLOWED_ORIGINS = "http://localhost:3000"
$env:PORT = "$AppPort"

Write-Host "Starting local app against VDS MongoDB:"
Write-Host "  $env:MONGODB_URI"
Write-Host "Changes made in this app will affect VDS data."

npm run dev
