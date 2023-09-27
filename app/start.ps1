Write-Host 'Creating python virtual environment "backend/backend_env"'
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
  # fallback to python3 if python not found
  $pythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
}
Start-Process -FilePath ($pythonCmd).Source -ArgumentList "-m venv ./backend/backend_env" -Wait -NoNewWindow

Write-Host ""
Write-Host "Restoring backend python packages"
Write-Host ""

Set-Location backend
$venvPythonPath = "./backend_env/scripts/python.exe"
if (Test-Path -Path "/usr") {
  # fallback to Linux venv path
  $venvPythonPath = "./backend_env/bin/python"
}

Start-Process -FilePath $venvPythonPath -ArgumentList "-m pip install -r requirements.txt" -Wait -NoNewWindow

Write-Host ""
Write-Host "Restoring frontend npm packages"
Write-Host ""
Set-Location ../frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to restore frontend npm packages"
    exit $LASTEXITCODE
}
$env:NODE_OPTIONS="--max-old-space-size=4000"

Write-Host ""
Write-Host "Building frontend"
Write-Host ""
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build frontend"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Starting backend"
Write-Host ""
Set-Location ../backend
Start-Process http://127.0.0.1:5000

Start-Process -FilePath $venvPythonPath -ArgumentList "./app.py" -Wait -NoNewWindow

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start backend"
    exit $LASTEXITCODE
}
