[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$Port = 3066
)

$projectRoot = Split-Path -Parent $PSCommandPath
$nextCli = Join-Path $projectRoot "node_modules\next\dist\bin\next"

if (-not (Test-Path -LiteralPath $nextCli)) {
  Write-Error "Next.js bulunamadı. Önce bu klasörde pnpm install çalıştırın."
  exit 1
}

# pnpm'in Windows alt süreç zincirini atlayarak Next.js'i doğrudan başlatır.
& node $nextCli dev -p $Port
exit $LASTEXITCODE
