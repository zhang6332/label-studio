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

export function applyLang(lang: Lang): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (lang === "en") return;
  const dict = dictionaries[lang];
  if (!dict) return;

  translateRoot(document.body, dict);

  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
          translateRoot(n, dict);
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
