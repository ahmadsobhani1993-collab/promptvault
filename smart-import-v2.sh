#!/bin/bash
AUTH="Authorization: Bearer pv-cron-8x2m1q"
BASE="https://promptsfa.ir/api"

echo "🚀 Resetting cursor to 998..."
curl -s "$BASE/debug/reset-cursor?id=998" -H "$AUTH"
echo ""

for i in {1..50}; do
  echo "=== Attempt $i ==="
  
  # 1. Collect
  res=$(curl -s "$BASE/import/collect?count=1" -H "$AUTH")
  echo "Collect: $res"
  
  collected=$(echo "$res" | grep -o '"collected":[0-9]*' | grep -o '[0-9]*')
  if [ "$collected" != "1" ]; then
    echo "✅ No more items to import. Stopping."
    break
  fi
  
  # 2. Import
  import_res=$(curl -s --max-time 90 "$BASE/debug/import-one" -H "$AUTH")
  echo "Import Result: $import_res"
  
  # 3. Wait to avoid Gemini quota limits
  echo "⏳ Waiting 12 seconds..."
  sleep 300
done

echo "🏁 Import process finished."
