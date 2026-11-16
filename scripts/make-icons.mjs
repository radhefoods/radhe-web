// Draws the icon of the shop, a peacock feather, and writes every file a
// browser, a phone or a search engine asks for:
//
//   src/app/favicon.ico            16, 32 and 48 px
//   src/app/icon.svg               the drawing itself, for any size
//   src/app/icon.png               192 px (a multiple of 48, as Google asks)
//   src/app/apple-icon.png         180 px on the shop's ground (iOS)
//   public/brand/icon-192.png      the web manifest, on the shop's ground
//   public/brand/icon-512.png
//   public/brand/icon-maskable-512.png   with room for Android's masks
//
// Run `node scripts/make-icons.mjs` after changing the drawing; the files
// are committed. `sharp` is the one Next.js brings along.
//
// The feather is computed, not traced: every barb is a tapered sliver along
// a curve from the shaft to the edge of the vane, coloured by its distance
// from the eye, the way the colour bands of a real feather run. The eye is
// four nested shapes that sit low, towards the shaft: gold-green, bronze,
// turquoise and the dark blue heart.
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

/** The ground of the shop (`--color-canvas`), for the icons that need one. */
const GROUND = "#f1f6f1";

/**
 * The feather as an SVG on a transparent square of 512.
 *
 * @param {"full" | "small"} detail "small" for 16 and 32 px: fewer, thicker
 *   barbs and a larger eye, so the shape survives the size
 */
export function feather(detail = "full") {
  const small = detail === "small";
  const f = (n) => Math.round(n * 10) / 10;
  // A fixed pseudo-random sequence: the feather is the same on every run.
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const C = { x: 256, y: 206 }; // the middle of the eye
  const NOTCH = { x: 256, y: 300 }; // where the shaft enters the eye
  const rad = (deg) => (deg * Math.PI) / 180;

  // The shaft: a gentle curve from the eye down to the quill.
  const S1 = { x: 260, y: 392 };
  const S2 = { x: 246, y: 478 };
  const shaftAt = (t) => ({
    x: (1 - t) * (1 - t) * NOTCH.x + 2 * (1 - t) * t * S1.x + t * t * S2.x,
    y: (1 - t) * (1 - t) * NOTCH.y + 2 * (1 - t) * t * S1.y + t * t * S2.y,
  });

  // How far the vane reaches from the eye in each direction (0° = the tip).
  const REACH = [
    [0, 198],
    [25, 186],
    [55, 168],
    [90, 156],
    [125, 158],
    [160, 168],
  ];
  const reach = (deg) => {
    for (let i = 1; i < REACH.length; i += 1) {
      if (deg <= REACH[i][0]) {
        const [a0, r0] = REACH[i - 1];
        const [a1, r1] = REACH[i];
        const t = (deg - a0) / (a1 - a0);
        return r0 + (r1 - r0) * t * t * (3 - 2 * t);
      }
    }
    return REACH[REACH.length - 1][1];
  };

  const outline = (left, right) =>
    "M" +
    left
      .concat(right.reverse())
      .map(([x, y]) => `${f(x)} ${f(y)}`)
      .join("L") +
    "Z";

  // One barb: a tapered sliver along a quadratic curve from A over P to E.
  const sliver = (A, P, E, width) => {
    const left = [];
    const right = [];
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      const x = (1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * P.x + t * t * E.x;
      const y = (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * P.y + t * t * E.y;
      const dx = 2 * (1 - t) * (P.x - A.x) + 2 * t * (E.x - P.x);
      const dy = 2 * (1 - t) * (P.y - A.y) + 2 * t * (E.y - P.y);
      const len = Math.hypot(dx, dy) || 1;
      // Widest a third of the way out, a point at the tip.
      const swell = Math.sin(Math.PI * Math.min(1, 0.18 + t * 0.82)) ** 0.7;
      const w = (0.15 + (width - 0.15) * swell) / 2;
      left.push([x - (dy / len) * w, y + (dx / len) * w]);
      right.push([x + (dy / len) * w, y - (dx / len) * w]);
    }
    return outline(left, right);
  };

  // A barb of the vane: from the shaft to the edge, bowed outward.
  const barb = (side, deg, scale, width, bow) => {
    const r = reach(deg) * scale * (0.95 + rnd() * 0.1);
    const E = {
      x: C.x + side * r * Math.sin(rad(deg)),
      y: C.y - r * Math.cos(rad(deg)),
    };
    const A = {
      x: NOTCH.x + side * 1.5,
      y: NOTCH.y - 34 + Math.pow(deg / 160, 1.25) * 150,
    };
    if (A.y > NOTCH.y) {
      A.x = shaftAt((A.y - NOTCH.y) / (S2.y - NOTCH.y)).x + side * 1.5;
    }
    const d = { x: E.x - A.x, y: E.y - A.y };
    const len = Math.hypot(d.x, d.y);
    const k = bow * len * (0.9 + rnd() * 0.2);
    const P = {
      x: A.x + d.x * 0.5 + ((-d.y / len) * side * k) / 1,
      y: A.y + d.y * 0.52 + (d.x / len) * side * k,
    };
    return sliver(A, P, E, width);
  };

  const count = small ? 15 : 50;
  const green = [];
  const gilt = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < count; i += 1) {
      const deg = 1.5 + (146 * i) / (count - 1);
      // Straight at the tip, bowed on the sides, calm again low on the vane.
      const bow = 0.2 * (1 - deg / 240) * Math.min(1, 0.3 + deg / 30);
      const scale = (side < 0 ? 0.97 : 1) * (i % 5 === 2 ? 1.05 : 1);
      const width = (small ? 13 : 5.2) * (deg > 85 ? 1 - (deg - 85) / 150 : 1);
      green.push(barb(side, deg, scale, width, bow));
      // A second, finer set in gold between them: the shimmer.
      if (!small && deg < 112) gilt.push(barb(side, deg + 1.7, 0.9, 2.6, bow));
    }
  }

  // The fine lines of the barbs across the bronze of the eye.
  const grain = [];
  if (!small) {
    for (const side of [1, -1]) {
      for (let i = 0; i < 30; i += 1) {
        const deg = 3 + (170 * i) / 29;
        const S = {
          x: C.x + side * 58 * Math.sin(rad(deg)),
          y: C.y + 44 - 66 * Math.cos(rad(deg)),
        };
        const E = {
          x: C.x + side * 150 * Math.sin(rad(deg)),
          y: C.y + 20 - 150 * Math.cos(rad(deg)),
        };
        grain.push(
          `M${f(S.x)} ${f(S.y)}Q${f((S.x + E.x) / 2 + side * 6)} ${f((S.y + E.y) / 2 + 5)} ${f(E.x)} ${f(E.y)}`,
        );
      }
    }
  }

  // An egg: rounder below than above.
  const egg = (cy, rx, top, bottom) => {
    const cx = 256;
    return (
      `M${f(cx - rx)} ${cy}` +
      `C${f(cx - rx)} ${f(cy - top * 0.62)} ${f(cx - rx * 0.6)} ${f(cy - top)} ${cx} ${f(cy - top)}` +
      `C${f(cx + rx * 0.6)} ${f(cy - top)} ${f(cx + rx)} ${f(cy - top * 0.62)} ${f(cx + rx)} ${cy}` +
      `C${f(cx + rx)} ${f(cy + bottom * 0.6)} ${f(cx + rx * 0.55)} ${f(cy + bottom)} ${cx} ${f(cy + bottom)}` +
      `C${f(cx - rx * 0.55)} ${f(cy + bottom)} ${f(cx - rx)} ${f(cy + bottom * 0.6)} ${f(cx - rx)} ${cy}Z`
    );
  };
  const k = small ? 1.1 : 1;
  const halo = egg(224, 110 * k, 126 * k, 118 * k);
  const bronze = egg(232, 90 * k, 112 * k, 100 * k);
  const turquoise = egg(246, 66 * k, 78 * k, 72 * k);
  const heart = egg(259, 46 * k, 47 * k, 45 * k);

  // The shaft itself: wider towards the quill, which ends in a point.
  const left = [];
  const right = [];
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    const p = shaftAt(t);
    const q = shaftAt(Math.min(1, t + 0.01));
    const o = shaftAt(Math.max(0, t - 0.01));
    const len = Math.hypot(q.x - o.x, q.y - o.y) || 1;
    const end = Math.max(0, (t - 0.82) / 0.18);
    const w =
      (((small ? 9 : 3.4) + t * (small ? 9 : 5.6)) * (1 - end * end * 0.88)) /
      2;
    left.push([p.x - ((q.y - o.y) / len) * w, p.y + ((q.x - o.x) / len) * w]);
    right.push([p.x + ((q.y - o.y) / len) * w, p.y - ((q.x - o.x) / len) * w]);
  }
  const shaft = outline(left, right);

  const stops = (list) =>
    list
      .map(
        ([offset, color, opacity]) =>
          `<stop offset="${offset}" stop-color="${color}"${opacity === undefined ? "" : ` stop-opacity="${opacity}"`}/>`,
      )
      .join("");
  const radial = (id, cx, cy, r, list) =>
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">`,
    `<title>Radhe Foods</title>`,
    `<defs>`,
    // The barbs: deep green at the eye, emerald, then gold at the tips.
    radial("b", 256, 226, 206, [
      [0, "#0a6a4c"],
      [0.5, "#0f8a5c"],
      [0.72, "#22a866"],
      [0.86, "#7dba42"],
      [0.95, "#d2ad36"],
      [1, "#e0b84a"],
    ]),
    radial("g", 256, 226, 190, [
      [0, "#e6c35c"],
      [0.6, "#d9b244"],
      [0.85, "#f0d27a"],
      [1, "#c9952c"],
    ]),
    radial("h", 256, 232, 140, [
      [0, "#d9b23c"],
      [0.62, "#c2b33a"],
      [0.8, "#6fb548"],
      [0.9, "#2ea466", 0.9],
      [1, "#1f9d62", 0],
    ]),
    radial("z", 236, 196, 150, [
      [0, "#f2c064"],
      [0.45, "#d18f38"],
      [0.8, "#a7631f"],
      [1, "#84490f"],
    ]),
    radial("t", 240, 212, 112, [
      [0, "#6fe9ee"],
      [0.4, "#1fc3d6"],
      [0.78, "#0f93cf"],
      [1, "#1a5fc0"],
    ]),
    radial("i", 242, 240, 74, [
      [0, "#4a40c4"],
      [0.5, "#231c86"],
      [1, "#0e0b45"],
    ]),
    `<linearGradient id="s" gradientUnits="userSpaceOnUse" x1="256" y1="300" x2="244" y2="506">${stops(
      [
        [0, "#e9cf86"],
        [0.5, "#cfa349"],
        [1, "#a97a26"],
      ],
    )}</linearGradient>`,
    `<clipPath id="c"><path d="${halo}"/></clipPath>`,
    `</defs>`,
    // Leaning to the right, as the feather of the logo does.
    `<g transform="translate(222 282) rotate(31) scale(1.1) translate(-256 -252)">`,
    `<path fill="url(#b)" d="${green.join("")}"/>`,
    gilt.length
      ? `<path fill="url(#g)" opacity=".85" d="${gilt.join("")}"/>`
      : "",
    `<path fill="url(#s)" d="${shaft}"/>`,
    `<path fill="url(#h)" d="${halo}"/>`,
    `<path fill="url(#z)" d="${bronze}"/>`,
    grain.length
      ? `<g clip-path="url(#c)" fill="none" stroke-linecap="round" stroke-width="1.1">` +
        `<path stroke="#fff" stroke-opacity=".14" d="${grain.filter((_, i) => i % 2 === 0).join("")}"/>` +
        `<path stroke="#0b2a2a" stroke-opacity=".07" d="${grain.filter((_, i) => i % 2 === 1).join("")}"/></g>`
      : "",
    `<path fill="url(#t)" d="${turquoise}"/>`,
    `<path fill="url(#i)" d="${heart}"/>`,
    // The pale tip of the shaft inside the heart.
    `<path fill="#f4e3ae" opacity=".8" d="M254.6 304L256 258L257.4 304Z"/>`,
    `</g>`,
    `</svg>`,
    ``,
  ]
    .filter((line, i, all) => line !== "" || i === all.length - 1)
    .join("\n");
}

/** The drawing as a PNG of one size, drawn four times as large first. */
function png(svg, size) {
  return sharp(Buffer.from(svg), { density: (72 * size * 4) / 512 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** The feather on the shop's ground, filling `share` of the square. */
async function onGround(svg, size, share) {
  const inner = Math.round(size * share);
  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: GROUND },
  })
    .composite([{ input: await png(svg, inner), left: offset, top: offset }])
    .flatten({ background: GROUND })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** An `.ico` file holding PNG pictures (every browser of today reads it). */
function ico(pictures) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pictures.length, 4);
  const entries = [];
  let offset = 6 + 16 * pictures.length;
  for (const { size, data } of pictures) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pictures.map((p) => p.data)]);
}

const full = feather("full");
const small = feather("small");

const files = {
  "src/app/icon.svg": full,
  "src/app/icon.png": await png(full, 192),
  "src/app/favicon.ico": ico([
    { size: 16, data: await png(small, 16) },
    { size: 32, data: await png(small, 32) },
    { size: 48, data: await png(full, 48) },
  ]),
  "src/app/apple-icon.png": await onGround(full, 180, 1),
  "public/brand/icon-192.png": await onGround(full, 192, 1),
  "public/brand/icon-512.png": await onGround(full, 512, 1),
  // Android may cut a circle or a rounded square out of the middle 80 %.
  "public/brand/icon-maskable-512.png": await onGround(full, 512, 0.72),
};
for (const [file, data] of Object.entries(files)) {
  await writeFile(file, data);
  console.log(`${file}  ${data.length} bytes`);
}
