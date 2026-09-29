// One-off codemod for react/button-has-type.
//
// Adds an explicit `type` to every lowercase <button> that is missing one,
// preserving current runtime behavior exactly:
//   - a <button> nested inside a <form> element defaults to type="submit" in
//     the DOM, so it gets an explicit type="submit" (no behavior change);
//   - every other <button> gets type="button" (outside a form the submit
//     default is a no-op, so this is also behavior-preserving).
//
// Custom components (<Button>) are never touched — the lint rule only flags the
// intrinsic lowercase element. Buttons that already declare a `type` are left
// alone. Edits are applied by string offset so formatting is untouched.
//
// Usage: node scripts/codemods/add-button-type.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";

const traverse = _traverse.default ?? _traverse;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function isButton(name) {
  return name?.type === "JSXIdentifier" && name.name === "button";
}
function isForm(name) {
  return name?.type === "JSXIdentifier" && name.name === "form";
}
function hasTypeAttr(attrs) {
  return attrs.some(
    (a) => a.type === "JSXAttribute" && a.name?.name === "type",
  );
}

let filesChanged = 0;
let buttonsFixed = 0;
let submitCount = 0;
const parseErrors = [];

for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8");
  if (!src.includes("<button")) continue;

  let ast;
  try {
    ast = parse(src, {
      sourceType: "module",
      plugins: ["jsx", "typescript", "decorators-legacy"],
    });
  } catch (err) {
    parseErrors.push(`${file}: ${err.message}`);
    continue;
  }

  const edits = [];
  traverse(ast, {
    JSXOpeningElement(path) {
      const { node } = path;
      if (!isButton(node.name)) return;
      if (hasTypeAttr(node.attributes)) return;

      const inForm = path.findParent(
        (p) => p.isJSXElement() && isForm(p.node.openingElement.name),
      );
      const type = inForm ? "submit" : "button";
      if (inForm) submitCount++;
      edits.push({ pos: node.name.end, text: ` type="${type}"` });
    },
  });

  if (edits.length === 0) continue;
  edits.sort((a, b) => b.pos - a.pos);
  let next = src;
  for (const { pos, text } of edits) {
    next = next.slice(0, pos) + text + next.slice(pos);
  }
  writeFileSync(file, next);
  filesChanged++;
  buttonsFixed += edits.length;
}

console.log(
  `Fixed ${buttonsFixed} <button> element(s) across ${filesChanged} file(s) — ` +
    `${submitCount} type="submit" (inside a form), ${buttonsFixed - submitCount} type="button".`,
);
if (parseErrors.length) {
  console.log(`\nParse errors (left untouched):`);
  for (const e of parseErrors) console.log(`  ${e}`);
}
