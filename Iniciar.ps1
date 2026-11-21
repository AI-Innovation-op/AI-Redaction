param([int]$Port=4317)
$ErrorActionPreference='Stop'
$base=Split-Path -Parent $MyInvocation.MyCommand.Path
$bundle=Get-ChildItem -LiteralPath 'C:\Program Files\WindowsApps' -Directory -Filter 'OpenAI.CodexPrimaryRuntime*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
$nodePath=$null;$pythonPath=$null
if($bundle){
 $nodeCandidate=Join-Path $bundle.FullName 'dependencies\node\bin\node.exe'
 $pythonCandidate=Join-Path $bundle.FullName 'dependencies\python\python.exe'
 if(Test-Path -LiteralPath $nodeCandidate){$nodePath=$nodeCandidate}
 if(Test-Path -LiteralPath $pythonCandidate){$pythonPath=$pythonCandidate}
}
if(-not $nodePath){$nodePath=(Get-Command node -ErrorAction SilentlyContinue).Source}
if(-not $pythonPath){$pythonPath=(Get-Command python -ErrorAction SilentlyContinue).Source}
if(-not $nodePath -or -not $pythonPath){throw 'Se requieren Node.js 22+ y Python 3 con python-docx y pdfplumber. Consulta README.md.'}
$env:APP_PYTHON=$pythonPath;$env:PORT="$Port"
Write-Host "Abre http://127.0.0.1:$Port . Mantén esta ventana abierta; Ctrl+C detiene la app."
& $nodePath (Join-Path $base 'server.mjs')
