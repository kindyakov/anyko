$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runtime = Join-Path $workspace 'work/mineru'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
& uv venv --python 3.12.15 (Join-Path $runtime '.venv')
if ($LASTEXITCODE -ne 0) { throw 'MinerU venv creation failed' }
& uv pip install --python (Join-Path $runtime '.venv/Scripts/python.exe') -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'MinerU dependency installation failed' }
