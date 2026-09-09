#!/bin/bash
AUTH="Authorization: Bearer pv-cron-8x2m1q"
BASE="https://promptsfa.ir/api"

imported=0
skipped=0
errors=0

echo "🚀 Smart import starting..."

for round in $(seq 1 100); do
  # 1. Collect 2 posts
  collect=$(curl -s --max-time 60 "$BASE/import/collect?count=2" -H "$AUTH")
  collected=$(echo "$collect" | python3 -c "import sys,json; print(json.load(sys.stdin).get('collected',0))" 2>/dev/null)
  
  if [ "$collected" = "0" ] || [ -z "$collected" ]; then
    echo "✅ No more posts collected. Stopping."
    break
  fi
  
  echo "=== Round $round | Collected: $collected ==="
  
  # 2. Process each
  for i in $(seq 1 $collected); do
    result=$(curl -s --max-time 90 "$BASE/debug/import-one" -H "$AUTH")
    
    slug=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug',''))" 2>/dev/null)
    ok=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
    skip=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('skipped',''))" 2>/dev/null)
    err=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','')[:60])" 2>/dev/null)
    
    if [ "$skip" = "duplicate" ]; then
      skipped=$((skipped + 1))
      echo "  ⏭️  DUPLICATE: $slug"
    elif [ "$ok" = "True" ] && [ -n "$slug" ]; then
      imported=$((imported + 1))
      echo "  ✅ IMPORTED: $slug"
    else
      errors=$((errors + 1))
      echo "  ❌ ERROR: $err"
    fi
    
    sleep 3
  done
  
  echo "  📊 Total: imported=$imported | skipped=$skipped | errors=$errors"
  echo ""
  
  # اگر خطاها زیاد شد، توقف کن
  if [ $errors -gt 5 ]; then
    echo "⚠️ Too many errors, stopping."
    break
  fi
done

echo ""
echo "🏁 FINAL RESULTS:"
echo "   Imported: $imported"
echo "   Skipped (duplicate): $skipped"
echo "   Errors: $errors"
