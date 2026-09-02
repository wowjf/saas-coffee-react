param(
  [string]$ServerHost = $(if ($env:VDS_HOST) { $env:VDS_HOST } else { "127.0.0.1" }),
  [string]$User = "deploy",
  [int]$LocalPort = 27018,
  [string]$RemoteMongoHost = "127.0.0.1",
  [int]$RemoteMongoPort = 27017,
  [string]$KeyPath = "$HOME\.ssh\cafe_vps_ed25519"
)

$ErrorActionPreference = "Stop"

$listener = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  Write-Host "Port $LocalPort is already listening on this computer."
  if ($process) {
    Write-Host "Process: $($process.ProcessName) ($($process.Id))"
  }
  return
}

$sshArgs = @(
  "-o", "StrictHostKeyChecking=accept-new",
  "-N",
  "-L", "$LocalPort`:$RemoteMongoHost`:$RemoteMongoPort",
  "$User@$ServerHost"
)

if ($KeyPath -and (Test-Path $KeyPath)) {
  $sshArgs = @("-i", $KeyPath) + $sshArgs
}
else {
  Write-Warning "SSH key was not found at '$KeyPath'. SSH may prompt for the VDS password."
}

Write-Host "Opening SSH tunnel:"
Write-Host "  local  127.0.0.1:$LocalPort"
Write-Host ("  remote {0}:{1} through {2}@{3}" -f $RemoteMongoHost, $RemoteMongoPort, $User, $ServerHost)
Write-Host "Keep this terminal open while using the VDS database."

& ssh @sshArgs
