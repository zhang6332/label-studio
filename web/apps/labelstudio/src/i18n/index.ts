/**
 * Lightweight i18n layer for the Label Studio frontend.
 *
 * Strategy: a JSON dictionary (locales/<lang>.json) mapping source (English)
 * strings to translated strings, applied by walking the DOM text nodes and
 * replacing exact (whitespace-trimmed) matches. A MutationObserver keeps
 * newly-rendered content translated too, so every page/region updates without
 * a per-component refactor.
 *
 * Adding a new language:
 *   1. drop `locales/<lang>.json` (source-string -> translated-string)
 *   2. add the code to `SUPPORTED` / `langLabels` below
 * That's it — the switcher and translator pick it up automatically.
 *
 * Switching back to "en" reloads (the source strings ARE the original text,
 * so we just stop translating instead of restoring node-by-node).
 */
import zhCN from "./locales/zh-CN.json";

export type Lang = "en" | "zh-CN";

const STORAGE_KEY = "ls-lang";
export const SUPPORTED: Lang[] = ["en", "zh-CN"];
export const langLabels: Record<Lang, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

// en is the source language — empty dict means "no replacement".
const dictionaries: Record<Lang, Record<string, string>> = {
  en: {},
  "zh-CN": zhCN as unknown as Record<string, string>,
};

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "NOSCRIPT", "CODE"]);

export function getLang(): Lang {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s && (SUPPORTED as string[]).includes(s)) return s as Lang;
  } catch {
    /* localStorage unavailable */
  }
  return "en";
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  // Reload so the page re-renders from the source strings and we re-apply
  // the chosen dictionary cleanly (no node-by-node restore needed).
  window.location.reload();
}

function translateRoot(root: Node, dict: Record<string, string>): void {
  if (!dict || Object.keys(dict).length === 0) return;
  const ownerDoc = (root as Document).ownerDocument ?? document;
  const walker = ownerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const pending: Array<[Text, string]> = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName)) continue;
    // skip elements that opted out
    if (parent.closest("[data-i18n-skip]")) continue;
    const value = node.nodeValue;
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const translated = dict[trimmed];
    if (!translated) continue;
    const lead = /^\s*/.exec(value)?.[0] ?? "";
    const trail = /\s*$/.exec(value)?.[0] ?? "";
    pending.push([node, lead + translated + trail]);
  }
  for (const [node, val] of pending) {
    if (node.nodeValue !== val) node.nodeValue = val;
  }
}

let observer: MutationObserver | null = null;

// Substring replacements: applied after exact-match dict, to translate
// fragments that contain dynamic content the dict can't key on — most
// notably dates rendered by date-fns (English month names + am/pm).
// Keys are matched case-sensitively as whole words; longest keys first to
// avoid "May" shadowing nothing in particular but to be deterministic.
const SUBSTR_REPLACEMENTS: Record<string, string> = {
  January: "1月",
  February: "2月",
  March: "3月",
  April: "4月",
  May: "5月",
  June: "6月",
  July: "7月",
  August: "8月",
  September: "9月",
  October: "10月",
  November: "11月",
  December: "12月",
  Jan: "1月",
  Feb: "2月",
  Mar: "3月",
  Apr: "4月",
  Jun: "6月",
  Jul: "7月",
  Aug: "8月",
  Sep: "9月",
  Oct: "10月",
  Nov: "11月",
  Dec: "12月",
  AM: "上午",
  PM: "下午",
  // Relative time (date-fns formatDistance: "5 minutes ago", "2 hours ago", etc.)
  second: "秒",
  seconds: "秒",
  minute: "分钟",
  minutes: "分钟",
  hour: "小时",
  hours: "小时",
  day: "天",
  days: "天",
  week: "周",
  weeks: "周",
  month: "个月",
  months: "个月",
  year: "年",
  years: "年",
  ago: "前",
  about: "约",
  almost: "近",
  over: "超过",
};
const SUBSTR_KEYS = Object.keys(SUBSTR_REPLACEMENTS).sort((a, b) => b.length - a.length);
const SUBSTR_REGEX = new RegExp(
  `\\b(${SUBSTR_KEYS.map((k) => k.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")).join("|")})\\b`,
  "g",
);

function translateSubstrings(root: Node): void {
  const ownerDoc = (root as Document).ownerDocument ?? document;
  const walker = ownerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const pending: Array<[Text, string]> = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName)) continue;
    if (parent.closest("[data-i18n-skip]")) continue;
    const value = node.nodeValue;
    if (!value || !SUBSTR_REGEX.test(value)) continue;
    SUBSTR_REGEX.lastIndex = 0;
    const replaced = value.replace(SUBSTR_REGEX, (m) => SUBSTR_REPLACEMENTS[m] ?? m);
    if (replaced !== value) pending.push([node, replaced]);
  }
  for (const [node, val] of pending) {
    if (node.nodeValue !== val) node.nodeValue = val;
  }
}

// Date localization: runs after substring replacement so month names are
// already Chinese (e.g. "6月"). Reorders "dd M月 yyyy" -> "yyyy M月dd" and
// strips commas, so "26 6月 2026, 11:00 上午" becomes "2026 6月26 11:00 上午".
// Only touches text nodes that contain a month marker (月 or Jan..Dec).
function translateDates(root: Node): void {
  const ownerDoc = (root as Document).ownerDocument ?? document;
  const walker = ownerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const pending: Array<[Text, string]> = [];
  const monthRe = /月|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName)) continue;
    if (parent.closest("[data-i18n-skip]")) continue;
    const value = node.nodeValue;
    if (!value || !monthRe.test(value)) continue;
    let replaced = value;
    // "M月 dd yyyy" -> "yyyy M月dd"  (6月 26 2026 -> 2026 6月26)
    replaced = replaced.replace(/(\d{1,2})月\s+(\d{1,2})\s+(\d{4})/g, "$3 $1月$2");
    // "dd M月 yyyy" -> "yyyy M月dd"  (26 6月 2026 -> 2026 6月26)
    replaced = replaced.replace(/(\d{1,2})\s+(\d{1,2})月\s+(\d{4})/g, "$3 $2月$1");
    // strip commas inside date text (Jun 26, 2026 -> Jun 26 2026)
    replaced = replaced.replace(/,\s*/g, " ");
    if (replaced !== value) pending.push([node, replaced]);
  }
  for (const [node, val] of pending) {
    if (node.nodeValue !== val) node.nodeValue = val;
  }
}

// Attribute translation: title, aria-label, placeholder, alt. These are not
// text nodes so translateRoot cannot reach them — without this, tooltips and
// placeholders stay in the source language even under zh-CN.
const TRANSLATABLE_ATTRS = ["title", "aria-label", "placeholder", "alt"];

function translateAttributes(root: Node, dict: Record<string, string>): void {
  if (!dict) return;
  const els: Element[] = [];
  const rootEl = root as Element;
  if (rootEl.nodeType === Node.ELEMENT_NODE) {
    els.push(rootEl);
    rootEl.querySelectorAll?.("*")?.forEach((e) => els.push(e as Element));
  } else if ((root as Document).querySelectorAll) {
    (root as any).querySelectorAll("*").forEach((e: Element) => els.push(e));
  }
  for (const el of els) {
    for (const attr of TRANSLATABLE_ATTRS) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      const translated = dict[v.trim()];
      if (translated && translated !== v) el.setAttribute(attr, translated);
    }
  }
}

export function applyLang(lang: Lang): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  // Set <html lang="..."> so CSS can drive language-specific styling (e.g.
  // font-size parity between en/zh) without React state / re-render flicker.
  document.documentElement.lang = lang;

  const runAll = (root: Node) => {
    if (lang === "en") {
      translateDates(root);
    } else {
      const dict = dictionaries[lang];
      translateRoot(root, dict);
      translateSubstrings(root);
      translateDates(root);
      translateAttributes(root, dict);
    }
  };

  // Initial pass over the entire body (catches already-rendered content).
  runAll(document.body);

  // MutationObserver: catches dynamically added nodes (React re-renders,
  // lazy-loaded routes, portal tooltips, etc.).
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
          runAll(n);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Safety net: lazy-loaded route chunks (e.g. HomePage via React.lazy) may
  // render AFTER the initial pass but their DOM mutations can be missed by
  // the observer if React batches them in a way that the addedNodes don't
  // contain the text nodes directly. A short-interval re-scan of the full
  // body for the first few seconds catches these reliably.
  if (lang !== "en") {
    let polls = 0;
    const maxPolls = 12; // 12 × 500ms = 6 seconds
    const poll = setInterval(() => {
      runAll(document.body);
      polls++;
      if (polls >= maxPolls) clearInterval(poll);
    }, 500);
  }
}

export function initI18n(): void {
  const lang = getLang();
  // Even English runs applyLang (to strip date commas uniformly).
  const run = () => applyLang(lang);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    // Defer to let the initial React tree render, then translate once.
    setTimeout(run, 0);
  }
}
