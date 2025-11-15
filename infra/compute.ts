/// <reference path="../.sst/platform/config.d.ts" />

import { bucket } from "./storage";

export const uploadRequestFunction = new sst.aws.Function("UploadRequestFunction", {
  handler: "./apps/functions/src/handlers/etl/index.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "512 MB",
  link: [bucket],
  environment: {
    SST_STAGE: $app.stage,
  },
});

