<#
.SYNOPSIS
  One-time dev-performance setup for Windows. Adds Windows Defender real-time
  scan exclusions for this repo so Turbopack's many small file reads aren't
  intercepted by the antivirus on every compile.

.NOTES
  Run in an ELEVATED PowerShell (Run as Administrator). Safe to re-run.
  This is the *secondary* dev-perf win. The primary one is keeping the repo on
  an SSD (see docs/PERFORMANCE_AUDIT_PLAN.md, P1) — an HDD checkout stays slow
  regardless of AV exclusions.
#>

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error 'Please run this script from an elevated (Administrator) PowerShell.'
  exit 1
}

# Repo root = parent of this script's folder.
$repo = Split-Path -Parent $PSScriptRoot

$paths = @(
  $repo,
  (Join-Path $repo '.next'),
  (Join-Path $repo 'node_modules')
)

foreach ($p in $paths) {
  Add-MpPreference -ExclusionPath $p
  Write-Host "Excluded path:    $p"
}

# Exclude the Node process so its file I/O isn't scanned.
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($node) {
  Add-MpPreference -ExclusionProcess $node
  Write-Host "Excluded process: $node"
}

Write-Host ''
Write-Host 'Done. Restart `next dev` to feel the effect.' -ForegroundColor Green
