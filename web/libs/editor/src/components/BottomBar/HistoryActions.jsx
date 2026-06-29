import { t } from "@humansignal/core";
import { observer } from "mobx-react";
import { IconRedo, IconReset, IconUndo } from "@humansignal/icons";
import { Tooltip, Button } from "@humansignal/ui";
import { cn } from "../../utils/bem";
import "./HistoryActions.scss";

export const EditingHistory = observer(({ entity }) => {
  const { history } = entity;

  return (
    <div className={cn("history-buttons").toClassName()}>
      <Tooltip title={t("Undo")}>
        <Button
          variant="neutral"
          size="small"
          aria-label={t("Undo")}
          look="string"
          disabled={!history?.canUndo}
          onClick={() => entity.undo()}
          className="aspect-square"
          leading={<IconUndo />}
          data-testid="bottombar-undo-button"
        />
      </Tooltip>
      <Tooltip title={t("Redo")}>
        <Button
          variant="neutral"
          size="small"
          look="string"
          aria-label={t("Redo")}
          disabled={!history?.canRedo}
          onClick={() => entity.redo()}
          className="aspect-square"
          leading={<IconRedo />}
          data-testid="bottombar-redo-button"
        />
      </Tooltip>
      <Tooltip title={t("Reset")}>
        <Button
          variant="negative"
          look="string"
          size="small"
          aria-label={t("Reset")}
          disabled={!history?.canUndo}
          onClick={() => history?.reset()}
          className="aspect-square"
          leading={<IconReset />}
          data-testid="bottombar-reset-button"
        />
      </Tooltip>
    </div>
  );
});
