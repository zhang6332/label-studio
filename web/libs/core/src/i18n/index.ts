/**
 * Core i18n mechanism — shared by the app and by libraries (editor,
 * datamanager) so they can render translated text directly via t() without
 * depending back on the app.
 *
 * The app registers its dictionary (locales/zh-CN.json) at boot via
 * setDictionary(); libraries just call t(). No dictionary data lives here, so
 * this package stays free of localization resources.
 */
export type Lang = "en" | "zh-CN";

const STORAGE_KEY = "ls-lang";
export const SUPPORTED: Lang[] = ["en", "zh-CN"];

const dicts: Record<string, Record<string, string>> = {};

export function getLang(): Lang {
  try {
    const s = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
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
  if (typeof window !== "undefined") window.location.reload();
}

/** Register a language's dictionary. Called by the app at boot. */
export function setDictionary(lang: Lang, dict: Record<string, string>): void {
  dicts[lang] = dict;
}

/** Read a registered dictionary (used by the app's DOM post-processor). */
export function getDictionary(lang: Lang): Record<string, string> {
  return dicts[lang] ?? {};
}

/**
 * Translate an English source string into the active language AT RENDER TIME.
 * No DOM walking — zero delay/flicker. English returns the string unchanged.
 *   <Button>{t("Save")}</Button>
 */
export function t(english: string): string {
  const lang = getLang();
  if (lang === "en") return english;
  return dicts[lang]?.[english] ?? english;
}
