param(
  [string]$ServerHost = $(if ($env:VDS_HOST) { $env:VDS_HOST } else { "127.0.0.1" }),
  [string]$User = "root",
  [string]$RemotePath = "/srv/cafe/app",
  [string]$KeyPath = "$HOME\\.ssh\\cafe_vps_ed25519"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$archivePath = Join-Path $env:TEMP "cafe-$timestamp.tar.gz"
$remoteArchivePath = "/tmp/cafe-$timestamp.tar.gz"

try {
  Write-Host "Creating deploy archive..."
  Push-Location $projectRoot
  & tar `
    --exclude node_modules `
    --exclude dist `
    --exclude uploads `
    --exclude .runtime-logs `
    --exclude .env `
    -czf $archivePath .
  Pop-Location

  Write-Host "Preparing remote directory..."
  & ssh -i $KeyPath "$User@$ServerHost" "mkdir -p '$RemotePath' '/srv/cafe/shared/uploads' && find '$RemotePath' -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf -- {} +"

  Write-Host "Uploading release..."
  & scp -i $KeyPath $archivePath "${User}@${ServerHost}:${remoteArchivePath}"

  Write-Host "Extracting and restarting containers..."
  & ssh -i $KeyPath "$User@$ServerHost" "tar -xzf '$remoteArchivePath' -C '$RemotePath' && rm -f '$remoteArchivePath' && cd '$RemotePath' && docker compose up -d --build"

  Write-Host "Deployment completed."
}
finally {
  if (Test-Path $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}
