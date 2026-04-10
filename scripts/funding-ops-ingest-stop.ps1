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

docker compose stop funding-ops-ingest | Out-Null
docker compose ps
