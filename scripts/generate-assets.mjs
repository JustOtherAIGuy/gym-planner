// One-off brand asset generation: assets/icon.svg → PWA icons, apple-touch
// icon, and iOS splash screens. Run from the repo root: node scripts/generate-assets.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const ICON = "assets/icon.svg";
const ICONS_DIR = "apps/web/public/icons";
const SPLASH_DIR = "apps/web/public/splash";

await mkdir(ICONS_DIR, { recursive: true });
await mkdir(SPLASH_DIR, { recursive: true });

// Manifest icons. The maskable variants use the same art — the glyph already
// sits inside the central 80% safe zone.
for (const size of [192, 512]) {
  await sharp(ICON).resize(size, size).png().toFile(`${ICONS_DIR}/icon-${size}.png`);
  await sharp(ICON)
    .resize(size, size)
    .flatten({ background: "#050505" })
    .png()
    .toFile(`${ICONS_DIR}/maskable-${size}.png`);
}

// iOS home-screen icon: 180×180, opaque (iOS ignores manifest icons).
await sharp(ICON)
  .resize(180, 180)
  .flatten({ background: "#050505" })
  .png()
  .toFile("apps/web/public/apple-touch-icon.png");

// iOS splash screens (apple-touch-startup-image) — portrait, common iPhones:
// 13/14/15/16 Pro Max class, 14/15 Pro class, 13/14 standard class.
const SPLASHES = [
  [1290, 2796],
  [1179, 2556],
  [1170, 2532],
];
for (const [w, h] of SPLASHES) {
  const glyph = await sharp(ICON).resize(Math.round(w * 0.3)).png().toBuffer();
  await sharp({
    create: { width: w, height: h, channels: 4, background: "#050505" },
  })
    .composite([{ input: glyph, gravity: "center" }])
    .png()
    .toFile(`${SPLASH_DIR}/${w}x${h}.png`);
}

console.log("brand assets generated");
