// News of Thursday 26 November 2026 in one image.
// The page is drawn ahead of time (layout/page.html -> render.sh -> entry.png); this program
// checks that entry.png is a valid PNG or JPEG within the contest limits and writes the same
// bytes to $MAKEFUN_OUTPUT_DIR/entry.png (default /output/entry.png).
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1048576;
const MAX_SIDE = 1024;

function fail(message: string): never {
  process.stderr.write(`entry check failed: ${message}\n`);
  process.exit(1);
}

type Info = { format: 'PNG' | 'JPEG'; width: number; height: number };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngInfo(buf: Buffer): Info {
  // The IHDR chunk must come first: length (4) + "IHDR" (4) + width (4) + height (4).
  if (buf.length < 33) fail('PNG is too short to hold an IHDR chunk');
  if (buf.toString('latin1', 12, 16) !== 'IHDR') fail('PNG does not start with an IHDR chunk');
  return { format: 'PNG', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegInfo(buf: Buffer): Info {
  // Walk the marker segments after SOI until a baseline (SOF0) or progressive (SOF2) frame header.
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) fail(`JPEG marker expected at byte ${i}`);
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; }        // fill byte
    if (marker === 0xd9 || marker === 0xda) break;     // EOI or start of scan: no frame header found
    const length = buf.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      if (i + 9 > buf.length) fail('JPEG frame header is truncated');
      return { format: 'JPEG', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  fail('JPEG has no SOF0 or SOF2 frame header');
}

const here = dirname(fileURLToPath(import.meta.url));
let bytes: Buffer;
try {
  bytes = readFileSync(join(here, 'entry.png'));
} catch (err) {
  fail(`cannot read entry.png beside main.ts (${(err as Error).message})`);
}

if (bytes.length > MAX_BYTES) fail(`entry.png is ${bytes.length} bytes, over the ${MAX_BYTES}-byte limit`);

let info: Info;
if (PNG_SIGNATURE.every((b, k) => bytes[k] === b)) info = pngInfo(bytes);
else if (bytes[0] === 0xff && bytes[1] === 0xd8) info = jpegInfo(bytes);
else fail('entry.png starts with neither the PNG signature nor the JPEG SOI marker');

if (info.width < 1 || info.height < 1) fail(`image has an empty side (${info.width}x${info.height})`);
if (info.width > MAX_SIDE || info.height > MAX_SIDE) {
  fail(`image is ${info.width}x${info.height}, larger than ${MAX_SIDE}x${MAX_SIDE}`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), bytes);
console.log(`wrote ${join(outDir, 'entry.png')}: ${info.format} ${info.width}x${info.height}, ${bytes.length} bytes`);
