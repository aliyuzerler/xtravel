#!/bin/bash
# Faz-1 doğrulama — API'yi başlat, test et, kapat.
set -e

cd /home/z/my-project/apps/api

# Eğer port 3000'de bir şey varsa önce öldür
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# API'yi başlat
echo "→ API başlatılıyor..."
npx ts-node --transpile-only src/main.ts > /tmp/api.log 2>&1 &
API_PID=$!
echo "  PID: $API_PID"

# Sağlıklı başlamasını bekle (en fazla 15 sn)
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me 2>/dev/null | grep -qE '^(200|401)$'; then
    echo "  API hazır (${i}/30 saniye)"
    break
  fi
  if ! ps -p $API_PID > /dev/null; then
    echo "  ✗ API process çöktü. Log:"
    tail -20 /tmp/api.log
    exit 1
  fi
  sleep 0.5
done

# Testi çalıştır
echo "→ Doğrulama betiği çalıştırılıyor..."
node scripts/verify-faz1.js || true

# Kapat
kill $API_PID 2>/dev/null || true
sleep 1
kill -9 $API_PID 2>/dev/null || true
echo "→ API kapatıldı (PID=$API_PID)"
