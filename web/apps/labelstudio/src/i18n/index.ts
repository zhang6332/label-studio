/**
 * App-level i18n wiring.
 *
 * The translation mechanism (t / getLang / setLang / dictionary registry) lives
 * in @humansignal/core so libraries (editor, datamanager) can import t() without
 * depending back on the app. This module:
 *   - registers the zh-CN dictionary (from core) at load time
 *   - re-exports t/getLang/setLang so existing app imports keep working
 *   - keeps the DOM post-processor (applyLang/initI18n) as a fallback for
 *     strings the app can't render itself (backend-returned text such as
 *     data_manager column help, and third-party component internals).
 *     Component-rendered text should use t() directly — no flicker, no perf cost.
 */
import zhCN from "./locales/zh-CN.json";
import { t, getLang, setLang, setDictionary, getDictionary } from "@humansignal/core";
import type { Lang } from "@humansignal/core";

export { t, getLang, setLang };
export type { Lang };
export const SUPPORTED: Lang[] = ["en", "zh-CN"];
export const langLabels: Record<Lang, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

// Register the dictionary at module load (before any component renders).
setDictionary("zh-CN", zhCN as unknown as Record<string, string>);

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "NOSCRIPT", "CODE"]);

function translateRoot(root: Node, dict: Record<string, string>): void {
  if (!dict || Object.keys(dict).length === 0) return;
  const ownerDoc = (root as Document).ownerDocument ?? document;
  const walker = ownerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const pending: Array<[Text, string]> = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName)) continue;
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
  // Backend validation errors — dynamic API responses with variables (uuid,
  // counts, tag names) that can't be t()'d at render time. Substring-replace
  // the fixed prefix; the variable tail stays as-is.
  "Created annotations are incompatible with provided labeling schema, we found:":
    "创建的标注与当前标注配置不兼容，发现：",
  "Validation error": "验证错误",
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
    if (!value) continue;
    const replaced = value.replace(SUBSTR_REGEX, (m) => SUBSTR_REPLACEMENTS[m] ?? m);
    if (replaced !== value) pending.push([node, replaced]);
  }
  for (const [node, val] of pending) {
    if (node.nodeValue !== val) node.nodeValue = val;
  }
}

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
    replaced = replaced.replace(/(\d{1,2})月\s+(\d{1,2})\s+(\d{4})/g, "$3 $1月$2");
    replaced = replaced.replace(/(\d{1,2})\s+(\d{1,2})月\s+(\d{4})/g, "$3 $2月$1");
    replaced = replaced.replace(/,\s*/g, " ");
    if (replaced !== value) pending.push([node, replaced]);
  }
  for (const [node, val] of pending) {
    if (node.nodeValue !== val) node.nodeValue = val;
  }
}

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
  document.documentElement.lang = lang;

  const runAll = (root: Node) => {
    if (lang === "en") {
      translateDates(root);
    } else {
      const dict = getDictionary(lang);
      translateRoot(root, dict);
      translateSubstrings(root);
      translateDates(root);
      translateAttributes(root, dict);
    }
  };

  runAll(document.body);

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

  if (lang !== "en") {
    let polls = 0;
    const maxPolls = 12;
    const poll = setInterval(() => {
      runAll(document.body);
      polls++;
      if (polls >= maxPolls) clearInterval(poll);
    }, 500);
  }
}

export function initI18n(): void {
  const lang = getLang();
  const run = () => applyLang(lang);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    setTimeout(run, 0);
  }
}
