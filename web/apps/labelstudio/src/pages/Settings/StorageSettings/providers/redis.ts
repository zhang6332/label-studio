import { t } from "../../../../i18n";
import { z } from "zod";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconCloudProviderRedis } from "@humansignal/icons";

export const redisProvider: ProviderConfig = {
  name: "redis",
  title: t("Redis Storage"),
  description: t("Configure your Redis storage connection with all required Label Studio settings"),
  icon: IconCloudProviderRedis,
  fields: [
    {
      name: "db",
      type: "text",
      label: t("Database Number (db)"),
      placeholder: "1",
      schema: z.string().default("1"),
    },
    {
      name: "password",
      type: "password",
      label: t("Password"),
      autoComplete: "new-password",
      placeholder: "Your redis password",
      schema: z.string().optional().default(""),
    },
    {
      name: "host",
      type: "text",
      label: t("Host"),
      required: true,
      placeholder: "redis://example.com",
      schema: z.string().min(1, "Host is required"),
    },
    {
      name: "port",
      type: "text",
      label: t("Port"),
      placeholder: "6379",
      schema: z.string().default("6379"),
    },
    {
      name: "prefix",
      type: "text",
      label: t("Bucket prefix"),
      placeholder: "path/to/files",
      schema: z.string().optional().default(""),
      target: "export",
    },
  ],
  layout: [{ fields: ["host", "port", "db", "password"] }, { fields: ["prefix"] }],
};

export default redisProvider;
