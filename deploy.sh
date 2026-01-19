echo "👉 Pull code từ branch develop..."
git pull origin develop

# echo "👉 Cài dependencies (production)..."
# npm ci

echo "👉 Build project..."
npm run build

echo "👉 Reload PM2..."
pm2 reload teacher-management

echo "✅ Deploy thành công!"