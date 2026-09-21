#!/bin/bash
# Faz-4 doğrulama — API + Web'i başlat, test et, kapat.
set -e
cd /home/z/my-project

fuser -k 3000/tcp 3001/tcp 2>/dev/null || true
pkill -9 -f "ts-node.*src/main.ts" 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
sleep 2

echo "→ API başlatılıyor..."
cd /home/z/my-project/apps/api
npx ts-node --transpile-only src/main.ts > /tmp/api.log 2>&1 &
API_PID=$!
echo "  PID: $API_PID"

for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cities 2>/dev/null | grep -qE '^200$'; then
    echo "  API hazır (${i}/30)"
    break
  fi
  if ! ps -p $API_PID > /dev/null; then
    echo "  ✗ API çöktü. Log:"
    tail -30 /tmp/api.log | tr -cd '\11\12\15\40-\176\200-\377'
    exit 1
  fi
  sleep 0.5
done

echo "→ Web başlatılıyor..."
cd /home/z/my-project/apps/web
npx next dev -p 3001 > /tmp/web.log 2>&1 &
WEB_PID=$!
echo "  PID: $WEB_PID"

for i in {1..40}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null | grep -qE '^200$'; then
    echo "  Web hazır (${i}/40)"
    break
  fi
  if ! ps -p $WEB_PID > /dev/null; then
    echo "  ✗ Web çöktü. Log:"
    tail -30 /tmp/web.log | tr -cd '\11\12\15\40-\176\200-\377'
    exit 1
  fi
  sleep 0.5
done

echo "→ Doğrulama betiği çalıştırılıyor..."
node /home/z/my-project/apps/api/scripts/verify-faz4.js
TEST_EXIT=$?

kill $API_PID $WEB_PID 2>/dev/null || true
sleep 1
kill -9 $API_PID $WEB_PID 2>/dev/null || true
echo "→ Sunucular kapatıldı"
exit $TEST_EXIT
