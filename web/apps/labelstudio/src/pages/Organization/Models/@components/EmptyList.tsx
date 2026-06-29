import { t } from "../../../../i18n";
import { Button } from "@humansignal/ui";
import { cn } from "apps/labelstudio/src/utils/bem";
import type { FC } from "react";
import "./EmptyList.scss";
import { HeidiAi } from "apps/labelstudio/src/assets/images";

export const EmptyList: FC = () => {
  return (
    <div className={cn("empty-models-list").toClassName()}>
      <div className={cn("empty-models-list").elem("content").toClassName()}>
        <div className={cn("empty-models-list").elem("heidy").toClassName()}>
          <HeidiAi />
        </div>
        <div className={cn("empty-models-list").elem("title").toClassName()}>{t("Create a Model")}</div>
        <div className={cn("empty-models-list").elem("caption").toClassName()}>
          {t("Build a high quality model to auto-label your data using LLMs")}
        </div>
        <Button aria-label={t("Create new model")}>{t("Create a Model")}</Button>
      </div>
    </div>
  );
};
