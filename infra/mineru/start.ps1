param([int]$Port = 8020)
$ErrorActionPreference = 'Stop'
if ($Port -lt 1 -or $Port -gt 65535) { throw 'Invalid MinerU port' }
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runtime = Join-Path $workspace 'work/mineru'
$env:MINERU_HOME = Join-Path $runtime 'home'
$env:HF_HOME = Join-Path $runtime 'huggingface'
$env:MINERU_TELEMETRY_DISABLED = '1'
$env:HF_HUB_DISABLE_XET = '1'
New-Item -ItemType Directory -Force -Path $env:MINERU_HOME | Out-Null
$env:ANYKO_PROCESSOR_ROOT = Join-Path $runtime 'processor'
& (Join-Path $runtime '.venv/Scripts/python.exe') -B -m uvicorn processor:app --app-dir (Join-Path $workspace 'infra/mineru') --host 127.0.0.1 --port $Port --workers 1 --log-level warning --no-access-log
exit $LASTEXITCODE
