#!/bin/bash
set -e

echo "===== FIXING DUPLICATE getImageUrl ====="

# Check and fix the prompt page
FILE="src/app/prompts/[slug]/page.tsx"

if [ -f "$FILE" ]; then
  # Count how many times getImageUrl appears
  count=$(grep -c "const getImageUrl" "$FILE" || echo "0")
  
  if [ "$count" -gt 1 ]; then
    echo "⚠️ Found $count duplicate getImageUrl functions. Removing duplicates..."
    
    # Get the file content
    content=$(cat "$FILE")
    
    # Keep only the first getImageUrl and remove the rest
    # This is a simple approach - remove all but the first occurrence
    echo "$content" | awk '
      /const getImageUrl/ {
        if (!found) {
          found = 1
          print
        }
        next
      }
      { print }
    ' > "$FILE.tmp"
    
    mv "$FILE.tmp" "$FILE"
    echo "✅ Removed duplicate getImageUrl from $FILE"
  else
    echo "✅ No duplicates in $FILE"
  fi
fi

# Also check components
for file in src/components/prompt-card.tsx src/components/prompt-item.tsx; do
  if [ -f "$file" ]; then
    count=$(grep -c "const getImageUrl" "$file" || echo "0")
    if [ "$count" -gt 1 ]; then
      echo "️ Found $count duplicates in $file"
      # Same cleanup
      content=$(cat "$file")
      echo "$content" | awk '
        /const getImageUrl/ {
          if (!found) {
            found = 1
            print
          }
          next
        }
        { print }
      ' > "$file.tmp"
      mv "$file.tmp" "$file"
      echo "✅ Removed duplicates from $file"
    fi
  fi
done

echo ""
echo "===== AFTER FIX ====="
echo "Now try: git add . && git commit -m 'fix duplicate getImageUrl' && git push"
echo "=================================="