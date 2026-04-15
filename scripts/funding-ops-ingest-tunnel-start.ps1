param()

$ErrorActionPreference = "Stop"

$configPath = "C:\Users\joche\.cloudflared\funding-ops-ingest.yml"
$logPath = "C:\Users\joche\.cloudflared\funding-ops-ingest.log"
$processName = "cloudflared"
$expectedArgs = "funding-ops-ingest.yml"

$existing = Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" |
  Where-Object { $_.CommandLine -like "*$expectedArgs*" }

if ($existing) {
  Write-Output "funding-ops-ingest tunnel already running."
  exit 0
}

Start-Process cloudflared -ArgumentList @(
  "tunnel",
  "--config",
  $configPath,
  "--logfile",
  $logPath,
  "run",
  "funding-ops-ingest"
) -WindowStyle Hidden | Out-Null

Write-Output "Started funding-ops-ingest tunnel."
