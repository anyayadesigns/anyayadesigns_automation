import { loadBrand, loadPosts, savePosts, ROOT } from "./lib/store.mjs";

const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSION ?? "v26.0"}`;

const owner =
  process.env.GH_OWNER ?? process.env.GITHUB_REPOSITORY?.split("/")[0];
const repo = process.env.GH_REPO ?? process.env.GITHUB_REPOSITORY?.split("/")[1];
const ref = process.env.GH_REF ?? process.env.GITHUB_REF_NAME ?? "main";

const pageId = process.env.FACEBOOK_PAGE_ID;
const pageToken = process.env.FACEBOOK_PAGE_TOKEN;
const igUserId = process.env.INSTAGRAM_USER_ID;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function rawImageUrl(imageRel) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${imageRel}`;
}

async function graphPost(endpoint, params) {
  const body = new URLSearchParams({ access_token: pageToken, ...params });
  const res = await fetch(`${GRAPH}${endpoint}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `graph ${res.status}`);
  return data;
}

async function graphGet(endpoint) {
  const url = `${GRAPH}${endpoint}&access_token=${encodeURIComponent(pageToken)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `graph ${res.status}`);
  return data;
}

async function publishFacebook(post) {
  if (!pageId || !pageToken) {
    console.warn("[fb] FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN not set, skipping FB");
    return null;
  }
  const caption = `${post.caption}\n\n${post.hashtags}`.trim().slice(0, 5000);
  const res = await graphPost(`/${pageId}/photos`, {
    url: rawImageUrl(post.image),
    caption,
  });
  const postId = res.post_id ?? res.id;
  let permalink = null;
  try {
    const detail = await graphGet(`/${postId}?fields=permalink_url`);
    permalink = detail.permalink_url;
  } catch {
    try {
      const detail = await graphGet(`/${postId}?fields=permalink`);
      permalink = detail.permalink;
    } catch {}
  }
  console.log(`[fb] published photo post ${postId}`);
  return { id: postId, permalink };
}

async function publishInstagram(post) {
  if (!igUserId || !pageToken) {
    console.warn("[ig] INSTAGRAM_USER_ID not set, skipping IG");
    return null;
  }
  const caption = `${post.caption}\n\n${post.hashtags}`.trim().slice(0, 2200);
  const container = await graphPost(`/${igUserId}/media`, {
    image_url: rawImageUrl(post.image),
    caption,
    media_type: "IMAGE",
  });
  let statusCode = "IN_PROGRESS";
  for (let i = 0; i < 12 && statusCode !== "FINISHED"; i++) {
    await sleep(5_000);
    const status = await graphGet(`/${container.id}?fields=status_code`);
    statusCode = status.status_code;
    if (statusCode === "ERROR") throw new Error("IG container error");
  }
  if (statusCode !== "FINISHED") throw new Error("IG container timeout");
  const publishRes = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: container.id,
  });
  let permalink = null;
  try {
    const detail = await graphGet(`/${publishRes.id}?fields=permalink`);
    permalink = detail.permalink;
  } catch {}
  console.log(`[ig] published media ${publishRes.id}`);
  return { id: publishRes.id, permalink };
}

async function main() {
  const brand = loadBrand();
  const posts = loadPosts();
  const onlyId = process.argv.find((a) => a.startsWith("--id="))?.slice(5);

  const approved = posts.filter(
    (p) => p.status === "approved" && (!onlyId || p.id === onlyId)
  );

  if (approved.length === 0) {
    console.log("[publish] no approved posts found");
    return;
  }

  for (const post of approved) {
    console.log(`[publish] processing ${post.id}...`);
    const links = {};
    let anyFail = false;
    try {
      const fb = await publishFacebook(post);
      if (fb) links.facebook = fb;
    } catch (err) {
      anyFail = true;
      console.error(`[fb] failed: ${err.message}`);
    }
    try {
      const ig = await publishInstagram(post);
      if (ig) links.instagram = ig;
    } catch (err) {
      anyFail = true;
      console.error(`[ig] failed: ${err.message}`);
    }

    post.links = links;
    if (!anyFail) {
      post.status = "posted";
      post.postedAt = new Date().toISOString();
      console.log(`[publish] ${post.id} → posted ✓`);
    } else if (Object.keys(links).length > 0) {
      post.status = "posted";
      post.postedAt = new Date().toISOString();
      post.publishNote = "partial success — check workflow logs";
    } else {
      post.publishNote = "all publishes failed — still approved, retry by re-approving";
      console.error(`[publish] ${post.id} all failed`);
    }
  }

  savePosts(posts);

  const postedCount = posts.filter((p) => p.status === "posted").length;
  console.log(`[done] total posted in queue history: ${postedCount}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
