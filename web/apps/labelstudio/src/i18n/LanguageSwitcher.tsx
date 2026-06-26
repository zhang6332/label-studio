import { useState } from "react";
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
 */
export const LanguageSwitcher = () => {
  const [lang, setLangState] = useState<Lang>(getLang());
  const [hover, setHover] = useState(false);

  const select = (next: Lang) => {
    setLangState(next);
    setLang(next);
  };

  return (
    <Dropdown.Trigger
      align="right"
      content={
        <Menu>
          {SUPPORTED.map((l) => (
            <Menu.Item key={l} label={(l === lang ? "✓ " : "") + langLabels[l]} onClick={() => select(l)} />
          ))}
        </Menu>
      }
    >
      <button
        type="button"
        title="Language"
        data-testid="language-switcher"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          alignSelf: "center",
          height: 32,
          padding: "0 12px",
          borderRadius: 24,
          border: `1px solid ${hover ? "var(--color-neutral-border-bold)" : "var(--color-neutral-border)"}`,
          background: hover ? "var(--color-neutral-surface)" : "var(--color-neutral-background)",
          color: "var(--color-neutral-content)",
          cursor: "pointer",
          fontSize: "var(--font-size-16, 14px)",
          transition: "all 150ms ease-out",
        }}
      >
        {langLabels[lang]}
      </button>
    </Dropdown.Trigger>
  );
};
