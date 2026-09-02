param(
  [string]$ServerHost = $(if ($env:VDS_HOST) { $env:VDS_HOST } else { "127.0.0.1" }),
  [string]$User = "deploy",
  [string]$RemotePath = "/srv/cafe/app",
  [string]$Database = "cafe_db",
  [string]$Service = "mongodb",
  [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "backups"),
  [string]$KeyPath = "$HOME\.ssh\cafe_vps_ed25519"
)

$ErrorActionPreference = "Stop"

function Assert-SafeName {
  param(
    [string]$Value,
    [string]$Label
  )

  if ($Value -notmatch "^[A-Za-z0-9_.-]+$") {
    throw "$Label may only contain letters, numbers, dots, underscores, and hyphens."
  }
}

Assert-SafeName -Value $Database -Label "Database"
Assert-SafeName -Value $Service -Label "Service"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$fileName = "$Database-$timestamp.archive.gz"
$localPath = Join-Path $OutDir $fileName
$remoteArchivePath = "/tmp/$fileName"
$sshTarget = "$User@$ServerHost"

$sshArgs = @("-o", "StrictHostKeyChecking=accept-new")
if ($KeyPath -and (Test-Path $KeyPath)) {
  $sshArgs += @("-i", $KeyPath)
}
else {
  Write-Warning "SSH key was not found at '$KeyPath'. SSH may prompt for a password if you run this in an interactive terminal."
}

$remoteDumpCommand = "cd '$RemotePath' && docker compose exec -T $Service mongodump --db $Database --archive --gzip > '$remoteArchivePath'"

try {
  Write-Host "Creating remote MongoDB dump..."
  & ssh @sshArgs $sshTarget $remoteDumpCommand
  if ($LASTEXITCODE -ne 0) {
    throw "Remote mongodump failed."
  }

  Write-Host "Downloading dump to $localPath..."
  & scp @sshArgs "${sshTarget}:$remoteArchivePath" $localPath
  if ($LASTEXITCODE -ne 0) {
    throw "Download failed."
  }

  Write-Host "MongoDB dump downloaded:"
  Write-Host $localPath
}
finally {
  Write-Host "Cleaning up remote temp file..."
  & ssh @sshArgs $sshTarget "rm -f '$remoteArchivePath'" | Out-Null
}
