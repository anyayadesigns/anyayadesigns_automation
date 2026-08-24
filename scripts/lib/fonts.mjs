import fs from "node:fs";
import path from "node:path";

const CSS_URL = "https://fonts.googleapis.com/css2?family=";
const CURL_UA = "curl/8.7.1";

async function fetchFaces(query) {
  const res = await fetch(`${CSS_URL}${query}`, {
    headers: { "User-Agent": CURL_UA },
  });
  if (!res.ok) throw new Error(`fonts css ${res.status} for ${query}`);
  const css = await res.text();
  const faces = [];
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  for (const block of blocks) {
    const style = block.match(/font-style:\s*([a-z]+)/)?.[1] ?? "normal";
    const weight = block.match(/font-weight:\s*(\d+)/)?.[1] ?? "400";
    const url = block.match(/url\((https:[^)]+)\)/)?.[1];
    if (url) faces.push({ style, weight, url: url.trim() });
  }
  return faces;
}

export async function ensureFonts(fontSpecs, fontsDir) {
  fs.mkdirSync(fontsDir, { recursive: true });
  const manifestPath = path.join(fontsDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {}
  }
  const manifest = [];
  for (const spec of fontSpecs) {
    const safe = spec.family.replace(/\s+/g, "");
    const faces = await fetchFaces(spec.query);
    for (const face of faces) {
      const file = path.join(fontsDir, `${safe}-${face.style}-${face.weight}.ttf`);
      if (!fs.existsSync(file)) {
        const buf = Buffer.from(await (await fetch(face.url)).arrayBuffer());
        fs.writeFileSync(file, buf);
      }
      manifest.push({ family: spec.family, style: face.style, weight: face.weight, file });
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}
