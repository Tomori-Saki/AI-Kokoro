$ErrorActionPreference = "Stop"
$port = 5173
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Try-Run($cmd, $args) {
  $exe = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($null -ne $exe) {
    Write-Host "Starting server with $cmd on http://localhost:$port ..."
    & $cmd @args
    return $true
  }
  return $false
}

if (Try-Run "python" @("-m", "http.server", $port)) { exit 0 }
if (Try-Run "python3" @("-m", "http.server", $port)) { exit 0 }

Write-Host "Python not found. Please install Python or run:"
Write-Host "  npx http-server -p $port"
