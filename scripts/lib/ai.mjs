const POLLINATIONS_TEXT = "https://text.pollinations.ai/openai";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const GEMINI_TEXT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function layoutFields(layout) {
  switch (layout) {
    case "list":
      return `"items": [{"t": "feature name 1-3 words", "d": "Taglish benefit max 45 chars"} x3-4]`;
    case "tips":
      return `"items": [{"t": "tip name 1-3 words", "d": "Taglish explanation max 70 chars"} x3-4]`;
    case "compare":
      return `"badLabel": "old way label 1-2 words", "goodLabel": "better way label 1-2 words", "cons": ["Taglish pain point max 48 chars" x3-4], "pros": ["Taglish benefit max 48 chars" x3-4]`;
    case "quote":
      return `"subtext": "1-2 sentence Taglish supporting line max 110 chars"`;
    case "question":
      return `"subtext": "1-2 sentence Taglish invitation to comment max 120 chars"`;
    case "statistic":
      return `"stat": "big number like 1 in 5 or 80%", "statSub": "italic Taglish line explaining the stat max 60 chars", "subtext": "1 sentence Taglish takeaway max 110 chars"`;
    case "photo":
      return `"accent": "1-3 word script phrase"`;
    case "cta":
      return `"subtext": "1-2 sentence Taglish reassurance/promise max 120 chars", "buttonText": "short CTA button text in English like Message us or Book your date"`;
    default:
      return `"subtext": "1-2 sentence Taglish supporting line"`;
  }
}

function buildPrompt({ brand, pillar, angle, cta, layout }) {
  const ctaText = cta.replace("{url}", brand.website);

  return `You are the social media copywriter for "${brand.name}" (${brand.handle}) — ${brand.tagline}.
Services: ${brand.services.join(" | ")}.
Audience: ${brand.audience}.
Style: warm Taglish (Filipino + English mix), elegant, editorial, para kang kaibigang marunong magtimpla ng salita. Short punchy lines.

TODAY'S POST
- Card layout: ${layout}
- Content pillar: ${pillar.name}
- Angle to use: ${angle}

IMAGE CARD TEXT (malalaking text sa designed card):
- "kicker": 2-5 word Taglish eyebrow label (e.g. "Ang totoo lang", "Dati kumpara ngayon", "Sagutin mo nga", "RSVP checklist"). NO emojis.
- "headline": the big serif line, 6-14 words, Taglish. Wrap 1-2 emphasized words with *asterisks* like *ganto* — those render italic + colored. NO emojis.
- ${layoutFields(layout)}

CAPTION:
- "caption": 2-4 short Taglish sentences, line breaks between thoughts. Must end with this CTA verbatim: ${ctaText}
- "hashtags": space-separated, start with: ${brand.hashtags.slice(0, 5).join(" ")} then relevant extras
- "imagePrompt": one sentence photorealistic scene (backup lang)

Return STRICT JSON only (no markdown fences, no commentary) with exactly these keys: layout, kicker, headline, ${layoutFields(layout).split(":")[0]}, caption, hashtags, imagePrompt`;
}

function parseJson(raw) {
  const cleaned = String(raw)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json in ai response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function tryGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const res = await fetch(`${GEMINI_TEXT}?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("gemini empty response");
  return parseJson(text);
}

async function tryPollinations(prompt) {
  const body = JSON.stringify({
    model: "openai",
    referrer: "anyayadesigns.github.io",
    messages: [
      { role: "system", content: "You output strict JSON only." },
      { role: "user", content: prompt },
    ],
  });
  const res = await fetch(POLLINATIONS_TEXT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Referer: "https://anyayadesigns.github.io/",
    },
    body,
  });
  if (!res.ok) throw new Error(`pollinations ${res.status}`);
  return parseJson(await res.text());
}

function pickHeadline(angle) {
  const segments = String(angle)
    .split(/[—–]/)
    .map((s) => s.trim())
    .filter(Boolean);
  let headline = segments.length > 1 ? segments[segments.length - 1] : String(angle);
  headline = headline.replace(/^["']+|["']+$/g, "").replace(/\?$/, "");
  if (headline.length > 56) {
    const cut = headline.slice(0, 56);
    const space = cut.lastIndexOf(" ");
    headline = cut.slice(0, space > 28 ? space : 56);
  }
  return headline.charAt(0).toUpperCase() + headline.slice(1);
}

function fallbackContent({ brand, pillar, angle, cta }) {
  const accents = ["forever begins", "beautifully yours", "made with love", "kilig, delivered"];
  const weekIndex = Math.floor(Date.now() / 604_800_000);
  const headline = pickHeadline(angle);
  const emphasized = headline.split(" ");
  if (emphasized.length > 2) {
    const mid = Math.floor(emphasized.length / 2);
    emphasized[mid] = `*${emphasized[mid]}*`;
  }
  return {
    layout: "quote",
    kicker: pillar.name,
    headline: emphasized.join(" "),
    subtext: angle,
    caption: `${angle}\n\nSa ${brand.name}, kami na ang bahala sa mga detalye — ikaw, mag-focus ka na lang sa kilig. 🤍\n\n${cta.replace("{url}", brand.website)}`,
    hashtags: [...brand.hashtags.slice(0, 5), ...pillar.hashtagsExtra].join(" "),
    imagePrompt: angle,
    accent: accents[weekIndex % accents.length],
  };
}

function normalize(content, { pillar, layout }) {
  const out = { ...content };
  const allowed = pillar.layouts ?? ["quote"];
  out.layout = allowed.includes(out.layout) ? out.layout : layout ?? allowed[0];
  out.kicker = String(out.kicker ?? pillar.kicker).slice(0, 42);
  out.headline = String(out.headline ?? "").slice(0, 140);
  if (!out.headline) throw new Error("no headline from ai");
  if (Array.isArray(out.items)) {
    out.items = out.items.slice(0, 4).map((it) => ({
      t: String(it.t ?? "").slice(0, 40),
      d: String(it.d ?? "").slice(0, 80),
    }));
  }
  if (Array.isArray(out.cons)) out.cons = out.cons.slice(0, 4).map((c) => String(c).slice(0, 60));
  if (Array.isArray(out.pros)) out.pros = out.pros.slice(0, 4).map((c) => String(c).slice(0, 60));
  for (const field of ["subtext", "stat", "statSub", "badLabel", "goodLabel", "accent", "buttonText"]) {
    if (out[field]) out[field] = String(out[field]).slice(0, 130);
  }
  out.caption = String(out.caption ?? "").trim();
  out.hashtags = String(out.hashtags ?? "").trim();
  return out;
}

export async function generateContent(ctx) {
  const prompt = buildPrompt(ctx);
  const providers = [tryGemini, tryPollinations];
  for (const provider of providers) {
    try {
      const content = await provider(prompt);
      if (content?.headline && content?.caption) {
        return normalize(content, ctx);
      }
    } catch (err) {
      console.warn(`[ai] ${provider.name} failed: ${err.message}`);
    }
  }
  console.warn("[ai] all providers failed, using fallback template");
  return fallbackContent(ctx);
}
