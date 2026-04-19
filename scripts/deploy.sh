#!/bin/bash
set -e

cd /var/www/digital-signage-app

# Pull latest code
git pull origin master

# Install backend dependencies and build
cd backend
npm install --production=false
npm run build

# Install frontend dependencies and build
cd ../frontend
npm install --production=false
npm run build

# Restart the service
sudo systemctl restart digital-signage.service

echo "Deploy completed at $(date)"
