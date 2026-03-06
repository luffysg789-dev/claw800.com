#!/usr/bin/env bash
set -euo pipefail

apt-get update
apt-get install -y nginx git curl

# install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm i -g pm2

echo "Install done. Node: $(node -v), npm: $(npm -v), pm2: $(pm2 -v)"
