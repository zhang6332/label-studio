import { useEffect, useState } from "react";
import { Dropdown } from "@humansignal/ui";
import { Menu } from "../components/Menu/Menu";
import { getLang, setLang, SUPPORTED, langLabels, type Lang } from "./index";

/**
 * Top-bar language switcher. Rendered in the Menubar next to the Hotkeys
 * button.
 *
 * Why a native <button> instead of <Button>: Dropdown.Trigger injects its
 * click handler via cloneElement(children, { onClickCapture, ref }). A real
 * DOM element forwards that prop, but the <Button> React component does not,
 * so the menu never opened. The native button is sized/styled inline to match
 * the ThemeToggle pill (32px tall, radius 24, neutral palette, hover state).
 *
 * Font size: driven by CSS on <html lang="..."> (set in applyLang), not React
 * state — so switching language never causes a font-size flicker. English
 * glyphs are visually smaller, so en gets +1px (14) vs zh (13) via CSS.
 */
const SWITCHER_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "center",
  height: 32,
  padding: "0 12px",
  margin: "0 var(--spacing-base) 0 0",
  borderRadius: 24,
  border: "1px solid var(--color-neutral-border)",
  background: "var(--color-neutral-background)",
  color: "var(--color-neutral-content)",
  cursor: "pointer",
  fontSize: 13,
  transition: "border-color 150ms ease-out, background 150ms ease-out",
};

export const LanguageSwitcher = () => {
  const [lang, setLangState] = useState<Lang>(getLang());

  // Keep local state in sync after reload (applyLang sets <html lang>).
  useEffect(() => {
    setLangState(getLang());
  }, []);

  const select = (next: Lang) => {
    setLangState(next);
    setLang(next); // reloads; applyLang sets <html lang> for CSS
  };

  return (
    <>
      <style>{`
        html[lang="en"] .ls-lang-btn { font-size: 14px !important; }
        html[lang="zh-CN"] .ls-lang-btn { font-size: 13px !important; }
        html[lang="en"] .ls-lang-menu-item { font-size: 14px !important; }
        html[lang="zh-CN"] .ls-lang-menu-item { font-size: 13px !important; }
      `}</style>
      <Dropdown.Trigger
        align="right"
        content={
          <Menu size="small">
            {SUPPORTED.map((l) => (
              <Menu.Item
                key={l}
                label={(l === lang ? "✓ " : "") + langLabels[l]}
                onClick={() => select(l)}
                className="ls-lang-menu-item"
              />
            ))}
          </Menu>
        }
      >
        <button
          type="button"
          title="Language"
          data-testid="language-switcher"
          className="ls-lang-btn"
          style={SWITCHER_STYLE}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-neutral-border-bold)";
            e.currentTarget.style.background = "var(--color-neutral-surface)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--color-neutral-border)";
            e.currentTarget.style.background = "var(--color-neutral-background)";
          }}
        >
          {langLabels[lang]}
        </button>
      </Dropdown.Trigger>
    </>
  );
};
