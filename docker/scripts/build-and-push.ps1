# =============================================================================
# OpenLDR — Build and push Docker images to Docker Hub (Windows PowerShell)
# =============================================================================
# Usage:
#   .\docker\scripts\build-and-push.ps1                          # defaults: openldr / latest
#   .\docker\scripts\build-and-push.ps1 -Registry myorg          # custom registry
#   .\docker\scripts\build-and-push.ps1 -Tag v1.0.0              # custom tag
#   .\docker\scripts\build-and-push.ps1 -DryRun                  # print commands only
#
# This script MUST be run from the repository root.
# =============================================================================

param(
    [string]$Registry = $( if ($env:DOCKER_REGISTRY) { $env:DOCKER_REGISTRY } else { "openldr" } ),
    [string]$Tag      = $( if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "latest" } ),
    [switch]$DryRun,
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

# Verify we're at the repo root
if (-not (Test-Path "package.json") -or -not (Test-Path "apps")) {
    Write-Error "ERROR: This script must be run from the repository root.`n  cd \path\to\openldr-v2`n  .\docker\scripts\build-and-push.ps1"
    exit 1
}

function Run-Command {
    param([string]$Description, [string[]]$Cmd)
    Write-Host "+ $($Cmd -join ' ')" -ForegroundColor Cyan
    if (-not $DryRun) {
        & $Cmd[0] $Cmd[1..($Cmd.Length - 1)]
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Command failed with exit code $LASTEXITCODE"
            exit $LASTEXITCODE
        }
    }
}

Write-Host "=============================================" -ForegroundColor Green
Write-Host " OpenLDR Docker Build & Push"
Write-Host " Registry: $Registry"
Write-Host " Tag:      $Tag"
Write-Host " Dry run:  $DryRun"
Write-Host "============================================="
Write-Host ""

# ---------------------------------------------------------------------------
# Services built from the monorepo root context (Turbo pruning Dockerfiles)
# ---------------------------------------------------------------------------
$turboServices = @(
    "openldr-web",
    "openldr-studio",
    "openldr-entity-services",
    "openldr-data-processing",
    "openldr-external-database",
    "openldr-mcp-server",
    "openldr-init"
)

foreach ($svc in $turboServices) {
    Write-Host "--- Building $svc (monorepo context) ---" -ForegroundColor Yellow
    Run-Command "Build $svc" @("docker", "build", "-t", "${Registry}/${svc}:${Tag}", "-f", "apps/${svc}/Dockerfile", ".")
    if (-not $NoPush) {
        Run-Command "Push $svc" @("docker", "push", "${Registry}/${svc}:${Tag}")
    }
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Gateway — built from its own context
# ---------------------------------------------------------------------------
Write-Host "--- Building openldr-gateway ---" -ForegroundColor Yellow
Run-Command "Build gateway" @("docker", "build", "-t", "${Registry}/openldr-gateway:${Tag}", "-f", "apps/openldr-gateway/Dockerfile", "apps/openldr-gateway/")
if (-not $NoPush) {
    Run-Command "Push gateway" @("docker", "push", "${Registry}/openldr-gateway:${Tag}")
}
Write-Host ""

# ---------------------------------------------------------------------------
# AI service — built from its own context
# ---------------------------------------------------------------------------
# Write-Host "--- Building openldr-ai ---" -ForegroundColor Yellow
# Run-Command "Build AI" @("docker", "build", "-t", "${Registry}/openldr-ai:${Tag}", "-f", "apps/openldr-ai/Dockerfile", "apps/openldr-ai/")
# if (-not $NoPush) {
#     Run-Command "Push AI" @("docker", "push", "${Registry}/openldr-ai:${Tag}")
# }
# Write-Host ""

# ---------------------------------------------------------------------------
# Internal database (Postgres + extensions) — built from its own context
# ---------------------------------------------------------------------------
Write-Host "--- Building openldr-internal-database ---" -ForegroundColor Yellow
Run-Command "Build DB" @("docker", "build", "-t", "${Registry}/openldr-internal-database:${Tag}", "-f", "apps/openldr-internal-database/Dockerfile.postgres", "apps/openldr-internal-database/")
if (-not $NoPush) {
    Run-Command "Push DB" @("docker", "push", "${Registry}/openldr-internal-database:${Tag}")
}
Write-Host ""

Write-Host "=============================================" -ForegroundColor Green
Write-Host " Done! Images pushed to ${Registry}/*:${Tag}"
Write-Host "============================================="
