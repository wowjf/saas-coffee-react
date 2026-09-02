/**
 * download-seed-images.mjs
 *
 * One-time setup tool: downloads the seed images used by autoSeed.ts and
 * defaults.ts, converts them to WebP and stores them in
 * src/server/data/seed-images/. After this runs once, the app is fully
 * offline-capable (no unsplash / picsum dependency at runtime).
 *
 * Usage:
 *   node scripts/download-seed-images.mjs
 */

import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../src/server/data/seed-images");

const IMAGES = {
  "cat-kahveler.webp": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800",
  "cat-cay.webp": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=800",
  "cat-soguk.webp": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800",
  "cat-firindan.webp": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800",
  "cat-tuzlular.webp": "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&q=80&w=800",
  "cat-tatlilar.webp": "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=800",
  "prod-espresso-single.webp": "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=800",
  "prod-espresso-double.webp": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=800",
  "prod-americano.webp": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800",
  "prod-filtre.webp": "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&q=80&w=800",
  "prod-latte.webp": "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&q=80&w=800",
  "prod-cappuccino.webp": "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&q=80&w=800",
  "prod-flatwhite.webp": "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&q=80&w=800",
  "prod-sufle.webp": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800",
  "banner-welcome.webp": "https://picsum.photos/seed/welcome/800/400",
};

await fs.mkdir(OUT_DIR, { recursive: true });

let ok = 0;
let failed = 0;

for (const [fileName, url] of Object.entries(IMAGES)) {
  const target = path.join(OUT_DIR, fileName);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await sharp(buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(target);
    console.log(`  ✓ ${fileName}`);
    ok++;
  } catch (err) {
    console.error(`  ✗ ${fileName}: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${ok} downloaded, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);