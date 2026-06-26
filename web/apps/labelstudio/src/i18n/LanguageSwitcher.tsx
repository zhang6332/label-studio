import { useState } from "react";
import { getLang, setLang, SUPPORTED, langLabels, type Lang } from "./index";

/**
 * Top-bar language switcher. Rendered in the Menubar next to the Hotkeys
 * button. On change it persists the choice and reloads so the whole app
 * re-renders in the new language (see i18n/index.ts).
 */
export const LanguageSwitcher = () => {
  const [lang, setLangState] = useState<Lang>(getLang());

  return (
    <select
      value={lang}
      aria-label="Switch language"
      data-testid="language-switcher"
      onChange={(e) => {
        const next = e.target.value as Lang;
        setLangState(next);
        setLang(next);
      }}
      style={{
        height: 30,
        padding: "0 8px",
        borderRadius: 6,
        border: "1px solid var(--dm-mixins-neutral-border, #ccc)",
        background: "transparent",
        color: "inherit",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {SUPPORTED.map((l) => (
        <option key={l} value={l}>
          {langLabels[l]}
        </option>
      ))}
    </select>
  );
};
