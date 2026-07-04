#!/bin/bash
# Deploy web frontend and (optionally) backend to VPS
# Usage: ./deploy.sh [--backend]

set -e
VPS="root@187.127.158.26"
FRONTEND_REMOTE="/var/www/pppipes/frontend/"
BACKEND_REMOTE="/var/www/pppipes/backend/"

echo "▶ Building web frontend..."
cd "$(dirname "$0")/web"
npm run build --silent
echo "▶ Deploying frontend to VPS..."
rsync -az --delete dist/ "$VPS:$FRONTEND_REMOTE"
echo "✓ Frontend deployed"

if [[ "$1" == "--backend" ]]; then
  echo "▶ Building backend (linux/amd64)..."
  cd "$(dirname "$0")/go-backend"
  GOOS=linux GOARCH=amd64 go build -o ppp-backend-linux ./cmd/server/
  echo "▶ Uploading backend binary..."
  scp ppp-backend-linux "$VPS:${BACKEND_REMOTE}ppp-backend-new"
  echo "▶ Restarting backend..."
  ssh "$VPS" "
    kill \$(lsof -t ${BACKEND_REMOTE}ppp-backend) 2>/dev/null || true
    cp ${BACKEND_REMOTE}ppp-backend-new ${BACKEND_REMOTE}ppp-backend
    chmod +x ${BACKEND_REMOTE}ppp-backend
    cd ${BACKEND_REMOTE}
    nohup ./ppp-backend > /var/log/ppp-backend.log 2>&1 &
    echo '✓ Backend restarted'
  "
fi

echo "✓ Deploy complete"
