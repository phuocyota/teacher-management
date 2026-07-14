echo "👉 Pull code từ branch develop..."
git pull origin develop

echo "👉 Cài/cập nhật dependencies..."
npm install --no-audit --no-fund

echo "👉 Build project..."
npm run build

echo "👉 Reload PM2 processes..."
pm2 startOrReload ecosystem.config.js

echo "✅ Deploy thành công!"
