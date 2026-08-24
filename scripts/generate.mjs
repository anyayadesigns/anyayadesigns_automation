import fs from "node:fs";
import path from "node:path";
import { loadBrand, loadPillars, loadPosts, savePosts, phToday, ROOT } from "./lib/store.mjs";
import { ensureFonts } from "./lib/fonts.mjs";
import { renderBranded } from "./lib/image.mjs";
import { loadLogo } from "./lib/logo.mjs";
import { generateContent } from "./lib/ai.mjs";

const FONTS_DIR = path.join(ROOT, ".cache", "fonts");
const ASSETS_DIR = path.join(ROOT, "assets", "posts");
const POLLINATIONS_IMAGE = "https://image.pollinations.ai/prompt/";

function pickPillar(pillars) {
  const override = process.env.PILLAR;
  if (override) {
    const found = pillars.find((p) => p.id === override || p.name.toLowerCase().includes(override.toLowerCase()));
    if (!found) throw new Error(`pillar not found: ${override}`);
    return found;
  }
  const { dayIndex } = phToday();
  return pillars.find((p) => p.day === dayIndex) ?? pillars[0];
}

async function fetchBackground(prompt, seedBase) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = seedBase + attempt * 7;
    const url = `${POLLINATIONS_IMAGE}${encodeURIComponent(prompt)}?width=1080&height=1350&seed=${seed}&model=flux&nologo=true`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20_000) throw new Error("image too small");
      console.log(`[image] ok (${Math.round(buf.length / 1024)}kb, seed ${seed})`);
      return buf;
    } catch (err) {
      console.warn(`[image] attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
  throw new Error("could not fetch background image after 3 attempts");
}

async function main() {
  const brand = loadBrand();
  const pillars = loadPillars();
  const posts = loadPosts();
  const pillar = pickPillar(pillars);
  const { dateStr } = phToday();
  const id = `${dateStr}-${pillar.id}`;

  const existing = posts.find((p) => p.id === id);
  if (existing && ["draft", "approved", "posted"].includes(existing.status)) {
    console.log(`[skip] post ${id} already exists (${existing.status})`);
    return;
  }

  const weekIndex = Math.floor(Date.now() / 604_800_000);
  const angle = pillar.angles[weekIndex % pillar.angles.length];
  const cta = pillar.cta[weekIndex % pillar.cta.length];

  console.log(`[generate] pillar=${pillar.id} angle="${angle}"`);
  const allowedLayouts = pillar.layouts ?? ["quote"];
  const layout = allowedLayouts.includes(process.env.LAYOUT)
    ? process.env.LAYOUT
    : allowedLayouts[0];
  const content = await generateContent({ brand, pillar, angle, cta, layout });
  const finalLayout = allowedLayouts.includes(content.layout) ? content.layout : layout;

  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const fontFaces = await ensureFonts(brand.fonts, FONTS_DIR);
  const logo = brand.logo ? loadLogo(path.join(ROOT, brand.logo)) : null;
  if (logo) logo.crop = brand.logoCrop ?? 1;

  let png;
  if (finalLayout === "photo") {
    const imagePrompt = `${content.imagePrompt}. ${pillar.imageStyle}`;
    const bg = await fetchBackground(imagePrompt, weekIndex * 13 + 5);
    png = renderBranded({
      layout: "photo",
      palette: brand.palette,
      fontFaces,
      kicker: content.kicker || pillar.kicker,
      headline: content.headline,
      accent: content.accent,
      bgBuffer: bg,
      brand,
      logo,
    });
  } else {
    png = renderBranded({
      layout: finalLayout,
      palette: brand.palette,
      fontFaces,
      kicker: content.kicker || pillar.kicker,
      headline: content.headline,
      items: content.items,
      subtext: content.subtext,
      cons: content.cons,
      pros: content.pros,
      badLabel: content.badLabel,
      goodLabel: content.goodLabel,
      stat: content.stat,
      statSub: content.statSub,
      buttonText: content.buttonText,
      brand,
      logo,
    });
  }

  const imageRel = `assets/posts/${id}.png`;
  fs.writeFileSync(path.join(ROOT, imageRel), png);

  const post = {
    id,
    createdAt: new Date().toISOString(),
    status: "draft",
    pillarId: pillar.id,
    layout: finalLayout,
    kicker: content.kicker || pillar.kicker,
    headline: String(content.headline).slice(0, 140),
    accent: String(content.accent ?? "").slice(0, 40),
    caption: content.caption,
    hashtags: content.hashtags,
    image: imageRel,
    imagePrompt: content.imagePrompt ?? "",
    links: {},
  };

  const filtered = posts.filter((p) => p.id !== id);
  savePosts([post, ...filtered]);

  console.log(`[done] created ${id}`);
  console.log(`        headline : ${post.headline}`);
  console.log(`        caption  : ${post.caption.slice(0, 80)}...`);
  console.log(`        image    : ${imageRel}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
