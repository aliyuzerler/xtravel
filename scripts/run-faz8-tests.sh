#!/bin/bash
# Faz-8 doğrulama — health + security quick checks
set -e
cd /home/z/my-project

fuser -k 3000/tcp 2>/dev/null || true
pkill -9 -f "ts-node.*src/main.ts" 2>/dev/null || true
sleep 2

echo "→ API başlatılıyor..."
cd /home/z/my-project/apps/api
npx ts-node --transpile-only src/main.ts > /tmp/api.log 2>&1 &
API_PID=$!

for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cities 2>/dev/null | grep -qE '^200$'; then
    echo "  API hazır (${i}/30)"
    break
  fi
  if ! ps -p $API_PID > /dev/null; then
    echo "  ✗ API çöktü:"
    tail -20 /tmp/api.log | tr -cd '\11\12\15\40-\176\200-\377'
    exit 1
  fi
  sleep 0.5
done

echo ""
echo "=== 1) HEALTH ENDPOINT'LERİ ==="
echo "→ GET /api/health"
curl -s http://localhost:3000/api/health | python3 -m json.tool 2>&1 | head -20

echo ""
echo "→ GET /api/health/live"
curl -s http://localhost:3000/api/health/live | python3 -m json.tool 2>&1 | head -5

echo ""
echo "→ GET /api/health/ready"
curl -s http://localhost:3000/api/health/ready | python3 -m json.tool 2>&1 | head -5

echo ""
echo "=== 2) SECURITY QUICK CHECKS ==="

# Admin token al
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@turizm-pazaryeri.local","password":"Admin123!"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

# User register (yeni)
TS=$(date +%s)
USER_EMAIL="faz8-sec-${TS}@test.local"
curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"${USER_EMAIL}\",\"password\":\"Test12345!\",\"fullName\":\"Sec Test\",\"role\":\"user\"}" > /dev/null
USER_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"${USER_EMAIL}\",\"password\":\"Test12345!\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

echo "→ User admin endpoint → 403"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/dashboard/stats -H "Authorization: Bearer $USER_TOKEN")
echo "  /admin/dashboard/stats (user): $STATUS (expected 403)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/users -H "Authorization: Bearer $USER_TOKEN")
echo "  /admin/users (user): $STATUS (expected 403)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/services -H "Authorization: Bearer $USER_TOKEN")
echo "  /admin/services (user): $STATUS (expected 403)"

echo ""
echo "→ Admin endpoint → 200 (admin token)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/dashboard/stats -H "Authorization: Bearer $ADMIN_TOKEN")
echo "  /admin/dashboard/stats (admin): $STATUS (expected 200)"

echo ""
echo "→ IDOR: User başkasının rezervasyonuna → 403"
# Customer'ın bir rezervasyonunu al
CUSTOMER_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"customer@demo.local","password":"Customer123!"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
RES_ID=$(curl -s http://localhost:3000/api/user/reservations -H "Authorization: Bearer $CUSTOMER_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['items'][0]['id'])" 2>/dev/null)
# Başka kullanıcı erişmeye çalış
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/user/reservations/$RES_ID -H "Authorization: Bearer $USER_TOKEN")
echo "  /user/reservations/$RES_ID (other user): $STATUS (expected 403)"

echo ""
echo "→ Rate limit: login 5/dk → 6+ → 429"
THROTTLED=0
for i in {1..7}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"${USER_EMAIL}\",\"password\":\"wrong\"}")
  if [ "$STATUS" = "429" ]; then
    THROTTLED=$((THROTTLED+1))
  fi
done
echo "  429 count: $THROTTLED (expected > 0)"

echo ""
echo "→ Upload güvenliği: PDF tipi → 400"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/uploads/presign -H "Content-Type: application/json" -H "Authorization: Bearer $USER_TOKEN" -d '{"filename":"bad.pdf","contentType":"application/pdf","size":1024}')
echo "  PDF upload (user): $STATUS (expected 400)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/uploads/presign -H "Content-Type: application/json" -H "Authorization: Bearer $USER_TOKEN" -d '{"filename":"big.jpg","contentType":"image/jpeg","size":6291456}')
echo "  6MB upload (user): $STATUS (expected 400)"

echo ""
echo "→ Webhook imza: geçersiz → 401"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/payments/webhook -H "Content-Type: application/json" -d '{"signature":"invalid","conversationId":"x","status":"success"}')
echo "  Invalid webhook signature: $STATUS (expected 401)"

echo ""
echo "→ SQL injection email → 401"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"' OR 1=1 --\",\"password\":\"x\"}")
echo "  SQL injection login: $STATUS (expected 401)"

echo ""
echo "=== 3) SENTRY INIT LOG ==="
cat /tmp/api.log | tr -cd '\11\12\15\40-\176\200-\377' | grep -i "Sentry" | head -5

echo ""
echo "=== 4) CRON MODULE LOG ==="
cat /tmp/api.log | tr -cd '\11\12\15\40-\176\200-\377' | grep -iE "Cron|Schedule" | head -5

kill $API_PID 2>/dev/null || true
sleep 1
kill -9 $API_PID 2>/dev/null || true
echo ""
echo "→ API kapatıldı"
echo "=== Faz-8 test tamam ==="
