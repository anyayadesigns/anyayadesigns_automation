import fs from "node:fs";
import path from "node:path";

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=";
const CURL_UA = "curl/8.7.1";

async function fetchTtfUrls(query) {
  const res = await fetch(`${GOOGLE_FONTS_CSS}${query}`, {
    headers: { "User-Agent": CURL_UA },
  });
  if (!res.ok) throw new Error(`fonts css ${res.status} for ${query}`);
  const css = await res.text();
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(
    (m) => m[1].trim()
  );
  return [...new Set(urls)];
}

export async function ensureFonts(fontSpecs, fontsDir) {
  fs.mkdirSync(fontsDir, { recursive: true });
  const marker = path.join(fontsDir, ".done");
  const files = [];
  for (const spec of fontSpecs) {
    const safeName = spec.family.replace(/\s+/g, "");
    const existing = fs
      .readdirSync(fontsDir)
      .filter((f) => f.startsWith(safeName) && f.endsWith(".ttf"))
      .map((f) => path.join(fontsDir, f));
    if (existing.length > 0 && fs.existsSync(marker)) {
      files.push(...existing);
      continue;
    }
    const urls = await fetchTtfUrls(spec.query);
    let i = 0;
    for (const url of urls) {
      const dest = path.join(fontsDir, `${safeName}-${i++}.ttf`);
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      fs.writeFileSync(dest, buf);
      files.push(dest);
    }
  }
  fs.writeFileSync(marker, new Date().toISOString());
  return files;
}
