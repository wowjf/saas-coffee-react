param(
  [Parameter(Mandatory = $true)]
  [string]$ArchivePath,
  [string]$MongoUri = "mongodb://localhost:27017",
  [switch]$NoDrop
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ArchivePath)) {
  throw "Archive was not found: $ArchivePath"
}

$mongorestore = Get-Command mongorestore -ErrorAction SilentlyContinue
if (-not $mongorestore) {
  $defaultToolsPath = "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe"
  if (Test-Path $defaultToolsPath) {
    $mongorestore = Get-Item $defaultToolsPath
  }
}

if (-not $mongorestore) {
  throw "mongorestore was not found. Install MongoDB Database Tools or restore with the Docker MongoDB container."
}

$restoreArgs = @("--uri", $MongoUri, "--archive=$ArchivePath", "--gzip")
if (-not $NoDrop) {
  $restoreArgs += "--drop"
}

Write-Host "Restoring MongoDB archive..."
& $mongorestore.FullName @restoreArgs
if ($LASTEXITCODE -ne 0) {
  throw "mongorestore failed."
}

Write-Host "Restore completed."
