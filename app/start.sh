#!/bin/sh

echo 'Creating python virtual environment "backend/backend_env"'
python -m venv backend/backend_env

echo ""
echo "Restoring backend python packages"
echo ""

cd backend
echo "Python version: $(./backend_env/bin/python3 --version)"
./backend_env/bin/python3 -m ensurepip --upgrade
./backend_env/bin/python3 -m pip install -r requirements.txt
if [ $? -ne 0 ]; then 
    echo "Failed to restore backend python packages"
    exit $?
fi

echo ""
echo "Restoring frontend npm packages"
echo ""

cd ../frontend
npm install
if [ $? -ne 0 ]; then
    echo "Failed to restore frontend npm packages"
    exit $?
fi

echo ""
echo "Building frontend"
echo ""

export NODE_OPTIONS=--max-old-space-size=4000
npm run build
if [ $? -ne 0 ]; then
    echo "Failed to build frontend"
    exit $?
fi

echo ""
echo "Starting backend"
echo ""

cd ../backend
./backend_env/bin/python3 ./app.py
# ./backend_env/bin/python -m flask run --port=500 --reload --debug
if [ $? -ne 0 ]; then
    echo "Failed to start backend"
    exit $?
fi
# open http://127.0.0.1:5000
