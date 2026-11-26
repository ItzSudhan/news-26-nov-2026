#!/bin/sh
# Render layout/page.html to entry.png (1024x1024) with headless Chrome.
# If the PNG is over 1 MiB, re-encode it as a quality-90 JPEG under the same name.
set -eu
ROOT="$(cd "$(dirname "$0")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$ROOT/entry.png"

"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1024,1024 --screenshot="$OUT" "file://$ROOT/layout/page.html" 2>/dev/null

SIZE=$(wc -c < "$OUT" | tr -d ' ')
if [ "$SIZE" -gt 1048576 ]; then
  sips -s format jpeg -s formatOptions 90 "$OUT" --out "$OUT.jpg" >/dev/null
  mv "$OUT.jpg" "$OUT"
  SIZE=$(wc -c < "$OUT" | tr -d ' ')
fi
sips -g pixelWidth -g pixelHeight "$OUT" | tail -2
echo "entry.png: $SIZE bytes"
