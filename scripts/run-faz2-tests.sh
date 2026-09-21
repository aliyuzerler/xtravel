#!/bin/bash
# Faz-2 doğrulama — API'yi başlat, test et, kapat.
set -e

cd /home/z/my-project/apps/api

# Eğer port 3000'de bir şey varsa önce öldür
fuser -k 3000/tcp 2>/dev/null || true
pkill -9 -f "ts-node.*src/main.ts" 2>/dev/null || true
sleep 2

# API'yi başlat
echo "→ API başlatılıyor..."
npx ts-node --transpile-only src/main.ts > /tmp/api.log 2>&1 &
API_PID=$!
echo "  PID: $API_PID"

# Sağlıklı başlamasını bekle (en fazla 15 sn)
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me 2>/dev/null | grep -qE '^(200|401)$'; then
    echo "  API hazır (${i}/30)"
    break
  fi
  if ! ps -p $API_PID > /dev/null; then
    echo "  ✗ API process çöktü. Log:"
    tail -30 /tmp/api.log | tr -cd '\11\12\15\40-\176\200-\377'
    exit 1
  fi
  sleep 0.5
done

# Notification log'ları görmek için tail başlat
echo "→ Doğrulama betiği çalıştırılıyor..."
node scripts/verify-faz2.js
TEST_EXIT=$?

# Backend log'unda notification created göründü mü?
echo ""
echo "→ Backend notification log'ları:"
grep -E "Notification created" /tmp/api.log | tail -10 | tr -cd '\11\12\15\40-\176\200-\377' || echo "  (notification log bulunamadı)"

# Kapat
kill $API_PID 2>/dev/null || true
sleep 1
kill -9 $API_PID 2>/dev/null || true
echo "→ API kapatıldı (PID=$API_PID)"

exit $TEST_EXIT
