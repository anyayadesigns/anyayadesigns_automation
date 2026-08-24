import { openSync as fontkitOpenSync } from "fontkit";
import { Resvg } from "@resvg/resvg-js";

const W = 1080;
const H = 1350;
const L = 100;
const R = 980;

function esc(str) {
  return String(str)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function makeMeasure(fontFaces) {
  const fontCache = new Map();
  const measureCache = new Map();

  function loadFont(family, style, weight) {
    const candidates = fontFaces.filter(
      (f) => f.family === family && f.style === style
    );
    if (candidates.length === 0) return null;
    const font =
      candidates.find((f) => f.weight === String(weight)) ?? candidates[0];
    if (!fontCache.has(font.file)) {
      fontCache.set(font.file, fontkitOpenSync(font.file));
    }
    return fontCache.get(font.file);
  }

  return function measure(text, { size, family = "Cormorant Garamond", style = "normal", weight = 400, spacing = 0 }) {
    const key = `${family}|${style}|${weight}|${size}|${spacing}|${text}`;
    if (measureCache.has(key)) return measureCache.get(key);
    let width;
    try {
      const font = loadFont(family, style, weight);
      width = font
        ? (font.layout(String(text)).advanceWidth / font.unitsPerEm) * size +
          spacing * String(text).length
        : String(text).length * size * 0.52 + spacing * String(text).length;
    } catch {
      width = String(text).length * size * 0.52 + spacing * String(text).length;
    }
    measureCache.set(key, width);
    return width;
  };
}

function tokenize(str, { forceItalic = false } = {}) {
  const words = [];
  let italic = false;
  for (const part of String(str).split("*")) {
    for (const w of part.split(/\s+/).filter(Boolean)) {
      words.push({ text: w, italic: forceItalic || italic });
    }
    italic = !italic;
  }
  return words;
}

function wrapWords(words, measure, size, maxWidth, family, weight, style) {
  const lines = [];
  let line = [];
  let w = 0;
  const spaceW = measure(" ", { size, family, weight, style });
  for (const word of words) {
    const ww = measure(word.text, { size, family, weight, style: word.italic ? "italic" : style });
    if (line.length && w + spaceW + ww > maxWidth) {
      lines.push(line);
      line = [];
      w = 0;
    }
    w += (line.length ? spaceW : 0) + ww;
    line.push(word);
  }
  if (line.length) lines.push(line);
  return lines;
}

function accentHeadline({
  text,
  x,
  y,
  size,
  lh,
  maxLines,
  fill,
  accentFill,
  anchor = "start",
  forceItalic = false,
  family = "Cormorant Garamond",
  weight = 600,
  maxWidth = R - L,
  measure,
}) {
  const words = tokenize(text, { forceItalic });
  let s = size;
  let lines = wrapWords(words, measure, s, maxWidth, family, weight, "normal");
  while (lines.length > maxLines && s > 42) {
    s -= 5;
    lines = wrapWords(words, measure, s, maxWidth, family, weight, "normal");
  }
  let svg = "";
  let cy = y;
  const spaceW = measure(" ", { size: s, family, weight });
  for (const line of lines) {
    const lineW = line.reduce(
      (a, wd, i) =>
        a +
        measure(wd.text, { size: s, family, weight, style: wd.italic ? "italic" : "normal" }) +
        (i ? spaceW : 0),
      0
    );
    let cx = anchor === "middle" ? (W - lineW) / 2 : x;
    for (const wd of line) {
      const ww = measure(wd.text, { size: s, family, weight, style: wd.italic ? "italic" : "normal" });
      svg += `<text x="${Math.round(cx)}" y="${Math.round(cy)}" font-family="${family}" font-weight="${weight}" font-style="${wd.italic ? "italic" : "normal"}" font-size="${s}" fill="${wd.italic ? accentFill : fill}">${esc(wd.text)}</text>`;
      cx += ww + spaceW;
    }
    cy += lh;
  }
  return { svg, endY: cy - lh, lines: lines.length };
}

function plainParagraph({
  text,
  x,
  y,
  size,
  lh,
  maxLines,
  fill,
  anchor = "start",
  maxWidth = R - L,
  spacing = 0,
  measure,
}) {
  const words = String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ text: w, italic: false }));
  let s = size;
  let lines = wrapWords(words, measure, s, maxWidth, "Jost", 300, "normal");
  while (lines.length > maxLines && s > 20) {
    s -= 2;
    lines = wrapWords(words, measure, s, maxWidth, "Jost", 300, "normal");
  }
  let svg = "";
  let cy = y;
  for (const line of lines) {
    const t = line.map((w) => w.text).join(" ");
    svg += `<text x="${anchor === "middle" ? W / 2 : x}" y="${Math.round(cy)}" font-family="Jost" font-weight="300" font-size="${s}" fill="${fill}" letter-spacing="${spacing}" text-anchor="${anchor}">${esc(t)}</text>`;
    cy += lh;
  }
  return { svg, endY: cy - lh, lines: lines.length };
}

function kickerLeft({ text, y, color, lineColor, measure }) {
  const label = text.toUpperCase();
  const tw = measure(label, { size: 23, family: "Jost", weight: 500, spacing: 8 });
  return `<text x="${L}" y="${y}" font-family="Jost" font-weight="500" font-size="23" letter-spacing="8" fill="${color}">${esc(label)}</text>
  <line x1="${Math.round(L + tw + 30)}" y1="${y - 8}" x2="${R}" y2="${y - 8}" stroke="${lineColor}" stroke-width="1" opacity="0.5"/>`;
}

function kickerCenter({ text, y, color, lineSide, measure }) {
  const label = text.toUpperCase();
  const tw = measure(label, { size: 23, family: "Jost", weight: 500, spacing: 8 });
  let line = "";
  if (lineSide === "left") {
    line = `<line x1="${L}" y1="${y - 8}" x2="${Math.round((W - tw) / 2 - 30)}" y2="${y - 8}" stroke="${color}" stroke-width="1" opacity="0.55"/>`;
  }
  return `${line}<text x="${W / 2}" y="${y}" font-family="Jost" font-weight="500" font-size="23" letter-spacing="8" fill="${color}" text-anchor="middle">${esc(label)}</text>`;
}

function frame(color, opacity) {
  return `<rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="none" stroke="${color}" stroke-width="1.5" opacity="${opacity}"/>`;
}

function sprig(x, y, gold) {
  return `<g opacity="0.85">
    <path d="M ${x} ${y} q 14 -30 42 -40" stroke="${gold}" stroke-width="1.4" fill="none"/>
    <path d="M ${x + 8} ${y - 14} q 10 -12 22 -10 q -6 14 -22 10 Z" fill="${gold}" opacity="0.75"/>
    <path d="M ${x + 20} ${y - 26} q 12 -10 24 -6 q -8 14 -24 6 Z" fill="${gold}" opacity="0.7"/>
    <path d="M ${x + 34} ${y - 36} q 10 -8 20 -4 q -6 12 -20 4 Z" fill="${gold}" opacity="0.65"/>
  </g>`;
}

function footer({ p, dark, monogram, brandName, footerSub, siteUrl, logo }) {
  const gold = p.gold;
  const nameFill = dark ? p.ink : p.cream;
  const urlFill = dark ? p.warm : p.cream;
  let logoSvg = "";
  if (logo?.base64) {
    const crop = logo.crop ?? 1;
    const cropH = Math.max(1, Math.round(logo.height * crop));
    const box = 118;
    const imgW = Math.round(box * (logo.width / cropH));
    const imgH = Math.round(box * (logo.height / cropH));
    const x = L - 6;
    const y = 1122;
    logoSvg = `<clipPath id="anyayaLogoClip"><rect x="${x}" y="${y}" width="${box}" height="${box}"/></clipPath>
    <image x="${x}" y="${y}" width="${imgW}" height="${imgH}" clip-path="url(#anyayaLogoClip)" href="data:image/${logo.mime};base64,${logo.base64}"/>`;
  } else {
    logoSvg = `${sprig(L + 4, 1206, gold)}
    <text x="${L + 26}" y="1198" font-family="Cormorant Garamond" font-weight="600" font-style="italic" font-size="66" fill="${gold}" opacity="0.95">${esc(monogram[0])}</text>
    <text x="${L + 52}" y="1208" font-family="Cormorant Garamond" font-weight="600" font-style="italic" font-size="66" fill="${gold}" opacity="0.9">${esc(monogram[1] ?? "")}</text>`;
  }
  return `
  <line x1="${L}" y1="1100" x2="${R}" y2="1100" stroke="${gold}" stroke-width="1" opacity="0.45"/>
  ${logoSvg}
  <text x="${L + 128}" y="1186" font-family="Jost" font-weight="500" font-size="30" letter-spacing="7" fill="${nameFill}">${esc(brandName.toUpperCase())}</text>
  <text x="${L + 129}" y="1222" font-family="Jost" font-weight="400" font-size="16.5" letter-spacing="3.2" fill="${gold}">${esc(footerSub.toUpperCase())}</text>
  <text x="${R}" y="1216" font-family="Jost" font-weight="300" font-size="21" fill="${urlFill}" opacity="0.85" text-anchor="end">${esc(siteUrl.replace("https://", ""))}</text>`;
}

function creamBase() {
  return `
  <defs>
    <radialGradient id="vig" cx="50%" cy="42%" r="78%">
      <stop offset="55%" stop-color="#574f44" stop-opacity="0"/>
      <stop offset="100%" stop-color="#574f44" stop-opacity="0.10"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#f7f3ec"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>`;
}

function sageBase() {
  return `
  <defs>
    <linearGradient id="sageg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#61704f"/>
      <stop offset="100%" stop-color="#4c5a43"/>
    </linearGradient>
    <radialGradient id="sagelight" cx="30%" cy="18%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sagevig" cx="50%" cy="45%" r="80%">
      <stop offset="55%" stop-color="#141a10" stop-opacity="0"/>
      <stop offset="100%" stop-color="#141a10" stop-opacity="0.28"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sageg)"/>
  <rect width="${W}" height="${H}" fill="url(#sagelight)"/>
  <rect width="${W}" height="${H}" fill="url(#sagevig)"/>`;
}

function renderSageList({ p, measure, kicker, headline, items, footerOpts }) {
  const gold = p.goldLight ?? p.gold;
  let svg = sageBase();
  svg += frame(p.cream, 0.4);
  svg += kickerLeft({ text: kicker, y: 246, color: gold, lineColor: gold, measure });
  const head = accentHeadline({
    text: headline,
    x: L,
    y: 402,
    size: 74,
    lh: 90,
    maxLines: 3,
    fill: p.cream,
    accentFill: gold,
    measure,
  });
  svg += head.svg;
  let iy = head.endY + 104;
  for (const item of items.slice(0, 4)) {
    svg += `<circle cx="${L + 24}" cy="${iy - 9}" r="24" fill="none" stroke="${gold}" stroke-width="1.5" opacity="0.9"/>`;
    svg += `<text x="${L + 24}" y="${iy}" font-family="Cormorant Garamond" font-weight="500" font-size="26" fill="${gold}" text-anchor="middle">${esc(item.n)}</text>`;
    svg += `<text x="${L + 74}" y="${iy - 1}" font-family="Jost" font-weight="500" font-size="27" fill="${p.cream}">${esc(item.t)}</text>`;
    if (item.d) {
      svg += `<text x="${L + 74}" y="${iy + 34}" font-family="Jost" font-weight="300" font-size="24" fill="${p.cream}" opacity="0.82">${esc(item.d)}</text>`;
      iy += 108;
    } else {
      iy += 84;
    }
  }
  svg += footer(footerOpts);
  return svg;
}

function renderQuote({ p, measure, kicker, headline, subtext, footerOpts }) {
  let svg = creamBase();
  svg += frame(p.sageDeep, 0.4);
  svg += kickerLeft({ text: kicker, y: 246, color: p.gold, lineColor: p.gold, measure });
  svg += `<text x="${L - 6}" y="404" font-family="Cormorant Garamond" font-weight="700" font-size="130" fill="${p.gold}" opacity="0.95">\u201C</text>`;
  const head = accentHeadline({
    text: headline,
    x: L,
    y: 540,
    size: 76,
    lh: 92,
    maxLines: 5,
    fill: p.sageDeep,
    accentFill: p.sage,
    measure,
  });
  svg += head.svg;
  if (subtext) {
    const sub = plainParagraph({
      text: subtext,
      x: L,
      y: head.endY + 66,
      size: 28,
      lh: 44,
      maxLines: 3,
      fill: p.warm,
      measure,
    });
    svg += sub.svg;
  }
  svg += footer(footerOpts);
  return svg;
}

function renderCompare({ p, measure, kicker, headline, badLabel, goodLabel, cons, pros, footerOpts }) {
  let svg = creamBase();
  svg += frame(p.sageDeep, 0.4);
  svg += kickerLeft({ text: kicker, y: 246, color: p.gold, lineColor: p.gold, measure });
  const head = accentHeadline({
    text: headline,
    x: L,
    y: 398,
    size: 62,
    lh: 76,
    maxLines: 3,
    fill: p.sageDeep,
    accentFill: p.gold,
    measure,
  });
  svg += head.svg;
  const colY = head.endY + 92;
  const cols = [
    { x: L, label: badLabel, list: cons, mark: "x" },
    { x: 580, label: goodLabel, list: pros, mark: "check" },
  ];
  for (const col of cols) {
    svg += `<text x="${col.x}" y="${colY}" font-family="Jost" font-weight="500" font-size="20" letter-spacing="4.5" fill="${p.gold}">${esc(col.label.toUpperCase())}</text>`;
    svg += `<line x1="${col.x}" y1="${colY + 18}" x2="${col.x + 380}" y2="${colY + 18}" stroke="${p.gold}" stroke-width="1" opacity="0.45"/>`;
    let iy = colY + 74;
    for (const item of col.list.slice(0, 4)) {
      if (col.mark === "x") {
        svg += `<path d="M ${col.x + 4} ${iy - 16} l 13 13 M ${col.x + 17} ${iy - 16} l -13 13" stroke="${p.gold}" stroke-width="2.2" opacity="0.9"/>`;
      } else {
        svg += `<path d="M ${col.x + 2} ${iy - 9} l 6 7 l 13 -15" stroke="${p.sageDeep}" stroke-width="2.4" fill="none" opacity="0.95"/>`;
      }
      const txt = plainParagraph({
        text: item,
        x: col.x + 38,
        y: iy,
        size: 23.5,
        lh: 32,
        maxLines: 2,
        fill: p.ink,
        maxWidth: 372,
        measure,
      });
      svg += txt.svg;
      iy += txt.lines * 32 + 26;
    }
  }
  svg += footer(footerOpts);
  return svg;
}

function renderQuestion({ p, measure, kicker, headline, subtext, footerOpts }) {
  let svg = creamBase();
  svg += frame(p.sageDeep, 0.4);
  svg += kickerCenter({ text: kicker, y: 252, color: p.sageDeep, measure });
  const head = accentHeadline({
    text: headline,
    x: 0,
    y: 452,
    size: 74,
    lh: 92,
    maxLines: 3,
    fill: p.sageDeep,
    accentFill: p.sageDeep,
    anchor: "middle",
    forceItalic: true,
    maxWidth: W - 220,
    measure,
  });
  svg += head.svg;
  let ornamentY = head.endY + 70;
  if (subtext) {
    const sub = plainParagraph({
      text: subtext,
      y: head.endY + 64,
      size: 27,
      lh: 42,
      maxLines: 3,
      fill: p.warm,
      anchor: "middle",
      maxWidth: W - 260,
      measure,
    });
    svg += sub.svg;
    ornamentY = sub.endY + 72;
  }
  svg += `<line x1="${W / 2 - 92}" y1="${ornamentY}" x2="${W / 2 - 26}" y2="${ornamentY}" stroke="${p.gold}" stroke-width="1" opacity="0.6"/>`;
  svg += `<rect x="${W / 2 - 5}" y="${ornamentY - 5}" width="10" height="10" fill="${p.gold}" transform="rotate(45 ${W / 2} ${ornamentY})"/>`;
  svg += `<line x1="${W / 2 + 26}" y1="${ornamentY}" x2="${W / 2 + 92}" y2="${ornamentY}" stroke="${p.gold}" stroke-width="1" opacity="0.6"/>`;
  svg += footer(footerOpts);
  return svg;
}

function renderTips({ p, measure, kicker, headline, items, footerOpts }) {
  let svg = creamBase();
  svg += frame(p.sageDeep, 0.4);
  svg += kickerLeft({ text: kicker, y: 246, color: p.sageDeep, lineColor: p.gold, measure });
  const head = accentHeadline({
    text: headline,
    x: L,
    y: 400,
    size: 64,
    lh: 80,
    maxLines: 3,
    fill: p.sageDeep,
    accentFill: p.gold,
    measure,
  });
  svg += head.svg;
  let iy = head.endY + 100;
  for (const item of items.slice(0, 4)) {
    svg += `<circle cx="${L + 26}" cy="${iy - 9}" r="26" fill="#fdfcf8" stroke="${p.sage}" stroke-width="1" opacity="0.9"/>`;
    svg += `<text x="${L + 26}" y="${iy}" font-family="Cormorant Garamond" font-weight="500" font-size="27" fill="${p.sageDeep}" text-anchor="middle">${esc(item.n)}</text>`;
    const words = [
      ...String(item.t)
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => ({ text: w, italic: false, bold: true, fill: p.ink })),
      { text: "\u2014", italic: false, bold: false, fill: p.warm },
      ...String(item.d)
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => ({ text: w, italic: false, bold: false, fill: p.warm })),
    ];
    let s = 25;
    let lines = wrapWords(words, measure, s, R - (L + 78), "Jost", 400, "normal");
    while (lines.length > 2 && s > 20) {
      s -= 1.5;
      lines = wrapWords(words, measure, s, R - (L + 78), "Jost", 400, "normal");
    }
    let cy = iy;
    const spaceW = measure(" ", { size: s, family: "Jost", weight: 400 });
    for (const line of lines) {
      let cx = L + 78;
      for (const wd of line) {
        const ww = measure(wd.text, { size: s, family: "Jost", weight: wd.bold ? 500 : 300 });
        svg += `<text x="${Math.round(cx)}" y="${Math.round(cy)}" font-family="Jost" font-weight="${wd.bold ? 500 : 300}" font-size="${s}" fill="${wd.fill}">${esc(wd.text)}</text>`;
        cx += ww + spaceW;
      }
      cy += 38;
    }
    iy = cy - 38 + 44;
  }
  svg += footer(footerOpts);
  return svg;
}

function renderStatistic({ p, measure, kicker, stat, statSub, subtext, footerOpts }) {
  let svg = creamBase();
  svg += frame(p.sageDeep, 0.4);
  svg += kickerCenter({ text: kicker, y: 252, color: p.sageDeep, lineSide: "left", measure });
  let statSize = 175;
  while (measure(stat, { size: statSize, weight: 500 }) > W - 240 && statSize > 90) statSize -= 10;
  svg += `<text x="${W / 2}" y="600" font-family="Cormorant Garamond" font-weight="500" font-size="${statSize}" fill="${p.sageDeep}" text-anchor="middle">${esc(stat)}</text>`;
  const sub = accentHeadline({
    text: statSub,
    y: 760,
    size: 47,
    lh: 60,
    maxLines: 2,
    fill: p.sageDeep,
    accentFill: p.sageDeep,
    anchor: "middle",
    forceItalic: true,
    maxWidth: W - 240,
    measure,
  });
  svg += sub.svg;
  if (subtext) {
    const para = plainParagraph({
      text: subtext,
      y: sub.endY + 62,
      size: 27,
      lh: 42,
      maxLines: 3,
      fill: p.warm,
      anchor: "middle",
      maxWidth: W - 280,
      measure,
    });
    svg += para.svg;
  }
  svg += footer(footerOpts);
  return svg;
}

function renderCta({ p, measure, kicker, headline, subtext, buttonText, footerOpts }) {
  let svg = creamBase();
  svg += frame(p.sageDeep, 0.4);
  svg += kickerCenter({ text: kicker, y: 252, color: p.sageDeep, measure });
  const head = accentHeadline({
    text: headline,
    y: 440,
    size: 76,
    lh: 94,
    maxLines: 3,
    fill: p.sageDeep,
    accentFill: p.sage,
    anchor: "middle",
    maxWidth: W - 200,
    measure,
  });
  svg += head.svg;
  let btnY = head.endY + 76;
  if (subtext) {
    const sub = plainParagraph({
      text: subtext,
      y: head.endY + 64,
      size: 27,
      lh: 44,
      maxLines: 3,
      fill: p.warm,
      anchor: "middle",
      maxWidth: W - 260,
      measure,
    });
    svg += sub.svg;
    btnY = sub.endY + 80;
  }
  const btnText = (buttonText ?? "Message us").toUpperCase();
  const btnTextW = measure(btnText, { size: 23, family: "Jost", weight: 500, spacing: 5 });
  const btnW = Math.min(btnTextW + 150, W - 240);
  const btnH = 64;
  const btnX = (W - btnW) / 2;
  svg += `<rect x="${Math.round(btnX)}" y="${Math.round(btnY)}" width="${Math.round(btnW)}" height="${btnH}" fill="${p.sageDeep}"/>`;
  svg += `<text x="${W / 2}" y="${Math.round(btnY + 42)}" font-family="Jost" font-weight="500" font-size="23" letter-spacing="5" fill="${p.cream}" text-anchor="middle">${esc(btnText)}</text>`;
  svg += footer(footerOpts);
  return svg;
}

export function buildLayoutSvg({
  layout,
  palette: p,
  fontFaces,
  kicker,
  headline,
  items,
  subtext,
  cons,
  pros,
  badLabel,
  goodLabel,
  stat,
  statSub,
  buttonText,
  brand,
  logo,
}) {
  const measure = makeMeasure(fontFaces);
  const footerOpts = {
    p,
    dark: layout !== "list",
    monogram: brand.monogram,
    brandName: brand.name,
    footerSub: brand.footerSub,
    siteUrl: brand.website,
    logo,
  };
  const opts = { p, measure, kicker, headline, items, subtext, cons, pros, badLabel, goodLabel, stat, statSub, buttonText, footerOpts };
  switch (layout) {
    case "list":
      return renderSageList({ ...opts, items: (items ?? []).map((it, i) => ({ ...it, n: String(i + 1) })) });
    case "tips":
      return renderTips({ ...opts, items: (items ?? []).map((it, i) => ({ ...it, n: String(i + 1) })) });
    case "compare":
      return renderCompare(opts);
    case "question":
      return renderQuestion(opts);
    case "statistic":
      return renderStatistic(opts);
    case "cta":
      return renderCta(opts);
    case "quote":
    default:
      return renderQuote(opts);
  }
}

function buildCardSvg({ bgBase64, kicker, headline, accent, handle, siteUrl, palette: p }) {
  const words = tokenize(headline);
  const measure = makeMeasure([]);
  const maxWidth = W - 200;
  let size = 78;
  let lines = wrapWords(words, measure, size, maxWidth, "Cormorant Garamond", 600, "normal");
  while (lines.length > 3 && size > 50) {
    size -= 8;
    lines = wrapWords(words, measure, size, maxWidth, "Cormorant Garamond", 600, "normal");
  }
  const lh = Math.round(size * 1.22);
  const startY = 520;
  const headlineSpans = lines
    .map(
      (line, i) =>
        `<text x="${W / 2}" y="${startY + i * lh}" font-family="Cormorant Garamond" font-weight="600" font-size="${size}" fill="${p.ink}" text-anchor="middle">${esc(line.map((w) => w.text).join(" "))}</text>`
    )
    .join("\n");
  const accentY = startY + lines.length * lh + 88;
  const accentSpan = accent
    ? `<text x="${W / 2}" y="${accentY}" font-family="Parisienne" font-size="92" fill="${p.rosedust}" text-anchor="middle" transform="rotate(-3 ${W / 2} ${accentY})">${esc(accent)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.paper}" stop-opacity="0.88"/>
      <stop offset="45%" stop-color="${p.paper}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${p.blush}" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${bgBase64}"/>
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

export function renderBranded({
  layout,
  palette: p,
  fontFaces,
  kicker,
  headline,
  accent,
  items,
  subtext,
  cons,
  pros,
  badLabel,
  goodLabel,
  stat,
  statSub,
  buttonText,
  bgBuffer,
  brand,
  logo,
}) {
  if (layout === "photo") {
    const base64 = Buffer.from(bgBuffer).toString("base64");
    const svg = buildCardSvg({
      bgBase64: base64,
      kicker,
      headline,
      accent,
      handle: brand.handle,
      siteUrl: brand.website,
      palette: p,
    });
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: W },
      font: { loadSystemFonts: false, defaultFontFamily: "Cormorant Garamond" },
    });
    return resvg.render().asPng();
  }
  const svg = buildLayoutSvg({ layout, palette: p, fontFaces, kicker, headline, items, subtext, cons, pros, badLabel, goodLabel, stat, statSub, buttonText, brand, logo });
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>`;
  const resvg = new Resvg(wrapped, {
    fitTo: { mode: "width", value: W },
    font: {
      fontFiles: fontFaces.map((f) => f.file),
      loadSystemFonts: false,
      defaultFontFamily: "Cormorant Garamond",
    },
  });
  return resvg.render().asPng();
}
