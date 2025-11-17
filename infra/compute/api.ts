// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../.sst/platform/config.d.ts" />

import * as Storage from "../storage";

export const uploadRequestFunction = new sst.aws.Function("UploadRequestFunction", {
  handler: "./apps/functions/src/handlers/api/files.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "512 MB",
  link: [Storage.S3.bucket, Storage.Dynamo.filesTable],
  environment: {
    SST_STAGE: $app.stage,
  },
});

