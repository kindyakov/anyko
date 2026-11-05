param([ValidateSet('flash', 'basic', 'standard', 'advanced')][string]$Tier = 'basic', [int]$Port = 8000)
$ErrorActionPreference = 'Stop'
if ($Port -lt 1 -or $Port -gt 65535) { throw 'Invalid MinerU port' }
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runtime = Join-Path $workspace 'work/mineru'
$env:MINERU_HOME = Join-Path $runtime 'home'
$env:HF_HOME = Join-Path $runtime 'huggingface'
$env:MINERU_TELEMETRY_DISABLED = '1'
$env:HF_HUB_DISABLE_XET = '1'
New-Item -ItemType Directory -Force -Path $env:MINERU_HOME | Out-Null
& (Join-Path $runtime '.venv/Scripts/mineru-kit.exe') api-server --host 127.0.0.1 --port $Port --tier $Tier --concurrency 1 --upload-dir (Join-Path $runtime 'uploads') --retention-seconds 86400 --disable-image-analysis --log-level warning
exit $LASTEXITCODE
