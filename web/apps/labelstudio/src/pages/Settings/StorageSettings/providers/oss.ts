import { z } from "zod";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconCloudCustom } from "@humansignal/ui";

export const ossProvider: ProviderConfig = {
  name: "oss",
  title: "Aliyun OSS",
  description:
    "Configure your Aliyun Object Storage Service (OSS) connection. OSS is S3-compatible, so credentials map to the standard access key pair.",
  icon: IconCloudCustom,
  fields: [
    {
      name: "bucket",
      type: "text",
      label: "Bucket Name",
      required: true,
      placeholder: "my-oss-bucket",
      schema: z.string().min(1, "Bucket name is required"),
    },
    {
      name: "region_name",
      type: "text",
      label: "Region",
      placeholder: "oss-cn-hangzhou",
      schema: z.string().optional().default(""),
    },
    {
      name: "s3_endpoint",
      type: "text",
      label: "Endpoint",
      required: true,
      placeholder: "https://oss-cn-hangzhou.aliyuncs.com",
      schema: z.string().min(1, "Endpoint is required"),
    },
    {
      name: "prefix",
      type: "text",
      label: "Bucket prefix",
      placeholder: "path/to/files",
      schema: z.string().optional().default(""),
      target: "export",
    },
    {
      name: "aws_access_key_id",
      type: "password",
      label: "Access Key ID",
      required: true,
      placeholder: "AccessKey ID",
      autoComplete: "off",
      accessKey: true,
      schema: z.string().min(1, "Access Key ID is required"),
    },
    {
      name: "aws_secret_access_key",
      type: "password",
      label: "Access Key Secret",
      required: true,
      placeholder: "AccessKey Secret",
      autoComplete: "new-password",
      accessKey: true,
      schema: z.string().min(1, "Access Key Secret is required"),
    },
    {
      name: "presign",
      type: "toggle",
      label: "Use pre-signed URLs (On) / Proxy through the platform (Off)",
      description:
        "When pre-signed URLs are enabled, all data bypasses the platform and user browsers directly read data from storage",
      schema: z.boolean().default(true),
      target: "import",
      resetConnection: false,
    },
    {
      name: "presign_ttl",
      type: "counter",
      label: "Expire pre-signed URLs (minutes)",
      min: 1,
      max: 10080,
      step: 1,
      schema: z.number().min(1).max(10080).default(15),
      target: "import",
      resetConnection: false,
      dependsOn: {
        field: "presign",
        value: true,
      },
    },
  ],
  layout: [
    { fields: ["bucket"] },
    { fields: ["region_name"] },
    { fields: ["s3_endpoint"] },
    { fields: ["prefix"] },
    { fields: ["aws_access_key_id"] },
    { fields: ["aws_secret_access_key"] },
    { fields: ["presign", "presign_ttl"] },
  ],
};
