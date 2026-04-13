
#!/bin/bash

# Function to kill all child processes on exit
cleanup() {
    echo ""
    echo "🛑  Stopping all services..."
    # Kill background jobs
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap SIGINT (Ctrl+C) and clean up
trap cleanup SIGINT SIGTERM

echo "Hello World"
echo "🚀 Starting GrindUp Development Environment..."
echo "--------------------------------------------------------"

# 0. Kill existing ports
echo "🧹 Cleaning up ports 3000 and 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

# 1. Start Runner (Backend)
echo ">>> Starting Runner (Port 8080)..."
cd apps/runner

# Setup venv if needed
if [ ! -d "venv" ]; then
    echo "Creating python venv..."
    python3 -m venv venv
fi

# Use explicit path to ensure we use the venv
VENV_PIP="./venv/bin/pip"
VENV_PYTHON="./venv/bin/python"

# Install dependencies
echo "Installing runner dependencies..."
$VENV_PIP install -r requirements.txt

# Run the runner using venv python
$VENV_PYTHON main.py &
RUNNER_PID=$!
echo "Runner started with PID $RUNNER_PID"
cd ../..

# 2. Start Web App (Frontend)
echo "--------------------------------------------------------"
echo ">>> Starting Web App (Port 3000)..."
cd apps/web

# Use npx simply to avoid pnpm arg parsing issues
# But let's try just pnpm exec which resolves binaries
# Also passing hostname explicitly

# Detect IP for access
IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$IP" ]; then
    IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
if [ -z "$IP" ]; then
    IP="localhost"
fi

echo "✅ Detected Local IP: $IP"

echo "Syncing Database Schema..."
./node_modules/.bin/prisma generate
./node_modules/.bin/prisma db push --accept-data-loss

echo "Running Next.js..."
# Reverting to localhost to match your GitHub/Google config
export NEXTAUTH_URL="http://localhost:3000"
export AUTH_URL="http://localhost:3000"
export AUTH_TRUST_HOST=true
# Force Webpack (disable Turbopack) to avoid dev compile hangs
export TURBOPACK=0
export NEXT_WEBPACK_USE_TURBOPACK=0

# Use Webpack dev (no Turbopack)
./node_modules/.bin/next dev -H 0.0.0.0 &
WEB_PID=$!
echo "Web App started with PID $WEB_PID"
cd ../..

# 3. Network Info
echo "--------------------------------------------------------"
echo "Waiting for services to initialize..."
sleep 5

# Get Local IP (try en0 then en1 for WiFi)
IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$IP" ]; then
    IP=$(ipconfig getifaddr en1 2>/dev/null)
fi

echo ""
echo "✅ Services are running!"
echo "🌐 Web App (Local):    http://localhost:3000"
echo "⚙️  Runner (Local):     http://localhost:8080"
echo ""

if [ ! -z "$IP" ]; then
    echo "📱 To access from your phone (Connect to same WiFi):"
    echo "   URL: http://$IP:3000"
    echo ""
    echo "   If you are port forwarding via VS Code:"
    echo "   Forward Port: 3000 (Web App)"
else
    echo "⚠️  Could not determine local Ethernet/WiFi IP."
    echo "   Check your network settings to find your LAN IP."
fi

echo "--------------------------------------------------------"
echo "Press Ctrl+C to stop all services."

# Wait forever until Ctrl+C
wait
