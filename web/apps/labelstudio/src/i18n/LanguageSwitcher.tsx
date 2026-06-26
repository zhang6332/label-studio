import { useState } from "react";
import { Button, Dropdown } from "@humansignal/ui";
import { Menu } from "../components/Menu/Menu";
import { getLang, setLang, SUPPORTED, langLabels, type Lang } from "./index";

/**
 * Top-bar language switcher. Rendered in the Menubar next to the Hotkeys
 * button, using the same Button (outlined / neutral / small) + Dropdown.Trigger
 * + Menu styling as the Hotkeys and Account buttons so it matches the toolbar.
 * On change it persists the choice and reloads so the whole app re-renders in
 * the new language (see i18n/index.ts).
 */
export const LanguageSwitcher = () => {
  const [lang, setLangState] = useState<Lang>(getLang());

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
            <Menu.Item
              key={l}
              label={(l === lang ? "✓ " : "") + langLabels[l]}
              onClick={() => select(l)}
            />
          ))}
        </Menu>
      }
    >
      <Button
        variant="neutral"
        look="outlined"
        size="small"
        tooltip="Language"
        data-testid="language-switcher"
      >
        {langLabels[lang]}
      </Button>
    </Dropdown.Trigger>
  );
};
