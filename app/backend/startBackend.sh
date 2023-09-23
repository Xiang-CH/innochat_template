#!/bin/sh

echo 'Creating python virtual environment "backend_env"'
python -m venv backend_env

echo ""
echo "Restoring backend python packages"
echo ""

./backend_env/bin/python -m pip install --upgrade pip
./backend_env/bin/python -m pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Failed to restore backend python packages"
    exit $?
fi

echo ""
echo "Starting backend"
echo ""

./backend_env/bin/python ./app.py
# ./backend_env/bin/python -m flask run --port=500 --reload --debug
if [ $? -ne 0 ]; then
    echo "Failed to start backend"
    exit $?
fi
# open http://127.0.0.1:5000