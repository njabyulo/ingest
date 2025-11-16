// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { bucket, filesTable } from "./storage";

export const uploadRequestFunction = new sst.aws.Function("UploadRequestFunction", {
  handler: "./apps/functions/src/handlers/etl/index.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "512 MB",
  link: [bucket, filesTable],
  environment: {
    SST_STAGE: $app.stage,
  },
});

