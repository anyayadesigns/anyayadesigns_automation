import { Resvg } from "@resvg/resvg-js";

const W = 1080;
const H = 1350;

function esc(str) {
  return String(str)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapLines(text, fontSize, maxWidth) {
  const charW = fontSize * 0.5;
  const maxChars = Math.floor(maxWidth / charW);
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function headlineBlock(text, maxWidth) {
  for (const size of [78, 68, 58, 50]) {
    const lines = wrapLines(text, size, maxWidth);
    if (lines.length <= 3 || size === 50) {
      return { lines: lines.slice(0, 4), size };
    }
  }
}

export function buildCardSvg({
  bgBase64,
  kicker,
  headline,
  accent,
  handle,
  siteUrl,
  palette,
}) {
  const p = palette;
  const frame = esc("");
  void frame;

  const head = headlineBlock(headline, W - 200);
  const lh = Math.round(head.size * 1.22);
  const startY = 520;
  const headlineSpans = head.lines
    .map(
      (l, i) =>
        `<text x="${W / 2}" y="${startY + i * lh}" font-family="Cormorant Garamond" font-weight="600" font-size="${head.size}" fill="${p.ink}" text-anchor="middle">${esc(l)}</text>`
    )
    .join("\n");

  const accentY = startY + head.lines.length * lh + 88;
  const accentSpan = accent
    ? `<text x="${W / 2}" y="${accentY}" font-family="Parisienne" font-size="92" fill="${p.rosedust}" text-anchor="middle" transform="rotate(-3 ${W / 2} ${accentY})">${esc(accent)}</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.paper}" stop-opacity="0.88"/>
      <stop offset="45%" stop-color="${p.paper}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${p.blush}" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/jpeg;base64,${bgBase64}"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#veil)"/>
  <rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="${p.gold}" stroke-width="2" opacity="0.85"/>
  <rect x="46" y="46" width="${W - 92}" height="${H - 92}" fill="none" stroke="${p.sageDeep}" stroke-width="1" opacity="0.5"/>
  <rect x="330" y="141" width="120" height="1.2" fill="${p.gold}" opacity="0.9"/>
  <rect x="630" y="141" width="120" height="1.2" fill="${p.gold}" opacity="0.9"/>
  <rect x="533" y="134" width="14" height="14" fill="${p.gold}" transform="rotate(45 540 141)"/>
  <text x="${W / 2}" y="196" font-family="Jost" font-weight="500" font-size="27" letter-spacing="9" fill="${p.sageDeep}" text-anchor="middle">${esc(kicker.toUpperCase())}</text>
  ${headlineSpans}
  ${accentSpan}
  <rect x="480" y="1148" width="120" height="2" fill="${p.gold}"/>
  <text x="${W / 2}" y="1204" font-family="Jost" font-weight="400" font-size="27" letter-spacing="5" fill="${p.bark}" text-anchor="middle">${esc(handle)}</text>
  <text x="${W / 2}" y="1244" font-family="Jost" font-weight="300" font-size="23" letter-spacing="2" fill="${p.warm}" text-anchor="middle">${esc(siteUrl.replace("https://", ""))}</text>
</svg>`;
}

export function renderCard({ bgBuffer, fontFiles, ...rest }) {
  const base64 = Buffer.from(bgBuffer).toString("base64");
  const svg = buildCardSvg({ bgBase64: base64, ...rest });
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: "Cormorant Garamond",
    },
  });
  return resvg.render().asPng();
}
