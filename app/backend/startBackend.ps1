Write-Host 'Creating python virtual environment "backend_env"'
python -m venv backend_env

Write-Host ""
Write-Host "Restoring backend python packages"
Write-Host ""

./backend_env/Scripts/python -m pip install --upgrade pip
./backend_env/Scripts/python -m pip install -r requirements.txt
# if ($LASTEXITCODE -ne 0) {
#     Write-Host "Failed to restore backend python packages"
#     exit $LASTEXITCODE
# }

Write-Host ""
Write-Host "Starting backend"
Write-Host ""

./backend_env/Scripts/python ./app.py
# ./backend_env/Scripts/python -m flask run --port=500 --reload --debug
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start backend"
    exit $LASTEXITCODE
}
# open http://127.0.0.1:5000