/* eslint-disable */
/**
 * i18n codemod — wraps strings into t() across app AND libraries.
 *
 * Targets:
 *   - apps/labelstudio/src  → import t from relative ".../i18n"
 *   - libs/editor/src       → import t from "@humansignal/core"
 *   - libs/datamanager/src  → import t from "@humansignal/core"
 *
 * Wraps when a string EXACTLY matches a zh-CN.json key, at:
 *   1. JSX text nodes
 *   2. JSX attrs: placeholder | title | aria-label | alt | label | header | description | text
 *   3. Object property VALUES under UI keys (label/title/message/...)
 *
 * AST locates hits; file is rewritten by splicing ORIGINAL source at each hit
 * (no whole-file reformat). Libraries keep their built-in English for strings
 * not in the dictionary.
 *
 *   node scripts/i18n-codemod.cjs            # dry-run
 *   node scripts/i18n-codemod.cjs --write    # apply
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverseMod = require("@babel/traverse");
const traverse = traverseMod.default || traverseMod;
const t = require("@babel/types");

const WRITE = process.argv.includes("--write");
const WEB = path.resolve(__dirname, "..");
const APP_SRC = path.join(WEB, "apps/labelstudio/src");
const APP_I18N = path.join(APP_SRC, "i18n");
const dict = JSON.parse(fs.readFileSync(path.join(APP_I18N, "locales/zh-CN.json"), "utf8"));
const keys = new Set(Object.keys(dict));

const TARGETS = [
  path.join(APP_SRC),
  path.join(WEB, "libs/editor/src"),
  path.join(WEB, "libs/datamanager/src"),
  path.join(WEB, "libs/app-common/src"),
];
const TRANSLATABLE_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label", "header", "description", "text"]);
const UI_PROP_NAMES = new Set([
  "label", "title", "text", "message", "description", "placeholder",
  "header", "content", "tooltip", "subtitle", "hint", "caption",
  "confirmText", "cancelText", "okText", "buttonText", "summary",
  "altText", "labelText", "titleText", "help", "tag",
]);

function isApp(file) {
  return file.startsWith(APP_SRC);
}
function importSpec(file) {
  // app files: relative path to app i18n; library files: shared core package.
  if (isApp(file)) {
    let rel = path.relative(path.dirname(file), APP_I18N);
    if (!rel.startsWith(".")) rel = "./" + rel;
    return { module: rel, isCore: false };
  }
  return { module: "@humansignal/core", isCore: true };
}
function hasTImport(code, file) {
  const { module, isCore } = importSpec(file);
  const esc = module.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bimport\\s*\\{[^}]*\\bt\\b[^}]*\\}\\s*from\\s*["']${esc}["']`).test(code);
}
function importLine(file) {
  const { module } = importSpec(file);
  return `import { t } from "${module}";\n`;
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "i18n", "__tests__", "tests", "__mocks__", "dist", "build"].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx|jsx|ts|js)$/.test(e.name)) {
      out.push(p);
    }
  }
}
function attrName(node) {
  if (!node || !node.name) return "";
  if (typeof node.name === "string") return node.name;
  return node.name.name || "";
}

const files = [];
for (const root of TARGETS) walk(root, files);

const hits = [];
let filesWritten = 0;
const pushHit = (file, node, kind, text) =>
  hits.push({ file: path.relative(WEB, file), line: node.loc?.start?.line, kind, text });

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parser.parse(code, { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: true });
  } catch {
    continue;
  }
  const changes = [];
  traverse(ast, {
    JSXText(p) {
      const node = p.node;
      const raw = node.value;
      const trimmed = raw.trim();
      if (!trimmed || !keys.has(trimmed)) return;
      pushHit(file, node, "JSXText", trimmed);
      if (!WRITE) return;
      const lead = /^\s*/.exec(raw)[0];
      const trail = /\s*$/.exec(raw)[0];
      changes.push({ start: node.start, end: node.end, repl: `${lead}{t("${trimmed}")}${trail}` });
    },
    JSXAttribute(p) {
      const name = attrName(p.node);
      if (!TRANSLATABLE_ATTRS.has(name)) return;
      const v = p.node.value;
      if (!v || !t.isStringLiteral(v) || !keys.has(v.value)) return;
      pushHit(file, v, `attr[${name}]`, v.value);
      if (!WRITE) return;
      changes.push({ start: v.start, end: v.end, repl: `{t("${v.value}")}` });
    },
    StringLiteral(p) {
      const node = p.node;
      if (!keys.has(node.value)) return;
      const parent = p.parent;
      if (t.isObjectProperty(parent) && parent.key === node) return;
      if (
        t.isImportDeclaration(parent) || t.isExportNamedDeclaration(parent) ||
        t.isCallExpression(parent) || t.isMemberExpression(parent) ||
        t.isSwitchCase(parent) || t.isTSLiteralType(parent) || t.isClassProperty(parent) ||
        t.isJSXAttribute(parent) || t.isObjectMethod(parent)
      ) return;
      if (!(t.isObjectProperty(parent) && parent.value === node)) return;
      const k = parent.key;
      const keyName = k && (k.name || (t.isStringLiteral(k) ? k.value : null));
      if (!keyName || !UI_PROP_NAMES.has(keyName)) return;
      pushHit(file, node, `obj.${keyName}`, node.value);
      if (!WRITE) return;
      changes.push({ start: node.start, end: node.end, repl: `t("${node.value}")` });
    },
  });
  if (!WRITE || !changes.length) continue;

  changes.sort((a, b) => b.start - a.start);
  let out = code;
  for (const c of changes) out = out.slice(0, c.start) + c.repl + out.slice(c.end);

  if (!hasTImport(out, file)) {
    const imp = importLine(file);
    const m = out.match(/^import[^\n]*\n/m);
    out = m ? out.slice(0, m.index) + imp + out.slice(m.index) : imp + out;
  }
  fs.writeFileSync(file, out);
  filesWritten++;
}

const by = (k) => hits.filter((h) => h.kind.startsWith(k)).length;
console.log(`mode: ${WRITE ? "WRITE" : "DRY-RUN"}`);
console.log(`JSX text: ${by("JSXText")} | attr: ${by("attr")} | obj.*: ${by("obj.")}`);
console.log(`Total hits: ${hits.length} | Files: ${new Set(hits.map((h) => h.file)).size}`);
if (WRITE) console.log(`Files written: ${filesWritten}`);
const byTarget = (t) => hits.filter((h) => h.file.includes(t)).length;
console.log(`  app: ${byTarget("apps/labelstudio")} | editor: ${byTarget("libs/editor")} | datamanager: ${byTarget("libs/datamanager")}`);
