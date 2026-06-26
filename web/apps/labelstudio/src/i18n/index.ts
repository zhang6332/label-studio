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
};
const SUBSTR_KEYS = Object.keys(SUBSTR_REPLACEMENTS).sort((a, b) => b.length - a.length);
const SUBSTR_REGEX = new RegExp(`\\b(${SUBSTR_KEYS.map((k) => k.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")).join("|")})\\b`, "g");

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

export function applyLang(lang: Lang): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (lang === "en") return;
  const dict = dictionaries[lang];
  if (!dict) return;

  translateRoot(document.body, dict);
  translateSubstrings(document.body);

  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
          translateRoot(n, dict);
          translateSubstrings(n);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function initI18n(): void {
  const lang = getLang();
  if (lang === "en") return;
  const run = () => applyLang(lang);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    // Defer to let the initial React tree render, then translate once.
    setTimeout(run, 0);
  }
}
