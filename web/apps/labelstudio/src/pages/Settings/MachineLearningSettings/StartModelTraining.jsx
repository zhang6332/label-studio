import { t } from "../../../i18n";
import { useCallback, useState } from "react";
import { Button } from "@humansignal/ui";
import { useAPI } from "../../../providers/ApiProvider";
import { Typography } from "@humansignal/ui";

export const StartModelTraining = ({ backend }) => {
  const api = useAPI();
  const [response, setResponse] = useState(null);

  const onStartTraining = useCallback(
    async (backend) => {
      const res = await api.callApi("trainMLBackend", {
        params: {
          pk: backend.id,
        },
      });

      setResponse(res.response || {});
    },
    [api],
  );

  return (
    <div className="max-w-[680px]">
      <Typography size="small" className="text-neutral-content-subtler">
        You're about to manually trigger your model's training process. This action will start the learning phase based
        on how train method is implemented in the ML Backend. Proceed to begin this process.
      </Typography>
      <Typography size="small" className="text-neutral-content-subtler mt-base mb-wide">
        *Note: Currently, there is no built-in feedback loop within this interface for tracking the training progress.
        You'll need to monitor the model's training steps directly through the model's own tools and environment.
      </Typography>

      {!response && (
        <Button
          onClick={() => {
            onStartTraining(backend);
          }}
        >
          {t("Start Training")}
        </Button>
      )}

      {!!response && (
        <>
          <pre>{t("Request Sent!")}</pre>
          <pre>{t("Response:")} {JSON.stringify(response, null, 2)}</pre>
        </>
      )}
    </div>
  );
};
