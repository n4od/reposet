#Requires -Version 5.1
<#
.SYNOPSIS
    Rebuilds templates/generic from recipes/.

.DESCRIPTION
    recipes/ is the source of truth. templates/generic/ is the merged, drop-in
    copy. Run this after editing any recipe, then commit both folders.

    Recipe 12 (reusable workflows) is excluded on purpose: it defines a workflow
    also named "CI" and is an alternative to recipe 06, not an addition to it.

    Files are byte-copied, so line endings are preserved exactly.

.PARAMETER Check
    Verify only. Rebuilds into a temp folder and fails if the committed
    templates/generic differs. Used by .github/workflows/verify.yml.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1 -Check
#>
[CmdletBinding()]
param(
    [switch]$Check
)

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$recipes = Join-Path $root 'recipes'
# Nested on purpose: Windows PowerShell 5.1's Join-Path has no -AdditionalChildPath.
$out     = Join-Path (Join-Path $root 'templates') 'generic'
$exclude = @('12-reusable-workflows')

if (-not (Test-Path -LiteralPath $recipes)) {
    throw "recipes/ not found at $recipes"
}

# --- 1. Collect every file, keyed by path relative to the repo root ----------
$map = [ordered]@{}

foreach ($recipe in Get-ChildItem -LiteralPath $recipes -Directory |
                   Where-Object { $exclude -notcontains $_.Name }) {

    foreach ($file in Get-ChildItem -LiteralPath $recipe.FullName -Recurse -File -Force) {
        # Transient twin created by scripts/pack-prepare.js for npm; never merge it.
        if ($file.Name -eq 'gitignore') { continue }

        $rel = $file.FullName.Substring($recipe.FullName.Length + 1)

        if ($map.Contains($rel)) {
            throw "Duplicate path '$rel' in recipes '$($recipe.Name)' and '$($map[$rel].Recipe)'. Two recipes cannot provide the same file."
        }

        $map[$rel] = [pscustomobject]@{
            Recipe = $recipe.Name
            Source = $file.FullName
        }
    }
}

if ($map.Count -eq 0) { throw "No files found under $recipes" }

# --- 2. Write the merged tree ------------------------------------------------
$target = if ($Check) {
    Join-Path ([System.IO.Path]::GetTempPath()) ("kit-verify-" + [guid]::NewGuid().ToString('N'))
} else {
    $out
}

if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
}
New-Item -ItemType Directory -Path $target -Force | Out-Null

foreach ($rel in $map.Keys) {
    $dest    = Join-Path $target $rel
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $map[$rel].Source -Destination $dest -Force
}

# --- 3. Check mode: compare against what is committed ------------------------
if ($Check) {
    $diff = @()

    $built = Get-ChildItem -LiteralPath $target -Recurse -File -Force
    foreach ($f in $built) {
        $rel  = $f.FullName.Substring($target.Length + 1)
        $dest = Join-Path $out $rel
        if (-not (Test-Path -LiteralPath $dest)) {
            $diff += "missing:  $rel"
            continue
        }
        $a = (Get-FileHash -LiteralPath $f.FullName    -Algorithm SHA256).Hash
        $b = (Get-FileHash -LiteralPath $dest          -Algorithm SHA256).Hash
        if ($a -ne $b) { $diff += "changed:  $rel" }
    }

    foreach ($f in Get-ChildItem -LiteralPath $out -Recurse -File -Force) {
        $rel = $f.FullName.Substring($out.Length + 1)
        if (-not (Test-Path -LiteralPath (Join-Path $target $rel))) {
            $diff += "extra:    $rel"
        }
    }

    Remove-Item -LiteralPath $target -Recurse -Force

    if ($diff.Count -gt 0) {
        Write-Host "templates/generic is out of date:" -ForegroundColor Red
        $diff | ForEach-Object { Write-Host "  $_" }
        Write-Host ""
        Write-Host "Fix: ./scripts/build-templates.ps1"
        exit 1
    }

    Write-Host "templates/generic is up to date." -ForegroundColor Green
    exit 0
}

Write-Host ("templates/generic rebuilt: {0} files from {1} recipes" -f `
    $map.Count, ($map.Values.Recipe | Sort-Object -Unique).Count) -ForegroundColor Green
