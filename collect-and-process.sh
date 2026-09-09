#!/bin/bash
AUTH="Authorization: Bearer pv-cron-8x2m1q"

echo "🚀 Batch import from cursor $(curl -s "https://promptsfa.ir/api/debug/status" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['telegram']['next_msg_id'])")..."

total=0
for round in $(seq 1 50); do
  echo "=== Round $round ==="
  
  # 1. Collect 3 posts
  collect=$(curl -s --max-time 60 "https://promptsfa.ir/api/import/collect?count=3" -H "$AUTH")
  collected=$(echo "$collect" | python3 -c "import sys,json; print(json.load(sys.stdin).get('collected',0))" 2>/dev/null)
  
  if [ "$collected" = "0" ] || [ -z "$collected" ]; then
    echo "✅ No more posts to collect"
    break
  fi
  
  echo "Collected: $collected posts"
  
  # 2. Process each
  for i in $(seq 1 $collected); do
    result=$(curl -s --max-time 60 "https://promptsfa.ir/api/debug/import-one" -H "$AUTH")
    slug=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('slug','error'))" 2>/dev/null)
    echo "  [$i/$collected] Imported: $slug"
    total=$((total + 1))
    sleep 3
  done
  
  echo "Total imported so far: $total"
  echo ""
done

echo "🏁 Finished. Total imported: $total"
