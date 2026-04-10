param(
  [switch]$Build
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

$required = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INGEST_SHARED_SECRET"
)

$missing = @(
  $required | Where-Object {
    -not [Environment]::GetEnvironmentVariable($_)
  }
)
if ($missing.Count -gt 0) {
  throw "Missing required env values: $($missing -join ', '). Add them to .env.local or .env.docker."
}

if (-not $env:FUNDING_OPS_STORAGE_ROOT) {
  $env:FUNDING_OPS_STORAGE_ROOT = "D:/Projects/funding-ops/runtime/data"
}

$storagePath = $env:FUNDING_OPS_STORAGE_ROOT -replace "/", "\"
New-Item -ItemType Directory -Force -Path $storagePath | Out-Null

docker version | Out-Null

if ($Build) {
  docker compose build funding-ops-ingest
}

docker compose up -d funding-ops-ingest | Out-Null

for ($index = 0; $index -lt 10; $index++) {
  Start-Sleep -Seconds 2
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8787/health" -Headers @{
      "x-ingest-secret" = $env:INGEST_SHARED_SECRET
    }

    if ($response.StatusCode -eq 200) {
      Write-Output "funding-ops-ingest is healthy on http://127.0.0.1:8787"
      exit 0
    }
  } catch {
  }
}

docker compose logs --tail 80 funding-ops-ingest
throw "funding-ops-ingest failed to become healthy."
