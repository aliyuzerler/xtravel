#!/bin/bash
# Faz-3 doğrulama — API'yi başlat, test et, kapat.
set -e
cd /home/z/my-project/apps/api

fuser -k 3000/tcp 2>/dev/null || true
pkill -9 -f "ts-node.*src/main.ts" 2>/dev/null || true
sleep 2

echo "→ API başlatılıyor..."
npx ts-node --transpile-only src/main.ts > /tmp/api.log 2>&1 &
API_PID=$!
echo "  PID: $API_PID"

for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cities 2>/dev/null | grep -qE '^200$'; then
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

echo "→ Doğrulama betiği çalıştırılıyor..."
node scripts/verify-faz3.js
TEST_EXIT=$?

echo ""
echo "→ Backend notification log'ları (provider onay):"
grep -E "Notification created" /tmp/api.log | tail -10 | tr -cd '\11\12\15\40-\176\200-\377' || true

kill $API_PID 2>/dev/null || true
sleep 1
kill -9 $API_PID 2>/dev/null || true
echo "→ API kapatıldı (PID=$API_PID)"
exit $TEST_EXIT
