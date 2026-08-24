import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url)))
);

export function loadJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

export function writeJSON(rel, data) {
  const target = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export const loadBrand = () => loadJSON("brand.config.json");
export const loadPillars = () => loadJSON("content/pillars.json").pillars;

export function loadPosts() {
  try {
    return loadJSON("content/posts.json").posts;
  } catch {
    return [];
  }
}

export function savePosts(posts) {
  writeJSON("content/posts.json", { version: 1, posts });
}

export function phToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  const dayIndex = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ].indexOf(weekday);
  return {
    dateStr: `${get("year")}${get("month")}${get("day")}`,
    dayIndex,
  };
}
