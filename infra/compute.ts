// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { bucket, filesTable } from "./storage";

export const uploadRequestFunction = new sst.aws.Function("UploadRequestFunction", {
  handler: "./apps/functions/src/handlers/api/index.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "512 MB",
  link: [bucket, filesTable],
  environment: {
    SST_STAGE: $app.stage,
  },
});

export const s3EventHandlerFunction = new sst.aws.Function("S3EventHandlerFunction", {
  handler: "./apps/functions/src/handlers/file-upload-events/index.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "512 MB",
  link: [filesTable],
  environment: {
    SST_STAGE: $app.stage,
  },
});

// Subscribe to S3 PutObject events
bucket.subscribe("s3:ObjectCreated:Put", s3EventHandlerFunction.arn);

