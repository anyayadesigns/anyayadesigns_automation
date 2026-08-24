const POLLINATIONS_TEXT = "https://text.pollinations.ai/openai";
const GEMINI_TEXT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

function buildPrompt({ brand, pillar, angle, cta }) {
  const ctaText = cta.replace("{url}", brand.website);
  return `You are the social media copywriter for "${brand.name}" (${brand.handle}) — ${brand.tagline}.
Services: ${brand.services.join(" | ")}.
Audience: ${brand.audience}.
Write in warm Taglish (Filipino + English mix), elegant but approachable tone.

TODAY'S CONTENT PILLAR: ${pillar.name}
ANGLE TO USE: ${angle}

Return STRICT JSON only (no markdown fences, no commentary) with this exact shape:
{
  "headline": "3-8 word elegant headline for the image card, English, title case, no emojis",
  "accent": "one short script-font phrase (1-3 words) that adds kilig, e.g. forever begins",
  "caption": "engaging caption, 2-4 short sentences, use line breaks between thoughts, must end with this call-to-action verbatim: ${ctaText}",
  "hashtags": "space-separated hashtags starting with these: ${brand.hashtags.slice(0, 5).join(" ")} plus relevant extras",
  "imagePrompt": "one sentence describing a photorealistic background scene that matches the headline and pillar mood"
}`;
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
  const accents = [
    "forever begins",
    "beautifully yours",
    "made with love",
    "kilig, delivered",
    "your yes, styled",
  ];
  const weekIndex = Math.floor(Date.now() / 604_800_000);
  return {
    headline: pickHeadline(angle),
    accent: accents[weekIndex % accents.length],
    caption: `${angle}\n\nSa ${brand.name}, kami na ang bahala sa mga detalye — ikaw, mag-focus ka na lang sa kilig. 🤍\n\n${cta.replace("{url}", brand.website)}`,
    hashtags: [...brand.hashtags.slice(0, 5), ...pillar.hashtagsExtra].join(" "),
    imagePrompt: angle,
  };
}

export async function generateContent(ctx) {
  const prompt = buildPrompt(ctx);
  const providers = [tryGemini, tryPollinations];
  for (const provider of providers) {
    try {
      const content = await provider(prompt);
      if (content?.headline && content?.caption) {
        content.caption = String(content.caption).trim();
        return content;
      }
    } catch (err) {
      console.warn(`[ai] ${provider.name} failed: ${err.message}`);
    }
  }
  console.warn("[ai] all providers failed, using fallback template");
  return fallbackContent(ctx);
}
