import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

export function loadLogo(logoPath) {
  if (!fs.existsSync(logoPath)) return null;
  const ext = path.extname(logoPath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "jpeg" : "png";
  const buf = fs.readFileSync(logoPath);
  if (mime !== "png") {
    return { base64: buf.toString("base64"), width: 0, height: 0, mime };
  }
  const png = PNG.sync.read(buf);
  const processed = removeDarkBackground(png);
  const out = PNG.sync.write(processed, { colorType: 6 });
  return {
    base64: Buffer.from(out).toString("base64"),
    width: processed.width,
    height: processed.height,
    mime: "png",
  };
}

function removeDarkBackground(png) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    const alpha = Math.max(r, g, b);
    if (alpha <= 24) {
      out.data[i + 3] = 0;
      continue;
    }
    const scale = 255 / alpha;
    out.data[i] = Math.min(255, Math.round(r * scale));
    out.data[i + 1] = Math.min(255, Math.round(g * scale));
    out.data[i + 2] = Math.min(255, Math.round(b * scale));
    out.data[i + 3] = Math.min(255, Math.round(alpha * 1.15));
  }
  return out;
}
