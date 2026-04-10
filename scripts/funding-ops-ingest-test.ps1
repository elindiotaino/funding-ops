param(
  [string]$TriggeredBy = "manual-validation"
)

$ErrorActionPreference = "Stop"

function Load-EnvFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      return
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (-not (Test-Path "Env:$name")) {
      Set-Item -Path "Env:$name" -Value $value
    }
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Load-EnvFile (Join-Path $repoRoot ".env.local")
Load-EnvFile (Join-Path $repoRoot ".env.docker")

if (-not [Environment]::GetEnvironmentVariable("INGEST_SHARED_SECRET")) {
  throw "INGEST_SHARED_SECRET is missing. Add it to .env.local or .env.docker."
}

node .\scripts\verify-supabase-feed-schema.mjs

$response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://127.0.0.1:8787/jobs/daily-refresh" -Headers @{
  "x-ingest-secret" = $env:INGEST_SHARED_SECRET
} -ContentType "application/json" -Body (@{
  triggeredBy = $TriggeredBy
} | ConvertTo-Json -Compress)

Write-Output $response.Content
