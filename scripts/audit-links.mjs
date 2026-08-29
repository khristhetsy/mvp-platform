#!/usr/bin/env node
// Static link auditor: cross-checks every internal navigation in the codebase
// against the real route set in src/app, and flags suspicious patterns. Catches
// dead/misrouted buttons (like a link to a list page that should be a detail
// page) without running the app. Run: `npm run audit:links`.
//
// Limits: static only — can't see runtime-computed targets or a link that
// navigates fine to a page that then errors. Pair with `npm run audit:crawl`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "src/app");

function walk(dir, test, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(p, test, acc);
    } else if (test(p)) acc.push(p);
  }
  return acc;
}

// 1) Route set from src/app/**/{page,route}.{ts,tsx,js,jsx}
function toRoute(file) {
  let rel = file.slice(APP.length).replace(/\/(page|route)\.(t|j)sx?$/, "");
  rel = rel.split("/").filter((seg) => !/^\(.*\)$/.test(seg)).join("/");
  if (rel === "") rel = "/";
  const re =
    "^" +
    rel.replace(/\[\.\.\..+?\]/g, ".*").replace(/\[.+?\]/g, "[^/]+").replace(/\//g, "\\/") +
    "\\/?$";
  return { rel, re: new RegExp(re) };
}
const routes = walk(APP, (p) => /\/(page|route)\.(t|j)sx?$/.test(p)).map(toRoute);

function resolves(pathname) {
  if (pathname === "" || pathname === "/") return routes.some((r) => r.rel === "/");
  const test = pathname.replace(/X/g, "seg"); // ${...} placeholder -> a segment
  return routes.some((r) => r.re.test(test));
}

// 2) Extract internal navigations. Capture the FULL string literal (incl. `${...}`).
const NAV =
  /(?:href\s*=\s*|router\.(?:push|replace)\(\s*|(?:^|[^.\w])redirect\(\s*|window\.location\.href\s*=\s*|openLink\(\s*)\{?\s*(["'`])((?:\\.|(?!\1).)*)\1/g;

const srcFiles = walk(ROOT + "/src", (p) => /\.(t|j)sx?$/.test(p) && !/\.(test|spec)\./.test(p));

const unresolved = [];
const suspicious = [];

for (const f of srcFiles) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = NAV.exec(src)) !== null) {
    const raw = m[2];
    const line = src.slice(0, m.index).split("\n").length;
    const rel = f.slice(ROOT.length + 1);
    if (raw.startsWith("#")) {
      if (raw === "#") suspicious.push(`${rel}:${line}  href="#" (no destination)`);
      continue;
    }
    if (!raw.startsWith("/")) continue; // external / relative / dynamic base
    if (/[?]company(Id)?=/.test(raw)) suspicious.push(`${rel}:${line}  list-filter link: ${raw}`);
    const pathname = raw
      .split("?")[0]
      .split("#")[0]
      .replace(/([^/])\$\{[^}]*\}/g, "$1") // template glued to text (e.g. path${hash}) -> drop suffix
      .replace(/\$\{[^}]*\}/g, "X"); // template as a whole path segment -> a segment
    if (!raw.startsWith("/api/") && !resolves(pathname)) unresolved.push(`${rel}:${line}  ${raw}`);
  }
}

const empty = [];
for (const f of srcFiles) {
  const src = fs.readFileSync(f, "utf8");
  const re = /onClick=\{\(\)\s*=>\s*(\{\s*\}|false|null|undefined)\}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    empty.push(`${f.slice(ROOT.length + 1)}:${src.slice(0, m.index).split("\n").length}`);
  }
}

const dim = (s) => [...new Set(s)];
console.log(`Routes: ${routes.length} · files scanned: ${srcFiles.length}\n`);
console.log(`UNRESOLVED internal links (${unresolved.length}):`);
console.log(unresolved.length ? unresolved.join("\n") : "  none");
console.log(`\nSUSPICIOUS patterns (${dim(suspicious).length}):`);
console.log(dim(suspicious).length ? dim(suspicious).join("\n") : "  none");
console.log(`\nEMPTY onClick handlers (${empty.length}):`);
console.log(empty.length ? empty.join("\n") : "  none");

// Non-zero exit when a genuinely unresolved (non-API) link is found, so CI fails.
process.exit(unresolved.length > 0 ? 1 : 0);
