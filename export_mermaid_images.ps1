param(
    [string]$Root = ".",
    [ValidateSet("png", "svg", "pdf")]
    [string]$Format = "png",
    [int]$Scale = 2,
    [string]$Background = "white",
    [switch]$IncludeClassDiagram,
    [switch]$UseNpx
)

$ErrorActionPreference = "Stop"

function Test-Command {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-MermaidCommand {
    if (-not $UseNpx -and (Test-Command "mmdc.cmd")) {
        return @{ Command = "mmdc.cmd"; Prefix = @() }
    }

    if (-not $UseNpx -and (Test-Command "mmdc")) {
        return @{ Command = "mmdc"; Prefix = @() }
    }

    if (Test-Command "npx.cmd") {
        return @{ Command = "npx.cmd"; Prefix = @("--yes", "--package", "@mermaid-js/mermaid-cli", "--", "mmdc") }
    }

    if (Test-Command "npx") {
        return @{ Command = "npx"; Prefix = @("--yes", "--package", "@mermaid-js/mermaid-cli", "--", "mmdc") }
    }

    throw "Cannot find mmdc or npx. Install Node.js, then run: npm install -g @mermaid-js/mermaid-cli"
}

function Convert-MermaidFile {
    param(
        [string]$InputPath,
        [hashtable]$MermaidCommand
    )

    $outputPath = [System.IO.Path]::ChangeExtension($InputPath, $Format)

    if (Test-Path $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }

    $args = @()
    $args += $MermaidCommand.Prefix
    $args += @("-i", $InputPath, "-o", $outputPath, "-b", $Background)

    if ($Format -eq "png") {
        $args += @("-s", $Scale)
    }

    Write-Host "Export:" $InputPath "->" $outputPath
    & $MermaidCommand.Command @args

    if ($LASTEXITCODE -ne 0) {
        throw "Export failed: $InputPath"
    }

    if (-not (Test-Path $outputPath)) {
        throw "Export did not create output file: $outputPath"
    }

    $outputFile = Get-Item -LiteralPath $outputPath
    if ($outputFile.Length -eq 0) {
        Remove-Item -LiteralPath $outputPath -Force
        throw "Export created an empty output file: $outputPath"
    }
}

$resolvedRoot = Resolve-Path -LiteralPath $Root
$mermaidCommand = Get-MermaidCommand

$files = New-Object System.Collections.Generic.List[string]

$rootItem = Get-Item -LiteralPath $resolvedRoot
if ($rootItem.PSIsContainer -and $rootItem.Name -like "De_*") {
    Get-ChildItem -Path $rootItem.FullName -File -Filter "*.mmd" | ForEach-Object {
        $files.Add($_.FullName)
    }
}
else {
    Get-ChildItem -Path $resolvedRoot -Directory -Filter "ChuDe_*" | ForEach-Object {
        $topicDir = $_

        if ($IncludeClassDiagram) {
            $classDiagram = Join-Path $topicDir.FullName "Class_Diagram.mmd"
            if (Test-Path $classDiagram) {
                $files.Add($classDiagram)
            }
        }

        Get-ChildItem -Path $topicDir.FullName -Directory -Filter "De_*" | ForEach-Object {
            Get-ChildItem -Path $_.FullName -File -Filter "*.mmd" | ForEach-Object {
                $files.Add($_.FullName)
            }
        }
    }
}

if ($files.Count -eq 0) {
    Write-Host "No .mmd files found."
    exit 0
}

foreach ($file in $files) {
    Convert-MermaidFile -InputPath $file -MermaidCommand $mermaidCommand
}

Write-Host "Done. Exported" $files.Count ".mmd files to .$Format."
