import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const user = process.env.ADMIN_USER;
const pass = process.env.ADMIN_PASS;

let config = "window.ANYAYA_AUTH = null;\n";
if (user && pass) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(`${salt}${user}:${pass}`)
    .digest("hex");
  config = `window.ANYAYA_AUTH = { salt: "${salt}", hash: "${hash}" };\n`;
}

fs.writeFileSync(path.join(ROOT, "auth.config.js"), config);
console.log(
  config.includes("null")
    ? "[auth] disabled — walang ADMIN_USER/ADMIN_PASS secrets"
    : "[auth] login enabled (salted hash lang ang naka-commit, hindi ang password)"
);
