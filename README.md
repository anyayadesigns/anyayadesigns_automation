# 🎨 Anyaya Post Studio

**AI-powered social media automation para sa Anyaya Designs** — RSVP websites & printed invitations.

Gumagawa ng 1 branded post kada araw (caption + designed image), tapos **approve ka lang**, at automatic nang ma-post sa **Facebook Page** at **Instagram**.

```
 ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
 │  ⏰ Daily 8AM PH  │     │  ✅ IKAW: Approve │     │  🚀 Auto-Post    │
 │  AI generates    │ ──► │  sa Post Studio   │ ──► │  FB Page + IG    │
 │  caption + image │     │  (GitHub Pages)   │     │  (Meta API)      │
 └──────────────────┘     └──────────────────┘     └─────────────────┘
```

| Component | Tool | Cost |
|---|---|---|
| Admin Panel | GitHub Pages (`index.html`) | ₱0 |
| Daily automation | GitHub Actions cron | ₱0 |
| Captions | Gemini API (free tier) o Pollinations.ai | ₱0 |
| Images | Pollinations.ai (AI photos) + branded SVG template mo | ₱0 |
| Hosting ng images | GitHub repo mismo | ₱0 |
| Posting | Meta Graph API | ₱0 |

---

## 📁 Content Strategy — 7 Pillars (1 kada araw)

| Araw | Pillar | Layunin |
|---|---|---|
| Sun 🤍 | Sweet Sunday | Kilig quotes, soft promo, gratitude |
| Mon 🌸 | Moodboard Monday | Wedding pegs & themes |
| Tue 💻 | Tech Tuesday | Bakit kailangan ng RSVP website |
| Wed 💍 | Wedding Wednesday | Invitation design tips |
| Thu ⭐ | Feature Thursday | Service spotlight + packages |
| Fri ❓ | FAQ Friday | Sagot sa "Magkano? Gaano kabilis?" |
| Sat ✂️ | Behind the Scenes | Process, packing, human side |

Edit ang themes/angles: `content/pillars.json`
Edit ang brand colors/fonts/handles: `brand.config.json`

---

## 🛠️ ONE-TIME SETUP (15–20 minuto)

### Step 1 — I-push ang repo na ito sa GitHub

```bash
git add -A
git commit -m "✨ Anyaya Post Studio v1"
git remote add origin https://github.com/anyayadesigns/anyayadesigns_automation.git
git push -u origin main
```

### Step 2 — Enable ang GitHub Pages (para sa Admin Panel)

1. Repo → **Settings → Pages**
2. Source: **Deploy from a branch** → Branch: `main` / `(root)` → Save
3. Antayin ang ~1 min. Ang admin panel mo ay nasa:
   `https://anyayadesigns.github.io/anyayadesigns_automation/`

### Step 3 — Gumawa ng Personal Access Token (para sa approve button)

1. Puntahan: <https://github.com/settings/personal-access-tokens/new>
2. **Token name:** `Anyaya Post Studio`
3. **Resource owner:** `anyayadesigns`
4. **Repository access:** Only select repositories → piliin ang `anyayadesigns_automation`
5. **Permissions:** Repository permissions:
   - `Contents` → **Read and write**
   - `Actions` → **Read and write**
6. Generate → **i-copy ang token** (hindi na ulit makikita!)

Bukasin ang Admin Panel URL → click ⚙️ → paste token → Save. ✅

### Step 4 — Facebook Page posting setup

1. Puntahan <https://developers.facebook.com> → **My Apps → Create App** → type: **Business**
2. Sa app, add product: **Facebook Login for Business** (o Graph API Explorer tools)
3. Kunin ang **Page ID**: punta sa FB Page → About/Page transparency, o gamit ang [findmyfbid](https://lookup-id.com)
4. Gumawa ng **long-lived Page Access Token**:
   - Sa Graph API Explorer: generate User Access Token with `pages_show_list`, `pages_manage_posts`, `business_management` permissions
   - I-exchange: `GET https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}` → long-lived user token (~60 days)
   - Kunin ang Page token: `GET /me/accounts?access_token={LONG_USER_TOKEN}` → **page_access_token ng Anyaya Designs page** (ito ay hindi nag-e-expire!)
5. Repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `FACEBOOK_PAGE_ID` = page id
   - `FACEBOOK_PAGE_TOKEN` = page access token

### Step 5 — Instagram auto-post setup (optional pero sulit)

1. I-convert ang IG account into **Professional (Business)** account sa IG app settings
2. I-link sa Facebook Page: FB Page → Settings → Linked accounts → Connect Instagram
3. Kunin ang IG User ID: `GET /{PAGE_ID}?fields=instagram_business_account&access_token={PAGE_TOKEN}`
4. Add secret: `INSTAGRAM_USER_ID` = IG user id

> ⚠️ Kailangan linked ang IG sa FB Page at business account — requirement ng Meta.

### Step 6 (optional) — Mas magandang captions via Gemini

1. Punta <https://aistudio.google.com/apikey> → Get API key (free)
2. Add secret: `GEMINI_API_KEY`

Kapag walang Gemini key, gumagamit pa rin ng libreng fallback (Pollinations.ai). Hindi masisiraang workflow.

---

## 📅 DAILY FLOW MO NA LANG

1. **8:00 AM** — automatic na gagawa ang GitHub Actions ng post draft (image + caption)
2. **Buklatin ang phone** — buksan ang Post Studio URL
3. **Basahin, i-edit kung gusto, tapos → ✅ Approve & Publish**
4. **~1 minuto** — live na sa Facebook Page at Instagram! 🎉
5. Balik ka after 1 min at i-click Refresh para makita ang links

### Manual generate (kapag may idea ka agad)

Repo → **Actions → Daily Post Generator → Run workflow**
- Optional: i-type ang pillar id (hal. `tuesday-tech`) para sa specific theme
- O kahit walang laman — susundin ang pillar ng araw ngayon

---

## 🔧 Local development (hindi required)

```bash
npm install
npm run generate          # gagawa ng 1 post draft locally
node scripts/publish.mjs  # manual publish (kailangan ng env vars)
```

---

## 📂 Structure

```
├── index.html                  ← Admin Panel (Post Studio)
├── brand.config.json           ← Colors, fonts, handles, hashtags
├── content/
│   ├── pillars.json            ← 7 content pillars + angles + CTAs
│   └── posts.json              ← Queue: draft → approved → posted
├── assets/posts/               ← Generated PNG images (1080×1350)
├── scripts/
│   ├── generate.mjs            ← AI caption + branded image composer
│   ├── publish.mjs             ← FB + IG publisher (Graph API)
│   └── lib/
│       ├── ai.mjs              ← Gemini/Pollinations content engine
│       ├── image.mjs           ← SVG→PNG branded card renderer
│       ├── fonts.mjs           ← Google Fonts downloader (Cormorant/Jost/Parisienne)
│       └── store.mjs           ← JSON storage helpers
└── .github/workflows/
    ├── generate.yml            ← Cron daily + manual dispatch
    └── publish.yml             ← Triggered by Approve button
```

---

## ❓ Troubleshooting

| Problema | Solusyon |
|---|---|
| Walang lumalabas sa queue | Check Actions tab kung may error; check na enabled ang workflows (Settings → Actions → Allow all) |
| "Bad credentials" sa panel | Expired/wrong token — gumawa ng bago (Step 3) |
| Approved pero walang post sa FB | Actions → Publish workflow → check logs; usually token/page id issue |
| IG hindi nagpo-post | Siguradong Business account + linked sa FB Page (Step 5) |
| Pangit ang generated image background | Skip mo lang o i-regenerate via Actions — AI photos vary per seed |

Made with 💚 by Anyaya Designs × Claude Code... este, ox 😄
